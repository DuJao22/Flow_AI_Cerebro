import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
  isOpen?: boolean;
  onToggle?: () => void;
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, isOpen = true, onToggle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400 border-red-900/50 bg-red-900/20';
      case 'SUCCESS': return 'text-green-400 border-green-900/50 bg-green-900/20';
      case 'WARN': return 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20';
      default: return 'text-blue-300 border-blue-900/50 bg-blue-900/20';
    }
  };

  const getLevelIcon = (level: string) => {
      switch (level) {
          case 'ERROR': return '❌';
          case 'SUCCESS': return '✅';
          case 'WARN': return '⚠️';
          default: return 'ℹ️';
      }
  };

  const renderMessage = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="h-full bg-[#0a0c10] border-t border-gray-700 flex flex-col font-mono text-xs w-full shadow-inner">
      <div 
        className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
            <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </span>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-200 tracking-wide uppercase text-[11px]">Terminal de Execução</h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-600/50 text-[10px] text-purple-300 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                Rede Neuronal Ativa
              </span>
            </div>
        </div>
        <div className="flex items-center gap-2">
             <span className="text-[10px] text-gray-500 hidden sm:inline">Sinapses & Logs</span>
             <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-700 font-bold">{logs.length} Eventos</span>
        </div>
      </div>
      
      {isOpen && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d1117]">
            {logs.length === 0 && (
                <div className="text-gray-600 italic flex flex-col items-center justify-center h-28 opacity-60 gap-2 border border-dashed border-gray-800 rounded-2xl bg-gray-950/50">
                    <div className="relative flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-sm animate-pulse">🧠</div>
                    </div>
                    <span className="text-xs font-mono text-gray-400">Aguardando disparo de sinapses do fluxo...</span>
                </div>
            )}
            {logs.map((log, index) => {
              const prevLog = index > 0 ? logs[index - 1] : null;
              const isDifferentNode = prevLog && prevLog.nodeLabel !== log.nodeLabel;

              return (
              <React.Fragment key={log.id}>
                {/* VISUAL SYNAPSE LINK BETWEEN NEURON NODES */}
                {isDifferentNode && (
                  <div className="flex items-center justify-center my-1.5 py-1 px-3 rounded-xl bg-gradient-to-r from-purple-950/60 via-indigo-950/80 to-purple-950/60 border border-purple-500/30 text-[10px] font-mono text-purple-300 gap-2 shadow-lg animate-fade-in">
                    <span className="text-purple-400 font-bold truncate max-w-[120px]">🧠 {prevLog.nodeLabel}</span>
                    <div className="flex-1 flex items-center justify-center relative h-3 overflow-hidden">
                      <div className="w-full h-0.5 bg-gradient-to-r from-purple-500 via-amber-400 to-indigo-500 rounded-full" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] bg-gray-950 px-2 py-0.2 rounded-full border border-purple-400/50 text-amber-300 font-black animate-pulse">
                          ⚡ DISPARO SINÁPTICO
                        </span>
                      </div>
                    </div>
                    <span className="text-indigo-300 font-bold truncate max-w-[120px]">🧠 {log.nodeLabel}</span>
                  </div>
                )}

                <div className="relative flex flex-col gap-1 group">
                    <div className="flex items-center gap-2 w-full select-none">
                        <span className="text-gray-600 text-[10px] w-16 font-mono shrink-0 text-right">{log.timestamp.split('T')[1].split('.')[0]}</span>
                        
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] border shrink-0 flex items-center gap-1 ${getLevelColor(log.level)}`}>
                            {getLevelIcon(log.level)} {log.level}
                        </span>
                        
                        <span className="text-purple-300 font-bold text-[10px] uppercase tracking-wider bg-purple-900/30 px-2.5 py-0.5 rounded-full shrink-0 border border-purple-700/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            {log.nodeLabel}
                        </span>
                        
                        <div className="h-px bg-gray-800 flex-1 ml-2 opacity-50"></div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCopy(log.message, log.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                            title="Copiar Conteúdo Completo"
                        >
                            {copiedId === log.id ? (
                                <span className="text-[9px] text-green-400 font-bold px-1">COPIADO!</span>
                            ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            )}
                        </button>
                    </div>
                    
                    {/* Message Content with Precise Formatting */}
                    <div className="pl-[4.5rem] pr-2 mt-1">
                        <div className={`p-2 rounded-xl border border-l-4 ${
                            log.level === 'ERROR' ? 'border-red-900/50 border-l-red-500 bg-red-950/10' :
                            log.level === 'SUCCESS' ? 'border-green-900/50 border-l-green-500 bg-green-950/10' :
                            'border-gray-800 border-l-purple-500 bg-gray-900/50'
                        }`}>
                            <pre className="text-gray-300 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed selection:bg-blue-500/30 font-medium">
                                {renderMessage(log.message)}
                            </pre>
                        </div>
                    </div>
                </div>
              </React.Fragment>
              );
            })}
            
            {/* Anchor to scroll to bottom */}
            <div className="h-4" />
        </div>
      )}
    </div>
  );
};

export default LogPanel;