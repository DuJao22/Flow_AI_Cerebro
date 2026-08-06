import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { brainService, BrainMemory } from '../services/brainService';

interface BrainKnowledgeGraphProps {
  onMemoryChange?: () => void;
}

interface D3BrainNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'core' | 'category' | 'source' | 'memory';
  category?: BrainMemory['category'];
  importance?: BrainMemory['importance'];
  useCount?: number;
  content?: string;
  source?: string;
  createdAt?: string;
  radius: number;
}

interface D3BrainLink extends d3.SimulationLinkDatum<D3BrainNode> {
  id: string;
  source: string | D3BrainNode;
  target: string | D3BrainNode;
  type: 'category' | 'source' | 'semantic' | 'core';
}

export const BrainKnowledgeGraph: React.FC<BrainKnowledgeGraphProps> = ({ onMemoryChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [memories, setMemories] = useState<BrainMemory[]>([]);
  const [selectedNode, setSelectedNode] = useState<D3BrainNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = () => {
    const mems = brainService.getMemories();
    setMemories(mems);
  };

  // Re-run D3 layout when dependencies or fullscreen state changes
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || (isFullscreen ? window.innerWidth : 900);
    const height = containerRef.current.clientHeight || (isFullscreen ? window.innerHeight : 550);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', [0, 0, width, height]);

    // Build graph structure
    const nodesMap = new Map<string, D3BrainNode>();

    // 1. Central Core Node
    const coreNode: D3BrainNode = {
      id: 'core_brain',
      label: '🧠 CÉREBRO DE IA',
      type: 'core',
      radius: 34
    };
    nodesMap.set(coreNode.id, coreNode);

    // 2. Category Hub Nodes
    const categories: { key: BrainMemory['category']; label: string; icon: string; color: string }[] = [
      { key: 'rule', label: 'REGRAS', icon: '📜', color: '#a855f7' },
      { key: 'pattern', label: 'PADRÕES', icon: '🧩', color: '#3b82f6' },
      { key: 'preference', label: 'PREFERÊNCIAS', icon: '⭐', color: '#10b981' },
      { key: 'insight', label: 'INSIGHTS', icon: '💡', color: '#f59e0b' },
      { key: 'correction', label: 'CORREÇÕES', icon: '🛠️', color: '#ef4444' }
    ];

    categories.forEach(cat => {
      const catNode: D3BrainNode = {
        id: `cat_${cat.key}`,
        label: `${cat.icon} ${cat.label}`,
        type: 'category',
        category: cat.key,
        radius: 24
      };
      nodesMap.set(catNode.id, catNode);
    });

    // 3. Source Hub Nodes
    const sources = [
      { key: 'user', label: 'Manual (User)', icon: '👤' },
      { key: 'auto', label: 'AI Chat', icon: '🤖' },
      { key: 'flow_execution', label: 'Execução de Fluxo', icon: '⚙️' },
      { key: 'landing_page', label: 'Landing Page', icon: '🎨' }
    ];

    sources.forEach(src => {
      const srcNode: D3BrainNode = {
        id: `src_${src.key}`,
        label: `${src.icon} ${src.label}`,
        type: 'source',
        radius: 20
      };
      nodesMap.set(srcNode.id, srcNode);
    });

    // 4. Memory Nodes & Links
    const links: D3BrainLink[] = [];

    // Connect Categories and Sources to Core
    categories.forEach(cat => {
      links.push({
        id: `link_core_cat_${cat.key}`,
        source: 'core_brain',
        target: `cat_${cat.key}`,
        type: 'core'
      });
    });

    sources.forEach(src => {
      links.push({
        id: `link_core_src_${src.key}`,
        source: 'core_brain',
        target: `src_${src.key}`,
        type: 'core'
      });
    });

    // Filter memories if needed
    const filteredMemories = memories.filter(m => {
      const matchCat = filterCategory === 'all' || m.category === filterCategory;
      const matchSearch = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    filteredMemories.forEach(mem => {
      const r = mem.importance === 'high' ? 16 : mem.importance === 'medium' ? 12 : 9;
      const memNode: D3BrainNode = {
        id: mem.id,
        label: mem.content.length > 25 ? mem.content.slice(0, 22) + '...' : mem.content,
        type: 'memory',
        category: mem.category,
        importance: mem.importance,
        useCount: mem.useCount,
        content: mem.content,
        source: mem.source,
        createdAt: mem.createdAt,
        radius: r + Math.min((mem.useCount || 0), 6)
      };
      nodesMap.set(memNode.id, memNode);

      // Link Memory to Category Hub
      links.push({
        id: `link_mem_${mem.id}_cat_${mem.category}`,
        source: mem.id,
        target: `cat_${mem.category}`,
        type: 'category'
      });

      // Link Memory to Source Hub
      const srcKey = mem.source || 'user';
      if (nodesMap.has(`src_${srcKey}`)) {
        links.push({
          id: `link_mem_${mem.id}_src_${srcKey}`,
          source: mem.id,
          target: `src_${srcKey}`,
          type: 'source'
        });
      }
    });

    // Optimized semantic relationship links between memories using word indexing
    const wordIndex = new Map<string, string[]>();
    filteredMemories.forEach(m => {
      const words = m.content.toLowerCase().split(/\s+/).filter(w => w.length > 5);
      words.forEach(w => {
        if (!wordIndex.has(w)) wordIndex.set(w, []);
        wordIndex.get(w)!.push(m.id);
      });
    });

    const addedSemanticLinks = new Set<string>();
    wordIndex.forEach((memIds) => {
      if (memIds.length > 1 && memIds.length < 8) {
        for (let i = 0; i < memIds.length - 1; i++) {
          const id1 = memIds[i];
          const id2 = memIds[i + 1];
          const linkKey = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
          if (!addedSemanticLinks.has(linkKey)) {
            addedSemanticLinks.add(linkKey);
            links.push({
              id: `link_semantic_${linkKey}`,
              source: id1,
              target: id2,
              type: 'semantic'
            });
          }
        }
      }
    });

    const d3NodesArray = Array.from(nodesMap.values());

    // Root Container Group for Zooming
    const g = svg.append('g').attr('class', 'brain-main-group');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Optimized High-Performance Force Simulation Setup
    const simulation = d3.forceSimulation<D3BrainNode>(d3NodesArray)
      .alphaDecay(0.08) // Settles 3.5x faster
      .velocityDecay(0.35) // Prevents wild oscillations
      .force('link', d3.forceLink<D3BrainNode, D3BrainLink>(links).id(d => d.id).distance(d => {
        if (d.type === 'core') return 140;
        if (d.type === 'category') return 80;
        if (d.type === 'source') return 95;
        return 50;
      }))
      .force('charge', d3.forceManyBody().strength(d => {
        const n = d as D3BrainNode;
        if (n.type === 'core') return -600;
        if (n.type === 'category') return -300;
        if (n.type === 'source') return -200;
        return -90;
      }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3BrainNode>().radius(d => d.radius + 8));

    // Pre-warm layout for 25 steps so initial position is instant & smooth
    for (let i = 0; i < 25; ++i) simulation.tick();

    // Color mapper
    const getNodeColor = (d: D3BrainNode) => {
      if (d.type === 'core') return '#c084fc';
      if (d.type === 'source') return '#64748b';
      switch (d.category) {
        case 'rule': return '#a855f7';
        case 'pattern': return '#3b82f6';
        case 'preference': return '#10b981';
        case 'insight': return '#f59e0b';
        case 'correction': return '#ef4444';
        default: return '#94a3b8';
      }
    };

    // Render Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (d.type === 'core') return '#c084fc';
        if (d.type === 'semantic') return '#ec4899';
        if (d.type === 'source') return '#475569';
        return '#64748b';
      })
      .attr('stroke-opacity', d => (d.type === 'semantic' ? 0.3 : d.type === 'core' ? 0.6 : 0.4))
      .attr('stroke-width', d => (d.type === 'core' ? 2.5 : d.type === 'semantic' ? 1 : 1.5))
      .attr('stroke-dasharray', d => (d.type === 'semantic' ? '3,3' : 'none'));

    // Drag behavior
    const dragstarted = (event: d3.D3DragEvent<SVGGElement, D3BrainNode, D3BrainNode>, d: D3BrainNode) => {
      if (!event.active) simulation.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    };

    const dragged = (event: d3.D3DragEvent<SVGGElement, D3BrainNode, D3BrainNode>, d: D3BrainNode) => {
      d.fx = event.x;
      d.fy = event.y;
    };

    const dragended = (event: d3.D3DragEvent<SVGGElement, D3BrainNode, D3BrainNode>, d: D3BrainNode) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    };

    // Render Nodes Group
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, D3BrainNode>('g')
      .data(d3NodesArray)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, D3BrainNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Outer Halo / Pulse Circle (Lightweight vector halo without SVG raster filters)
    nodeGroup.append('circle')
      .attr('r', d => d.radius + (d.type === 'core' ? 10 : 5))
      .attr('fill', d => getNodeColor(d))
      .attr('fill-opacity', d => (d.type === 'core' ? 0.25 : 0.12))
      .attr('stroke', d => getNodeColor(d))
      .attr('stroke-width', d => (d.type === 'core' ? 2 : 1))
      .attr('stroke-opacity', 0.5);

    // Inner Circle
    nodeGroup.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => (d.type === 'core' ? '#581c87' : '#090d16'))
      .attr('stroke', d => getNodeColor(d))
      .attr('stroke-width', d => (d.type === 'core' ? 3 : 2));

    // Text Label inside Core / Category / Memory
    nodeGroup.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.type === 'memory' ? `${d.radius + 12}px` : '0.35em'))
      .attr('font-size', d => (d.type === 'core' ? '12px' : d.type === 'category' ? '10px' : '9px'))
      .attr('font-weight', 'bold')
      .attr('fill', d => (d.type === 'core' || d.type === 'category' ? '#ffffff' : '#cbd5e1'))
      .style('pointer-events', 'none');

    // Tick Handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3BrainNode).x || 0)
        .attr('y1', d => (d.source as D3BrainNode).y || 0)
        .attr('x2', d => (d.target as D3BrainNode).x || 0)
        .attr('y2', d => (d.target as D3BrainNode).y || 0);

      nodeGroup.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Clean up simulation when unmounted or re-rendered
    return () => {
      simulation.stop();
    };

  }, [memories, filterCategory, searchQuery, isFullscreen]);

  const handleZoomReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }
  };

  const handleDeleteMemory = (id: string) => {
    if (confirm("Deseja apagar esta memória do Cérebro?")) {
      brainService.removeMemory(id);
      loadGraphData();
      setSelectedNode(null);
      if (onMemoryChange) onMemoryChange();
    }
  };

  const graphJSX = (
    <div className={`relative w-full h-full bg-[#07090e] border border-purple-900/40 rounded-3xl flex flex-col overflow-hidden select-none font-sans ${isFullscreen ? 'fixed inset-0 z-[99999] rounded-none border-none' : 'min-h-[480px]'}`}>
      
      {/* GRAPH CONTROL BAR - MOBILE FIRST & RESPONSIVE */}
      <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-gray-900/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-purple-900/50 shadow-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-purple-950/80 border border-purple-800 px-2.5 py-1 rounded-xl shrink-0">
            <span className="text-sm">🧠</span>
            <span className="text-[11px] sm:text-xs font-black uppercase text-purple-200">
              Grafo do Cérebro ({memories.length})
            </span>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar memória ou nó..."
            className="bg-gray-950 border border-gray-800 text-xs text-white px-2.5 py-1 rounded-xl outline-none focus:border-purple-500 w-28 sm:w-44 font-mono shrink-0"
          />

          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 custom-scrollbar">
            {['all', 'rule', 'pattern', 'preference', 'insight', 'correction'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-all shrink-0 ${
                  filterCategory === cat
                    ? 'bg-purple-900 text-white border-purple-500'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>
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
              title="Centralizar"
            >
              Reset
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-black rounded-xl shadow-lg shadow-purple-950/50 transition-all uppercase tracking-wider active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            {isFullscreen ? '✕ Sair da Tela Cheia' : '🖥️ Tela Cheia'}
          </button>
        </div>
      </div>

      {/* SVG CANVAS */}
      <div ref={containerRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing">
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* NODE DETAILS INSPECTOR CARD */}
      {selectedNode && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:right-4 z-20 sm:w-80 bg-gray-900/95 border border-purple-800/80 p-4 rounded-2xl shadow-2xl backdrop-blur-lg animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <h4 className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <span>{selectedNode.type === 'core' ? '🧠 Núcleo do Cérebro' : selectedNode.type === 'category' ? '🏷️ Categoria Hub' : selectedNode.type === 'source' ? '🔌 Fonte de Dados' : '📜 Memória Gravada'}</span>
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-xs"
            >
              ✕
            </button>
          </div>

          {selectedNode.type === 'memory' ? (
            <div className="space-y-3 text-xs">
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-850 text-gray-200 font-sans leading-relaxed max-h-32 overflow-y-auto">
                "{selectedNode.content}"
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400">
                <div className="bg-gray-950 p-2 rounded-lg border border-gray-850">
                  <span className="text-gray-500 block">Categoria:</span>
                  <span className="text-purple-400 font-bold uppercase">{selectedNode.category}</span>
                </div>
                <div className="bg-gray-950 p-2 rounded-lg border border-gray-850">
                  <span className="text-gray-500 block">Importância:</span>
                  <span className="text-amber-400 font-bold uppercase">{selectedNode.importance}</span>
                </div>
                <div className="bg-gray-950 p-2 rounded-lg border border-gray-850">
                  <span className="text-gray-500 block">Origem:</span>
                  <span className="text-blue-400 font-bold">{selectedNode.source || 'user'}</span>
                </div>
                <div className="bg-gray-950 p-2 rounded-lg border border-gray-850">
                  <span className="text-gray-500 block">Uso no Sistema:</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.useCount || 0} vezes</span>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => handleDeleteMemory(selectedNode.id)}
                  className="bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 px-3 py-1 rounded-xl text-xs font-bold transition-all"
                >
                  🗑️ Apagar Memória
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-300 space-y-1.5">
              <p className="font-bold text-white">{selectedNode.label}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Nó de agrupamento da estrutura do Cérebro. Arraste para reposicionar no mapa.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return ReactDOM.createPortal(graphJSX, document.body);
  }

  return graphJSX;
};
