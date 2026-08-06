
import React, { useState, useRef, useEffect } from 'react';
import { generateFlowFromPrompt } from '../services/geminiService';
import { AIMessage, FlowSchema, LogEntry, FlowNode, FlowEdge } from '../types';
import { CREATOR_CREDIT } from '../constants';

interface AIChatProps {
  onImportFlow: (flowData: FlowSchema) => void;
  onCloseMobile?: () => void;
  isMobile?: boolean;
  logs: LogEntry[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const AIChat: React.FC<AIChatProps> = ({ onImportFlow, logs, nodes, edges }) => {
  const renderFormattedText = (content: string) => {
    if (!content) return '';
    let formatted = content;
    // Convert markdown links [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300 font-bold">$1</a>');
    // Convert markdown bold **text** or __text__ across multiple lines
    formatted = formatted.replace(/\*\*([\s\S]*?)\*\*/g, '<strong class="font-extrabold text-white">$1</strong>');
    formatted = formatted.replace(/__([\s\S]*?)__/g, '<strong class="font-extrabold text-white">$1</strong>');
    // Convert markdown italic *text*
    formatted = formatted.replace(/\*([^\*]+)\*/g, '<em class="italic text-gray-200">$1</em>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  };

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([
    { 
      role: 'system', 
      content: `Olá! Sou o **AI Architect**, especialista em **Landing Pages de Alto Padrão (Luxury, High-Converting & Responsive)** e Automações de Fluxos.\n\nCada página criada passa por aprendizado contínuo do **Cérebro de IA**, que analisa estruturas, componentes e animações para aperfeiçoar cada novo desenvolvimento!\n\n⚡ **Todos os direitos e créditos do criador do sistema:**\nDesenvolvido por **João Layon**.\n👉 Siga no Instagram: [**@layon.dev**](https://instagram.com/layon.dev) para novidades e atualizações!\n\nComo posso ajudar você a criar hoje?`, 
      timestamp: Date.now() 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll inteligente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    try {
      const { text, flowData } = await generateFlowFromPrompt(input, { logs, currentNodes: nodes, currentEdges: edges });
      const aiMsg: AIMessage = { role: 'ai', content: text, timestamp: Date.now(), flowData };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: "Desculpe, tive um problema ao processar sua solicitação. Tente novamente.", 
        timestamp: Date.now() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 w-full relative">
      
      {/* Header do Chat - Compacto e Fixo */}
      <div className="shrink-0 p-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-20 flex items-center justify-between shadow-sm">
        <div>
            <h2 className="text-xs md:text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 md:w-1.5 md:h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                AI Architect
            </h2>
            <p className="text-[10px] md:text-[9px] text-gray-500 font-medium uppercase tracking-tighter">{CREATOR_CREDIT}</p>
        </div>
      </div>

      {/* Lista de Mensagens - Flexível com Scroll */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar overscroll-contain">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
            <div className={`max-w-[95%] md:max-w-[85%] rounded-2xl px-4 py-3 text-[15px] md:text-sm leading-relaxed shadow-md ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-tl-none'
            }`}>
              <div 
                className="whitespace-pre-wrap break-words font-sans"
                dangerouslySetInnerHTML={{ __html: renderFormattedText(msg.content) }} 
              />
              
              {msg.flowData && (
                <button 
                  onClick={() => onImportFlow(msg.flowData!)}
                  className="mt-4 w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-green-900/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Importar Fluxo
                </button>
              )}
            </div>
            <span className="text-[10px] text-gray-600 mt-1.5 font-mono uppercase px-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        
        {loading && (
          <div className="flex flex-col items-start animate-pulse px-1">
            <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700 flex items-center gap-3 w-32">
                <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Sugestões de Ações Rápidas */}
      <div className="shrink-0 px-3 py-2 bg-gray-950/80 border-t border-gray-800 flex gap-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => {
            setInput("Criar um fluxo para gerar uma Landing Page de Alto Padrão em HTML5 com hero section, Tailwind CSS e salvar o arquivo index.html");
          }}
          className="bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-colors"
        >
          🚀 Landing Page de Alto Padrão
        </button>
        <button
          onClick={() => {
            setInput("Criar um fluxo com nó Cérebro IA para analisar produtos e gerar uma Landing Page com aprendizado automático");
          }}
          className="bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-colors"
        >
          🧠 Cérebro + Landing Page
        </button>
      </div>

      {/* Input Area - Fixo no Rodapé e Seguro para Mobile */}
      <div className="shrink-0 p-3 bg-gray-900 border-t border-gray-800 z-30 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
        <div className="flex gap-2 bg-gray-950 p-2 border border-gray-700 rounded-2xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all items-end">
          <textarea
            ref={textareaRef}
            value={input} 
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, window.innerHeight * 0.5)}px`;
            }} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Descreva o fluxo desejado..."
            rows={1}
            className="flex-1 bg-transparent px-2 py-2 text-white text-[16px] focus:outline-none placeholder-gray-500 resize-none max-h-[50vh] overflow-y-auto custom-scrollbar"
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()} 
            className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 md:w-10 md:h-10 flex items-center justify-center rounded-xl shadow-lg active:scale-90 transition-all disabled:opacity-50 disabled:bg-gray-800 disabled:scale-100 shrink-0 mb-1"
          >
            {loading ? (
                 <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
            ) : (
                 <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
