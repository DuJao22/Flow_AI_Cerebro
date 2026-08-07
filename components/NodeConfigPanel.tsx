
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FlowNode, NodeType } from '../types';

interface NodeConfigPanelProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, newConfig: any) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, isOpen, onClose, onUpdate, onDelete }) => {
  const [config, setConfig] = useState<any>({});
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [jsonString, setJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  const activeNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (node) {
      // Sincroniza estado apenas quando o ID do nó muda ou ao abrir pela primeira vez
      if (activeNodeIdRef.current !== node.id) {
        activeNodeIdRef.current = node.id;
        const currentConfig = node.data.config || {};
        setConfig(currentConfig);
        setJsonString(JSON.stringify(currentConfig, null, 2));
        setJsonError(null);
      }
    } else {
      activeNodeIdRef.current = null;
    }
  }, [node?.id]);

  if (!isOpen || !node) return null;

  // Atualiza via Formulário Visual
  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setJsonString(JSON.stringify(newConfig, null, 2));
    onUpdate(node.id, newConfig);
  };

  // Atualiza via Editor JSON
  const handleJsonChange = (value: string) => {
    setJsonString(value);
    try {
      const parsed = JSON.parse(value);
      setConfig(parsed);
      setJsonError(null);
      onUpdate(node.id, parsed);
    } catch (e) {
      setJsonError("Sintaxe JSON inválida");
    }
  };

  const handleContainerEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex flex-col md:flex-row md:justify-end pointer-events-none select-text"
      onClick={handleContainerEvent}
      onMouseDown={handleContainerEvent}
      onTouchStart={handleContainerEvent}
      onPointerDown={handleContainerEvent}
    >
      {/* Overlay Mobile Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm md:hidden pointer-events-auto transition-opacity" 
        onClick={(e) => { 
          e.stopPropagation(); 
          if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
          onClose(); 
        }} 
      />
      
      <div 
        onClick={handleContainerEvent}
        onMouseDown={handleContainerEvent}
        onTouchStart={handleContainerEvent}
        onPointerDown={handleContainerEvent}
        className="relative mt-auto md:mt-0 w-full md:w-[420px] max-h-[85vh] md:max-h-full md:h-full bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 pointer-events-auto shadow-2xl overflow-hidden flex flex-col rounded-t-3xl md:rounded-none z-10 animate-fade-in"
      >
        
        {/* DRAG HANDLE MOBILE */}
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto my-3 md:hidden shrink-0" />

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${node.data.status === 'ERROR' ? 'bg-red-500' : 'bg-blue-500'} animate-pulse`}></div>
             <div>
                 <h3 className="font-black text-xs sm:text-sm uppercase tracking-widest text-white">{node.data.label}</h3>
                 <p className="text-[9px] text-gray-500 font-mono uppercase">{node.data.type}</p>
             </div>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
            title="Fechar Modal de Edição"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* TABS SWITCHER */}
        <div className="px-5 pt-3 shrink-0">
            <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                <button 
                    type="button"
                    onClick={() => setMode('visual')} 
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'visual' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Visual Editor
                </button>
                <button 
                    type="button"
                    onClick={() => setMode('json')} 
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'json' ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50 shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    JSON Bruto
                </button>
            </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-10 custom-scrollbar">
          
          {/* --- MODO JSON --- */}
          {mode === 'json' && (
              <div className="flex flex-col h-full">
                  <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase">Configuração Raw (JSON)</label>
                      {jsonError && <span className="text-[10px] text-red-400 font-bold bg-red-900/20 px-2 py-0.5 rounded border border-red-900/50">{jsonError}</span>}
                  </div>
                  <textarea 
                    value={jsonString}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    className={`flex-1 w-full bg-gray-950 border rounded-xl p-4 text-xs font-mono leading-relaxed outline-none resize-none
                        ${jsonError ? 'border-red-500 text-red-200 focus:border-red-500' : 'border-gray-800 text-green-300 focus:border-blue-500'}
                    `}
                    spellCheck={false}
                  />
                  <p className="text-[9px] text-gray-600 mt-2">
                      Edite as propriedades diretamente. Alterações são aplicadas em tempo real se o JSON for válido.
                  </p>
              </div>
          )}

          {/* --- MODO VISUAL --- */}
          {mode === 'visual' && (
            <>
                {/* HTTP REQUEST UI */}
                {node.data.type === NodeType.HTTP_REQUEST && (
                    <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Endpoint URL</label>
                        <input 
                        type="text" value={config.url || ''} onChange={(e) => handleChange('url', e.target.value)}
                        placeholder="https://api.exemplo.com/v1"
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none font-mono text-blue-300 placeholder-gray-700 transition-colors"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Método</label>
                            <select 
                            value={config.method || 'GET'} onChange={(e) => handleChange('method', e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none appearance-none text-white font-bold"
                            >
                            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                             <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Auth Header</label>
                             <input 
                                type="text" value={config.headers?.Authorization || ''} 
                                onChange={(e) => handleChange('headers', {...config.headers, Authorization: e.target.value})}
                                placeholder="Bearer token..."
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-xs focus:border-blue-500 outline-none text-gray-300 placeholder-gray-700"
                             />
                        </div>
                    </div>
                    {config.method !== 'GET' && (
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">JSON Body</label>
                            <textarea 
                                value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body, null, 2) || ''}
                                onChange={(e) => handleChange('body', e.target.value)}
                                placeholder='{"key": "value"}'
                                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-xs font-mono text-gray-300 outline-none focus:border-blue-500"
                            />
                        </div>
                    )}
                    </div>
                )}

                {/* IF CONDITION UI */}
                {node.data.type === NodeType.IF_CONDITION && (
                    <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Condição JavaScript</label>
                    <div className="relative">
                        <textarea 
                            value={config.condition || ''} onChange={(e) => handleChange('condition', e.target.value)}
                            placeholder="input.price > 100"
                            className="w-full h-40 bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-sm font-mono text-yellow-400 outline-none focus:border-blue-500 leading-relaxed"
                        />
                        <div className="absolute bottom-3 right-3 text-[9px] text-gray-600 font-mono">
                            Variável disponível: <span className="text-blue-500">input</span>
                        </div>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                        Escreva uma expressão JS que retorne <span className="text-green-400 font-bold">true</span> ou <span className="text-red-400 font-bold">false</span>. 
                        Use <code>input</code> para acessar os dados do nó anterior.
                    </p>
                    </div>
                )}

                {/* FILE SAVE UI */}
                {node.data.type === NodeType.FILE_SAVE && (
                    <div className="space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Nome do Arquivo</label>
                            <input 
                                type="text" value={config.fileName || ''} onChange={(e) => handleChange('fileName', e.target.value)}
                                placeholder="resultado.json"
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Formato</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['json', 'txt', 'csv'].map(fmt => (
                                    <button 
                                        type="button"
                                        key={fmt}
                                        onClick={() => handleChange('fileFormat', fmt)}
                                        className={`py-3 rounded-lg text-xs font-bold uppercase transition-all ${config.fileFormat === fmt ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                    >
                                        {fmt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* DELAY UI */}
                {node.data.type === NodeType.DELAY && (
                    <div className="animate-fade-in">
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Tempo de Espera (ms)</label>
                        <input 
                            type="number" value={config.delayMs || 1000} onChange={(e) => handleChange('delayMs', parseInt(e.target.value))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-xl font-bold text-blue-400 focus:border-blue-500 outline-none"
                        />
                        <p className="mt-2 text-[10px] text-gray-500">1000ms = 1 segundo.</p>
                    </div>
                )}

                {/* AI BRAIN UI */}
                {(node.data.type === NodeType.AI_BRAIN || node.data.type === ('aiBrain' as any)) && (
                    <div className="space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-black text-purple-400 uppercase mb-2">
                               🧠 Diretiva / Raciocínio Solicitado
                            </label>
                            <textarea
                              value={config.directive || ''}
                              onChange={(e) => handleChange('directive', e.target.value)}
                              placeholder="Ex: Analise o preço recebido do nó anterior e determine se a oportunidade é favorável segundo as regras salvas..."
                              rows={4}
                              className="w-full bg-gray-950 border border-purple-900/50 rounded-xl p-3 text-xs text-purple-200 outline-none focus:border-purple-500 resize-none leading-relaxed"
                            />
                        </div>

                        <label className="flex items-center justify-between p-3 bg-gray-950 rounded-xl border border-purple-900/40 cursor-pointer">
                          <div>
                            <div className="text-xs font-bold text-gray-200">Gravar Aprendizado Automático</div>
                            <div className="text-[9px] text-gray-500">Extrai novos insights desta execução para a memória do Cérebro.</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={config.autoLearn !== false}
                            onChange={(e) => handleChange('autoLearn', e.target.checked)}
                            className="w-4 h-4 accent-purple-600 rounded"
                          />
                        </label>
                    </div>
                )}

                {/* GENERIC FALLBACK UI */}
                {![NodeType.HTTP_REQUEST, NodeType.IF_CONDITION, NodeType.FILE_SAVE, NodeType.DELAY, NodeType.AI_BRAIN, 'aiBrain'].includes(node.data.type as any) && (
                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 opacity-60">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        <p className="text-xs text-gray-400 max-w-[200px]">
                            Este tipo de nó não possui interface visual dedicada. 
                            <br/>
                            <span className="text-blue-400 font-bold cursor-pointer" onClick={() => setMode('json')}>Use a aba JSON</span> para editar.
                        </p>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-800">
                    <button 
                    type="button"
                    onClick={() => { if(confirm('Tem certeza que deseja excluir este nó do fluxo?')) { onDelete(node.id); onClose(); } }}
                    className="w-full py-3.5 text-xs font-black uppercase tracking-widest text-red-400 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-95"
                    >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Remover Nó
                    </button>
                </div>
            </>
          )}
        </div>
        
        {/* FOOTER */}
        <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
           <button 
              type="button"
              onClick={onClose} 
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-950/50 active:scale-95 transition-all text-white"
           >
               Concluir Edição
           </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NodeConfigPanel;
