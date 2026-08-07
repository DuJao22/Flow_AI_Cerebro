
import { SavedProject, FlowNode, FlowEdge, GeneratedFile } from '../types';

const STORAGE_KEY = 'flow_architect_projects_v1';

export const storageService = {
  getProjects: (): SavedProject[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Erro ao ler projetos:", e);
      return [];
    }
  },

  saveProject: (name: string, nodes: FlowNode[], edges: FlowEdge[], files: GeneratedFile[]): SavedProject => {
    const projects = storageService.getProjects();
    
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes,
      edges,
      files
    };

    const updatedProjects = [newProject, ...projects];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    } catch (e) {
      console.warn("QuotaExceededError ao salvar projeto. Otimizando tamanho dos arquivos salvos:", e);
      try {
        const lightweightProjects = updatedProjects.map(p => ({
          ...p,
          files: p.files.map(f => ({
            ...f,
            content: f.content.length > 25000 
              ? f.content.substring(0, 25000) + '\n<!-- [CONTEÚDO COMPACTADO NO ARMAZENAMENTO LOCAL] -->' 
              : f.content
          }))
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightProjects));
      } catch (e2) {
        console.error("Erro crítico ao salvar no LocalStorage:", e2);
      }
    }
    return newProject;
  },

  deleteProject: (id: string): void => {
    const projects = storageService.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error("Erro ao atualizar lista de projetos após exclusão:", e);
    }
  },

  updateProject: (id: string, nodes: FlowNode[], edges: FlowEdge[], files: GeneratedFile[]): void => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === id);
    
    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        nodes,
        edges,
        files,
        updatedAt: Date.now()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      } catch (e) {
        console.warn("QuotaExceededError ao atualizar projeto. Otimizando arquivos:", e);
        try {
          const lightweightProjects = projects.map(p => ({
            ...p,
            files: p.files.map(f => ({
              ...f,
              content: f.content.length > 25000 
                ? f.content.substring(0, 25000) + '\n<!-- [CONTEÚDO COMPACTADO NO ARMAZENAMENTO LOCAL] -->' 
                : f.content
            }))
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightProjects));
        } catch (e2) {
          console.error("Erro crítico ao atualizar projeto no LocalStorage:", e2);
        }
      }
    }
  }
};
