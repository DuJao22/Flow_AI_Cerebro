
import React, { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel,
  MarkerType,
} from 'reactflow';
import type { Connection } from 'reactflow';
import CustomNode from './components/CustomNode';
import AIChat from './components/AIChat';
import LogPanel from './components/LogPanel';
import FilePanel from './components/FilePanel';
import SettingsModal from './components/SettingsModal';
import ProjectLibraryModal from './components/ProjectLibraryModal'; 
import FlowJsonModal from './components/FlowJsonModal'; 
import NodeConfigPanel from './components/NodeConfigPanel';
import KeyStatusPanel from './components/KeyStatusPanel';
import LandingPage from './components/LandingPage';
import { BrainModal } from './components/BrainModal';
import { FlowDependencyGraph } from './components/FlowDependencyGraph';
import { INITIAL_NODES, INITIAL_EDGES, APP_NAME } from './constants';
import { FlowEngine } from './services/flowEngine';
import { storageService } from './services/storageService'; 
import { FlowSchema, LogEntry, NodeStatus, GeneratedFile, FlowNode, SavedProject, NodeType, FlowEdge } from './types';

const nodeTypes = {
  custom: CustomNode,
  httpRequest: CustomNode,
  webhook: CustomNode,
  delay: CustomNode,
  ifCondition: CustomNode,
  logger: CustomNode,
  discord: CustomNode,
  telegram: CustomNode,
  fileSave: CustomNode,
  aiBrain: CustomNode,
  start: CustomNode
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 3, stroke: '#3b82f6' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
};

