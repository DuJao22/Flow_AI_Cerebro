import React from 'react';
import { Flower2, Zap, BrainCircuit, Rocket, ArrowRight, Code2 } from 'lucide-react';
import { CreditsCard } from './CreditsCard';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto z-50 bg-[#0a0c10] text-white font-sans selection:bg-purple-500/30 custom-scrollbar">
      {/* Header */}
      <header className="fixed top-0 w-full border-b border-gray-800 bg-[#0a0c10]/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-400">
            <Flower2 className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">Flow Architect <span className="text-purple-400">AI</span></span>
          </div>
          <button 
            onClick={onStart}
            className="px-4 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            Acessar Plataforma <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            <span>A nova era da automação visual</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
            Crie, Automatize e Faça Deploy com Inteligência Artificial.
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            O Flow Architect AI é a sua plataforma completa para transformar ideias em realidade. Construa fluxos visuais, gere código HTML moderno com IA e faça o deploy automático para seus servidores em segundos.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <button 
              onClick={onStart}
              className="px-8 py-4 text-base font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-full transition-all shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)] hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.7)] flex items-center gap-2 hover:scale-105"
            >
              Começar a Criar <Rocket className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<BrainCircuit className="w-6 h-6 text-purple-400" />}
            title="Geração por IA"
            description="Descreva o que você precisa e nossa IA construirá o fluxo de nós, configurará as requisições HTTP e preparará a lógica automaticamente."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-blue-400" />}
            title="Execução em Tempo Real"
            description="Motor de execução integrado. Teste suas APIs, valide condições e veja os logs detalhados de cada etapa diretamente no navegador."
          />
          <FeatureCard 
            icon={<Code2 className="w-6 h-6 text-green-400" />}
            title="Exportação & Deploy"
            description="Gere arquivos, salve resultados em JSON ou faça chamadas diretas para seus webhooks e servidores de produção com facilidade."
          />
        </div>

        {/* CARD DE CRÉDITOS NA LANDING PAGE */}
        <div className="max-w-xl mx-auto mt-20">
          <CreditsCard isOpen={true} floating={false} />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-8 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flower2 className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-gray-300">Flow Architect AI</span>
        </div>
        <p>© {new Date().getFullYear()} - Desenvolvido por <a href="https://instagram.com/layon.dev" target="_blank" rel="noopener noreferrer" className="text-purple-400 font-bold hover:underline">@layon.dev</a> & <a href="https://instagram.com/davi._link" target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-bold hover:underline">@davi._link</a>. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-6 rounded-2xl bg-[#161b22] border border-gray-800 hover:border-gray-700 transition-colors">
    <div className="w-12 h-12 rounded-xl bg-[#0d1117] border border-gray-800 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-gray-200 mb-2">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
