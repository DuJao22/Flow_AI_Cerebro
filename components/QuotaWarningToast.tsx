import React, { useState, useEffect } from 'react';
import { AlertTriangle, Key, X, RefreshCw } from 'lucide-react';
import { keyManager } from '../services/keyManager';

interface QuotaWarningToastProps {
  onOpenSettings: () => void;
}

export const QuotaWarningToast: React.FC<QuotaWarningToastProps> = ({ onOpenSettings }) => {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    // Escuta avisos acionados pelo KeyManager quando o limite de tokens/cota é atingido
    const unsubscribe = keyManager.onWarning((msg) => {
      setWarningMessage(msg);
      setIsVisible(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isVisible || !warningMessage) return null;

  return (
    <div className="fixed top-16 right-4 sm:top-20 sm:right-6 z-[9999] max-w-md w-[calc(100vw-2rem)] sm:w-[420px] animate-bounce-in font-sans">
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/95 via-gray-900/95 to-amber-900/90 border-2 border-amber-500/80 backdrop-blur-xl rounded-2xl p-4 shadow-[0_10px_40px_rgba(245,158,11,0.35)] text-white">
        
        {/* Glow de Fundo */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start gap-3">
          {/* Ícone de Alerta Animado */}
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 shrink-0 text-amber-300">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>⚠️ Limite de Tokens / Cota (429)</span>
              </h4>
              <button
                onClick={() => setIsVisible(false)}
                className="text-amber-200/60 hover:text-white p-1 rounded-lg hover:bg-amber-900/40 transition-colors"
                title="Fechar Aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-amber-100 font-medium leading-relaxed">
              {warningMessage}
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  setIsVisible(false);
                  onOpenSettings();
                }}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-[11px] py-1.5 px-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Inserir Chave Pessoal</span>
              </button>

              <button
                onClick={() => setIsVisible(false)}
                className="bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700/60 font-bold text-[11px] py-1.5 px-3 rounded-lg transition-all"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