const AUTOSAVE_KEY = 'flow_architect_autosave_v2';

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const [currentProject, setCurrentProject] = useState<{id: string, name: string} | null>(null);

  // MOBILE STATE
  const [activeTab, setActiveTab] = useState<'flow' | 'chat' | 'terminal'>('flow');
  
  // DESKTOP STATE (Toggles)
  const [showDesktopChat, setShowDesktopChat] = useState(true);
  const [showDesktopLogs, setShowDesktopLogs] = useState(false);

  const [terminalSubTab, setTerminalSubTab] = useState<'logs' | 'files' | 'graph'>('logs');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false); 
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(true);

  // PWA INSTALL STATE
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.length > 0) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          setFiles(parsed.files || []);
          if (parsed.currentProject) setCurrentProject(parsed.currentProject);
        }
      } catch (e) {}
    }
    setIsLoaded(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes, edges, files, currentProject }));
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, files, isLoaded, currentProject]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const handleAddNode = (type: NodeType, label: string) => {
    const id = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type: 'custom',
      position: { x: 50, y: 150 },
      data: { label, type, status: NodeStatus.IDLE, config: {} }
    };
    setNodes((nds) => nds.concat(newNode));
    setIsAddMenuOpen(false);
    setSelectedNodeId(id);
  };

  const handleRunFlow = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([]); 
    
    // Auto-open logs on execution
    if (window.innerWidth >= 768) {
        setShowDesktopLogs(true);
    } else {
        setActiveTab('terminal');
    }
    setTerminalSubTab('logs');
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, status: NodeStatus.IDLE } })));

    const engine = new FlowEngine(
      nodes, edges, setNodes, 
      (log) => setLogs(prev => [...prev, log]),
      (file) => setFiles(prev => [file, ...prev])
    );

    await engine.run();
    setIsExecuting(false);
  }, [nodes, edges, isExecuting, setNodes]);

  const handleSaveProject = () => {
    setSaveStatus('saving');
    
    if (currentProject) {
        storageService.updateProject(currentProject.id, nodes, edges, files);
        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
        const name = window.prompt("Nome do Projeto:", "Meu Fluxo Automático");
        if (name) {
            const newProj = storageService.saveProject(name, nodes, edges, files);
            setCurrentProject({ id: newProj.id, name: newProj.name });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            setSaveStatus('idle');
        }
    }
  };

  const handleLoadProject = (project: SavedProject) => {
    setNodes(project.nodes.map(n => ({ ...n, type: 'custom' })));
    setEdges(project.edges.map(e => ({ ...e, ...defaultEdgeOptions })));
    setFiles(project.files || []);
    setCurrentProject({ id: project.id, name: project.name });
    setActiveTab('flow');
  };

  const handleImportJson = (newNodes: FlowNode[], newEdges: FlowEdge[]) => {
      setNodes(newNodes.map(n => ({ ...n, type: 'custom' })));
      setEdges(newEdges.map(e => ({ ...e, ...defaultEdgeOptions })));
      setActiveTab('flow');
  };

  if (showLandingPage) {
    return <LandingPage onStart={() => setShowLandingPage(false)} />;
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden flex-col bg-gray-950 text-white select-none">
        
        {/* HEADER EXECUTIVO COMPACTO MOBILE-FIRST */}
        <header className="min-h-[3.5rem] bg-gray-950/95 backdrop-blur-2xl border-b border-gray-800/80 flex items-center justify-between px-2.5 sm:px-4 py-1.5 shrink-0 z-40 shadow-2xl pt-[env(safe-area-inset-top)] gap-2 overflow-x-auto scrollbar-none">
          
          {/* LADO ESQUERDO: BRANDING & PROJETO */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-xs sm:text-sm text-white shadow-md border border-blue-400/30 shrink-0">
                  F
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <h1 className="font-black text-[11px] sm:text-xs md:text-sm tracking-wider uppercase bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent leading-none whitespace-nowrap">
                        {APP_NAME}
                      </h1>
                      <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[8px] sm:text-[9px] font-mono text-purple-300 bg-purple-950/90 px-1.5 py-0.2 rounded-full border border-purple-700/50 font-bold truncate max-w-[85px] sm:max-w-[120px]">
                        {currentProject?.name || 'Projeto Ativo'}
                      </span>
                    </div>
                </div>
            </div>

            {/* DESKTOP VIEW TOGGLES SEGMENTED CONTROL */}
            <div className="hidden lg:flex items-center bg-gray-900/90 border border-gray-800 p-0.5 rounded-xl ml-2 gap-0.5">
                <button 
                    onClick={() => setShowDesktopLogs(!showDesktopLogs)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                      showDesktopLogs ? 'bg-purple-900/70 text-purple-200 border border-purple-700/50 shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Alternar Terminal de Logs"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    Logs
                </button>
                <button 
                    onClick={() => setShowDesktopChat(!showDesktopChat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                      showDesktopChat ? 'bg-blue-900/70 text-blue-200 border border-blue-700/50 shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Alternar Copiloto IA Chat"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    IA Chat
                </button>
            </div>
          </div>
          
          {/* LADO DIREITO: DOCK DE AÇÕES EM GRID/FLEX COMPACTO SEM OVERFLOW */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
             <div className="hidden 2xl:block">
                 <KeyStatusPanel />
             </div>

             {/* BOTÃO INSTALAR PWA WEBAPP */}
             <button
                onClick={handleInstallPWA}
                className="flex items-center gap-1 px-2 sm:px-2.5 h-8 rounded-lg bg-teal-950/90 hover:bg-teal-900 text-teal-200 hover:text-white font-bold text-[10px] sm:text-xs transition-all border border-teal-600/50 shadow-md active:scale-95 shrink-0"
                title="Instalar WebApp no Celular ou PC"
             >
                <span className="text-xs">📱</span>
                <span className="hidden xs:inline font-mono uppercase tracking-tight">App</span>
             </button>

             {/* BOTÃO CÉREBRO IA */}
             <button 
                onClick={() => setIsBrainModalOpen(true)}
                className="flex items-center gap-1 px-2 sm:px-2.5 h-8 rounded-lg bg-purple-950/90 hover:bg-purple-900 text-purple-200 hover:text-white transition-all border border-purple-600/50 shadow-md active:scale-95 font-bold text-[10px] sm:text-xs shrink-0"
                title="Cérebro de IA & Aprendizado Contínuo"
             >
                <span className="text-xs animate-pulse">🧠</span>
                <span className="hidden xs:inline font-mono uppercase tracking-tight">Cérebro</span>
             </button>
             
             {/* DOCK DE FERRAMENTAS (JSON / SAVE / SETTINGS) */}
             <div className="flex items-center bg-gray-900/90 border border-gray-800 p-0.5 rounded-lg gap-0.5 shrink-0">
               {/* JSON / IMPORTER */}
               <button 
                  onClick={() => setIsJsonModalOpen(true)}
                  className="flex items-center justify-center w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="Editor JSON / Importar"
               >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
               </button>

               {/* SALVAR PROJETO */}
               <button 
                  onClick={handleSaveProject}
                  className={`flex items-center justify-center w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md transition-all ${
                      saveStatus === 'saved' ? 'bg-green-600/30 text-green-400 border border-green-500/50' :
                      saveStatus === 'saving' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50 animate-pulse' :
                      'hover:bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Salvar Estado do Projeto"
               >
                  {saveStatus === 'saved' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  )}
               </button>

               {/* CONFIGURAÇÕES */}
               <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center justify-center w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="Configurações e Chaves Gemini"
               >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </button>
             </div>

             {/* BOTÃO PRIMÁRIO EXECUTAR FLUXO */}
             <button 
                onClick={handleRunFlow} 
                disabled={isExecuting}
                className={`flex items-center gap-1 px-2.5 sm:px-3 h-8 rounded-lg transition-all font-black text-[11px] sm:text-xs uppercase tracking-wider shrink-0 ${
                  isExecuting 
                    ? 'bg-blue-950 border border-blue-700/50 text-blue-300 animate-pulse' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md active:scale-95 border border-blue-400/30'
                }`}
                title="Executar Automação do Fluxo"
             >
                {isExecuting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent animate-spin rounded-full" />
                    <span className="hidden xs:inline text-[9px]">Executando</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.664l-3-2z"/></svg>
                    <span>Play</span>
                  </>
                )}
             </button>
          </div>
        </header>

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 relative overflow-hidden bg-gray-950 flex flex-col md:flex-row">
          
          {/* ÁREA DE FLUXO & LOGS DESKTOP */}
          <div className={`flex-1 flex flex-col relative min-w-0 transition-opacity duration-200 ${activeTab === 'flow' || window.innerWidth >= 768 ? 'opacity-100' : 'hidden md:flex'}`}>
            
            {/* CANVAS */}
            <div className="flex-1 relative">
                <ReactFlow 
                    nodes={nodes} edges={edges} 
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => setSelectedNodeId(null)} nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
                    fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
                >
                  <Background color="#1e293b" gap={25} size={1} />
                  
                  <Panel position="bottom-right" className="mb-20 md:mb-4">
                     <button 
                      onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                      className="bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform border-4 border-gray-950"
                     >
                        {isAddMenuOpen ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                     </button>
                     
                     {isAddMenuOpen && (
                        <div className="absolute bottom-16 right-0 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-mobile-up z-50 p-1">
                            {[
                              {type: NodeType.START, label: 'Gatilho Manual', color: 'bg-green-500'},
                              {type: NodeType.HTTP_REQUEST, label: 'HTTP / API', color: 'bg-blue-500'},
                              {type: NodeType.IF_CONDITION, label: 'Lógica IF', color: 'bg-yellow-500'},
                              {type: NodeType.AI_BRAIN, label: 'Cérebro IA 🧠', color: 'bg-purple-500'},
                              {type: NodeType.FILE_SAVE, label: 'Salvar Arquivo', color: 'bg-indigo-500'},
                            ].map(item => (
                                <button key={item.type} onClick={() => handleAddNode(item.type, item.label)} className="w-full px-4 py-3 text-left text-xs hover:bg-gray-800 flex items-center gap-3 rounded-lg transition-colors font-bold text-gray-300">
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span> {item.label}
                                </button>
                            ))}
                        </div>
                     )}
                  </Panel>

                  <Controls position="top-left" className="!bg-gray-900 !border-gray-800 !fill-white hidden md:flex" />
                </ReactFlow>
            </div>

            {/* PAINEL INFERIOR DE LOGS / GRAFO (DESKTOP) */}
            {showDesktopLogs && (
                <div className="hidden md:flex flex-col h-[35%] min-h-[220px] border-t border-gray-800 bg-gray-950 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                     <div className="flex bg-gray-900 p-1 border-b border-gray-800">
                        <button onClick={() => setTerminalSubTab('logs')} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Logs</button>
                        <button onClick={() => setTerminalSubTab('files')} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Arquivos ({files.length})</button>
                        <button onClick={() => setTerminalSubTab('graph')} className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${terminalSubTab === 'graph' ? 'bg-purple-600 text-white font-black' : 'text-purple-400/80 hover:text-purple-300'}`}>📊 Grafo D3</button>
                        <div className="flex-1"></div>
                        <button onClick={() => setShowDesktopLogs(false)} className="px-2 text-gray-500 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                         {terminalSubTab === 'logs' ? (
                           <LogPanel logs={logs} isOpen={true} />
                         ) : terminalSubTab === 'files' ? (
                           <FilePanel files={files} />
                         ) : (
                           <FlowDependencyGraph nodes={nodes} edges={edges} onSelectNode={(id) => setSelectedNodeId(id)} />
                         )}
                    </div>
                </div>
            )}
          </div>

          {/* SIDEBAR CHAT (DESKTOP) */}
          {showDesktopChat && (
              <div className="hidden md:flex flex-none w-[380px] bg-gray-950 border-l border-gray-800 z-30 flex-col shadow-2xl overflow-hidden">
                   <AIChat onImportFlow={handleLoadProject} logs={logs} nodes={nodes} edges={edges} />
              </div>
          )}

          {/* VIEWS MOBILE (Chat & Terminal - Substitui a view Desktop quando ativo) */}
          <div className={`md:hidden flex-1 overflow-hidden ${activeTab === 'chat' ? 'flex flex-col' : 'hidden'}`}>
             <AIChat onImportFlow={handleLoadProject} logs={logs} nodes={nodes} edges={edges} />
          </div>
          <div className={`md:hidden flex-1 ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
             <div className="flex flex-col h-full bg-gray-950">
                <div className="flex bg-gray-900 p-1 border-b border-gray-800">
                    <button onClick={() => setTerminalSubTab('logs')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Logs</button>
                    <button onClick={() => setTerminalSubTab('files')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Arquivos ({files.length})</button>
                    <button onClick={() => setTerminalSubTab('graph')} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded transition-all ${terminalSubTab === 'graph' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}>📊 Grafo D3</button>
                </div>
                <div className="flex-1 overflow-hidden">
                    {terminalSubTab === 'logs' ? (
                      <LogPanel logs={logs} isOpen={true} />
                    ) : terminalSubTab === 'files' ? (
                      <FilePanel files={files} />
                    ) : (
                      <FlowDependencyGraph nodes={nodes} edges={edges} onSelectNode={(id) => setSelectedNodeId(id)} />
                    )}
                </div>
             </div>
          </div>

        </main>

        {/* BOTTOM NAV - MOBILE ONLY */}
        <nav className="h-[60px] bg-gray-900 border-t border-gray-800 flex items-center justify-around px-2 shrink-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => setActiveTab('flow')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'flow' ? 'text-blue-500' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Fluxo</span>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'chat' ? 'text-blue-500' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             </div>
             <span className="text-[9px] font-black uppercase tracking-tighter">AI Chat</span>
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${activeTab === 'terminal' ? 'text-blue-500' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {logs.some(l => l.level === 'ERROR') && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-900"></span>}
             </div>
             <span className="text-[9px] font-black uppercase tracking-tighter">Logs</span>
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-1 text-gray-500 py-1">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Menu</span>
          </button>
        </nav>

        <NodeConfigPanel node={selectedNode} isOpen={!!selectedNode} onClose={() => setSelectedNodeId(null)} onUpdate={(id, cfg) => setNodes(nds => nds.map(n => n.id === id ? {...n, data: {...n.data, config: cfg}} : n))} onDelete={id => setNodes(nds => nds.filter(n => n.id !== id))} onDuplicate={() => {}} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onInstallPWA={handleInstallPWA} />
        <ProjectLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onLoadProject={handleLoadProject} currentNodesCount={nodes.length} activeProjectId={currentProject?.id} />
        <FlowJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} nodes={nodes} edges={edges} onImport={handleImportJson} />
        <BrainModal isOpen={isBrainModalOpen} onClose={() => setIsBrainModalOpen(false)} />

        {/* MODAL INSTRUÇÕES DE INSTALAÇÃO WEBAPP / PWA */}
        {showInstallModal && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900 border border-emerald-500/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-up">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <span>📱 Instalar Flow Architect WebApp</span>
                </h3>
                <button onClick={() => setShowInstallModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
              </div>

              <div className="space-y-3 text-xs text-gray-300 font-sans leading-relaxed">
                <p className="bg-emerald-950/70 border border-emerald-800/80 p-3 rounded-xl text-emerald-200 font-bold">
                  ✨ Use o Flow Architect como um aplicativo nativo em seu celular Android, iPhone ou computador!
                </p>

                <div className="space-y-1.5 bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>📱 Android / Google Chrome:</span>
                  </h4>
                  <p className="text-gray-400">
                    Toque nos <span className="text-white font-bold">3 pontinhos (⋮)</span> no canto do navegador e selecione <span className="text-emerald-400 font-bold">"Instalar aplicativo"</span> ou <span className="text-emerald-400 font-bold">"Adicionar à Tela inicial"</span>.
                  </p>
                </div>

                <div className="space-y-1.5 bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>🍎 iPhone / iPad Safari iOS:</span>
                  </h4>
                  <p className="text-gray-400">
                    Toque no botão <span className="text-white font-bold">Compartilhar (⎋)</span> na barra do Safari e selecione <span className="text-emerald-400 font-bold">"Adicionar à Tela de Início"</span>.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/50"
                >
                  Entendi, fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
};

export default App;
