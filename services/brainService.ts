export interface BrainMemory {
  id: string;
  category: 'rule' | 'preference' | 'insight' | 'pattern' | 'correction';
  content: string;
  source: 'auto' | 'user' | 'execution';
  createdAt: number;
  importance: 'high' | 'medium' | 'low';
  useCount: number;
}


const STORAGE_KEY = 'flow_architect_brain_memories_v1';
const BRAIN_API_KEY_STORAGE = 'flow_architect_brain_gemini_key';
const DB_NAME = 'FlowArchitectBrainDB';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

// Inicializa IndexedDB no navegador se suportado
let dbInstance: IDBDatabase | null = null;

const initIndexedDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('importance', 'importance', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn("[BrainDB] Erro ao abrir IndexedDB, usando fallback LocalStorage.");
        resolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
};

// Auto-inicializa IndexedDB em background
if (typeof window !== 'undefined') {
  initIndexedDB().then((db) => {
    if (db) {
      // Sincroniza dados do LocalStorage para IndexedDB na primeira execução
      const memories = brainService.getMemories();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      memories.forEach(m => store.put(m));
    }
  });
}

const INITIAL_MEMORIES: BrainMemory[] = [
  {
    id: 'mem-lp-1',
    category: 'rule',
    content: 'Especialidade Landing Pages Ultra: Estrutura obrigatoriamente Hero Section com visual dark luxury, badges animados, títulos de alto impacto, CTA duplo, prova social com métricas, grid de diferenciais, depoimentos em glassmorphism e rodapé institucional.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 5,
    importance: 'high',
    useCount: 35
  },
  {
    id: 'mem-lp-2',
    category: 'pattern',
    content: 'Utilizar Tailwind CSS CDN com suporte a efeitos glassmorphism (backdrop-blur-md), gradientes sofisticados (from-purple-600 via-indigo-600 to-purple-700) e tipografia refinada Google Fonts Plus Jakarta Sans.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 4,
    importance: 'high',
    useCount: 28
  },
  {
    id: 'mem-lp-3',
    category: 'preference',
    content: 'Sintetizador Autônomo Local: Capaz de gerar código HTML5 completo, responsivo e ultra-profissional mesmo sem necessidade de IA externa, compilando blocos semânticos e estilos CSS dinâmicos.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 2,
    importance: 'high',
    useCount: 22
  },
  {
    id: 'mem-1',
    category: 'rule',
    content: 'Sempre sanitizar e extrair respostas JSON mesmo quando contiverem formatação em blocos de código Markdown.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 3,
    importance: 'high',
    useCount: 15
  }
];

