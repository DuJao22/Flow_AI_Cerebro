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

  // Helper to extract pure clean HTML and inject auto-playing presentation frame engine
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

    text = text.trim();

    // Se já for HTML e não contiver o script de apresentação, injeta o player automático de frames
    if ((text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<section') || text.toLowerCase().includes('<div')) && !text.includes('presentation-frame-styles')) {
      const presentationEngine = `
<style id="presentation-frame-styles">
  html, body {
    margin: 0 !important; padding: 0 !important; width: 100vw !important; height: 100vh !important; overflow: hidden !important;
    background: #090d16 !important; font-family: system-ui, -apple-system, sans-serif !important;
  }
  .frame-slide-wrapper {
    width: 100vw; height: 100vh; position: relative; overflow: hidden;
  }
  .frame-slide-wrapper > section,
  .frame-slide-wrapper > header,
  .frame-slide-wrapper > footer,
  .frame-slide-wrapper > main,
  .frame-slide-wrapper > div {
    position: absolute !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
    box-sizing: border-box !important; opacity: 0 !important; pointer-events: none !important;
    transform: scale(0.96) translateY(20px) !important;
    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) !important;
    overflow-y: auto !important; display: flex !important; flex-direction: column !important; justify-content: center !important;
  }
  .frame-slide-wrapper > .active-frame-slide {
    opacity: 1 !important; pointer-events: auto !important; transform: scale(1) translateY(0) !important; z-index: 10 !important;
  }
  #presentation-controls {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    z-index: 999999; display: flex; items-center: center; gap: 12px;
    background: rgba(13, 17, 23, 0.88); backdrop-filter: blur(16px);
    padding: 8px 18px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.18);
    box-shadow: 0 20px 40px rgba(0,0,0,0.7); color: white; font-family: monospace; font-size: 12px;
  }
  #presentation-controls button {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25);
    color: white; border-radius: 9999px; padding: 6px 14px; font-weight: bold;
    cursor: pointer; transition: all 0.2s; font-size: 11px;
  }
  #presentation-controls button:hover { background: #3b82f6; border-color: #60a5fa; transform: scale(1.05); }
  .frame-dot {
    width: 8px; height: 8px; border-radius: 9999px; background: rgba(255,255,255,0.3); transition: all 0.3s;
  }
  .frame-dot.active { background: #38bdf8; width: 22px; box-shadow: 0 0 10px #38bdf8; }
  #frame-progress-bar {
    position: fixed; top: 0; left: 0; height: 4px; background: linear-gradient(90deg, #3b82f6, #a855f7, #ec4899);
    z-index: 999999; transition: width 0.1s linear;
  }
</style>
<script id="presentation-frame-script">
  window.addEventListener('DOMContentLoaded', () => {
    let body = document.body;
    let frames = Array.from(body.querySelectorAll('section, header, footer, main, body > div'));
    if (frames.length <= 1) {
      frames = Array.from(body.children).filter(el => el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.id !== 'presentation-controls' && el.id !== 'frame-progress-bar');
    }
    if (frames.length === 0) return;

    let wrapper = document.createElement('div');
    wrapper.className = 'frame-slide-wrapper';
    frames.forEach(f => wrapper.appendChild(f));
    body.appendChild(wrapper);

    let progress = document.createElement('div');
    progress.id = 'frame-progress-bar';
    body.appendChild(progress);

    let controls = document.createElement('div');
    controls.id = 'presentation-controls';
    controls.innerHTML = \`
      <button id="prev-frame-btn">◀ Ant</button>
      <button id="pause-frame-btn">⏸ Pausa</button>
      <div id="frame-dots" style="display:flex; gap:6px; align-items:center;"></div>
      <button id="next-frame-btn">Próx ▶</button>
      <span id="frame-counter" style="color:#a855f7; font-weight:bold; margin-left:4px;">1/\${frames.length}</span>
    \`;
    body.appendChild(controls);

    let dotsContainer = document.getElementById('frame-dots');
    frames.forEach((_, idx) => {
      let dot = document.createElement('div');
      dot.className = 'frame-dot' + (idx === 0 ? ' active' : '');
      dotsContainer.appendChild(dot);
    });

    let current = 0;
    let isPlaying = true;
    let intervalTime = 4500;
    let timer = null;
    let progressInterval = null;
    let startTime = Date.now();

    function showFrame(index) {
      current = (index + frames.length) % frames.length;
      frames.forEach((f, i) => {
        if (i === current) f.classList.add('active-frame-slide');
        else f.classList.remove('active-frame-slide');
      });

      Array.from(dotsContainer.children).forEach((d, i) => {
        if (i === current) d.classList.add('active');
        else d.classList.remove('active');
      });

      document.getElementById('frame-counter').innerText = (current + 1) + '/' + frames.length;
      resetTimer();
    }

    function resetTimer() {
      clearInterval(timer);
      clearInterval(progressInterval);
      progress.style.width = '0%';
      if (!isPlaying) return;

      startTime = Date.now();
      progressInterval = setInterval(() => {
        let elapsed = Date.now() - startTime;
        let pct = Math.min(100, (elapsed / intervalTime) * 100);
        progress.style.width = pct + '%';
      }, 50);

      timer = setInterval(() => {
        showFrame(current + 1);
      }, intervalTime);
    }

    document.getElementById('prev-frame-btn').onclick = () => showFrame(current - 1);
    document.getElementById('next-frame-btn').onclick = () => showFrame(current + 1);

    let pauseBtn = document.getElementById('pause-frame-btn');
    pauseBtn.onclick = () => {
      isPlaying = !isPlaying;
      pauseBtn.innerText = isPlaying ? '⏸ Pausa' : '▶ Play';
      resetTimer();
    };

    showFrame(0);
  });
</script>
`;
      if (text.includes('</body>')) {
        text = text.replace('</body>', `${presentationEngine}</body>`);
      } else {
        text += presentationEngine;
      }
    }

    return text;
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
                    setIsFullscreen(isHtml ? true : false);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-sans font-bold py-2 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                >
                  🖥️ Visualizar em Tela Cheia {isHtml ? '(HTML)' : ''}
                </button>

                <button
                  onClick={() => handleOpenNewTab(file)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-sans font-bold py-2 px-3 rounded-xl border border-gray-700 transition-all flex items-center justify-center gap-1"
                  title="Abrir diretamente em nova aba do navegador"
                >
                  🔗 Nova Aba
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PADRÃO DE PRÉ-VISUALIZAÇÃO (INLINE) */}
      {selectedFile && !isFullscreen && createPortal(
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
      {/* MODAL TELA CHEIA SIMULADOR DE NAVEGADOR (FULLSCREEN BROWSER SIMULATION) */}
      {/* ========================================================================= */}
      {selectedFile && isFullscreen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-950 flex flex-col w-screen h-screen overflow-hidden animate-fade-in select-none">
          
          {/* BARRA SUPERIOR DO NAVEGADOR SIMULADO */}
          <div className="bg-gray-900 border-b border-gray-800 p-2.5 flex flex-col gap-2 shrink-0">
            
            {/* LINHA 1: CONTROLES DA JANELA, CONTROLES DE NAVEGAÇÃO E ENDEREÇO URL */}
            <div className="flex items-center gap-2 sm:gap-3 justify-between">
              
              {/* LADO ESQUERDO: DOTS + BOTÕES NAVEGAÇÃO */}
              <div className="flex items-center gap-2 shrink-0">
                {/* WINDOW DOTS */}
                <div className="hidden sm:flex items-center gap-1.5 mr-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 cursor-pointer hover:bg-red-500 transition-colors" onClick={() => setIsFullscreen(false)} title="Fechar" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" onClick={() => setDeviceWidth('100%')} title="Tela Cheia" />
                </div>

                {/* BOTÕES NAVEGAÇÃO NAVEGADOR */}
                <div className="flex items-center gap-1 bg-gray-950/80 p-1 rounded-lg border border-gray-800">
                  <button className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors" title="Voltar">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors" title="Avançar">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button 
                    onClick={() => {
                      // Recarrega iframe
                      const iframe = document.getElementById('fullscreen-preview-iframe') as HTMLIFrameElement;
                      if (iframe) iframe.srcdoc = getCleanHtmlContent(selectedFile.content);
                    }} 
                    className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors" 
                    title="Recarregar Página"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              {/* BARRA DE ENDEREÇO SIMULADA (URL BAR) */}
              <div className="flex-1 max-w-2xl bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shadow-inner">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-emerald-400 text-xs shrink-0" title="Conexão Segura SSL">🔒</span>
                  <span className="text-xs text-gray-400 font-mono truncate select-all">
                    https://preview.local/app/<span className="text-purple-300 font-bold">{selectedFile.name}</span>
                  </span>
                </div>
                <button
                  onClick={() => handleOpenNewTab(selectedFile)}
                  className="text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-0.5 rounded-md font-sans font-bold shrink-0 transition-colors flex items-center gap-1"
                  title="Abrir em aba real do navegador"
                >
                  <span>🔗</span> <span className="hidden xs:inline">Nova Aba Real</span>
                </button>
              </div>

              {/* LADO DIREITO: BOTÕES DE MODO E FECHAR */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex bg-gray-950 border border-gray-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewMode === 'preview' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🌐 Live Preview
                  </button>
                  <button
                    onClick={() => setPreviewMode('code')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewMode === 'code' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    💻 Código
                  </button>
                </div>

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="bg-red-600/90 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1"
                >
                  ✕ <span className="hidden md:inline">Sair</span>
                </button>
              </div>

            </div>

            {/* LINHA 2: CONTROLES DE DISPOSITIVO / RESPONSIVIDADE E APRENDIZADO CÉREBRO */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/60 overflow-x-auto scrollbar-none">
              
              {/* SELETORES DE VIEWPORT DE DISPOSITIVO */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase font-mono mr-1 hidden sm:inline">Modo:</span>
                <button
                  onClick={() => setDeviceWidth('100%')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    deviceWidth === '100%' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  🖥️ Desktop <span className="text-[9px] opacity-70">(100%)</span>
                </button>
                <button
                  onClick={() => setDeviceWidth('1024px')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    deviceWidth === '1024px' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  💻 Laptop <span className="text-[9px] opacity-70">(1024px)</span>
                </button>
                <button
                  onClick={() => setDeviceWidth('768px')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    deviceWidth === '768px' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  📱 Tablet <span className="text-[9px] opacity-70">(768px)</span>
                </button>
                <button
                  onClick={() => setDeviceWidth('375px')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                    deviceWidth === '375px' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  📱 Mobile <span className="text-[9px] opacity-70">(375px)</span>
                </button>
              </div>

              {/* AÇÕES ADICIONAIS: APRENDIZADO CÉREBRO & DOWNLOAD */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAbsorbLearning(selectedFile)}
                  disabled={isLearning}
                  className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700/60 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  🧠 <span className="hidden sm:inline">Absorver no Cérebro</span>
                </button>

                <button
                  onClick={() => downloadFile(selectedFile)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                  title="Baixar HTML UTF-8"
                >
                  ⬇️ Baixar
                </button>
              </div>

            </div>

          </div>

          {/* PALCO DO NAVEGADOR SIMULADO (VIEWPORT RESPONSIVO) */}
          <div className={`flex-1 bg-gray-950 flex items-center justify-center overflow-hidden relative ${deviceWidth === '100%' ? 'p-0' : 'p-2 md:p-6 bg-gray-900/90'}`}>
            <div 
              style={{ width: deviceWidth }} 
              className={`h-full max-h-full transition-all duration-300 relative ${
                deviceWidth === '100%' 
                  ? 'w-full h-full rounded-none border-none shadow-none bg-white' 
                  : 'shadow-2xl rounded-2xl border-2 border-purple-500/40 overflow-hidden bg-white'
              }`}
            >
              {previewMode === 'preview' ? (
                <iframe
                  id="fullscreen-preview-iframe"
                  srcDoc={getCleanHtmlContent(selectedFile.content)}
                  title="Landing Page Responsive Fullscreen Browser Simulation"
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-scripts allow-modals allow-same-origin"
                />
              ) : (
                <div className="relative h-full bg-gray-950 p-4 overflow-auto">
                  <button
                    onClick={() => handleCopyCode(getCleanHtmlContent(selectedFile.content))}
                    className="absolute top-4 right-4 z-10 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md"
                  >
                    {copied ? '✅ Copiado!' : '📋 Copiar Código HTML'}
                  </button>
                  <pre className="text-xs leading-relaxed text-emerald-400 font-mono selection:bg-purple-900 selection:text-white">
                    {getCleanHtmlContent(selectedFile.content)}
                  </pre>
                </div>
              )}
            </div>
          </div>

        </div>,
        document.body
      )}

    </div>
  );
};

export default FilePanel;
