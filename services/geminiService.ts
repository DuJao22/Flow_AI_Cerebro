import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { keyManager } from './keyManager';
import { brainService } from './brainService';

/**
 * Lista de modelos Gemini válidos suportados em ordem de preferência
 */
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

/**
 * Valida uma chave de API fazendo uma requisição mínima
 */
export const validateGeminiKey = async (rawApiKey: string): Promise<{ valid: boolean; error?: string }> => {
  const apiKey = rawApiKey.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();
  if (!apiKey || apiKey.length < 15) {
    return { valid: false, error: 'Chave muito curta ou vazia' };
  }

  let lastErrorMsg = 'Erro desconhecido ao conectar com o Google Gemini';

  for (const model of GEMINI_MODELS) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      await ai.models.generateContent({
        model: model,
        contents: { role: 'user', parts: [{ text: 'Ping' }] },
        config: { 
          maxOutputTokens: 1,
        }
      });

      return { valid: true };
    } catch (error: any) {
      console.warn(`Key Validation check (${model}):`, error);
      
      if (error.status === 400 || error.message?.includes('API_KEY_INVALID')) {
        return { valid: false, error: 'Chave Inexistente ou Malformada' };
      }
      
      if (error.status === 403 || error.message?.includes('403')) {
        lastErrorMsg = 'Chave Inválida, Expirada ou Restrita (403)';
      } else if (error.message?.includes('quota') || error.status === 429) {
        lastErrorMsg = 'Quota Excedida para este modelo. Tentando modelos alternativos...';
      } else {
        lastErrorMsg = error.message?.substring(0, 80) || 'Falha ao conectar com o Google Gemini';
      }
    }
  }

  return { valid: false, error: lastErrorMsg };
};

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  const statusInfo = JSON.parse(keyManager.getStatus());
  const maxRetries = Math.max(statusInfo.total * 2, 3); 
  
  let lastError = "";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const activeKey = keyManager.getActiveKey();
    
    if (!activeKey) {
        return { 
          text: "❌ **Erro Crítico**: Nenhuma chave de API funcional encontrada no pool. Por favor, clique na engrenagem (Configurações API) no topo do app e insira sua chave do Google AI Studio.", 
          flowData: undefined 
        };
    }

    // Tenta cada modelo disponível em sequência se o primeiro falhar
    for (const modelName of GEMINI_MODELS) {
      try {
        const ai = new GoogleGenAI({ apiKey: activeKey });
        
        const brainContext = brainService.getFormattedContext();
        let finalPromptParts: any[] = [
          { text: SYSTEM_PROMPT },
          { text: `\n=== CÉREBRO DE APRENDIZADO (CONHECIMENTO ACUMULADO) ===\n${brainContext}\n==============================================` }
        ];

        if (context) {
            const recentLogs = context.logs.slice(-5).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
            const contextString = `\nCONTEXTO ATUAL:\nNodes: ${context.currentNodes.length}\nLogs Recentes:\n${recentLogs}`;
            finalPromptParts.push({ text: contextString });
        }

        finalPromptParts.push({ text: `SOLICITAÇÃO DO USUÁRIO: ${userPrompt}` });

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: finalPromptParts }],
            config: { 
                temperature: 0.2,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || "";
        let flowData: FlowSchema | undefined;

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : text;
            const parsed = JSON.parse(jsonString);
            if (parsed.nodes) flowData = parsed as FlowSchema;
        } catch (e) {
            console.warn("[IA] Falha ao parsear JSON, enviando texto puro.");
        }

        return { 
          text: flowData ? `✨ Fluxo gerado com sucesso (Chave #${keyManager.getCurrentIndex() + 1})` : text, 
          flowData 
        };

      } catch (error: any) {
        const errorMsg = error.message || "";
        const isForbidden = error.status === 403 || errorMsg.includes('403') || errorMsg.includes('API_KEY_INVALID');
        const isQuota = error.status === 429 || errorMsg.includes('429') || errorMsg.includes('quota');
        const isLeaked = errorMsg.toLowerCase().includes('leaked');

        console.error(`[IA Attempt ${attempt + 1} | ${modelName}] Falha na Chave #${keyManager.getCurrentIndex() + 1}: ${errorMsg}`);
        lastError = errorMsg;

        if (isForbidden || isQuota || isLeaked) {
            const reason = isQuota 
              ? `⚠️ Limite de Tokens/Cota Excedido na Chave #${keyManager.getCurrentIndex() + 1} (Erro 429). Alternando para a próxima chave...`
              : isLeaked 
                ? `🚨 Chave #${keyManager.getCurrentIndex() + 1} bloqueada por vazamento de segurança.`
                : `❌ Chave #${keyManager.getCurrentIndex() + 1} inválida ou restrita (Erro 403).`;
            keyManager.markCurrentKeyAsFailed(reason);
            break; // Sai do loop de modelos e tenta a próxima chave
        }
      }
    }
  }
  
  // Mensagem final mais descritiva
  let userHelp = "";
  if (lastError.toLowerCase().includes('leaked')) {
      userHelp = "\n\n🚨 **ALERTA DE SEGURANÇA:**\nSua chave de API foi detectada como VAZADA publicamente e bloqueada pelo Google. Você DEVE gerar uma nova chave no Google AI Studio imediatamente.";
  } else if (lastError.includes('403')) {
      userHelp = "\n\n💡 **Dica para Deploy (Vercel/Netlify):**\nO erro 403 geralmente significa que suas chaves no Google Cloud têm restrição de domínio (Referrer). Adicione o domínio do seu site hospedado nas configurações da chave ou remova as restrições de site.";
  }

  return { 
    text: `❌ **Falha Total no Pool de Chaves**\n\nTodas as ${statusInfo.total} chaves retornaram erro. A última falha foi: ${lastError}${userHelp}`, 
    flowData: undefined 
  };
};