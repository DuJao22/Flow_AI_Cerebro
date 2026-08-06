import { FlowNode, FlowEdge, NodeType, NodeStatus, LogEntry, ExecutionContext, GeneratedFile } from '../types';
import { keyManager } from './keyManager';
import { brainService } from './brainService';
import { GoogleGenAI } from '@google/genai';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createLog = (nodeId: string, label: string, level: LogEntry['level'], message: string): LogEntry => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toISOString(),
  nodeId,
  nodeLabel: label,
  level,
  message
});

export class FlowEngine {
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private setNodes: (nodes: FlowNode[] | ((nodes: FlowNode[]) => FlowNode[])) => void;
  private addLog: (log: LogEntry) => void;
  private onFileGenerated?: (file: GeneratedFile) => void;
  private context: ExecutionContext = {};

  constructor(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    setNodes: any, 
    addLog: any,
    onFileGenerated?: (file: GeneratedFile) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.setNodes = setNodes;
    this.addLog = addLog;
    this.onFileGenerated = onFileGenerated;
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus) {
    this.setNodes((nds: FlowNode[]) => 
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)
    );
  }

  private async fetchWithRetry(url: string, options: any, nodeId: string, label: string): Promise<any> {
    let attempts = 0;
    const totalKeys = JSON.parse(keyManager.getStatus()).total;
    // Se tivermos chaves no pool, tentamos rodar o pool inteiro. Se não, tentamos 3 vezes padrão.
    const maxRetries = totalKeys > 0 ? totalKeys + 1 : 3;

    while (attempts < maxRetries) {
        const activeKey = keyManager.getActiveKey();
        let finalUrl = url;

        // Injeta a chave na URL se for Google API
        if (url.includes('googleapis.com') && activeKey) {
            // Remove chave antiga se existir para não duplicar
            const urlObj = new URL(url);
            urlObj.searchParams.set('key', activeKey);
            finalUrl = urlObj.toString();
        }

        try {
            const response = await fetch(finalUrl, options);
            const status = response.status;

            if (response.ok) {
                return await response.json();
            }

            // LÊ O ERRO UMA ÚNICA VEZ PARA EVITAR "STREAM ALREADY READ"
            const errorText = await response.text();

            // TRATAMENTO DE ERROS DE CHAVE (403: Referrer/Forbidden/Leaked, 400: Invalid, 429: Quota)
            if (status === 403 || status === 400 || status === 429) {
                const isLeaked = errorText.toLowerCase().includes('leaked');
                let logMsg = `🔄 Chave #${keyManager.getCurrentIndex() + 1} falhou (${status}). Rotacionando...`;
                
                if (isLeaked) {
                    logMsg = `🚫 Chave #${keyManager.getCurrentIndex() + 1} identificada como VAZADA. Removendo do pool...`;
                }

                console.warn(`[FlowEngine] ${logMsg}`, errorText.substring(0, 100));
                
                // Tenta rotacionar a chave
                if (keyManager.markCurrentKeyAsFailed()) {
                    this.addLog(createLog(nodeId, label, 'WARN', logMsg));
                    attempts++;
                    await wait(200);
                    continue; // Tenta com a próxima chave
                }
            }

            // Se não for erro de chave ou se acabaram as chaves, lança o erro final
            throw new Error(`Erro API (${status}): ${errorText.substring(0, 300)}`);

        } catch (err: any) {
            // Se for erro de rede (fetch failed) ou se as tentativas acabaram
            if (attempts >= maxRetries - 1) throw err;
            attempts++;
            await wait(500);
        }
    }
  }

  private resolvePath(path: string): any {
      const normalizedPath = path.trim().replace(/\[(\w+)\]/g, '.$1');
      const keys = normalizedPath.split('.').filter(Boolean);
      let current: any = this.context;
      
      if (keys[0] === 'input') {
          current = this.context['input'];
          keys.shift();
          
          // Helper for Gemini responses
          if (keys.length === 1 && (keys[0] === 'text' || keys[0] === 'gemini_text')) {
              if (current?.candidates?.[0]?.content?.parts?.[0]?.text) {
                  let text = current.candidates[0].content.parts[0].text;
                  // Remove markdown code blocks if present (e.g., ```html ... ```)
                  const match = text.match(/```[\w]*\n([\s\S]*?)\n```/);
                  if (match) {
                      text = match[1];
                  }
                  return text;
              }
          }
      }
      
      for (const key of keys) {
          if (current === undefined || current === null) return undefined;
          current = current[key];
      }
      return current;
  }

  private interpolate(value: any): any {
    if (typeof value === 'string') {
      const exactMatch = value.match(/^\{\{([^}]+)\}\}$/);
      if (exactMatch) {
          const resolved = this.resolvePath(exactMatch[1]);
          return resolved !== undefined ? resolved : value;
      }

      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const resolved = this.resolvePath(path);
        if (resolved === undefined || resolved === null) return '';
        return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
      });
    }
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(v => this.interpolate(v));
      }
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.interpolate(v);
      }
      return result;
    }
    
    return value;
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) type = node.type as NodeType;
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);

    try {
        await wait(100);

        switch (type) {
          case NodeType.START:
              this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Execução iniciada.`));
              break;

          case NodeType.HTTP_REQUEST:
            let url = this.interpolate(config?.url);
            if (!url) throw new Error("URL não definida no nó.");

            const method = (config?.method || 'GET').toUpperCase();
            
            let rawBody = config?.body;
            let parsedBody: any = undefined;
            if (rawBody) {
                if (typeof rawBody === 'string') {
                    try {
                        parsedBody = JSON.parse(rawBody);
                    } catch (e) {
                        parsedBody = rawBody;
                    }
                } else {
                    parsedBody = rawBody;
                }
            }
            
            const body = this.interpolate(parsedBody);
            
            let headers: any = { 'Content-Type': 'application/json' };
            if (config?.headers) {
                let parsedHeaders = config.headers;
                if (typeof parsedHeaders === 'string') {
                    try { parsedHeaders = JSON.parse(parsedHeaders); } catch(e) {}
                }
                if (typeof parsedHeaders === 'object') {
                    headers = { ...headers, ...this.interpolate(parsedHeaders) };
                }
            }
            
            const responseData = await this.fetchWithRetry(url, { 
                method, 
                headers, 
                body: method !== 'GET' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined 
            }, node.id, label);
            
            this.context[node.id] = responseData;
            this.context['input'] = responseData; 
            this.addLog(createLog(node.id, label, 'SUCCESS', `📦 Requisição concluída.`));
            
            if (responseData && typeof responseData === 'object' && responseData.url) {
                this.addLog(createLog(node.id, label, 'SUCCESS', `🔗 URL Retornada: ${responseData.url}`));
            }
            break;

          case NodeType.IF_CONDITION:
            const condition = config?.condition || 'true';
            const input = this.context['input'] || {};
            // Cria um sandbox simples para a condição
            const check = new Function('input', `try { return ${condition}; } catch(e) { return false; }`);
            const result = !!check(input);
            this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ Condição resultou em: ${result.toString().toUpperCase()}`));
            this.context[node.id] = result;
            break;

          case NodeType.FILE_SAVE:
            const fileName = config?.fileName || `output-${Date.now()}.txt`;
            let rawInputContent = this.context['input'];
            
            // Helper function to extract clean HTML / string from potential JSON / Markdown wrappers
            const extractCleanContent = (data: any): string => {
              if (data === null || data === undefined) return '';

              let extracted = data;

              // If data is an object, check for known keys
              if (typeof extracted === 'object') {
                if (extracted.html_code) extracted = extracted.html_code;
                else if (extracted.html) extracted = extracted.html;
                else if (extracted.htmlCode) extracted = extracted.htmlCode;
                else if (extracted.code) extracted = extracted.code;
                else if (extracted.content && typeof extracted.content === 'string' && extracted.content.includes('<html')) extracted = extracted.content;
                else if (extracted.candidates?.[0]?.content?.parts?.[0]?.text) {
                  extracted = extracted.candidates[0].content.parts[0].text;
                }
              }

              let str = typeof extracted === 'object' ? JSON.stringify(extracted, null, 2) : String(extracted);

              // Try parsing stringified JSON
              const trimmed = str.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (parsed.html_code) str = parsed.html_code;
                  else if (parsed.html) str = parsed.html;
                  else if (parsed.htmlCode) str = parsed.htmlCode;
                  else if (parsed.code) str = parsed.code;
                } catch (e) {}
              }

              // Extract markdown codeblocks ```html ... ```
              const markdownMatch = str.match(/```(?:html|xml)?\s*([\s\S]*?)\s*```/i);
              if (markdownMatch) {
                str = markdownMatch[1];
              }

              // Unescape literal backslash escapes (\n, \", \\) if present
              if (str.includes('\\n') && !str.includes('\n')) {
                str = str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '  ');
              }

              return str.trim();
            };

            const fileContentStr = extractCleanContent(rawInputContent);
            const isHtmlPage = (config?.fileFormat === 'html' || fileName.endsWith('.html') || fileContentStr.toLowerCase().includes('<!doctype html') || fileContentStr.toLowerCase().includes('<html'));

            if (this.onFileGenerated && fileContentStr) {
              this.onFileGenerated({
                  id: crypto.randomUUID(),
                  name: fileName,
                  content: fileContentStr,
                  extension: config?.fileFormat || (isHtmlPage ? 'html' : 'txt'),
                  timestamp: Date.now(),
                  nodeId: node.id
              });
              this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo gerado: ${fileName}`));

              // Se for uma Landing Page HTML, aciona aprendizado do Cérebro automaticamente!
              if (isHtmlPage) {
                this.addLog(createLog(node.id, label, 'INFO', `🧠 Cérebro analisando Landing Page "${fileName}" para absorver aprendizado...`));
                brainService.learnFromLandingPage(fileName, fileContentStr).then((insight) => {
                  this.addLog(createLog(node.id, label, 'SUCCESS', `💡 Aprendizado Absorvido: "${insight}"`));
                });
              }
            }
            break;

          case NodeType.AI_BRAIN:
            const directive = this.interpolate(config?.directive || 'Analisar dados de entrada, raciocinar segundo as regras do Cérebro e retornar o resultado ideal.');
            const currentInput = this.context['input'] || {};
            const activeKey = await brainService.getEffectiveApiKey();

            if (!activeKey) {
              throw new Error("Nenhuma chave Gemini disponível no pool para o Cérebro de IA.");
            }

            const memories = brainService.getMemories();
            this.addLog(createLog(node.id, label, 'INFO', `🧠 Cérebro consultando ${memories.length} memórias aprendidas...`));

            const ai = new GoogleGenAI({ apiKey: activeKey });
            const memoriesText = brainService.getFormattedContext();

            const promptText = `
Você é o Cérebro de Aprendizado IA responsável por executar esta etapa do fluxo de automação.
REGRAS E MEMÓRIAS ACUMULADAS:
${memoriesText}

DADOS DE ENTRADA DO FLUXO (INPUT):
${typeof currentInput === 'object' ? JSON.stringify(currentInput, null, 2) : String(currentInput)}

SUA DIRETIVA / TAREFA:
${directive}

Forneça uma resposta clara, estruturada e diretamente útil em formato JSON ou texto limpo contendo sua decisão/resultado.
            `;

            const brainResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              config: { temperature: 0.2 }
            });

            const brainText = brainResponse.text || '';
            let parsedBrainResult: any = brainText;

            try {
              const jsonMatch = brainText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedBrainResult = JSON.parse(jsonMatch[0]);
              }
            } catch (e) {
              // Mantém texto puro
            }

            this.context[node.id] = parsedBrainResult;
            this.context['input'] = parsedBrainResult;

            // Aprendizado automático opcional
            if (config?.autoLearn) {
              const learnPrompt = `Analise a execução recente e extraia 1 nova regra ou insight curto para o Cérebro aprender. Se não houver nada novo a aprender, responda APENAS "NADA". Texto: ${brainText}`;
              try {
                const learnRes = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: [{ role: 'user', parts: [{ text: learnPrompt }] }],
                  config: { maxOutputTokens: 60, temperature: 0.1 }
                });
                const newInsight = learnRes.text?.trim() || '';
                if (newInsight && newInsight.toUpperCase() !== 'NADA' && newInsight.length > 10) {
                  brainService.addMemory(newInsight, 'insight', 'medium', 'execution');
                  this.addLog(createLog(node.id, label, 'SUCCESS', `💡 Novo Aprendizado Gravado: "${newInsight}"`));
                }
              } catch (err) {}
            }

            this.addLog(createLog(node.id, label, 'SUCCESS', `🧠 Cérebro concluiu o raciocínio com sucesso.`));
            break;
        }

        this.updateNodeStatus(node.id, NodeStatus.SUCCESS);
        return true;

    } catch (error: any) {
        this.updateNodeStatus(node.id, NodeStatus.ERROR);
        this.addLog(createLog(node.id, label, 'ERROR', `❌ Falha: ${error.message}`));
        return false;
    }
  }

  public async run() {
    this.context = {}; 
    const startNodes = this.nodes.filter(n => n.data.type === NodeType.START);
    const queue: FlowNode[] = startNodes.length > 0 ? startNodes : [this.nodes[0]];

    while (queue.length > 0) {
      const currentNode = queue.shift();
      if (!currentNode) continue;

      const success = await this.executeNode(currentNode);
      if (success) {
        const nextNodes = this.edges
          .filter(e => e.source === currentNode.id)
          .map(e => this.nodes.find(n => n.id === e.target))
          .filter(Boolean) as FlowNode[];
        queue.push(...nextNodes);
      }
    }
    this.addLog(createLog('system', 'Engine', 'INFO', `🏁 Fluxo finalizado.`));
  }
}