
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
        
        {/* HEADER */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 md:px-4 shrink-0 z-40 shadow-xl pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-sm shadow-lg shadow-blue-900/20">F</div>
                <div className="flex flex-col">
                    <h1 className="font-black text-[11px] md:text-xs tracking-tighter uppercase leading-none text-white">{APP_NAME}</h1>
                    <span className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[100px]">{currentProject?.name || 'Projeto Local'}</span>
                </div>
            </div>

            {/* DESKTOP TOGGLES */}
            <div className="hidden md:flex items-center gap-1 ml-4 border-l border-gray-700 pl-4 h-8">
                <button 
                    onClick={() => setShowDesktopLogs(!showDesktopLogs)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showDesktopLogs ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Alternar Painel de Logs"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    Logs
                </button>
                <button 
                    onClick={() => setShowDesktopChat(!showDesktopChat)}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${showDesktopChat ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Alternar Chat IA"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    IA Chat
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
             <div className="hidden md:block">
                 <KeyStatusPanel />
             </div>

             {/* BOTÃO CÉREBRO DE IA / APRENDIZADO */}
             <button 
                onClick={() => setIsBrainModalOpen(true)}
                className="flex items-center gap-1.5 px-3 h-9 md:h-10 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white transition-all border border-purple-800/60 shadow-lg shadow-purple-900/20 active:scale-95 font-bold text-xs"
                title="Cérebro de Aprendizado & Memória IA"
             >
                <span className="text-sm animate-pulse">🧠</span>
                <span className="hidden sm:inline">Cérebro IA</span>
             </button>
             
             {/* BOTÃO JSON / CÓDIGO */}
             <button 
                onClick={() => setIsJsonModalOpen(true)}
                className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700 shadow-md active:scale-95"
                title="Editor JSON / Importar"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
             </button>

             {/* BOTÃO SAVE */}
             <button 
                onClick={handleSaveProject}
                className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all border shadow-md active:scale-95 ${
                    saveStatus === 'saved' ? 'bg-green-600 text-white border-green-500' :
                    saveStatus === 'saving' ? 'bg-blue-800 text-blue-300 border-blue-700' :
                    'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border-gray-700'
                }`}
                title="Salvar Projeto"
             >
                {saveStatus === 'saved' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                )}
             </button>

             {/* BOTÃO SETTINGS */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700 shadow-md active:scale-95"
                title="Configurações (API Keys)"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>

             {/* BOTÃO RUN */}
             <button 
                onClick={handleRunFlow} 
                disabled={isExecuting}
                className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all ${isExecuting ? 'bg-blue-900/50 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-90'}`}
             >
                {isExecuting ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <svg className="w-5 h-5 fill-white" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.664l-3-2z"/></svg>}
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
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <ProjectLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onLoadProject={handleLoadProject} currentNodesCount={nodes.length} activeProjectId={currentProject?.id} />
        <FlowJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} nodes={nodes} edges={edges} onImport={handleImportJson} />
        <BrainModal isOpen={isBrainModalOpen} onClose={() => setIsBrainModalOpen(false)} />
      </div>
    </ReactFlowProvider>
  );
};

export default App;
