
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { NodeStatus, NodeType } from '../types';

const CustomNode = ({ data, isConnectable, selected }: NodeProps) => {
  const isRunning = data.status === NodeStatus.RUNNING;
  const isSuccess = data.status === NodeStatus.SUCCESS;
  const isError = data.status === NodeStatus.ERROR;

  // Configuração visual baseada no status
  let statusStyles = 'border-gray-600 bg-gray-900'; // Default mais escuro
  let statusLabel = null;
  let statusIcon = null;

  switch (data.status as NodeStatus) {
    case NodeStatus.RUNNING:
      // Amarelo/Âmbar fluorescente com brilho e pulso sutil ultra-profissional
      statusStyles = 'border-amber-400 bg-gradient-to-r from-amber-950/90 via-gray-900 to-yellow-950/90 shadow-[0_0_25px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/80 z-50';
      statusLabel = (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-50">
             <span className="bg-amber-400 text-gray-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xl flex items-center gap-1.5 border border-amber-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-950 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-950"></span>
                </span>
                EXECUTANDO...
             </span>
        </div>
      );
      statusIcon = (
        <div className="relative flex items-center justify-center mr-2.5 shrink-0">
          <div className="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full"></div>
        </div>
      );
      break;

    case NodeStatus.SUCCESS:
      statusStyles = 'border-emerald-500 bg-gradient-to-r from-emerald-950/70 via-gray-900 to-emerald-950/70 shadow-[0_0_18px_rgba(16,185,129,0.4)]';
      statusIcon = <span className="text-emerald-400 mr-2 font-black text-sm">✓</span>;
      break;

    case NodeStatus.ERROR:
      statusStyles = 'border-rose-500 bg-gradient-to-r from-rose-950/80 via-gray-900 to-rose-950/80 shadow-[0_0_18px_rgba(244,63,94,0.5)]';
      statusIcon = <span className="text-rose-400 mr-2 font-black text-sm">✕</span>;
      statusLabel = (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-50">
             <span className="bg-rose-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md border border-rose-400">
                FALHOU
             </span>
        </div>
      );
      break;

    case NodeStatus.IDLE:
    default:
      if (selected) {
          statusStyles = 'border-blue-400 bg-gray-800 ring-2 ring-blue-500 shadow-xl';
      } else if (data.type === NodeType.AI_BRAIN || data.type === 'aiBrain') {
          statusStyles = 'border-purple-500/80 bg-gradient-to-r from-purple-950/70 via-gray-900 to-indigo-950/70 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:border-purple-400';
          statusIcon = <span className="mr-2 text-sm animate-pulse">🧠</span>;
      } else {
          statusStyles = 'border-gray-600 bg-gray-800 hover:border-gray-500';
      }
      if (!statusIcon) {
          statusIcon = <div className={`rounded-full w-2 h-2 mr-2 shrink-0 ${selected ? 'bg-blue-400' : 'bg-gray-600'}`}></div>;
      }
      break;
  }

  return (
    <div className="relative group">
      {/* GLOWING PULSE BACKDROP FOR RUNNING STATE */}
      {isRunning && (
        <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 opacity-60 blur-md animate-pulse pointer-events-none" />
      )}

      <div className={`px-4 py-3 rounded-xl border-2 min-w-[185px] transition-all duration-300 relative ${statusStyles}`}>
        
        {statusLabel}

        <div className="flex items-center">
          {statusIcon}
          <div className="flex flex-col overflow-hidden">
            <div className="text-xs font-black text-gray-100 truncate max-w-[150px]" title={data.label}>
              {data.label}
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-widest font-mono mt-0.5">
              {data.type}
            </div>
          </div>
        </div>

        {/* Inputs (Top) */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          className="w-3.5 h-3.5 bg-gray-400 border-2 border-gray-900 hover:bg-white transition-colors"
        />

        {/* Outputs (Bottom) */}
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          className="w-3.5 h-3.5 bg-gray-400 border-2 border-gray-900 hover:bg-white transition-colors"
        />
      </div>
    </div>
  );
};

export default memo(CustomNode);
