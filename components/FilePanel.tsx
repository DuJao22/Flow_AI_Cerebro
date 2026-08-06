import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GeneratedFile } from '../types';
import { brainService } from '../services/brainService';

interface FilePanelProps {
  files: GeneratedFile[];
  isOpen?: boolean;
}

export const FilePanel: React.FC<FilePanelProps> = ({ files, isOpen = true }) => {
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceWidth, setDeviceWidth] = useState<'100%' | '1024px' | '768px' | '375px'>('100%');
  const [copied, setCopied] = useState(false);
  const [learningMessage, setLearningMessage] = useState<string | null>(null);
  const [isLearning, setIsLearning] = useState(false);

  // Helper to extract pure clean HTML from stringified JSON or markdown codeblocks
  const getCleanHtmlContent = (content: string): string => {
    if (!content) return '';
    let text = content;

    // If text is a stringified JSON containing html_code / html / code
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.html_code) text = parsed.html_code;
        else if (parsed.html) text = parsed.html;
        else if (parsed.code) text = parsed.code;
        else if (parsed.content) text = parsed.content;
      } catch (e) {}
    }

    // Markdown block extraction
    const match = text.match(/```(?:html|xml)?\s*([\s\S]*?)\s*```/i);
    if (match) {
      text = match[1];
    }

    // Unescape literal escapes (\n, \", \\)
    if (text.includes('\\n') && !text.includes('\n')) {
      text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '  ');
    }

    return text.trim();
  };

  const downloadFile = (file: GeneratedFile) => {
    const byteOrderMark = '\uFEFF';
    let mimeType = 'text/plain;charset=utf-8';
    if (file.extension === 'html' || file.name.endsWith('.html')) mimeType = 'text/html;charset=utf-8';
    if (file.extension === 'json') mimeType = 'application/json;charset=utf-8';
    if (file.extension === 'csv') mimeType = 'text/csv;charset=utf-8';

    const blob = new Blob([byteOrderMark, file.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleAbsorbLearning = async (file: GeneratedFile) => {
    if (isLearning) return;
    setIsLearning(true);
    setLearningMessage("🧠 Cérebro de IA analisando design e taxas de conversão da página...");
    
    const insight = await brainService.learnFromLandingPage(file.name, file.content);
    setLearningMessage(`✨ Novo Aprendizado Gravado: "${insight}"`);
    setIsLearning(false);

    setTimeout(() => {
      setLearningMessage(null);
    }, 6000);
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-gray-950 flex flex-col font-mono text-xs w-full">
      
      {/* MENSAGEM DE TOAST DE APRENDIZADO */}
      {learningMessage && (
        <div className="bg-purple-900/90 text-purple-200 border-b border-purple-700/60 p-2.5 text-center text-[11px] font-sans font-bold animate-fade-in flex items-center justify-center gap-2">
          <span>{learningMessage}</span>
        </div>
      )}

      {/* LISTA DE ARQUIVOS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 py-10">
            <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="italic text-xs font-sans">Nenhum arquivo gerado no projeto até o momento.</span>
          </div>
        )}
        
        {files.map((file) => {
          const isHtml = file.extension === 'html' || file.name.endsWith('.html') || file.content.toLowerCase().includes('<!doctype html');
          
          return (
            <div 
              key={file.id} 
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 p-3.5 rounded-xl transition-all shadow-md flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold uppercase text-[11px] border ${
                    isHtml 
                      ? 'bg-purple-950 text-purple-300 border-purple-800/80 shadow-md shadow-purple-950/30' 
                      : 'bg-gray-800 text-blue-400 border-gray-700'
                  }`}>
                    {isHtml ? 'HTML' : file.extension}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-200 font-bold text-xs flex items-center gap-2">
                      {file.name}
                      {isHtml && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-sans font-semibold">
                          Landing Page
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 text-[10px]">
                      Gerado às {new Date(file.timestamp).toLocaleTimeString()} • {Math.round(file.content.length / 1024 * 10) / 10} KB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => downloadFile(file)}
                    className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors border border-gray-700"
                    title="Baixar Arquivo (UTF-8)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO E VISUALIZAÇÃO */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-800/80 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedFile(file);
                    setPreviewMode('preview');
                    setIsFullscreen(false);
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-750 text-gray-200 hover:text-white text-[11px] font-sans font-bold py-1.5 px-3 rounded-lg border border-gray-700 transition-all flex items-center justify-center gap-1.5"
                >
                  👁️ Ver {isHtml ? 'HTML / Preview' : 'Conteúdo'}
                </button>

                {isHtml && (
                  <button
                    onClick={() => {
                      setSelectedFile(file);
                      setPreviewMode('preview');
                      setIsFullscreen(true);
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-sans font-bold py-1.5 px-3 rounded-lg transition-all shadow-md shadow-purple-900/30 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    🖥️ Modo Tela Cheia
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PADRÃO DE PRÉ-VISUALIZAÇÃO (INLINE) */}
      {selectedFile && !isFullscreen && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <div>
                  <h3 className="font-bold text-white text-xs font-sans">{selectedFile.name}</h3>
                  <span className="text-[10px] text-gray-500">Visualização de Arquivo</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className={`px-3 py-1 text-[11px] font-sans font-bold rounded-md transition-all ${
                      previewMode === 'preview' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🌐 Renderizado
                  </button>
                  <button
                    onClick={() => setPreviewMode('code')}
                    className={`px-3 py-1 text-[11px] font-sans font-bold rounded-md transition-all ${
                      previewMode === 'code' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    💻 Código Fonte
                  </button>
                </div>

                <button
                  onClick={() => setIsFullscreen(true)}
                  className="bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/80 px-3 py-1.5 rounded-lg text-[11px] font-sans font-bold transition-colors"
                >
                  🖥️ Tela Cheia
                </button>

                <button
                  onClick={() => setSelectedFile(null)}
                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 bg-gray-950 overflow-hidden relative">
              {previewMode === 'preview' ? (
                <iframe
                  srcDoc={getCleanHtmlContent(selectedFile.content)}
                  title="HTML Preview"
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-scripts allow-modals allow-same-origin"
                />
              ) : (
                <div className="relative h-full">
                  <button
                    onClick={() => handleCopyCode(getCleanHtmlContent(selectedFile.content))}
                    className="absolute top-3 right-3 z-10 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-sans font-bold border border-gray-700 transition-colors"
                  >
                    {copied ? '✅ Copiado!' : '📋 Copiar Código'}
                  </button>
                  <pre className="h-full p-4 overflow-auto text-[11px] leading-relaxed text-emerald-400 font-mono bg-gray-950">
                    {getCleanHtmlContent(selectedFile.content)}
                  </pre>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between shrink-0">
              <button
                onClick={() => handleAbsorbLearning(selectedFile)}
                disabled={isLearning}
                className="bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-700/60 px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5"
              >
                🧠 Absorver Aprendizado no Cérebro
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(selectedFile)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg text-xs font-sans font-bold transition-colors"
                >
                  ⬇️ Baixar
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-lg text-xs font-sans font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL TELA CHEIA (FULLSCREEN VIEWPORT) */}
      {/* ========================================================================= */}
      {selectedFile && isFullscreen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-950 flex flex-col w-screen h-screen overflow-hidden animate-fade-in">
          
          {/* TOOLBAR EM TELA CHEIA */}
          <div className="h-14 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between shrink-0 select-none">
            
            {/* LADO ESQUERDO: NOME DO ARQUIVO & BADGE */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                🖥️
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-sans flex items-center gap-2">
                  {selectedFile.name}
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    TELA CHEIA
                  </span>
                </h2>
                <span className="text-[10px] text-gray-400 font-mono">Visualização em Tempo Real de Landing Page</span>
              </div>
            </div>

            {/* CENTRO: SELETORES DE DISPOSITIVO */}
            <div className="hidden md:flex items-center bg-gray-950 border border-gray-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setDeviceWidth('100%')}
                className={`px-3 py-1 text-xs font-sans font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceWidth === '100%' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                🖥️ Desktop
              </button>
              <button
                onClick={() => setDeviceWidth('1024px')}
                className={`px-3 py-1 text-xs font-sans font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceWidth === '1024px' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                💻 Laptop
              </button>
              <button
                onClick={() => setDeviceWidth('768px')}
                className={`px-3 py-1 text-xs font-sans font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceWidth === '768px' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                📱 Tablet
              </button>
              <button
                onClick={() => setDeviceWidth('375px')}
                className={`px-3 py-1 text-xs font-sans font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  deviceWidth === '375px' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                📱 Mobile
              </button>
            </div>

            {/* LADO DIREITO: AÇÕES */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAbsorbLearning(selectedFile)}
                disabled={isLearning}
                className="hidden sm:flex items-center gap-1.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700/60 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-all shadow-md"
              >
                🧠 Extrair Aprendizado
              </button>

              <button
                onClick={() => handleOpenNewTab(selectedFile)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1"
                title="Abrir em Nova Aba do Navegador"
              >
                🔗 Nova Aba
              </button>

              <button
                onClick={() => downloadFile(selectedFile)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-xl text-xs font-sans font-bold transition-colors"
                title="Baixar HTML"
              >
                ⬇️
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="bg-red-600 hover:bg-red-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-sans font-bold transition-all shadow-md"
              >
                ✕ Sair da Tela Cheia
              </button>
            </div>
          </div>

          {/* PALCO IFRAME TELA CHEIA */}
          <div className="flex-1 bg-gray-900 flex items-center justify-center p-0 md:p-4 overflow-hidden relative">
            <div 
              style={{ width: deviceWidth }} 
              className="h-full max-h-full bg-white transition-all duration-300 shadow-2xl md:rounded-2xl overflow-hidden border border-gray-800 relative"
            >
              <iframe
                srcDoc={getCleanHtmlContent(selectedFile.content)}
                title="Landing Page Fullscreen Preview"
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-modals allow-same-origin"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default FilePanel;
