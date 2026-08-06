import { MY_API_KEYS } from '../api_keys_list';

/**
 * Gerenciador de Chaves de API (Load Balancer / Rotation)
 */

type KeyListener = (status: string) => void;

const sanitizeKey = (k: string): string => {
  if (!k) return '';
  return k.replace(/^["'“”‘’`\s]+|["'“”‘’`\s]+$/g, '').trim();
};

class KeyManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private failedKeys: Set<string> = new Set();
  private listeners: KeyListener[] = [];

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    this.keys = []; // Reset

    // 1. Chave do Usuário (LocalStorage) - PRIORIDADE MÁXIMA
    let customKey: string | null = null;
    if (typeof window !== 'undefined') {
      customKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('flow_architect_brain_gemini_key');
    }

    if (customKey) {
      const cleanCustomKey = sanitizeKey(customKey);
      if (cleanCustomKey.length > 15) {
        this.keys.push(cleanCustomKey);
      }
    }

    // 2. Chaves do ambiente (Vercel, Vite, Cloud Run)
    let envKeys: string[] = [];
    try {
      const candidates = [
        process.env.GEMINI_API_KEY,
        process.env.VITE_GEMINI_API_KEY,
        process.env.API_KEY,
        (import.meta as any).env?.VITE_GEMINI_API_KEY,
        (import.meta as any).env?.GEMINI_API_KEY,
      ];

      for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string' && candidate !== 'undefined' && candidate !== 'null') {
          const parts = candidate.split(/[\s,]+/);
          for (const p of parts) {
            const clean = sanitizeKey(p);
            if (clean.length > 15) {
              envKeys.push(clean);
            }
          }
        }
      }
    } catch (e) {}

    // 3. Chaves do arquivo físico
    const fileKeys = Array.isArray(MY_API_KEYS) 
      ? MY_API_KEYS.map(k => sanitizeKey(k || '')).filter(k => k.length > 15) 
      : [];
    
    // Mescla chaves de ambiente e arquivo, mantendo ordem e evitando duplicatas
    const allKeys = Array.from(new Set([...this.keys, ...envKeys, ...fileKeys]));
    this.keys = allKeys;
    
    // Fallback log
    if (this.keys.length === 0) {
      console.warn("[KeyManager] Nenhuma chave API detectada. Configure nas opções.");
    }
    this.notify();
  }

  public setCustomKey(key: string) {
      // Método chamado quando o usuário salva no SettingsModal
      const clean = sanitizeKey(key);
      if (clean) {
        localStorage.setItem('gemini_api_key', clean);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
      // Recarrega e reseta estado
      this.reset(); 
      this.loadKeys();
  }

  public subscribe(listener: KeyListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.getStatus()));
  }

  public getActiveKey(): string {
    if (this.keys.length === 0) return '';
    
    let attempts = 0;
    // Pula chaves que já falharam
    while (this.failedKeys.has(this.keys[this.currentIndex]) && attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    return this.keys[this.currentIndex] || '';
  }

  public markCurrentKeyAsFailed(): boolean {
    if (this.keys.length === 0) return false;
    
    const keyToMark = this.keys[this.currentIndex];
    this.failedKeys.add(keyToMark);
    
    console.error(`[KeyManager] Chave #${this.currentIndex + 1} falhou.`);
    
    // Avança para a próxima
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.notify();
    
    // Retorna true se ainda houver chaves não testadas ou que não falharam
    return this.failedKeys.size < this.keys.length;
  }

  public getStatus() {
    return JSON.stringify({
        total: this.keys.length,
        failed: this.failedKeys.size,
        current: this.currentIndex,
        healthy: Math.max(0, this.keys.length - this.failedKeys.size)
    });
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public reset() {
    this.failedKeys.clear();
    this.currentIndex = 0;
    this.notify();
  }

  public getAllKeysStatus() {
      return this.keys.map((key, index) => ({
          index,
          id: key.substring(0, 8) + "...",
          isFailed: this.failedKeys.has(key),
          isActive: index === this.currentIndex
      }));
  }
}

export const keyManager = new KeyManager();