export const brainService = {
  // GERENCIAMENTO DA CHAVE API GEMINI DEDICADA DO CÉREBRO
  getDedicatedApiKey: (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(BRAIN_API_KEY_STORAGE) || '';
  },

  setDedicatedApiKey: (key: string): void => {
    if (typeof window === 'undefined') return;
    if (key && key.trim()) {
      localStorage.setItem(BRAIN_API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(BRAIN_API_KEY_STORAGE);
    }
  },

  getEffectiveApiKey: async (): Promise<string> => {
    const dedicated = brainService.getDedicatedApiKey();
    const cleanDedicated = (dedicated || '').replace(/^["']|["']$/g, '').trim();
    if (cleanDedicated && cleanDedicated.length > 15) {
      return cleanDedicated;
    }
    const { keyManager } = await import('./keyManager');
    return keyManager.getActiveKey();
  },

  // LEITURA E GRAVAÇÃO DO BANCO DE DADOS (INDEXEDDB + LOCALSTORAGE)
  getMemories: (): BrainMemory[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MEMORIES));
        return INITIAL_MEMORIES;
      }
      const parsed: BrainMemory[] = JSON.parse(stored);
      // Filtra memórias corrompidas ou com vazamento de texto de instrução/prompt
      const cleaned = parsed.filter(m => 
        m && m.content && 
        !m.content.toUpperCase().includes('TEXT:REQUISITOS') &&
        !m.content.toUpperCase().includes('REQUISITOS OBRIGATORIOS DE RESPONSIVIDADE')
      );
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned.length > 0 ? cleaned : INITIAL_MEMORIES;
    } catch (e) {
      console.error("Erro ao ler memórias do Cérebro:", e);
      return INITIAL_MEMORIES;
    }
  },

  saveMemoriesToDB: (memories: BrainMemory[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      initIndexedDB().then(db => {
        if (!db) return;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        memories.forEach(m => store.put(m));
      });
    } catch (e) {
      console.error("[BrainDB] Erro ao salvar banco:", e);
    }
  },

  addMemory: (
    content: string, 
    category: BrainMemory['category'] = 'insight', 
    importance: BrainMemory['importance'] = 'medium',
    source: BrainMemory['source'] = 'user'
  ): BrainMemory => {
    const memories = brainService.getMemories();
    
    // Evita duplicatas exatas
    const existing = memories.find(m => m.content.toLowerCase().trim() === content.toLowerCase().trim());
    if (existing) {
      existing.useCount += 1;
      brainService.saveMemoriesToDB(memories);
      return existing;
    }

    const newMemory: BrainMemory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category,
      content,
      source,
      createdAt: Date.now(),
      importance,
      useCount: 1
    };

    const updated = [newMemory, ...memories];
    brainService.saveMemoriesToDB(updated);
    return newMemory;
  },

  removeMemory: (id: string): void => {
    const memories = brainService.getMemories();
    const filtered = memories.filter(m => m.id !== id);
    brainService.saveMemoriesToDB(filtered);
  },

  updateMemory: (id: string, newContent: string, importance?: BrainMemory['importance']): void => {
    const memories = brainService.getMemories();
    const index = memories.findIndex(m => m.id === id);
    if (index !== -1) {
      memories[index].content = newContent;
      if (importance) memories[index].importance = importance;
      brainService.saveMemoriesToDB(memories);
    }
  },

  clearMemories: (): void => {
    brainService.saveMemoriesToDB([]);
  },

  resetToDefaults: (): void => {
    brainService.saveMemoriesToDB(INITIAL_MEMORIES);
  },

  getFormattedContext: (): string => {
    const memories = brainService.getMemories().filter(m => 
      m && m.content && 
      !m.content.toUpperCase().includes('TEXT:REQUISITOS') &&
      !m.content.toUpperCase().includes('REQUISITOS OBRIGATORIOS DE RESPONSIVIDADE')
    );
    if (memories.length === 0) return "Nenhum aprendizado prévio registrado.";

    return memories.map((m, idx) => 
      `${idx + 1}. [${m.category.toUpperCase()} | Importância: ${m.importance.toUpperCase()}] ${m.content}`
    ).join('\n');
  },

  // IMPORTAÇÃO E EXPORTAÇÃO COMPLETA DO BANCO DE DADOS (DB BACKUP & MEMÓRIAS JSON)
  exportDatabase: (): string => {
    const memories = brainService.getMemories();
    const dbData = {
      version: 1,
      appName: 'Flow Architect AI - Cérebro IA',
      type: 'brain_memory_export',
      exportedAt: new Date().toISOString(),
      totalMemories: memories.length,
      memories: memories
    };
    return JSON.stringify(dbData, null, 2);
  },

  importDatabase: (jsonText: string, merge: boolean = true): { success: boolean; count: number; message: string } => {
    try {
      const parsed = JSON.parse(jsonText);
      let rawList: any[] | null = null;

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawList = parsed.memories || parsed.brainMemories || parsed.data || parsed.items || null;
      }

      if (!rawList || !Array.isArray(rawList)) {
        return { 
          success: false, 
          count: 0, 
          message: "Formato de arquivo JSON inválido. Esperado um arquivo de memória com a lista 'memories'." 
        };
      }

      // Valida e sanitiza cada item importado
      const validMemories: BrainMemory[] = rawList.map((m: any, idx: number) => {
        return {
          id: m.id || `mem-imp-${Date.now()}-${idx}`,
          category: ['rule', 'preference', 'insight', 'pattern', 'correction'].includes(m.category) ? m.category : 'insight',
          content: String(m.content || m.text || '').trim(),
          source: ['auto', 'user', 'execution'].includes(m.source) ? m.source : 'user',
          createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
          importance: ['high', 'medium', 'low'].includes(m.importance) ? m.importance : 'medium',
          useCount: typeof m.useCount === 'number' ? m.useCount : 1
        };
      }).filter(m => m.content.length > 0);

      if (validMemories.length === 0) {
        return { success: false, count: 0, message: "Nenhuma memória válida encontrada no arquivo JSON." };
      }

      if (merge) {
        const existingMemories = brainService.getMemories();
        const existingMap = new Map(existingMemories.map(m => [m.content.toLowerCase().trim(), m]));

        let addedCount = 0;
        validMemories.forEach(incoming => {
          const key = incoming.content.toLowerCase().trim();
          if (existingMap.has(key)) {
            const item = existingMap.get(key)!;
            item.useCount += 1;
          } else {
            existingMap.set(key, incoming);
            addedCount++;
          }
        });

        const mergedList = Array.from(existingMap.values());
        brainService.saveMemoriesToDB(mergedList);
        return {
          success: true,
          count: validMemories.length,
          message: `Memória importada com sucesso! ${addedCount} novos aprendizados adicionados, ${validMemories.length - addedCount} atualizados.`
        };
      } else {
        brainService.saveMemoriesToDB(validMemories);
        return { 
          success: true, 
          count: validMemories.length, 
          message: `Banco de memórias substituído com sucesso! ${validMemories.length} aprendizados carregados.` 
        };
      }
    } catch (err: any) {
      return { success: false, count: 0, message: `Erro ao processar arquivo JSON: ${err.message || 'Sintaxe JSON inválida'}` };
    }
  },

  // SALVAR E APRENDER ESTRUTURA DE CÓDIGO HTML COM FEEDBACK DO USUÁRIO
  saveCodeStructurePattern: async (
    fileName: string, 
    htmlContent: string, 
    rating: number = 5, 
    feedback?: string
  ): Promise<string> => {
    try {
      const cleanHtml = htmlContent.trim();
      const hasTailwind = cleanHtml.includes('tailwindcss') || cleanHtml.includes('cdn.tailwindcss.com');
      const hasHero = /hero|banner|welcome|header/i.test(cleanHtml);
      const hasGlass = /backdrop-blur|glassmorphism|bg-white\/10|bg-black\/40/i.test(cleanHtml);
      const hasAnim = /animate-|transition-|hover:/i.test(cleanHtml);

      // Extrai trecho estrutural representativo
      const structuralSnippet = cleanHtml.substring(0, 1500).replace(/\s+/g, ' ');

      const patternMemory = `[ESTRUTURA DE CÓDIGO APROVADA - "${fileName}"] 
Nota: ${rating}/5★ ${feedback ? `| Feedback: "${feedback}"` : ''}
Atributos Técnicos: ${hasHero ? 'Hero Section' : 'Layout Custom'} | ${hasGlass ? 'Efeitos Glassmorphism' : 'Clean UI'} | ${hasAnim ? 'Animações CSS/Tailwind' : 'Estático'} | ${hasTailwind ? 'Tailwind CSS' : 'Custom CSS'}
Blueprint Estrutural: ${structuralSnippet}`;

      // Grava no banco de memórias do Cérebro
      brainService.addMemory(
        patternMemory,
        'pattern',
        'high',
        'user'
      );

      return `Estrutura de código HTML de "${fileName}" e feedback (${rating}/5★) gravados no Cérebro IA com sucesso!`;
    } catch (e: any) {
      console.error("Erro ao salvar estrutura no Cérebro:", e);
      return `Erro ao salvar estrutura: ${e.message}`;
    }
  },

  learnFromLandingPage: async (fileName: string, htmlContent: string): Promise<string> => {
    try {
      // 1. Analisa a estrutura do HTML diretamente por regex/parsing
      const hasTailwind = htmlContent.includes('tailwindcss') || htmlContent.includes('cdn.tailwindcss.com') || htmlContent.includes('class=');
      const hasHero = /hero|banner|welcome|header/i.test(htmlContent);
      const hasCTA = /cta|button|entrar|cadastr|comprar|saiba mais/i.test(htmlContent);
      const hasDarkTheme = /bg-gray-900|bg-black|bg-slate-900|#000|#050505/i.test(htmlContent);

      const structuralSummary = `Página "${fileName}" [HTML5]: ${hasHero ? 'Hero Section' : 'Layout Standard'} | ${hasCTA ? 'Botões CTA de Conversão' : 'Sem CTA'} | ${hasTailwind ? 'Tailwind CSS Styling' : 'Custom CSS'} | Tema: ${hasDarkTheme ? 'Dark Luxury' : 'Light/Modern'}.`;

      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = await brainService.getEffectiveApiKey();

      let aiInsight = '';

      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analise a estrutura deste código HTML de Landing Page ("${fileName}") e extraia 1 REGRA OU INSIGHT DE DESIGN/CONVERSÃO de alto padrão para o Cérebro de IA memorizar para as próximas páginas.
Responda em APENAS 1 frase direta e prática.

CÓDIGO (Trecho):
${htmlContent.substring(0, 3000)}`;

        const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: { maxOutputTokens: 120, temperature: 0.2 }
            });
            const text = response.text?.trim();
            if (text && text.length > 10) {
              aiInsight = text;
              break;
            }
          } catch (err) {
            console.warn(`[Brain AI] Model ${modelName} fallback for page analysis:`, err);
          }
        }
      }

      const finalMemoryText = aiInsight
        ? `[Estrutura & Aprendizado IA - "${fileName}"]: ${aiInsight} (${structuralSummary})`
        : `[Estrutura Absorvida - "${fileName}"]: ${structuralSummary}`;

      // Grava no banco do Cérebro
      brainService.addMemory(
        finalMemoryText,
        'pattern',
        'high',
        'execution'
      );

      return aiInsight || structuralSummary;
    } catch (e: any) {
      console.error("Erro ao aprender com a Landing Page:", e);
      const fallbackMsg = `Estrutura de "${fileName}" gravada com sucesso no Cérebro.`;
      brainService.addMemory(fallbackMsg, 'pattern', 'medium', 'execution');
      return fallbackMsg;
    }
  },

  // SINTETIZADOR AUTÔNOMO DE LANDING PAGE LOCAL (SEM DEPENDÊNCIA DE IA EXTERNA)
  synthesizeOfflineLandingPage: (
    directive: string, 
    inputData?: any,
    options?: {
      name?: string;
      desc?: string;
      benefit?: string;
      target?: string;
      style?: 'dark' | 'clean' | 'cyberpunk' | 'warm';
    }
  ): string => {
    let name = options?.name || '';
    let desc = options?.desc || '';
    let benefit = options?.benefit || '';
    let target = options?.target || '';
    let style = options?.style || 'dark';

    if (!name && typeof inputData === 'object' && inputData) {
      name = inputData.name || inputData.productName || inputData.title || inputData.label || '';
      desc = inputData.desc || inputData.productDesc || inputData.description || '';
      benefit = inputData.benefit || inputData.productBenefit || '';
      target = inputData.target || inputData.productTarget || '';
    } else if (!name && typeof inputData === 'string' && inputData.trim()) {
      name = inputData.trim();
    }

    if (!name && directive) {
      name = directive.split('\n')[0].substring(0, 40);
    }

    const titleClean = String(name || "Produto de Alta Performance")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/[\{\}"\\]/g, "")
      .trim();

    const descClean = String(desc || "Solução inovadora desenvolvida para entregar máxima eficiência, alta conversão e experiência de usuário inigualável.")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();

    const benefitClean = String(benefit || "Transforme seus resultados e economize tempo com nossa tecnologia avançada.")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();

    const targetClean = String(target || "Empreendedores, Profissionais e Equipes de Alta Performance")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();

    // Configuração de Temas Visuais
    const isClean = style === 'clean';
    const isCyber = style === 'cyberpunk';
    const isWarm = style === 'warm';

    const bgClass = isClean ? 'bg-slate-50 text-slate-900' : isCyber ? 'bg-black text-emerald-400' : isWarm ? 'bg-stone-950 text-amber-100' : 'bg-gray-950 text-gray-100';
    const cardBg = isClean ? 'bg-white/90 border-slate-200 shadow-xl' : isCyber ? 'bg-gray-950 border-emerald-500/40 shadow-emerald-950/40' : isWarm ? 'bg-stone-900/80 border-amber-500/30 shadow-amber-950/40' : 'bg-gray-900/80 border-gray-800 backdrop-blur-xl shadow-2xl';
    const primaryGradient = isClean ? 'from-blue-600 via-indigo-600 to-blue-700' : isCyber ? 'from-emerald-500 via-teal-400 to-cyan-500' : isWarm ? 'from-amber-500 via-orange-500 to-amber-600' : 'from-purple-600 via-indigo-600 to-purple-700';
    const textGradient = isClean ? 'from-blue-600 to-indigo-700' : isCyber ? 'from-emerald-400 via-teal-300 to-cyan-400' : isWarm ? 'from-amber-300 via-orange-300 to-amber-500' : 'from-purple-400 via-indigo-300 to-pink-400';
    const badgeBg = isClean ? 'bg-blue-50 text-blue-700 border-blue-200' : isCyber ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' : isWarm ? 'bg-amber-950/80 text-amber-300 border-amber-500/40' : 'bg-purple-950/80 text-purple-300 border-purple-500/30';

    return `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleClean} - Oficial &amp; Alta Conversão</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .glow-effect { background: radial-gradient(circle at 50% 20%, rgba(124, 58, 237, 0.2) 0%, transparent 70%); }
    .glass-card { backdrop-filter: blur(16px); }
  </style>
</head>
<body class="${bgClass} min-h-screen selection:bg-purple-600 selection:text-white antialiased">

  <!-- HEADER NAVBAR -->
  <header class="sticky top-0 z-50 ${cardBg} border-b px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-r ${primaryGradient} flex items-center justify-center font-black text-white text-base shadow-md">
        🚀
      </div>
      <span class="font-black text-base sm:text-lg tracking-tight uppercase">${titleClean}</span>
    </div>

    <nav class="hidden md:flex items-center gap-8 text-xs font-bold opacity-80">
      <a href="#beneficios" class="hover:opacity-100 transition-opacity">Benefícios</a>
      <a href="#diferenciais" class="hover:opacity-100 transition-opacity">Diferenciais</a>
      <a href="#depoimentos" class="hover:opacity-100 transition-opacity">Depoimentos</a>
      <a href="#faq" class="hover:opacity-100 transition-opacity">FAQ</a>
    </nav>

    <a href="#oferta" class="bg-gradient-to-r ${primaryGradient} text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg hover:brightness-110 transition-all active:scale-95">
      Garantir Acesso
    </a>
  </header>

  <!-- HERO SECTION -->
  <section class="relative pt-16 sm:pt-24 pb-16 px-4 sm:px-6 max-w-6xl mx-auto text-center glow-effect">
    <div class="inline-flex items-center gap-2 border ${badgeBg} px-4 py-1.5 rounded-full text-xs font-bold mb-8 shadow-sm">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>Lançamento Exclusivo • Produto Validado</span>
    </div>

    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto mb-6">
      Conheça o <span class="bg-gradient-to-r ${textGradient} bg-clip-text text-transparent">${titleClean}</span>
    </h1>

    <p class="text-sm sm:text-lg opacity-80 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
      ${descClean}
    </p>

    <!-- DESTAQUE DO PRINCIPAL BENEFÍCIO -->
    <div class="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 p-4 rounded-2xl max-w-2xl mx-auto mb-10 text-xs sm:text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
      <span>💡 Benefício Principal:</span>
      <span class="text-white">${benefitClean}</span>
    </div>

    <!-- BOTÕES DE CTA -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
      <a href="#oferta" class="w-full sm:w-auto bg-gradient-to-r ${primaryGradient} text-white font-black text-sm px-8 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 active:scale-95">
        <span>⚡ Quero Experimentar Agora</span>
        <span>→</span>
      </a>
      <a href="#beneficios" class="w-full sm:w-auto ${cardBg} border font-bold text-sm px-8 py-4 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2">
        <span>🔍 Ver Todos os Recursos</span>
      </a>
    </div>

    <!-- METRICAS & PROVA SOCIAL -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 ${cardBg} rounded-3xl border max-w-4xl mx-auto text-center">
      <div>
        <div class="text-2xl sm:text-3xl font-black text-emerald-400">4.9 / 5★</div>
        <div class="text-[11px] opacity-70 mt-0.5">Avaliação Média</div>
      </div>
      <div>
        <div class="text-2xl sm:text-3xl font-black text-blue-400">+12.500</div>
        <div class="text-[11px] opacity-70 mt-0.5">Clientes Atendidos</div>
      </div>
      <div>
        <div class="text-2xl sm:text-3xl font-black text-purple-400">99.8%</div>
        <div class="text-[11px] opacity-70 mt-0.5">Taxa de Satisfação</div>
      </div>
      <div>
        <div class="text-2xl sm:text-3xl font-black text-amber-400">24/7</div>
        <div class="text-[11px] opacity-70 mt-0.5">Suporte Dedicado</div>
      </div>
    </div>
  </section>

  <!-- SEÇÃO DE BENEFÍCIOS & DIFERENCIAIS -->
  <section id="beneficios" class="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
    <div class="text-center mb-12">
      <span class="text-xs font-black uppercase tracking-widest text-emerald-400">Por Que Escolher?</span>
      <h2 class="text-2xl sm:text-4xl font-extrabold mt-2">Diferenciais Que Fazem Toda a Diferença</h2>
      <p class="text-xs sm:text-sm opacity-70 mt-2 max-w-xl mx-auto">Desenvolvido sob medida para ${targetClean}.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="${cardBg} p-6 sm:p-8 rounded-3xl border hover:border-emerald-500/50 transition-all">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl mb-5">
          💎
        </div>
        <h3 class="text-lg font-bold mb-2">Máxima Qualidade &amp; Precisão</h3>
        <p class="text-xs sm:text-sm opacity-70 leading-relaxed">
          Estruturado para entregar o mais alto padrão com facilidade de uso, garantindo resultados superiores.
        </p>
      </div>

      <div class="${cardBg} p-6 sm:p-8 rounded-3xl border hover:border-blue-500/50 transition-all">
        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-2xl mb-5">
          ⚡
        </div>
        <h3 class="text-lg font-bold mb-2">Velocidade &amp; Automação</h3>
        <p class="text-xs sm:text-sm opacity-70 leading-relaxed">
          Poupe dezenas de horas com processos otimizados e prontos para uso imediato sem complicações.
        </p>
      </div>

      <div class="${cardBg} p-6 sm:p-8 rounded-3xl border hover:border-purple-500/50 transition-all">
        <div class="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl mb-5">
          🛡️
        </div>
        <h3 class="text-lg font-bold mb-2">Garantia &amp; Segurança</h3>
        <p class="text-xs sm:text-sm opacity-70 leading-relaxed">
          Sua satisfação garantida ou seu investimento de volta em até 7 dias sem perguntas.
        </p>
      </div>
    </div>
  </section>

  <!-- SEÇÃO DE DEPOIMENTOS -->
  <section id="depoimentos" class="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
    <div class="text-center mb-12">
      <span class="text-xs font-black uppercase tracking-widest text-blue-400">Prova Social</span>
      <h2 class="text-2xl sm:text-4xl font-extrabold mt-2">O Que Nossos Clientes Dizem</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="${cardBg} p-6 rounded-3xl border space-y-3">
        <div class="text-amber-400 text-sm">★★★★★</div>
        <p class="text-xs sm:text-sm opacity-80 leading-relaxed italic">
          "Surpreendeu totalmente minhas expectativas. O ${titleClean} facilitou nossa rotina e triplicou nossa velocidade."
        </p>
        <div class="text-xs font-bold text-emerald-400 pt-2 border-t border-gray-800">
          — Carlos Eduardo, Diretor de Operações
        </div>
      </div>

      <div class="${cardBg} p-6 rounded-3xl border space-y-3">
        <div class="text-amber-400 text-sm">★★★★★</div>
        <p class="text-xs sm:text-sm opacity-80 leading-relaxed italic">
          "Interface impecável e resultados rápidos. Recomendo para qualquer profissional da área!"
        </p>
        <div class="text-xs font-bold text-emerald-400 pt-2 border-t border-gray-800">
          — Mariana Silva, Empreendedora
        </div>
      </div>

      <div class="${cardBg} p-6 rounded-3xl border space-y-3">
        <div class="text-amber-400 text-sm">★★★★★</div>
        <p class="text-xs sm:text-sm opacity-80 leading-relaxed italic">
          "O suporte é sensacional e a entrega é exatamente o que promete. Nota 10!"
        </p>
        <div class="text-xs font-bold text-emerald-400 pt-2 border-t border-gray-800">
          — Lucas Mendes, Gestor
        </div>
      </div>
    </div>
  </section>

  <!-- PERGUNTAS FREQUENTES (FAQ ACCORDION INTERATIVO) -->
  <section id="faq" class="py-16 px-4 sm:px-6 max-w-4xl mx-auto">
    <div class="text-center mb-10">
      <span class="text-xs font-black uppercase tracking-widest text-purple-400">Tire Suas Dúvidas</span>
      <h2 class="text-2xl sm:text-3xl font-extrabold mt-2">Perguntas Frequentes</h2>
    </div>

    <div class="space-y-3">
      <details class="${cardBg} rounded-2xl border p-4 cursor-pointer group">
        <summary class="font-bold text-sm flex items-center justify-between outline-none">
          <span>Como funciona o acesso ao ${titleClean}?</span>
          <span class="text-xs transition-transform group-open:rotate-180">▼</span>
        </summary>
        <p class="text-xs opacity-70 mt-3 leading-relaxed border-t pt-3 border-gray-800">
          Após a confirmação da inscrição, você recebe acesso imediato e ilimitado através da nossa plataforma com instruções completas de uso.
        </p>
      </details>

      <details class="${cardBg} rounded-2xl border p-4 cursor-pointer group">
        <summary class="font-bold text-sm flex items-center justify-between outline-none">
          <span>Existe garantia de reembolso?</span>
          <span class="text-xs transition-transform group-open:rotate-180">▼</span>
        </summary>
        <p class="text-xs opacity-70 mt-3 leading-relaxed border-t pt-3 border-gray-800">
          Sim! Oferecemos 7 dias de garantia incondicional. Se por qualquer motivo você não ficar 100% satisfeito, devolvemos 100% do seu dinheiro.
        </p>
      </details>

      <details class="${cardBg} rounded-2xl border p-4 cursor-pointer group">
        <summary class="font-bold text-sm flex items-center justify-between outline-none">
          <span>Qual é o público ideal para o produto?</span>
          <span class="text-xs transition-transform group-open:rotate-180">▼</span>
        </summary>
        <p class="text-xs opacity-70 mt-3 leading-relaxed border-t pt-3 border-gray-800">
          É perfeito especialmente para ${targetClean}.
        </p>
      </details>
    </div>
  </section>

  <!-- BANNER DE CTA E OFERTA FINAL -->
  <section id="oferta" class="py-16 px-4 sm:px-6 max-w-5xl mx-auto my-8">
    <div class="${cardBg} p-8 sm:p-14 rounded-3xl border border-emerald-500/40 text-center relative overflow-hidden bg-gradient-to-b from-emerald-950/30 to-gray-950">
      <span class="bg-emerald-500 text-black font-black text-[10px] uppercase px-3 py-1 rounded-full tracking-widest inline-block mb-4">
        OFERTA POR TEMPO LIMITADO
      </span>
      <h2 class="text-2xl sm:text-4xl font-black mb-3">Garanta Seu Acesso ao ${titleClean}</h2>
      <p class="text-xs sm:text-base opacity-80 max-w-xl mx-auto mb-8">
        ${benefitClean}
      </p>

      <a href="#oferta" onclick="alert('Inscrição efetuada com sucesso!')" class="inline-block bg-gradient-to-r ${primaryGradient} text-white font-black text-sm sm:text-base px-10 py-4.5 rounded-2xl shadow-2xl hover:scale-105 transition-all active:scale-95">
        ⚡ GARANTIR APROVEITAMENTO AGORA
      </a>

      <div class="mt-6 flex items-center justify-center gap-4 text-[11px] opacity-70 font-mono">
        <span>🔒 Pagamento 100% Seguro</span>
        <span>•</span>
        <span>🛡️ 7 Dias de Garantia</span>
        <span>•</span>
        <span>⚡ Acesso Imediato</span>
      </div>
    </div>
  </section>

  <!-- RODAPÉ INSTITUCIONAL -->
  <footer class="border-t border-gray-900 py-8 px-4 text-center text-xs opacity-60 font-mono">
    <p>© ${new Date().getFullYear()} ${titleClean}. Todos os direitos reservados.</p>
  </footer>

</body>
</html>`;
  }
};

