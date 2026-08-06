import React, { useState, useEffect } from 'react';
import { brainService, BrainMemory } from '../services/brainService';
import { keyManager } from '../services/keyManager';
import { GoogleGenAI } from '@google/genai';
import { BrainKnowledgeGraph } from './BrainKnowledgeGraph';

interface BrainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrainModal: React.FC<BrainModalProps> = ({ isOpen, onClose }) => {
  const [memories, setMemories] = useState<BrainMemory[]>([]);
  const [activeTab, setActiveTab] = useState<'memories' | 'graph' | 'test' | 'config'>('memories');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Form states for adding memory
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<BrainMemory['category']>('rule');
  const [newImportance, setNewImportance] = useState<BrainMemory['importance']>('medium');

  // Test Brain states
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Settings
  const [autoLearnFromFlows, setAutoLearnFromFlows] = useState(true);
  const [autoLearnFromChat, setAutoLearnFromChat] = useState(true);
  const [dedicatedKeyInput, setDedicatedKeyInput] = useState('');
  const [keyStatusMessage, setKeyStatusMessage] = useState<string | null>(null);
  const [dbStatusMessage, setDbStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
      setDedicatedKeyInput(brainService.getDedicatedApiKey());
    }
  }, [isOpen]);

  const loadMemories = () => {
    setMemories(brainService.getMemories());
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    brainService.addMemory(newContent.trim(), newCategory, newImportance, 'user');
    setNewContent('');
    loadMemories();
  };

  const handleDeleteMemory = (id: string) => {
    brainService.removeMemory(id);
    loadMemories();
  };

  const handleClearAll = () => {
    if (confirm("Tem certeza que deseja apagar TODAS as memórias do Cérebro de Aprendizado?")) {
      brainService.clearMemories();
      loadMemories();
    }
  };

  const handleResetDefaults = () => {
    brainService.resetToDefaults();
    loadMemories();
  };

  const handleSaveDedicatedKey = () => {
    brainService.setDedicatedApiKey(dedicatedKeyInput);
    setKeyStatusMessage("✅ Chave API Gemini do Cérebro atualizada com sucesso!");
    setTimeout(() => setKeyStatusMessage(null), 4000);
  };

  const handleClearDedicatedKey = () => {
    brainService.setDedicatedApiKey('');
    setDedicatedKeyInput('');
    setKeyStatusMessage("ℹ️ Chave dedicada removida. O Cérebro usará a chave geral do sistema.");
    setTimeout(() => setKeyStatusMessage(null), 4000);
  };

  const handleExportDB = () => {
    const jsonStr = brainService.exportDatabase();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDbStatusMessage("📥 Download do banco de dados (DB) concluído!");
    setTimeout(() => setDbStatusMessage(null), 4000);
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = brainService.importDatabase(content);
      if (result.success) {
        loadMemories();
        setDbStatusMessage(`✅ ${result.message}`);
      } else {
        setDbStatusMessage(`❌ ${result.message}`);
      }
      setTimeout(() => setDbStatusMessage(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestBrain = async () => {
    if (!testPrompt.trim() || isTesting) return;
    setIsTesting(true);
    setTestResponse('');

    const activeKey = await brainService.getEffectiveApiKey();
    if (!activeKey) {
      setTestResponse("❌ Erro: Nenhuma chave de API Gemini disponível para o Cérebro. Configure uma chave nas opções.");
      setIsTesting(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      const formattedMemories = brainService.getFormattedContext();

      const prompt = `Você é o CÉREBRO DE APRENDIZADO IA do Flow Architect.
Você possui o seguinte banco de memórias e aprendizados acumulados:

=== BANCO DE MEMÓRIAS DO CÉREBRO ===
${formattedMemories}
===================================

Sua tarefa: Analisar a solicitação abaixo aplicando rigorosamente o conhecimento acumulado do seu Cérebro. Explicar seu raciocínio e fornecer a solução.

SOLICITAÇÃO DE TESTE:
${testPrompt}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.3 }
      });

      setTestResponse(response.text || "Sem resposta gerada.");
    } catch (err: any) {
      setTestResponse(`❌ Erro durante a inferência do Cérebro: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  const filteredMemories = memories.filter(m => 
    categoryFilter === 'all' ? true : m.category === categoryFilter
  );

  const getCategoryBadge = (cat: BrainMemory['category']) => {
    switch (cat) {
      case 'rule':
        return <span className="bg-purple-900/60 text-purple-300 border border-purple-700/50 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Regra</span>;
      case 'pattern':
        return <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Padrão</span>;
      case 'preference':
        return <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Preferência</span>;
      case 'insight':
        return <span className="bg-amber-900/60 text-amber-300 border border-amber-700/50 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Insight</span>;
      case 'correction':
        return <span className="bg-red-900/60 text-red-300 border border-red-700/50 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Correção</span>;
    }
  };

  const getImportanceColor = (imp: BrainMemory['importance']) => {
    switch (imp) {
      case 'high': return 'text-red-400 font-bold';
      case 'medium': return 'text-amber-400';
      case 'low': return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-gray-900 border border-purple-900/60 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(147,51,234,0.2)] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-gray-800 bg-gradient-to-r from-purple-950/80 via-gray-900 to-indigo-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-lg sm:text-xl shadow-lg shadow-purple-900/40 shrink-0">
              🧠
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Cérebro de Aprendizado IA</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono">
                  {memories.length} memórias
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-gray-400">Banco de Conhecimento Contínuo e Memória de Longo Prazo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* NAVIGATION TABS - SCROLLABLE ON MOBILE */}
        <div className="px-4 sm:px-6 pt-3 border-b border-gray-800 bg-gray-950/50 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('memories')}
            className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'memories' 
                ? 'border-purple-500 text-purple-300 bg-purple-950/30' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            📚 Memórias ({memories.length})
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'graph' 
                ? 'border-purple-500 text-purple-300 bg-purple-950/40' 
                : 'border-transparent text-purple-400/70 hover:text-purple-300'
            }`}
          >
            🕸️ Grafo do Cérebro (D3)
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'test' 
                ? 'border-indigo-500 text-indigo-300 bg-indigo-950/30' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            🧪 Testar Raciocínio
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'config' 
                ? 'border-blue-500 text-blue-300 bg-blue-950/30' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            ⚙️ Configurações
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar bg-gray-950/30 flex flex-col ${activeTab === 'graph' ? 'p-1.5 sm:p-2 space-y-0' : 'p-3 sm:p-6 space-y-6'}`}>
          
          {/* --- TAB GRAFO DO CÉREBRO --- */}
          {activeTab === 'graph' && (
            <div className="w-full flex-1 h-full flex flex-col min-h-[500px] sm:min-h-[600px]">
              <BrainKnowledgeGraph onMemoryChange={loadMemories} />
            </div>
          )}
          
          {/* --- TAB MEMÓRIAS --- */}
          {activeTab === 'memories' && (
            <div className="space-y-6">
              
              {/* FORMA DE ADICIONAR NOVA REGRA */}
              <form onSubmit={handleAddMemory} className="bg-gray-900 border border-purple-900/40 p-4 rounded-2xl space-y-3 shadow-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <span>➕ Ensinar Nova Regra ao Cérebro</span>
                </h3>
                
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Ex: Sempre validar se as requisições HTTP retornam status 200 antes de prosseguir..."
                  rows={2}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold mr-2">Categoria:</span>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-300 px-2 py-1 outline-none"
                      >
                        <option value="rule">Regra Fictícia / Estrita</option>
                        <option value="pattern">Padrão de Execução</option>
                        <option value="preference">Preferência de Formato</option>
                        <option value="insight">Insight Geral</option>
                        <option value="correction">Correção de Erro</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold mr-2">Prioridade:</span>
                      <select
                        value={newImportance}
                        onChange={(e) => setNewImportance(e.target.value as any)}
                        className="bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-300 px-2 py-1 outline-none"
                      >
                        <option value="high">Alta (Crítica)</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!newContent.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Gravar Memória
                  </button>
                </div>
              </form>

              {/* FILTROS E AÇÕES EM MASSA */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {['all', 'rule', 'pattern', 'preference', 'insight', 'correction'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                        categoryFilter === cat 
                          ? 'bg-purple-900/50 border-purple-500 text-white' 
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {cat === 'all' ? 'Todas' : cat}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetDefaults}
                    className="text-[10px] font-bold uppercase text-gray-400 hover:text-white bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Restaurar Padrões
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] font-bold uppercase text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Limpar Tudo
                  </button>
                </div>
              </div>

              {/* LISTA DE MEMÓRIAS */}
              <div className="space-y-3">
                {filteredMemories.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs">
                    Nenhuma memória registrada para o filtro selecionado.
                  </div>
                ) : (
                  filteredMemories.map((mem) => (
                    <div 
                      key={mem.id}
                      className="bg-gray-900 border border-gray-800 hover:border-purple-800/60 p-4 rounded-2xl transition-all flex items-start justify-between gap-4 group shadow-sm"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getCategoryBadge(mem.category)}
                          <span className={`text-[10px] uppercase font-mono ${getImportanceColor(mem.importance)}`}>
                            {mem.importance} prioridade
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono">
                            Origem: {mem.source === 'user' ? 'Manual' : mem.source === 'auto' ? 'IA Chat' : 'Execução'}
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono ml-auto">
                            Usado {mem.useCount}x
                          </span>
                        </div>

                        <p className="text-xs text-gray-200 leading-relaxed font-sans">
                          {mem.content}
                        </p>

                        <div className="text-[9px] text-gray-600 font-mono">
                          Registrado em: {new Date(mem.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-2 text-gray-600 hover:text-red-400 opacity-60 group-hover:opacity-100 transition-opacity"
                        title="Apagar esta memória"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* --- TAB TESTAR RACIOCÍNIO --- */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-900/50 p-4 rounded-2xl">
                <h3 className="text-xs font-black uppercase text-indigo-300 mb-1">Simulação de Raciocínio</h3>
                <p className="text-[11px] text-gray-400">
                  Teste como o Cérebro de Aprendizado aplica o conhecimento acumulado para responder dúvidas ou tomar decisões de fluxo.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Pergunta ou Cenário de Teste:
                </label>
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Ex: Como devo tratar um erro 429 retornado por uma API externa no meu fluxo?"
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none"
                />
                <button
                  onClick={handleTestBrain}
                  disabled={isTesting || !testPrompt.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Processando com Banco de Memória...
                    </>
                  ) : (
                    '⚡ Consultar Cérebro'
                  )}
                </button>
              </div>

              {testResponse && (
                <div className="bg-gray-900 border border-indigo-900/50 rounded-2xl p-4 space-y-2 animate-fade-in">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Resposta do Cérebro:</span>
                  <div className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed font-sans bg-gray-950 p-3 rounded-xl border border-gray-850">
                    {testResponse}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- TAB CONFIGURAÇÕES --- */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              
              {/* STATUS MESSAGES */}
              {keyStatusMessage && (
                <div className="bg-purple-950/80 border border-purple-800 text-purple-200 p-3 rounded-xl text-xs font-bold animate-fade-in">
                  {keyStatusMessage}
                </div>
              )}

              {dbStatusMessage && (
                <div className="bg-blue-950/80 border border-blue-800 text-blue-200 p-3 rounded-xl text-xs font-bold animate-fade-in">
                  {dbStatusMessage}
                </div>
              )}

              {/* 🔑 SEÇÃO DE CHAVE API GEMINI DEDICADA */}
              <div className="bg-gray-900 border border-purple-900/50 p-5 rounded-2xl space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                    <span>🔑 Chave API Gemini do Cérebro</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    dedicatedKeyInput && dedicatedKeyInput.length > 20
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-blue-950 text-blue-400 border-blue-800'
                  }`}>
                    {dedicatedKeyInput && dedicatedKeyInput.length > 20 ? '🟢 Chave Dedicada Ativa' : '🔵 Usando Chave Geral do Sistema'}
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Você pode configurar uma chave de API Gemini exclusiva dedicada apenas ao gerenciamento, raciocínio e aprendizado do Cérebro IA. Se deixado em branco, o Cérebro utilizará o pool geral de chaves do sistema.
                </p>

                <div className="space-y-2">
                  <input
                    type="password"
                    value={dedicatedKeyInput}
                    onChange={(e) => setDedicatedKeyInput(e.target.value)}
                    placeholder="Cole sua chave AIzaSy..."
                    className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none font-mono tracking-wider"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {dedicatedKeyInput && (
                      <button
                        onClick={handleClearDedicatedKey}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                      >
                        Remover Chave
                      </button>
                    )}
                    <button
                      onClick={handleSaveDedicatedKey}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Salvar Chave do Cérebro
                    </button>
                  </div>
                </div>
              </div>

              {/* 🗄️ SEÇÃO DE BANCO DE DADOS EM DB (INDEXEDDB) */}
              <div className="bg-gray-900 border border-indigo-900/50 p-5 rounded-2xl space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                    <span>🗄️ Banco de Dados do Cérebro (DB)</span>
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-0.5 rounded-full font-mono">
                    IndexedDB (FlowArchitectBrainDB)
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  As memórias e aprendizados do Cérebro são persistidos de forma assíncrona em um Banco de Dados no navegador com suporte a transações e backup em dupla camada.
                </p>

                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2 text-[11px] font-mono text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Motor do Banco de Dados:</span>
                    <span className="text-indigo-400 font-bold">IndexedDB v1 + LocalStorage Mirror</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total de Registros (Memórias):</span>
                    <span className="text-purple-400 font-bold">{memories.length} itens gravados</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status da Sincronização:</span>
                    <span className="text-emerald-400 font-bold">🟢 Online & Persistido</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2">
                    <span>📤 Importar Banco de Dados</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDB}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={handleExportDB}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <span>📥 Exportar Backup (.db / .json)</span>
                  </button>
                </div>
              </div>

              {/* COMPORTAMENTO DE APRENDIZADO */}
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Comportamento de Aprendizado Automático</h3>
                
                <label className="flex items-center justify-between p-3 bg-gray-950 rounded-xl border border-gray-850 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-gray-200">Aprender com Landing Pages Criadas</div>
                    <div className="text-[10px] text-gray-500">Extrai automaticamente padrões de design e conversão das páginas geradas.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLearnFromFlows}
                    onChange={(e) => setAutoLearnFromFlows(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-950 rounded-xl border border-gray-850 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-gray-200">Aprender com o AI Chat</div>
                    <div className="text-[10px] text-gray-500">Grava preferências de regras especificadas durante o diálogo com o AI Architect.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoLearnFromChat}
                    onChange={(e) => setAutoLearnFromChat(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
          <div className="text-[10px] text-gray-500 font-mono">
            Status: <span className="text-purple-400 font-bold">Cérebro Ativo & Autônomo</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
