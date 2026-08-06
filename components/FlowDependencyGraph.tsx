import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { FlowNode, FlowEdge, NodeStatus } from '../types';

interface FlowDependencyGraphProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onSelectNode?: (nodeId: string) => void;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  status: NodeStatus;
  config: Record<string, any>;
  degree: number;
  radius: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  label?: string;
}

const getNodeColor = (status: NodeStatus, type: string) => {
  if (status === NodeStatus.ERROR) return '#ef4444';
  if (status === NodeStatus.RUNNING) return '#3b82f6';
  if (status === NodeStatus.SUCCESS) return '#10b981';

  switch (type) {
    case 'start': return '#22c55e';
    case 'aiBrain': return '#a855f7';
    case 'httpRequest': return '#3b82f6';
    case 'ifCondition': return '#eab308';
    case 'fileSave': return '#6366f1';
    case 'logger': return '#06b6d4';
    default: return '#8b5cf6';
  }
};

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'start': return '⚡';
    case 'aiBrain': return '🧠';
    case 'httpRequest': return '🌐';
    case 'ifCondition': return '🔀';
    case 'fileSave': return '💾';
    case 'logger': return '📝';
    default: return '⚙️';
  }
};

export const FlowDependencyGraph: React.FC<FlowDependencyGraphProps> = ({
  nodes,
  edges,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  const nodesRef = useRef<D3Node[]>([]);
  const linksRef = useRef<D3Link[]>([]);
  const selectedNodeRef = useRef<D3Node | null>(null);
  const filterQueryRef = useRef<string>('');

  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  selectedNodeRef.current = selectedNode;
  filterQueryRef.current = filterQuery;

  // ESC Key listener for Fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // High performance Canvas Redraw Function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply scale for Retina / High DPI displays
    ctx.scale(dpr, dpr);

    const transform = transformRef.current;
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const currentNodes = nodesRef.current;
    const currentLinks = linksRef.current;
    const selectedId = selectedNodeRef.current?.id;
    const query = filterQueryRef.current.toLowerCase().trim();

    // 1. Render Links with Real-Time Neural Synapse Firing
    const now = Date.now();
    const t1 = (now / 1100) % 1;
    const t2 = ((now / 1100) + 0.5) % 1;

    currentLinks.forEach(link => {
      const src = link.source as D3Node;
      const tgt = link.target as D3Node;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

      const isSrcRunning = src.status === NodeStatus.RUNNING;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = isSrcRunning ? '#f59e0b' : '#3b82f6';
      ctx.globalAlpha = isSrcRunning ? 0.95 : 0.5;
      ctx.lineWidth = isSrcRunning ? 3 : 2;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();

      // Synaptic Firing Energy Pulse Particles
      [t1, t2].forEach(progress => {
        const px = src.x + (tgt.x - src.x) * progress;
        const py = src.y + (tgt.y - src.y) * progress;

        ctx.beginPath();
        ctx.arc(px, py, isSrcRunning ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = isSrcRunning ? '#fbbf24' : '#60a5fa';
        ctx.shadowColor = isSrcRunning ? '#f59e0b' : '#3b82f6';
        ctx.shadowBlur = isSrcRunning ? 15 : 8;
        ctx.fill();
      });

      // Render Edge Label if present
      if (link.label) {
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText(link.label, midX, midY - 6);
      }
      ctx.restore();
    });

    // 2. Render Nodes
    currentNodes.forEach(node => {
      if (node.x == null || node.y == null) return;

      const isSelected = selectedId === node.id;
      const matchesFilter = !query || node.label.toLowerCase().includes(query) || node.type.toLowerCase().includes(query);
      const color = getNodeColor(node.status, node.type);
      const icon = getNodeIcon(node.type);

      ctx.save();
      ctx.globalAlpha = matchesFilter ? 1 : 0.25;

      // Outer Halo Ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isSelected ? 10 : 6), 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = matchesFilter ? (isSelected ? 0.35 : 0.18) : 0.05;
      ctx.fill();

      // Outer Border Glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isSelected ? 10 : 6), 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.globalAlpha = matchesFilter ? (isSelected ? 1 : 0.6) : 0.1;
      ctx.stroke();

      // Inner Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = matchesFilter ? 1 : 0.3;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Icon Inside Node
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, node.x, node.y);

      // Label Below Node
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(node.label, node.x, node.y + node.radius + 16);

      ctx.restore();
    });

    ctx.restore();
  }, []);

  // Initialize Canvas D3 Simulation and Resize Observers
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    const updateCanvasDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(rect.width || (isFullscreen ? window.innerWidth : 800), 300);
      const height = Math.max(rect.height || (isFullscreen ? window.innerHeight : 500), 300);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (simulationRef.current) {
        simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
        simulationRef.current.alpha(0.3).restart();
      }
      renderCanvas();
    };

    updateCanvasDimensions();

    const observer = new ResizeObserver(() => {
      updateCanvasDimensions();
    });
    observer.observe(container);

    // Prepare Degree Map
    const degreeMap: Record<string, number> = {};
    edges.forEach(e => {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
    });

    // Prepare Nodes & Links
    const d3Nodes: D3Node[] = nodes.map(n => ({
      id: n.id,
      label: n.data.label || n.id,
      type: n.data.type,
      status: n.data.status || NodeStatus.IDLE,
      config: n.data.config || {},
      degree: degreeMap[n.id] || 0,
      radius: 24,
    }));

    const d3Links: D3Link[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label as string
    }));

    nodesRef.current = d3Nodes;
    linksRef.current = d3Links;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .alphaDecay(0.06)
      .velocityDecay(0.3)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius(d => d.radius + 20));

    for (let i = 0; i < 30; ++i) simulation.tick();

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      renderCanvas();
    });

    // D3 Zoom Behavior
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 3.5])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
        renderCanvas();
      });

    zoomRef.current = zoom;
    d3.select(canvas).call(zoom);

    // Canvas Click Node Selection
    const handleCanvasClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const transform = transformRef.current;
      const worldX = (x - transform.x) / transform.k;
      const worldY = (y - transform.y) / transform.k;

      let clicked: D3Node | null = null;
      for (const node of nodesRef.current) {
        if (node.x != null && node.y != null) {
          const dx = worldX - node.x;
          const dy = worldY - node.y;
          if (dx * dx + dy * dy <= (node.radius + 10) * (node.radius + 10)) {
            clicked = node;
            break;
          }
        }
      }

      setSelectedNode(clicked);
      if (clicked && onSelectNode) {
        onSelectNode(clicked.id);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    let animFrameId: number;
    const animLoop = () => {
      renderCanvas();
      animFrameId = requestAnimationFrame(animLoop);
    };
    animFrameId = requestAnimationFrame(animLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
      canvas.removeEventListener('click', handleCanvasClick);
      simulation.stop();
    };
  }, [nodes, edges, isFullscreen, renderCanvas, onSelectNode]);

  const handleZoomReset = () => {
    if (canvasRef.current && zoomRef.current) {
      d3.select(canvasRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (canvasRef.current && zoomRef.current) {
      d3.select(canvasRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (canvasRef.current && zoomRef.current) {
      d3.select(canvasRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }
  };

  const graphJSX = (
    <div className={`relative w-full h-full bg-gray-950 border border-blue-900/40 rounded-2xl flex flex-col overflow-hidden select-none font-sans ${
      isFullscreen ? '!fixed !inset-0 z-[999999] !w-screen !h-screen rounded-none border-none' : 'min-h-[420px] sm:min-h-[520px]'
    }`}>
      
      {/* FLOATING HUD CONTROLS */}
      <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-30 flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-gray-900/90 backdrop-blur-xl border border-blue-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-blue-950/90 border border-blue-700/60 px-3 py-1 rounded-xl shrink-0">
            <span className="text-sm">⚙️</span>
            <span className="text-xs font-black uppercase tracking-wider text-blue-200">
              Grafo de Fluxo ({nodes.length})
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar nós..."
              className="w-32 sm:w-48 bg-gray-950/90 border border-gray-800 text-xs text-white placeholder-gray-500 px-3 py-1 rounded-xl outline-none focus:border-blue-500 font-mono"
            />
            {filterQuery && (
              <button 
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-950/80 p-1 rounded-xl border border-gray-800">
            <button
              onClick={handleZoomIn}
              className="w-7 h-7 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center text-xs active:scale-95"
              title="Aumentar Zoom"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-7 h-7 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center text-xs active:scale-95"
              title="Diminuir Zoom"
            >
              -
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-bold rounded-lg active:scale-95 uppercase"
              title="Centralizar"
            >
              Reset
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-black rounded-xl shadow-lg shadow-blue-950/50 transition-all uppercase tracking-wider active:scale-95 flex items-center gap-1.5 shrink-0 border border-blue-400/30"
          >
            {isFullscreen ? '✕ Sair' : '🖥️ Tela Cheia'}
          </button>
        </div>
      </div>

      {/* CANVAS ELEMENT */}
      <div ref={containerRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* INSPECTOR CARD OVERLAY */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:right-3 z-40 sm:w-80 bg-gray-900/95 border border-blue-600/60 p-4 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span>Nó Selecionado</span>
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-gray-500">ID:</span>
              <span className="text-blue-400 font-bold">{selectedNode.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rótulo:</span>
              <span className="text-white font-bold">{selectedNode.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tipo:</span>
              <span className="text-purple-400 font-bold">{selectedNode.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className={`font-bold ${
                selectedNode.status === NodeStatus.SUCCESS ? 'text-green-400' :
                selectedNode.status === NodeStatus.ERROR ? 'text-red-400' :
                selectedNode.status === NodeStatus.RUNNING ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {selectedNode.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Conexões:</span>
              <span className="text-amber-400 font-bold">{selectedNode.degree} arestas</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return ReactDOM.createPortal(graphJSX, document.body);
  }

  return graphJSX;
};
