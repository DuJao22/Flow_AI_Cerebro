import React, { useState } from 'react';
import { Heart, Sparkles, ExternalLink, UserCheck, X } from 'lucide-react';

interface CreditsCardProps {
  isOpen?: boolean;
  onClose?: () => void;
  floating?: boolean;
}

export const CreditsCard: React.FC<CreditsCardProps> = ({ 
  isOpen = true, 
  onClose,
  floating = false
}) => {
  const [minimized, setMinimized] = useState(false);

  if (!isOpen) return null;

  return (
    <div className={`transition-all duration-300 font-sans z-50 ${
      floating 
        ? 'fixed bottom-20 left-4 sm:bottom-6 sm:left-6 max-w-sm w-[calc(100vw-2rem)] sm:w-96 shadow-2xl' 
        : 'w-full'
    }`}>
      {/* CARD PRINCIPAL DE CRÉDITOS */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-950/95 via-gray-900/95 to-indigo-950/95 border border-purple-500/40 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-[0_0_50px_-10px_rgba(168,85,247,0.3)]">
        
        {/* BRILHO AMBIENTE E FEIXE DE LUZ */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* CABEÇALHO DO CARD */}
        <div className="flex items-center justify-between pb-3 border-b border-purple-800/40 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-500 p-0.5 shadow-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>Créditos do Sistema</span>
                <span className="text-[10px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">Criadores</span>
              </h3>
              <p className="text-[10px] text-purple-300/80">Desenvolvido com IA & Dedicação</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {floating && (
              <button
                onClick={() => setMinimized(!minimized)}
                className="text-purple-300 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 transition-colors"
                title={minimized ? "Expandir" : "Minimizar"}
              >
                {minimized ? "▲" : "▼"}
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!minimized && (
          <div className="space-y-3.5">
            <p className="text-xs text-gray-200 leading-relaxed font-medium">
              Todos os créditos pelo desenvolvimento e arquitetura do <strong className="text-purple-300">Flow Architect AI</strong> vão para os criadores:
            </p>

            {/* LISTA DE PERFIS DOS CRIADORES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* LAYON.DEV */}
              <a
                href="https://instagram.com/layon.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-purple-900/50 to-indigo-900/40 hover:from-purple-800/70 hover:to-indigo-800/60 border border-purple-500/30 hover:border-purple-400 transition-all shadow-md hover:scale-[1.02] active:scale-95"
              >
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 p-0.5 shrink-0 shadow-md">
                  <div className="w-full h-full bg-gray-900 rounded-full flex items-center justify-center font-black text-xs text-purple-300">
                    LD
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white group-hover:text-purple-200 truncate">
                      @layon.dev
                    </span>
                    <ExternalLink className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-pink-300/90 font-semibold flex items-center gap-1">
                    <span>Siga no Instagram</span> ➔
                  </span>
                </div>
              </a>

              {/* DAVI._LINK */}
              <a
                href="https://instagram.com/davi._link"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-900/50 to-purple-900/40 hover:from-indigo-800/70 hover:to-purple-800/60 border border-indigo-500/30 hover:border-indigo-400 transition-all shadow-md hover:scale-[1.02] active:scale-95"
              >
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-0.5 shrink-0 shadow-md">
                  <div className="w-full h-full bg-gray-900 rounded-full flex items-center justify-center font-black text-xs text-indigo-300">
                    DL
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white group-hover:text-indigo-200 truncate">
                      @davi._link
                    </span>
                    <ExternalLink className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-pink-300/90 font-semibold flex items-center gap-1">
                    <span>Siga no Instagram</span> ➔
                  </span>
                </div>
              </a>

            </div>

            {/* APELO PARA SEGUIR OS CRIADORES */}
            <div className="bg-purple-950/60 border border-purple-800/50 rounded-xl p-2.5 text-center flex items-center justify-center gap-2 text-xs font-bold text-purple-200">
              <Heart className="w-4 h-4 text-pink-400 animate-bounce fill-pink-400" />
              <span>Siga os perfis para acompanhar atualizações e novos projetos!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
