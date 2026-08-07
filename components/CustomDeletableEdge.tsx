import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, EdgeProps } from 'reactflow';

export default function CustomDeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 4 : (style?.strokeWidth || 3),
          stroke: selected ? '#ef4444' : (style?.stroke || '#3b82f6'),
          transition: 'stroke 0.2s, stroke-width 0.2s',
          cursor: 'pointer',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            type="button"
            onClick={handleDelete}
            className={`group flex items-center gap-1.5 px-2 py-1 rounded-full border shadow-xl transition-all cursor-pointer ${
              selected
                ? 'bg-red-600 border-red-400 text-white scale-110 shadow-red-900/50 ring-2 ring-red-400'
                : 'bg-gray-900/90 border-blue-500/50 hover:border-red-500 text-gray-200 hover:text-white hover:bg-red-600/90'
            }`}
            title="Clique para apagar esta conexão e desconectar os nós"
          >
            <span className="text-[11px] font-black leading-none">✕</span>
            <span className="text-[10px] font-bold uppercase tracking-wider hidden group-hover:inline transition-all">
              Apagar
            </span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
