import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Building2, 
  FileText, 
  MessageSquare, 
  Upload, 
  Send, 
  ChevronRight, 
  LayoutDashboard, 
  HardHat, 
  ClipboardCheck, 
  Trash2,
  Loader2,
  Image as ImageIcon,
  FileUp,
  Info,
  Download,
  GitBranch,
  Maximize2,
  Plus,
  X,
  Edit2,
  ArrowUpDown,
  History,
  Sparkles,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { chatWithGemini, analyzeImage, Message } from '@/src/services/gemini';
import { extractTextFromPdf, fileToBase64, renderPdfPageToImage } from '@/src/lib/pdf-utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Node, 
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  Handle,
  Position,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// BPMN Custom Nodes
const BPMNTaskNode = ({ data, id }: any) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-primary min-w-[150px] text-center group relative">
    <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-primary" />
    <div className="flex items-center justify-center gap-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tarefa</div>
    </div>
    <div className="text-sm font-semibold">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-primary" />
    
    {/* Action Buttons */}
    <div className="absolute -right-10 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => data.onAdd(id)}>
        <Plus size={12} />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full text-destructive" onClick={() => data.onDelete(id)}>
        <X size={12} />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => data.onEdit(id)}>
        <Edit2 size={12} />
      </Button>
    </div>
  </div>
);

