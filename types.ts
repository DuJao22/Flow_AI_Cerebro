
import type { Node, Edge } from 'reactflow';
import type { BrainMemory } from './services/brainService';

export type { BrainMemory };

export enum NodeType {
  HTTP_REQUEST = 'httpRequest',
  WEBHOOK = 'webhook',
  DELAY = 'delay',
  IF_CONDITION = 'ifCondition',
  LOGGER = 'logger',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  FILE_SAVE = 'fileSave', // Novo node para salvar arquivos
  AI_BRAIN = 'aiBrain',   // Nó do Cérebro de Aprendizado / Raciocínio Inteligente
  HTML_ANALYZER = 'htmlAnalyzer', // Nó de Análise Estrutural HTML e Aprendizado com Chave do Cérebro
  START = 'start'
}

export enum NodeStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  RETRY = 'RETRY'
}

export interface NodeData {
  label: string;
  type: NodeType;
  status: NodeStatus;
  config: Record<string, any>;
  logs?: string[];
  [key: string]: any;
}

export type FlowNode = Node<NodeData>;
export type FlowEdge = Edge;

export interface FlowSchema {
  meta: {
    engine: string;
    created_by: string;
  };
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  level: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN';
  message: string;
}

export interface GeneratedFile {
  id: string;
  name: string;
  content: string;
  extension: string; // 'txt', 'json', 'csv'
  timestamp: number;
  nodeId: string;
}

export interface AIMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  flowData?: FlowSchema; // Optional payload if AI generates a flow
}

export interface ExecutionContext {
  [nodeId: string]: any; // Output data from nodes
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  files: GeneratedFile[]; // Adicionado para persistência de arquivos
}

export interface FlowContext {
  logs: LogEntry[];
  currentNodes: FlowNode[];
  currentEdges: FlowEdge[];
}
