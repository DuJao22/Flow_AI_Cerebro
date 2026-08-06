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
    content: 'Especialidade Landing Pages: Estrutura obrigatoriamente Hero Section com visual dark luxury ou contrastado, badges animados, títulos de alto impacto, CTA duplo, prova social, grid de diferenciais, FAQ sanfonado e rodapé institucional.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 5,
    importance: 'high',
    useCount: 25
  },
  {
    id: 'mem-lp-2',
    category: 'pattern',
    content: 'Utilizar Tailwind CSS CDN com suporte a efeitos glassmorphism (backdrop-blur-md), gradientes sofisticados e tipografia refinada (Google Fonts como Plus Jakarta Sans / Inter).',
    source: 'user',
    createdAt: Date.now() - 86400000 * 4,
    importance: 'high',
    useCount: 18
  },
  {
    id: 'mem-lp-3',
    category: 'preference',
    content: 'Em Landing Pages de Alto Padrão, incluir garantias visuais de 7 dias, contadores numéricos de satisfação (+10.000 clientes) e depoimentos em formato de cards com estrelas de avaliação.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 2,
    importance: 'medium',
    useCount: 14
  },
  {
    id: 'mem-1',
    category: 'rule',
    content: 'Sempre sanitizar e extrair respostas JSON mesmo quando contiverem formatação em blocos de código Markdown.',
    source: 'user',
    createdAt: Date.now() - 86400000 * 3,
    importance: 'high',
    useCount: 12
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
      return JSON.parse(stored);
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
    const memories = brainService.getMemories();
    if (memories.length === 0) return "Nenhum aprendizado prévio registrado.";

    return memories.map((m, idx) => 
      `${idx + 1}. [${m.category.toUpperCase()} | Importância: ${m.importance.toUpperCase()}] ${m.content}`
    ).join('\n');
  },

  // IMPORTAÇÃO E EXPORTAÇÃO COMPLETA DO BANCO DE DADOS (DB BACKUP)
  exportDatabase: (): string => {
    const dbData = {
      version: 1,
      databaseName: DB_NAME,
      exportedAt: new Date().toISOString(),
      dedicatedApiKey: brainService.getDedicatedApiKey() ? '*** CONFIGURADA ***' : 'NÃO CONFIGURADA',
      totalMemories: brainService.getMemories().length,
      memories: brainService.getMemories()
    };
    return JSON.stringify(dbData, null, 2);
  },

  importDatabase: (jsonText: string): { success: boolean; count: number; message: string } => {
    try {
      const parsed = JSON.parse(jsonText);
      const incomingMemories = parsed.memories || (Array.isArray(parsed) ? parsed : null);

      if (!incomingMemories || !Array.isArray(incomingMemories)) {
        return { success: false, count: 0, message: "Formato de banco de dados inválido. Esperado um array 'memories'." };
      }

      brainService.saveMemoriesToDB(incomingMemories);
      return { 
        success: true, 
        count: incomingMemories.length, 
        message: `Banco de dados restaurado com sucesso! ${incomingMemories.length} memórias importadas.` 
      };
    } catch (err: any) {
      return { success: false, count: 0, message: `Erro ao importar arquivo DB: ${err.message}` };
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

        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
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
  }
};

