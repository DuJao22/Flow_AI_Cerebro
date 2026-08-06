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

  // Sync state to refs for fast animation frame access
  selectedNodeRef.current = selectedNode;
  filterQueryRef.current = filterQuery;

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

    // 1. Render Links
    currentLinks.forEach(link => {
      const src = link.source as D3Node;
      const tgt = link.target as D3Node;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();

      // Render Arrowhead pointing to target boundary
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      const targetRadius = tgt.radius || 18;
      const arrowX = tgt.x - Math.cos(angle) * (targetRadius + 4);
      const arrowY = tgt.y - Math.sin(angle) * (targetRadius + 4);

      ctx.fillStyle = '#60a5fa';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle - Math.PI / 6),
        arrowY - 8 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - 8 * Math.cos(angle + Math.PI / 6),
        arrowY - 8 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Render Link Label
      if (link.label) {
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(link.label, midX, midY - 6);
      }
      ctx.restore();
    });

    // 2. Render Nodes
    currentNodes.forEach(n => {
      if (n.x == null || n.y == null) return;

      const color = getNodeColor(n.status, n.type);
      const icon = getNodeIcon(n.type);
      const isSelected = selectedId === n.id;
      const isMatched = query.length > 0 && (n.label.toLowerCase().includes(query) || n.type.toLowerCase().includes(query));

      ctx.save();

      // Outer Degree Halo
      const haloRadius = n.radius + Math.min(n.degree * 2, 8);
      ctx.beginPath();
      ctx.arc(n.x, n.y, haloRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 0.35 : 0.12;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.globalAlpha = isSelected ? 0.8 : 0.4;
      ctx.stroke();

      // Filter Highlight Pulse Ring
      if (isMatched) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloRadius + 6, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.95;
        ctx.stroke();
      }

      // Main Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : color;
      ctx.lineWidth = isSelected ? 3 : 2.5;
      ctx.stroke();

      // Node Icon
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(icon, n.x, n.y);

      // Label under Node
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#f8fafc';
      ctx.fillText(n.label, n.x, n.y + n.radius + 14);

      // Type Subtitle
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(n.type.toUpperCase(), n.x, n.y + n.radius + 25);

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
      const width = container.clientWidth || (isFullscreen ? window.innerWidth : 800);
      const height = container.clientHeight || (isFullscreen ? window.innerHeight : 450);
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
      radius: 18,
    }));

    const d3Links: D3Link[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label as string
    }));

    nodesRef.current = d3Nodes;
    linksRef.current = d3Links;

    // D3 Force Simulation Setup with High Performance Speed Settings
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .alphaDecay(0.08)
      .velocityDecay(0.35)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links).id(d => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius(d => d.radius + 18));

    // Pre-warm layout steps for instant initial presentation
    for (let i = 0; i < 25; ++i) simulation.tick();

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      renderCanvas();
    });

    // D3 Zoom Behavior on Canvas
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
        renderCanvas();
      });

    zoomRef.current = zoom;
    d3.select(canvas).call(zoom);

    // Canvas Mouse / Touch Dragging and Node Selection Handlers
    let dragStartPos = { x: 0, y: 0 };
    let draggedNode: D3Node | null = null;

    const getCanvasCoords = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const transform = transformRef.current;
      const worldX = (mouseX - transform.x) / transform.k;
      const worldY = (mouseY - transform.y) / transform.k;
      return { worldX, worldY, mouseX, mouseY };
    };

    const handlePointerDown = (e: MouseEvent) => {
      const { worldX, worldY, mouseX, mouseY } = getCanvasCoords(e);
      dragStartPos = { x: mouseX, y: mouseY };

      // Find clicked node within radius
      const targetNode = nodesRef.current.find(n => {
        if (n.x == null || n.y == null) return false;
        const dx = n.x - worldX;
        const dy = n.y - worldY;
        return (dx * dx + dy * dy) <= (n.radius + 10) * (n.radius + 10);
      });

      if (targetNode) {
        draggedNode = targetNode;
        draggedNode.fx = worldX;
        draggedNode.fy = worldY;
        simulation.alphaTarget(0.2).restart();
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!draggedNode) return;
      const { worldX, worldY } = getCanvasCoords(e);
      draggedNode.fx = worldX;
      draggedNode.fy = worldY;
      renderCanvas();
    };

    const handlePointerUp = (e: MouseEvent) => {
      const { mouseX, mouseY } = getCanvasCoords(e);
      const distMoved = Math.hypot(mouseX - dragStartPos.x, mouseY - dragStartPos.y);

      if (draggedNode) {
        // If click without heavy movement, select the node
        if (distMoved < 6) {
          setSelectedNode(draggedNode);
          if (onSelectNode) onSelectNode(draggedNode.id);
        }
        draggedNode.fx = null;
        draggedNode.fy = null;
        draggedNode = null;
        simulation.alphaTarget(0);
      } else if (distMoved < 6) {
        // Clicked empty background canvas
        setSelectedNode(null);
      }
    };

    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasDimensions();
    });
    resizeObserver.observe(container);

    return () => {
      simulation.stop();
      canvas.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      resizeObserver.disconnect();
    };

  }, [nodes, edges, isFullscreen, renderCanvas, onSelectNode]);

  // Re-trigger render when search filter changes
  useEffect(() => {
    renderCanvas();
  }, [filterQuery, selectedNode, renderCanvas]);

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
    <div className={`relative w-full h-full bg-[#0a0c10] border border-blue-900/40 rounded-3xl flex flex-col overflow-hidden select-none font-sans ${isFullscreen ? 'fixed inset-0 z-[99999] rounded-none border-none' : 'min-h-[450px]'}`}>
      
      {/* GRAPH CONTROL BAR - RESPONSIVE & MOBILE FIRST */}
      <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-gray-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-gray-800 shadow-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-900 px-2.5 py-1 rounded-xl shrink-0">
            <span className="text-xs">📊</span>
            <span className="text-[11px] sm:text-xs font-black uppercase text-blue-300">
              Canvas Grafo D3 ({nodes.length} Nós)
            </span>
          </div>

          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filtrar nó..."
            className="bg-gray-950 border border-gray-800 text-xs text-white px-2.5 py-1 rounded-xl outline-none focus:border-blue-500 w-28 sm:w-40 font-mono shrink-0"
          />
        </div>

        <div className="flex items-center justify-between md:justify-end gap-1.5 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-gray-800">
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700 flex items-center justify-center text-xs active:scale-95"
              title="Aumentar Zoom"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-gray-700 flex items-center justify-center text-xs active:scale-95"
              title="Diminuir Zoom"
            >
              -
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-bold rounded-xl border border-gray-700 active:scale-95 uppercase"
              title="Centralizar Visualização"
            >
              Reset
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-xl shadow-lg shadow-blue-950/50 transition-all uppercase tracking-wider active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            {isFullscreen ? '✕ Sair da Tela Cheia' : '🖥️ Tela Cheia'}
          </button>
        </div>
      </div>

      {/* CANVAS ELEMENT */}
      <div ref={containerRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* INSPECTOR CARD OVERLAY */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:right-3 z-20 sm:w-72 bg-gray-900/95 border border-blue-900/80 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in space-y-2">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span>Nó Selecionado</span>
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white text-xs font-bold"
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

