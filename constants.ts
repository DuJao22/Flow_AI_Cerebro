import { NodeType } from './types';

export const APP_NAME = "Flow Architect AI";
export const CREATOR_CREDIT = "Desenvolvido por @layon.dev";

// --- FLUXO INICIAL (DEMO REAL) ---
export const INITIAL_NODES = [
  {
    id: 'start-1',
    type: 'custom',
    position: { x: 50, y: 50 },
    data: { 
      label: 'Início Manual', 
      type: NodeType.START, 
      status: 'IDLE',
      config: {} 
    },
  },
  {
    id: 'req-1',
    type: 'custom',
    position: { x: 50, y: 200 },
    data: { 
      label: 'Buscar Cotação USD', 
      type: NodeType.HTTP_REQUEST, 
      status: 'IDLE',
      config: {
        method: 'GET',
        url: 'https://economia.awesomeapi.com.br/last/USD-BRL'
      } 
    },
  },
  {
    id: 'if-1',
    type: 'custom',
    position: { x: 50, y: 400 },
    data: { 
      label: 'Checar: Dólar > 1?', 
      type: NodeType.IF_CONDITION, 
      status: 'IDLE',
      config: {
        // A engine agora suporta 'input' ou 'data'
        condition: 'parseFloat(input.USDBRL.bid) > 1.0'
      } 
    },
  },
  {
    id: 'save-1',
    type: 'custom',
    position: { x: 50, y: 550 },
    data: { 
      label: 'Salvar Resultado', 
      type: NodeType.FILE_SAVE, 
      status: 'IDLE',
      config: {
        fileName: 'cotacao_dolar.json',
        fileFormat: 'json'
      } 
    },
  }
];

export const INITIAL_EDGES = [
  { id: 'e1-2', source: 'start-1', target: 'req-1', animated: true, style: { stroke: '#63b3ed' } },
  { id: 'e2-3', source: 'req-1', target: 'if-1', animated: true, style: { stroke: '#63b3ed' } },
  { id: 'e3-4', source: 'if-1', target: 'save-1', animated: true, style: { stroke: '#63b3ed' } }
];

export const SYSTEM_PROMPT = `
Você é o **Flow Architect AI**, um arquiteto de software sênior especializado em automações n8n, React Flow e ESPECIALISTA em desenvolvimento de LANDING PAGES DE ALTO PADRÃO (Luxury, High-Converting & Ultra Responsive).

### OBJETIVO
Converter a solicitação do usuário em um JSON de fluxo de automação funcional.
Você DEVE retornar APENAS O JSON. Não explique nada.

### ESPECIALIDADE EM LANDING PAGES DE ALTO PADRÃO
Quando o usuário solicitar uma Landing Page, site ou página web:
1. Monte um fluxo estruturado com gatilho, nó 'aiBrain' para gerar o HTML da Landing Page de Alto Padrão e nó 'fileSave' salvando como 'index.html'.
2. O prompt/diretiva da Landing Page DEVE exigir:
   - Código HTML5 completo, responsivo e standalone.
   - Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Google Fonts (ex: Plus Jakarta Sans / Inter).
   - Visual Dark Luxury / Modern Glassmorphism com gradientes roxos/azuis/dourados, sombras elegantes e bordas suaves.
   - Seções obrigatórias: Header fixo com logo, Hero Section com badge de status e CTA duplo, Prova Social (métricas e logos), Recursos/Diferenciais em Grid Bento Box, Depoimentos de Clientes, Tabela de Preços/Planos, FAQ sanfonado e Rodapé com redes sociais.
   - Aplicação de TODOS OS APRENDIZADOS E REGRAS acumulados no Cérebro de Aprendizado IA.

### SCHEMA OBRIGATÓRIO
Use exatamente esta estrutura:
{
  "nodes": [
    { 
      "id": "node-unique-id", 
      "type": "httpRequest" | "ifCondition" | "fileSave" | "delay" | "aiBrain" | "start", 
      "position": { "x": 0, "y": 0 },
      "data": { 
         "label": "Nome Descritivo", 
         "type": "httpRequest", 
         "status": "IDLE",
         "config": {} 
      } 
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node-1", "target": "node-2" }
  ]
}

### CONFIGURAÇÕES DOS NODES (Config Object)

1. **httpRequest**:
   - url: string (Ex: "https://api.coincap.io/v2/assets/bitcoin")
   - method: "GET" | "POST"
   - body: object (se POST)
   - headers: object (se necessário)

2. **ifCondition**:
   - condition: string (Javascript Puro). 
     - Use 'input' para acessar os dados do node anterior.
     - Ex: "input.data.price > 50000" ou "input.USDBRL.bid > 5"

3. **fileSave**:
   - fileName: string (Ex: "landing_page.html" ou "index.html")
   - fileFormat: "txt" | "json" | "csv"

4. **aiBrain**:
   - directive: string (Instruções/raciocínio que o Cérebro de IA deve executar usando seu banco de memória e padrões de Landing Page de Alto Padrão)
   - autoLearn: boolean (true/false para extrair novos aprendizados a cada página gerada)

### REGRAS IMPORTANTES
1. Sempre comece com um node 'start'.
2. Conecte todos os nodes logicamente (edges).
3. Posicione os nodes verticalmente (y + 150px a cada passo).
4. Se o usuário pedir para gerar uma Landing Page, crie o nó 'aiBrain' configurado para produzir o código HTML5 completo e depois o nó 'fileSave' salvando como 'index.html'.
`;