const BPMNEventNode = ({ data, id }: any) => (
  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center bg-white shadow-sm group relative ${data.type === 'end' ? 'border-destructive' : 'border-green-500'}`}>
    <Handle type="target" position={Position.Top} className="opacity-0" />
    <div className="text-[10px] font-bold text-center px-1 leading-tight">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="opacity-0" />
    
    <div className="absolute -right-8 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => data.onAdd(id)}>
        <Plus size={12} />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full text-destructive" onClick={() => data.onDelete(id)}>
        <X size={12} />
      </Button>
    </div>
  </div>
);

const BPMNGatewayNode = ({ data, id }: any) => (
  <div className="w-12 h-12 rotate-45 border-2 border-orange-400 bg-white shadow-sm flex items-center justify-center relative group">
    <Handle type="target" position={Position.Top} className="!top-[-4px] !left-[22px] opacity-0" />
    <div className="-rotate-45 text-[10px] font-bold text-center leading-tight">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="!bottom-[-4px] !left-[22px] opacity-0" />
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-400 rounded-full -rotate-45" />
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-400 rounded-full -rotate-45" />
    
    <div className="absolute -right-10 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity -rotate-45">
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => data.onAdd(id)}>
        <Plus size={12} />
      </Button>
      <Button variant="outline" size="icon" className="h-6 w-6 rounded-full text-destructive" onClick={() => data.onDelete(id)}>
        <X size={12} />
      </Button>
    </div>
  </div>
);

const nodeTypes = {
  bpmnTask: BPMNTaskNode,
  bpmnEvent: BPMNEventNode,
  bpmnGateway: BPMNGatewayNode,
};

const SYSTEM_INSTRUCTION = `Você é um assistente especializado em planejamento de obras e gestão da construção civil.

OBJETIVOS:
1. Analisar plantas baixas detalhadamente, cruzando informações visuais com textos técnicos.
2. PROTOCOLO DE EXTRAÇÃO DE METADADOS: Antes de qualquer análise textual, você DEVE realizar uma busca exaustiva no texto extraído do PDF por palavras-chave como "Área Total", "Área Construída", "m²", "Ambientes", "Quartos", "Suítes". Priorize os dados numéricos do texto técnico sobre estimativas visuais. Atualize "estimatedArea" e "environments" no JSON imediatamente.
3. Gerar cronogramas e próximos passos realistas baseados na complexidade detectada.
4. Criar e MANTER um FLUXO DE OBRA DETALHADO seguindo a notação BPMN.
5. SINCRONIZAÇÃO BIDIRECIONAL: 
   - O chat e o editor de fluxo estão conectados. 
   - Sempre que o usuário solicitar alterações, adições, remoções ou reorganizações de etapas via chat, você DEVE atualizar o JSON <project_data_json> refletindo essas mudanças no fluxo (nodes e edges).
   - Você tem autoridade total para manipular o fluxo BPMN para torná-lo tecnicamente correto e eficiente com base nas conversas.
   - Se o usuário disser "adicione uma etapa de pintura após o reboco", você deve criar o nó e a conexão correspondente no JSON.

REGRAS BPMN:
- Use "bpmnEvent" para Início/Fim.
- Use "bpmnTask" para ações concretas da obra.
- Use "bpmnGateway" para decisões técnicas (losango).
- CRÍTICO: Todo "bpmnGateway" DEVE ter obrigatoriamente duas conexões de saída (edges) com as labels "Sim" e "Não".
- Crie um fluxo DETALHADO (mínimo 10 passos para projetos reais).
- Posicione os nós logicamente com Y crescente (ex: 0, 100, 200, 300...).

FORMATO DE RESPOSTA:
1. Responda ao usuário em Markdown de forma técnica e consultiva.
2. Sempre inclua o bloco <project_data_json> no final com o estado ATUALIZADO de todo o projeto (dashboard + fluxo).

ESTRUTURA DO JSON:
<project_data_json>
{
  "criticalPoints": number,
  "estimatedArea": number,
  "environments": number,
  "complexity": "Baixa" | "Média" | "Alta",
  "nextSteps": [{"step": "string", "status": "string"}],
  "flow": {
    "nodes": [
      { "id": "string", "type": "bpmnEvent" | "bpmnTask" | "bpmnGateway", "data": { "label": "string", "type": "start" | "end" (opcional) }, "position": { "x": number, "y": number } }
    ],
    "edges": [
      { "id": "string", "source": "string", "target": "string", "label": "Sim" | "Não" (obrigatório para gateways), "animated": true }
    ]
  }
}
</project_data_json>`;

interface ProjectFile {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  category: 'plan' | 'doc';
  content: string; // base64 for image, text for pdf
  mimeType: string;
  previewImage?: string; // base64 for PDF plans
}

interface ProjectData {
  criticalPoints: number;
  estimatedArea: number;
  environments: number;
  complexity: 'Baixa' | 'Média' | 'Alta' | 'Aguardando';
  nextSteps: { step: string; status: string }[];
  nodes: Node[];
  edges: Edge[];
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<{id: string, title: string, messages: Message[]}[]>([]);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [docSortOrder, setDocSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  // BPMN Editor State
  const [editingNode, setEditingNode] = useState<{id: string, label: string} | null>(null);

  const addSystemMessage = (text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      role: 'model',
      parts: [{ text: `🛠️ **Atualização do Fluxo:** ${text}` }],
      timestamp: now
    }]);
  };

  const handleAddNode = (parentId: string) => {
    const parentNode = projectData.nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const newNodeId = `node-${Math.random().toString(36).substr(2, 9)}`;
    
    // BPMN Logic: Gateways need Sim/Não labels
    const isParentGateway = parentNode.type === 'bpmnGateway';
    const existingEdgesFromParent = projectData.edges.filter(e => e.source === parentId);
    const label = isParentGateway ? (existingEdgesFromParent.length === 0 ? 'Sim' : 'Não') : undefined;

    const newNode: Node = {
      id: newNodeId,
      type: 'bpmnTask',
      position: { 
        x: isParentGateway ? (existingEdgesFromParent.length === 0 ? parentNode.position.x - 150 : parentNode.position.x + 150) : parentNode.position.x, 
        y: parentNode.position.y + 120 
      },
      data: { 
        label: 'Nova Etapa',
        onAdd: handleAddNode,
        onDelete: handleDeleteNode,
        onEdit: (id: string) => setEditingNode({ id, label: 'Nova Etapa' })
      }
    };

    const newEdge: Edge = {
      id: `e-${parentId}-${newNodeId}`,
      source: parentId,
      target: newNodeId,
      label,
      animated: true,
      labelStyle: { fill: '#f6ad55', fontWeight: 700 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
    };

    setProjectData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      edges: [...prev.edges, newEdge]
    }));
    toast.success('Etapa adicionada ao fluxo');
    addSystemMessage(`Uma nova etapa ("Nova Etapa") foi adicionada ao fluxo após a etapa anterior.`);
  };

  const handleDeleteNode = (id: string) => {
    const nodeToDelete = projectData.nodes.find(n => n.id === id);
    setProjectData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
    toast.info('Etapa removida');
    if (nodeToDelete) {
      addSystemMessage(`A etapa "${nodeToDelete.data.label}" foi removida do fluxo.`);
    }
  };

  const [projectData, setProjectData] = useState<ProjectData>({
    criticalPoints: 0,
    estimatedArea: 0,
    environments: 0,
    complexity: 'Aguardando',
    nextSteps: [
      { step: 'Limpeza e Canteiro', status: 'Pendente' },
      { step: 'Fundação e Estrutura', status: 'Pendente' },
      { step: 'Alvenaria e Vedações', status: 'Pendente' },
      { step: 'Instalações Hidrossanitárias', status: 'Pendente' },
    ],
    nodes: [
      { id: 'start', position: { x: 250, y: 0 }, data: { label: 'Início', type: 'start', onAdd: handleAddNode, onDelete: handleDeleteNode }, type: 'bpmnEvent' },
      { id: 'task1', position: { x: 200, y: 100 }, data: { label: 'Análise Técnica', onAdd: handleAddNode, onDelete: handleDeleteNode, onEdit: (id: string) => setEditingNode({ id, label: 'Análise Técnica' }) }, type: 'bpmnTask' },
      { id: 'gate1', position: { x: 250, y: 200 }, data: { label: 'Viável?', onAdd: handleAddNode, onDelete: handleDeleteNode }, type: 'bpmnGateway' },
      { id: 'end', position: { x: 250, y: 350 }, data: { label: 'Fim', type: 'end', onAdd: handleAddNode, onDelete: handleDeleteNode }, type: 'bpmnEvent' },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'task1', animated: true },
      { id: 'e2', source: 'task1', target: 'gate1', animated: true },
      { id: 'e3', source: 'gate1', target: 'end', animated: true },
    ]
  });

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('obra_chat_history');
    if (saved) setChatHistory(JSON.parse(saved));
    
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', userApiKey);
    toast.success('Chave API salva com sucesso');
    setShowSettings(false);
  };

  // Save current chat to history
  const saveToHistory = () => {
    if (messages.length === 0) return;
    const newHistory = {
      id: Date.now().toString(),
      title: messages[0].parts[0].text?.substring(0, 30) + '...',
      messages: [...messages]
    };
    const updated = [newHistory, ...chatHistory].slice(0, 10);
    setChatHistory(updated);
    localStorage.setItem('obra_chat_history', JSON.stringify(updated));
    toast.success('Histórico salvo');
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chatHistory.filter(h => h.id !== id);
    setChatHistory(updated);
    localStorage.setItem('obra_chat_history', JSON.stringify(updated));
    toast.info('Conversa removida do histórico');
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setProjectData(prev => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes) })),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setProjectData(prev => ({ ...prev, edges: applyEdgeChanges(changes, prev.edges) })),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = projectData.nodes.find(n => n.id === params.source);
      const isGateway = sourceNode?.type === 'bpmnGateway';
      const existingEdges = projectData.edges.filter(e => e.source === params.source);
      
      const edgeParams = {
        ...params,
        label: isGateway ? (existingEdges.length === 0 ? 'Sim' : 'Não') : undefined,
        animated: true,
        labelStyle: { fill: '#f6ad55', fontWeight: 700 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
      };
      
      setProjectData(prev => ({ ...prev, edges: addEdge(edgeParams, prev.edges) }));
    },
    [projectData.nodes, projectData.edges]
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const planInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([{
      role: 'model',
      parts: [{ text: 'Olá! Sou seu **Engenheiro Digital IA**. Como posso ajudar no seu projeto hoje? Você pode carregar uma planta baixa ou documentos técnicos para uma análise detalhada.' }]
    }]);
  }, []);

  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: 'plan' | 'doc') => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    setIsLoading(true);
    for (const file of Array.from(uploadedFiles)) {
      try {
        if (file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          setFiles(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: 'image',
            category,
            content: base64,
            mimeType: file.type
          }]);
          toast.success(`${file.name} adicionado como ${category === 'plan' ? 'Planta' : 'Documento'}.`);
          
          if (category === 'plan') {
            // Auto-trigger analysis for new plans
            setTimeout(() => {
              handleSendMessage("Analise esta planta baixa. Identifique pontos críticos, área estimada, ambientes e sugira os próximos passos detalhados para o cronograma.");
            }, 500);
          }
        } else if (file.type === 'application/pdf') {
          const text = await extractTextFromPdf(file);
          let previewImage;
          
          if (category === 'plan') {
            try {
              previewImage = await renderPdfPageToImage(file);
            } catch (e) {
              console.warn('Could not render PDF preview', e);
            }
          }

          setFiles(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: 'pdf',
            category,
            content: text,
            mimeType: file.type,
            previewImage
          }]);
          toast.success(`${file.name} processado como ${category === 'plan' ? 'Planta' : 'Documento'}.`);

          if (category === 'plan') {
            // Auto-trigger analysis for new plans
            setTimeout(() => {
              handleSendMessage("Analise esta planta baixa em PDF. PRIORIDADE: Extraia primeiro a área total e o número de ambientes do texto técnico do PDF. Em seguida, identifique pontos críticos e sugira os próximos passos detalhados.");
            }, 500);
          }
        } else {
          toast.error(`Tipo de arquivo não suportado: ${file.name}`);
        }
      } catch (error) {
        console.error(error);
        toast.error(`Erro ao processar ${file.name}`);
      }
    }
    setIsLoading(false);
    if (planInputRef.current) planInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast.info('Arquivo removido.');
  };

  const handleSendMessage = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    
    // Input Validation
    if (!messageText.trim() && files.filter(f => f.category === 'plan').length === 0) {
      toast.error('Por favor, digite uma mensagem ou anexe uma planta.');
      return;
    }

    if (messageText.length > 1000) {
      toast.error('Mensagem muito longa (máximo 1000 caracteres).');
      return;
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = {
      role: 'user',
      parts: [{ text: messageText }],
      timestamp: now
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput('');
    setIsLoading(true);

    try {
      // RAG Context from documents AND text layer of PDF plans
      let ragContext = files
        .filter(f => f.category === 'doc' || (f.category === 'plan' && f.type === 'pdf'))
        .map(f => `${f.category === 'plan' ? 'Texto Extraído da Planta (PDF)' : 'Documento'}: ${f.name}\n${f.content}`)
        .join('\n\n');

      // Optimization: Truncate context if too large to prevent timeouts
      if (ragContext.length > 12000) {
        ragContext = ragContext.substring(0, 12000) + "\n... [Texto truncado para otimização de performance]";
      }

      // Plans (Images or PDFs rendered as images)
      const plans = files.filter(f => f.category === 'plan');
      const planImages = plans.map(p => ({
        content: p.type === 'image' ? p.content : (p.previewImage || ''),
        mimeType: p.type === 'image' ? p.mimeType : 'image/png'
      })).filter(img => img.content !== '');

      let responseText = '';

      if (planImages.length > 0) {
        // Use the most recent plan image for visual analysis
        const lastPlanImage = planImages[planImages.length - 1];
        responseText = await analyzeImage(
          lastPlanImage.content,
          lastPlanImage.mimeType,
          messageText || "Analise esta planta baixa e forneça insights técnicos.",
          SYSTEM_INSTRUCTION,
          ragContext
        );
      } else {
        // Text only chat with RAG
        const chatMessages = [...messages, userMessage];
        const promptWithRag = ragContext 
          ? `CONTEXTO TÉCNICO (RAG):\n${ragContext}\n\nPERGUNTA:\n${messageText}`
          : messageText;
        
        const apiMessages = chatMessages.map((m, idx) => 
          idx === chatMessages.length - 1 ? { ...m, parts: [{ text: promptWithRag }] } : m
        );

        responseText = await chatWithGemini(apiMessages, SYSTEM_INSTRUCTION);
      }

      const modelNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Parse and clean response
      let cleanText = responseText;
      if (responseText.includes('<project_data_json>')) {
        try {
          const parts = responseText.split('<project_data_json>');
          cleanText = parts[0].trim();
          const jsonPart = parts[1].split('</project_data_json>')[0].trim();
          const parsedData = JSON.parse(jsonPart);
          
          setProjectData(prev => {
            const newData = {
              ...prev,
              ...parsedData,
              nodes: parsedData.flow?.nodes?.map((n: any) => ({
                ...n,
                data: { 
                  ...n.data, 
                  onAdd: handleAddNode, 
                  onDelete: handleDeleteNode,
                  onEdit: n.type === 'bpmnTask' ? (id: string) => setEditingNode({ id, label: n.data.label }) : undefined
                }
              })) || prev.nodes,
              edges: parsedData.flow?.edges || prev.edges
            };
            return newData;
          });
          toast.success('Fluxo de obra sincronizado com o chat');
        } catch (e) {
          console.error('Error parsing project data:', e);
        }
      }

      setMessages(prev => [...prev, { role: 'model', parts: [{ text: cleanText }], timestamp: modelNow }]);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao obter resposta da IA.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportFlowToPdf = async () => {
    if (!flowRef.current) return;
    try {
      // Hide controls for export
      const controls = flowRef.current.querySelector('.react-flow__controls') as HTMLElement;
      if (controls) controls.style.display = 'none';

      const canvas = await html2canvas(flowRef.current);
      
      if (controls) controls.style.display = 'flex';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('fluxo-obra.pdf');
      toast.success('Fluxo exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar PDF');
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden technical-grid">
      <Toaster position="top-right" />
      
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações da API</DialogTitle>
            <DialogDescription>
              Insira sua chave API do Gemini para rodar o aplicativo localmente. 
              Sua chave será salva apenas no seu navegador (localStorage).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chave API Gemini</label>
              <Input 
                type="password"
                value={userApiKey} 
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder="Cole sua chave API aqui..."
              />
              <p className="text-[10px] text-muted-foreground">
                Você pode obter uma chave gratuita no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancelar</Button>
            <Button onClick={saveApiKey}>Salvar Chave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualização do Projeto</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted rounded-lg flex items-center justify-center">
            {selectedImage && (
              <img src={selectedImage} alt="Preview" className="max-w-full max-h-full object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Etapa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={editingNode?.label || ''} 
              onChange={(e) => setEditingNode(prev => prev ? {...prev, label: e.target.value} : null)}
              placeholder="Nome da etapa"
              className="mb-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNode(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (editingNode) {
                const oldNode = projectData.nodes.find(n => n.id === editingNode.id);
                setProjectData(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === editingNode.id ? { ...n, data: { ...n.data, label: editingNode.label } } : n)
                }));
                setEditingNode(null);
                toast.success('Etapa atualizada');
                addSystemMessage(`A etapa "${oldNode?.data.label}" foi renomeada para "${editingNode.label}".`);
              }
            }}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar */}
      <aside className="w-80 border-r bg-card flex flex-col shrink-0">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Engenheiro</h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-tighter font-medium">Digital IA</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={saveToHistory} title="Salvar no Histórico">
            <History size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-8">
            {chatHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-2">
                  <History size={12} /> Histórico Recente
                </h3>
                <div className="space-y-1">
                  {chatHistory.map(h => (
                    <div key={h.id} className="group relative">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-xs h-9 px-3 truncate font-normal hover:bg-primary/5 hover:text-primary pr-8"
                        onClick={() => setMessages(h.messages)}
                      >
                        <MessageSquare size={14} className="mr-2 opacity-50" />
                        <span className="truncate">{h.title}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => deleteFromHistory(h.id, e)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon size={12} /> Plantas e Projetos
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => planInputRef.current?.click()}>
                  <Upload size={14} />
                </Button>
              </div>
              <div className="space-y-2">
                {files.filter(f => f.category === 'plan').map((file) => (
                  <div key={file.id} className="group flex items-center justify-between p-2 rounded-lg border bg-muted/50 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden border">
                        {file.type === 'image' ? (
                          <img src={`data:${file.mimeType};base64,${file.content}`} alt={file.name} className="object-cover w-full h-full" />
                        ) : file.previewImage ? (
                          <img src={`data:image/png;base64,${file.previewImage}`} alt={file.name} className="object-cover w-full h-full" />
                        ) : (
                          <FileText size={14} className="text-primary" />
                        )}
                      </div>
                      <span className="truncate max-w-[120px]">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(file.id)}>
                      <Trash2 size={12} className="text-destructive" />
                    </Button>
                  </div>
                ))}
                {files.filter(f => f.category === 'plan').length === 0 && (
                  <p className="text-[10px] text-center py-4 text-muted-foreground italic border border-dashed rounded-lg">Nenhuma planta carregada</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <FileUp size={12} /> Base Técnica (RAG)
                </h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDocSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                    <ArrowUpDown size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => docInputRef.current?.click()}>
                    <Upload size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {files
                  .filter(f => f.category === 'doc')
                  .sort((a, b) => docSortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
                  .map((file) => (
                    <div key={file.id} className="group flex items-center justify-between p-2 rounded-lg border bg-muted/50 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={14} className="text-primary" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(file.id)}>
                        <Trash2 size={12} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                {files.filter(f => f.category === 'doc').length === 0 && (
                  <p className="text-[10px] text-center py-4 text-muted-foreground italic border border-dashed rounded-lg">Nenhum documento técnico</p>
                )}
              </div>
            </div>
          </div>
            {files.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs gap-2 text-destructive hover:text-destructive"
                onClick={() => {
                  setFiles([]);
                  toast.info('Todos os arquivos removidos.');
                }}
              >
                <Trash2 size={12} /> Limpar Tudo
              </Button>
            )}
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30 space-y-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start text-[10px] gap-2 h-8"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={12} />
            Configurações da API
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info size={14} />
            <span>IA utiliza gemini-2.0-flash</span>
          </div>
          <input 
            type="file" 
            ref={planInputRef} 
            onChange={(e) => handleFileUpload(e, 'plan')} 
            className="hidden" 
            multiple 
            accept="image/*,application/pdf"
          />
          <input 
            type="file" 
            ref={docInputRef} 
            onChange={(e) => handleFileUpload(e, 'doc')} 
            className="hidden" 
            multiple 
            accept="image/*,application/pdf"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/50 backdrop-blur-sm">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50">
          <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[500px]">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare size={16} /> Chat
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard size={16} /> Dashboard
                </TabsTrigger>
                <TabsTrigger value="flow" className="flex items-center gap-2">
                  <GitBranch size={16} /> Fluxo Obra
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground"
              onClick={() => {
                toast.info('Engenheiro Digital IA: Carregue plantas (JPG/PNG) e normas (PDF) para análise contextualizada.', {
                  duration: 5000,
                });
              }}
            >
              <Info size={14} className="mr-1" /> Ajuda
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                setMessages([]);
                toast.info('Chat limpo.');
              }}
            >
              <Trash2 size={14} className="mr-1" /> Limpar Chat
            </Button>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Sistema Online
            </Badge>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full"
              >
                <ScrollArea className="flex-1 p-6" ref={scrollRef} onScroll={handleScroll}>
                  <div className="max-w-3xl mx-auto space-y-6">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <HardHat size={32} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold">Bem-vindo ao seu Consultor de Obras</h3>
                          <p className="text-muted-foreground max-w-md">
                            Carregue uma planta baixa ou documentos técnicos para começar a análise inteligente do seu projeto.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-8">
                          {[
                            { label: 'Otimizar circulação', icon: <LayoutDashboard size={16} />, prompt: 'Como otimizar a circulação desta planta?' },
                            { label: 'Lista de materiais', icon: <ClipboardCheck size={16} />, prompt: 'Quais os principais materiais para esta etapa?' },
                            { label: 'Pontos Críticos', icon: <HardHat size={16} />, prompt: 'Quais os pontos críticos desta planta e qual a área estimada?' },
                            { label: 'Próximos Passos', icon: <ChevronRight size={16} />, prompt: 'Quais os próximos passos recomendados para este projeto?' }
                          ].map((s, idx) => (
                            <Card key={idx} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSendMessage(s.prompt)}>
                              <CardContent className="p-4 text-sm text-left flex flex-col gap-2">
                                <div className="text-primary">{s.icon}</div>
                                {s.label}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 relative group ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-card border shadow-sm'
                        }`}>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.parts[0].text || ''}</ReactMarkdown>
                          </div>
                          {msg.role === 'model' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.parts[0].text || '');
                                toast.success('Copiado para a área de transferência');
                              }}
                            >
                              <ClipboardCheck size={12} />
                            </Button>
                          )}
                        </div>
                        {msg.timestamp && (
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {msg.timestamp}
                          </span>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-card border shadow-sm rounded-2xl px-4 py-3 flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Engenheiro Digital está analisando...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {showScrollButton && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50"
                      >
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="rounded-full shadow-lg border gap-2"
                          onClick={scrollToBottom}
                        >
                          <ChevronRight className="rotate-90" size={14} />
                          Novas mensagens
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </ScrollArea>

                <div className="p-6 border-t bg-card/50">
                  <div className="max-w-3xl mx-auto relative">
                    <Input 
                      placeholder="Pergunte sobre a planta, materiais ou planejamento..." 
                      className="pr-12 py-6 text-base shadow-sm"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={isLoading}
                    />
                    <Button 
                      className="absolute right-1.5 top-1.5 h-9 w-9" 
                      size="icon"
                      onClick={() => handleSendMessage()}
                      disabled={isLoading || (!input.trim() && files.filter(f => f.category === 'plan').length === 0)}
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                  <p className="text-[10px] text-center mt-3 text-muted-foreground uppercase tracking-widest">
                    Análise baseada em IA e Normas Técnicas
                  </p>
                </div>
              </motion.div>
            ) : activeTab === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full p-6 overflow-auto"
              >
                <div className="max-w-5xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Building2 size={16} /> Status do Projeto
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">Em Análise</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {files.length} arquivos carregados
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <HardHat size={16} /> Pontos Críticos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${projectData.criticalPoints > 0 ? 'text-destructive' : ''}`}>
                          {projectData.criticalPoints}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {projectData.criticalPoints > 0 ? 'Inconsistências detectadas' : 'Nenhum ponto crítico'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <ClipboardCheck size={16} /> Conformidade
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">Pendente</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cruzar com normas técnicas
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="md:col-span-1">
                      <CardHeader>
                        <CardTitle>Resumo da Planta</CardTitle>
                        <CardDescription>Principais características identificadas</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {files.filter(f => f.category === 'plan').length > 0 ? (
                          <div className="aspect-video rounded-lg bg-muted overflow-hidden border relative group">
                            {(() => {
                              const firstPlan = files.filter(f => f.category === 'plan')[0];
                              const imgSrc = firstPlan.type === 'image' 
                                ? `data:${firstPlan.mimeType};base64,${firstPlan.content}`
                                : firstPlan.previewImage 
                                  ? `data:image/png;base64,${firstPlan.previewImage}`
                                  : null;
                              
                              return imgSrc ? (
                                <img 
                                  src={imgSrc} 
                                  alt="Planta principal" 
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText size={32} className="text-muted-foreground" />
                                </div>
                              );
                            })()}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => {
                                  const firstPlan = files.filter(f => f.category === 'plan')[0];
                                  const imgSrc = firstPlan.type === 'image' 
                                    ? `data:${firstPlan.mimeType};base64,${firstPlan.content}`
                                    : firstPlan.previewImage 
                                      ? `data:image/png;base64,${firstPlan.previewImage}`
                                      : null;
                                  if (imgSrc) setSelectedImage(imgSrc);
                                }}
                              >
                                <Maximize2 size={14} className="mr-2" /> Ver Detalhes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg bg-muted border border-dashed flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <ImageIcon size={32} />
                            <p className="text-sm">Nenhuma planta para exibir</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Área Estimada:</span>
                            <span className="font-medium">{projectData.estimatedArea > 0 ? `${projectData.estimatedArea} m²` : '-- m²'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ambientes:</span>
                            <span className="font-medium">{projectData.environments > 0 ? projectData.environments : '--'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Complexidade:</span>
                            <Badge variant={projectData.complexity === 'Alta' ? 'destructive' : 'secondary'}>
                              {projectData.complexity}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-1">
                      <CardHeader>
                        <CardTitle>Próximos Passos</CardTitle>
                        <CardDescription>Sugestão de cronograma macro</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {projectData.nextSteps.length > 0 ? (
                            projectData.nextSteps.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-sm hover:border-primary/50 transition-colors group">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  item.status === 'Concluído' ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'
                                }`}>
                                  {item.status === 'Concluído' ? <ClipboardCheck size={14} /> : <ChevronRight size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground leading-tight break-words">{item.step}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.status}</p>
                                </div>
                                {item.status === 'Concluído' && (
                                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">
                                    OK
                                  </Badge>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="text-sm italic">Nenhuma etapa definida ainda.</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="flow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Fluxo de Execução da Obra</h2>
                    <p className="text-muted-foreground">Visualização interativa do processo construtivo</p>
                  </div>
                  <Button onClick={exportFlowToPdf} className="gap-2">
                    <Download size={16} /> Exportar PDF
                  </Button>
                </div>
                <Card className="flex-1 overflow-hidden bg-card border shadow-inner relative">
                  <div ref={flowRef} className="w-full h-full">
                    <ReactFlow
                      nodes={projectData.nodes}
                      edges={projectData.edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      nodeTypes={nodeTypes}
                      fitView
                    >
                      <Background />
                      <Controls />
                      <Panel position="top-right" className="flex flex-col gap-2">
                        <Card className="p-3 flex flex-col gap-3 bg-background/90 backdrop-blur shadow-xl border-primary/20 min-w-[200px]">
                          <div className="flex items-center justify-between px-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">BPMN Toolbox</p>
                            <Badge variant="outline" className="text-[8px] h-4">Editor</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="h-9 text-[10px] flex flex-col gap-0.5 py-1" onClick={() => {
                              const id = `node-${Date.now()}`;
                              setProjectData(prev => ({
                                ...prev,
                                nodes: [...prev.nodes, { id, type: 'bpmnTask', position: { x: 100, y: 100 }, data: { label: 'Nova Tarefa', onAdd: handleAddNode, onDelete: handleDeleteNode, onEdit: (id: string) => setEditingNode({ id, label: 'Nova Tarefa' }) } }]
                              }));
                              addSystemMessage('Uma nova "Tarefa" foi adicionada manualmente ao fluxo.');
                            }}>
                              <ClipboardCheck size={12} />
                              <span>Tarefa</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-[10px] flex flex-col gap-0.5 py-1" onClick={() => {
                              const id = `node-${Date.now()}`;
                              setProjectData(prev => ({
                                ...prev,
                                nodes: [...prev.nodes, { id, type: 'bpmnGateway', position: { x: 100, y: 100 }, data: { label: 'Decisão', onAdd: handleAddNode, onDelete: handleDeleteNode } }]
                              }));
                              addSystemMessage('Um novo "Gateway" de decisão foi adicionado manualmente ao fluxo.');
                            }}>
                              <GitBranch size={12} className="rotate-90" />
                              <span>Gateway</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-[10px] flex flex-col gap-0.5 py-1" onClick={() => {
                              const id = `node-${Date.now()}`;
                              setProjectData(prev => ({
                                ...prev,
                                nodes: [...prev.nodes, { id, type: 'bpmnEvent', position: { x: 100, y: 100 }, data: { label: 'Início', type: 'start', onAdd: handleAddNode, onDelete: handleDeleteNode } }]
                              }));
                              addSystemMessage('Um novo evento de "Início" foi adicionado manualmente ao fluxo.');
                            }}>
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span>Início</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 text-[10px] flex flex-col gap-0.5 py-1" onClick={() => {
                              const id = `node-${Date.now()}`;
                              setProjectData(prev => ({
                                ...prev,
                                nodes: [...prev.nodes, { id, type: 'bpmnEvent', position: { x: 100, y: 100 }, data: { label: 'Fim', type: 'end', onAdd: handleAddNode, onDelete: handleDeleteNode } }]
                              }));
                              addSystemMessage('Um novo evento de "Fim" foi adicionado manualmente ao fluxo.');
                            }}>
                              <div className="w-2 h-2 rounded-full bg-destructive" />
                              <span>Fim</span>
                            </Button>
                          </div>
                          <Separator />
                          <Button variant="default" size="sm" className="h-9 text-xs gap-2 font-bold shadow-lg shadow-primary/20" onClick={() => {
                            handleSendMessage("Valide este fluxo de obra BPMN e sugira melhorias técnicas ou etapas faltantes.");
                          }}>
                            <Sparkles size={14} className="text-yellow-400 fill-yellow-400" /> Validar Fluxo
                          </Button>
                        </Card>
                      </Panel>
                    </ReactFlow>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
