import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  type Node, 
  type Edge, 
  Position,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  BackgroundVariant,
  Panel,
  addEdge,
  type Connection,
  type EdgeProps,
  getBezierPath,
  EdgeLabelRenderer
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, 
  Workflow as LucideWorkflow, 
  X, Zap,
  Activity, Layers, Database, AlertCircle,
  Plus, 
  ImageIcon, Paperclip,
  ChevronLeft,
  Building2,
  Users2,
  User,
  Info,
  Settings,
  Trash,
  Link2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsApi } from '../api/client';
import { CreationProgressBar } from './IntakeGatekeeper';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


// --- TYPES & INTERFACES ---

interface Blocker {
  id: string;
  blocking_entity: string;
  reason: string;
  probability_percent: number;
  average_delay_minutes: number;
  standard_mitigation: string;
}

interface TaskError {
  id: string;
  error_type: string;
  description: string;
  probability_percent: number;
  recovery_time_minutes: number;
}

interface TargetSystem {
  id: string;
  name: string;
  purpose: string;
  access_method: string;
}

interface SourceData {
  id: string;
  is_manual: boolean;
  name: string;
  source_location: string;
  format: string;
  example: string;
  description: string;
  purpose: string;
  origin_node_id?: string;
}

interface OutputData {
  id: string;
  name: string;
  description: string;
  format: string;
  example: string;
  saved_location: string;
}

interface VerificationStep {
  id: string;
  step_number: number;
  instruction: string;
  expected_result: string;
}

interface TribalKnowledge {
  id: string;
  knowledge: string;
  captured_from: string;
}

interface ReferenceLink {
  id: string;
  url: string;
  description: string;
}

interface TaskMedia {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  label: string;
}

interface Task {
  id: string;
  name: string;
  description: string;
  task_type: string;
  target_systems: TargetSystem[];
  interface_type: 'GUI' | 'CLI' | 'API' | 'DECISION';
  manual_time_minutes: number;
  automation_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrences_per_cycle: number;
  occurrence_condition?: string;
  
  // Data Tab
  source_data_list: SourceData[];
  output_data_list: OutputData[];
  verification_methods: VerificationStep[];

  // Exceptions Tab
  blockers: Blocker[];
  errors: TaskError[];
  tribal_knowledge: TribalKnowledge[];

  // Appendix Tab
  media: TaskMedia[];
  reference_links: ReferenceLink[];
  
  // Operational Matrix (Legacy/Internal)
  tool_id: string;
  hardware_family: string;
  trigger_architecture: string;
  output_classification: string;

  // I/O Lineage (Legacy/Internal)
  upstream_links: string[]; 
  io_variables: string[]; 
}

interface WorkflowMetadata {
  cadence_count: number;
  cadence_unit: 'day' | 'week' | 'month' | 'year';
  equipment_state: 'READY' | 'MAINTENANCE' | 'ERROR';
  cleanroom_class: 'ISO5' | 'ISO7' | 'UNCONTROLLED';
  status: 'DRAFT' | 'PROD' | 'ARCHIVED';
  // Extended fields
  prc: string;
  workflow_type: string;
  tool_family: string;
  tool_family_count: number;
  org: string;
  team: string;
  poc: string;
  forensic_description: string;
  trigger_type: string;
  trigger_description: string;
  output_type: string;
  output_description: string;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  onSave: (data: any) => void;
  onBack: () => void;
}

// --- CUSTOM NODES & EDGES ---

const MatrixNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const typeColors: Record<string, string> = {
    'Admin': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    'Technical': 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    'Physical': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    'Validation': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  };

  const typeColor = typeColors[data.task_type] || 'text-white/40 border-white/10 bg-white/5';

  return (
    <div className={`apple-glass !bg-[#0f172a]/90 !rounded-2xl px-6 py-5 min-w-[300px] shadow-2xl transition-all duration-300 group relative border-2 ${selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'border-white/10 hover:border-white/20'}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-3">
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1 bg-status-warning/20 text-status-warning px-1.5 py-0.5 rounded text-[9px] font-black border border-status-warning/20">
                <AlertCircle size={10} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1 bg-status-error/20 text-status-error px-1.5 py-0.5 rounded text-[9px] font-black border border-status-error/20">
                <X size={10} /> {data.errorCount}
              </div>
            )}
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-black text-white/80">
              <Activity size={12} className="text-white/20" />
              <span>{Number(data.manual_time || 0) + Number(data.automation_time || 0)}m</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-1">
          <h4 className="text-[15px] font-black text-white tracking-tighter leading-tight uppercase group-hover:text-theme-accent transition-colors">{data.label || "Untitled Task"}</h4>
          <div className="flex items-center gap-2">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{data.systems || "STANDALONE"}</span>
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-theme-accent !w-4 !h-4 !border-4 !border-[#0f172a] !-left-2 shadow-xl hover:scale-125 transition-transform" />
      <Handle type="source" position={Position.Right} className="!bg-theme-accent !w-4 !h-4 !border-4 !border-[#0f172a] !-right-2 shadow-xl hover:scale-125 transition-transform" />
    </div>
  );
};

const DiamondNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`relative w-28 h-28 flex items-center justify-center transition-all duration-300 group ${selected ? 'scale-110' : ''}`}>
    <div className={`absolute inset-0 rotate-45 border-2 transition-all duration-300 bg-[#1e293b]/90 ${selected ? 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'border-white/20 group-hover:border-white/40'}`} />
    <div className="relative z-10 flex flex-col items-center p-4">
      <Zap size={22} className="text-blue-400 mb-1.5" />
      <span className="text-[10px] font-black text-white uppercase tracking-tighter text-center leading-tight">{data.label || "DECISION"}</span>
    </div>
    
    <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-left-2 shadow-lg" />
    <Handle type="source" position={Position.Top} id="top" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-top-2 shadow-lg" />
    <Handle type="source" position={Position.Right} id="right" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-right-2 shadow-lg" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-bottom-2 shadow-lg" />
  </div>
);

const CustomEdge = ({
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
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: data?.color || style.stroke || '#3b82f6',
          strokeWidth: 2.5,
          strokeDasharray: data?.style === 'dashed' ? '5,5' : 'none',
        }}
        className="react-flow__edge-path transition-all duration-300"
        d={edgePath}
        markerEnd={markerEnd}
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
          {data?.label && (
            <div className="bg-[#1e293b]/90 backdrop-blur-md px-2 py-0.5 rounded border border-white/20 text-[9px] font-black text-white uppercase tracking-widest shadow-lg">
              {data.label}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = {
  matrix: MatrixNode,
  DECISION: DiamondNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

// --- MAIN BUILDER ---

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack }) => {
  const [view, setView] = useState<'flow' | 'table'>('flow');
  const [isSaved, setIsSaved] = useState(false);
  const [systemParams, setSystemParams] = useState<any[]>([]);

  useEffect(() => {
    settingsApi.listParameters().then(setSystemParams).catch(() => {});
  }, []);

  const taskTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === 'TASK_TYPE');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || ['Admin', 'Technical', 'Physical', 'Validation'];
  }, [systemParams]);

  // Task normalization to ensure all fields exist
  const normalizeTasks = useCallback((rawTasks: any[]): Task[] => {
    return rawTasks.map(t => ({
      id: t.id || `node-${Date.now()}-${Math.random()}`,
      name: t.name || t.label || 'Unnamed Task',
      description: t.description || '',
      task_type: t.task_type || 'Technical',
      target_systems: t.target_systems || (t.target_system ? [{ id: 'default', name: t.target_system, purpose: 'Primary Interface', access_method: t.interface_type }] : []),
      interface_type: t.interface_type || 'GUI',
      manual_time_minutes: t.manual_time_minutes || t.active_touch_time_minutes || 0,
      automation_time_minutes: t.automation_time_minutes || 0,
      machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
      occurrences_per_cycle: t.occurrences_per_cycle || 1,
      occurrence_condition: t.occurrence_condition || '',
      source_data_list: t.source_data_list || [],
      output_data_list: t.output_data_list || [],
      verification_methods: t.verification_methods || [],
      blockers: t.blockers || [],
      errors: t.errors || [],
      tribal_knowledge: t.tribal_knowledge || [],
      media: t.media || [],
      reference_links: t.reference_links || [],
      tool_id: t.tool_id || 'LOCAL',
      hardware_family: t.hardware_family || 'VIRTUAL',
      trigger_architecture: t.trigger_architecture || 'MANUAL',
      output_classification: t.output_classification || 'INTERNAL',
      upstream_links: t.upstream_links || [],
      io_variables: t.io_variables || []
    }));
  }, []);

  const [tasks, setTasks] = useState<Task[]>(() => normalizeTasks(workflow.tasks || []));

  // Get all available outputs from other nodes for source data selection
  const allAvailableOutputs = useMemo(() => {
    const outputs: { nodeId: string, nodeName: string, output: OutputData }[] = [];
    tasks.forEach(t => {
      t.output_data_list.forEach(o => {
        outputs.push({ nodeId: t.id, nodeName: t.name, output: o });
      });
    });
    return outputs;
  }, [tasks]);

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    cadence_count: workflow.cadence_count || 1,
    cadence_unit: workflow.cadence_unit || 'week',
    equipment_state: workflow.equipment_state || 'READY',
    cleanroom_class: workflow.cleanroom_class || 'UNCONTROLLED',
    status: workflow.status || 'DRAFT',
    prc: workflow.prc || '',
    workflow_type: workflow.workflow_type || '',
    tool_family: workflow.tool_family || '',
    tool_family_count: workflow.tool_family_count || 1,
    org: workflow.org || '',
    team: workflow.team || '',
    poc: workflow.poc || '',
    forensic_description: workflow.forensic_description || '',
    trigger_type: workflow.trigger_type || '',
    trigger_description: workflow.trigger_description || '',
    output_type: workflow.output_type || '',
    output_description: workflow.output_description || ''
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'execution' | 'data' | 'exceptions' | 'appendix' | 'process'>('execution');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // World-class Auto-Layout (Layered approach)
  const autoLayout = useCallback(() => {
    if (!reactFlowInstance) return;
    
    setNodes(nds => {
      const incomingCounts: Record<string, number> = {};
      edges.forEach(e => {
        incomingCounts[e.target] = (incomingCounts[e.target] || 0) + 1;
      });

      const roots = nds.filter(n => !incomingCounts[n.id]);
      const levels: Record<string, number> = {};
      
      const assignLevel = (nodeId: string, level: number) => {
        levels[nodeId] = Math.max(levels[nodeId] || 0, level);
        edges.filter(e => e.source === nodeId).forEach(e => assignLevel(e.target, level + 1));
      };

      roots.forEach(r => assignLevel(r.id, 0));
      nds.forEach(n => { if (levels[n.id] === undefined) levels[n.id] = 0; });

      const levelGroups: Record<number, string[]> = {};
      Object.entries(levels).forEach(([id, level]) => {
        if (!levelGroups[level]) levelGroups[level] = [];
        levelGroups[level].push(id);
      });

      return nds.map(n => {
        const level = levels[n.id];
        const indexInLevel = levelGroups[level].indexOf(n.id);
        const totalInLevel = levelGroups[level].length;
        
        return {
          ...n,
          position: {
            x: 100 + (level * 450),
            y: 300 + (indexInLevel * 180) - ((totalInLevel - 1) * 90)
          }
        };
      });
    });

    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 800 }), 100);
  }, [reactFlowInstance, edges, setNodes]);

  // Sync tasks to nodes on load
  useEffect(() => {
    const newNodes: Node[] = tasks.map((t, idx) => ({
      id: t.id,
      type: t.interface_type === 'DECISION' ? 'DECISION' : 'matrix',
      data: { 
        label: t.name, 
        systems: t.target_systems.map(s => s.name).join(', '),
        manual_time: t.manual_time_minutes,
        automation_time: t.automation_time_minutes,
        task_type: t.task_type,
        blockerCount: t.blockers.length,
        errorCount: t.errors.length,
        interface: t.interface_type
      },
      position: nodes.find(n => n.id === t.id)?.position || { x: 100 + (idx * 400), y: 300 },
    }));
    
    // Default edges based on order if no edges exist
    const newEdges: Edge[] = edges.length > 0 ? edges : [];
    if (newEdges.length === 0 && tasks.length > 1) {
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: tasks[i].id,
          target: tasks[i+1].id,
          type: 'custom',
          data: { label: '', color: '#3b82f6', style: 'solid' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
        });
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'custom',
      data: { label: '', color: '#3b82f6', style: 'solid' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, 
    }, eds));
  }, [setEdges]);

  const addNewNode = (type: Task['interface_type']) => {
    const id = `node-${Date.now()}`;
    const newTask: Task = {
      id,
      name: `NEW ${type}`,
      description: '',
      task_type: 'Technical',
      target_systems: [],
      interface_type: type,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrences_per_cycle: 1,
      source_data_list: [],
      output_data_list: [],
      verification_methods: [],
      blockers: [],
      errors: [],
      tribal_knowledge: [],
      media: [],
      reference_links: [],
      tool_id: 'LOCAL',
      hardware_family: 'VIRTUAL',
      trigger_architecture: 'MANUAL',
      output_classification: 'INTERNAL',
      upstream_links: [],
      io_variables: []
    };
    
    setTasks([...tasks, newTask]);
    setSelectedTaskId(id);
    setSelectedEdgeId(null);
    setInspectorTab('execution');
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const updateEdge = (id: string, updates: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates } } : e));
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  const handleSave = async () => {
    try {
      await onSave({...metadata, tasks});
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImagePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob && selectedTaskId) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const url = event.target?.result as string;
            const newMedia: TaskMedia = {
              id: Date.now().toString(),
              type: 'image',
              url,
              label: `Pasted Image ${new Date().toLocaleTimeString()}`
            };
            updateTask(selectedTaskId, { media: [...(selectedTask?.media || []), newMedia] });
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <CreationProgressBar currentStep={isSaved ? 4 : 3} />

      <div className="apple-card !p-0 flex-1 flex flex-col overflow-hidden relative shadow-2xl border-white/10 bg-[#0a1120]">

        {/* --- UNIFIED HEADER --- */}
        <div className="border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl z-40 flex flex-col">
          {/* Row 1: Nav & Basic Controls */}
          <div className="h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-theme-muted hover:text-white transition-all group"
              >
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest">Repository</span>
              </button>

              <div className="h-8 w-[1px] bg-white/10" />

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <LucideWorkflow size={14} className="text-theme-accent" />
                  <span className="text-[13px] font-black text-white tracking-tighter uppercase">{workflow.name}</span>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-white/10 mx-2" />

              {/* Org / Team / POC Context */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-white/20" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.org || 'Unassigned Org'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users2 size={12} className="text-white/20" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.team || 'Unassigned Team'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={12} className="text-white/20" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.poc || 'No POC'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setSelectedTaskId(null); setInspectorTab('process'); }}
                className={cn("flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", 
                  inspectorTab === 'process' && !selectedTaskId ? "bg-theme-accent border-theme-accent text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white")}
              >
                <Settings size={12} /> Process Definition
              </button>
              <button 
                onClick={autoLayout}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                <Layers size={12} /> Auto-Layout
              </button>
              <div className="flex bg-white/5 p-0.5 rounded-full border border-white/10">
                {[
                  { id: 'flow', label: 'Designer' },
                  { id: 'table', label: 'List View' },
                ].map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => setView(v.id as any)} 
                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v.id ? 'bg-theme-accent text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <button onClick={handleSave} className="px-4 py-1.5 bg-theme-accent text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Save size={12} /> {isSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        {/* Row 2: Forensic Description & Type/PRC */}
        <div className="h-10 flex items-center justify-between px-6 border-t border-white/5 bg-white/[0.02]">
           <div className="flex items-center gap-3 flex-1 overflow-hidden">
             <Info size={12} className="text-theme-accent shrink-0" />
             <input 
               className="bg-transparent text-[11px] font-bold text-white/60 outline-none w-full italic truncate"
               placeholder="Add forensic description for this industrial workflow..."
               value={metadata.forensic_description}
               onChange={e => setMetadata({...metadata, forensic_description: e.target.value})}
             />
           </div>

           <div className="flex items-center gap-4 border-l border-white/10 pl-6 shrink-0">
             <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Type</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase">{metadata.workflow_type || 'N/A'}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">PRC</span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-black text-white/60 uppercase">{metadata.prc || 'N/A'}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* --- MAIN CANVAS AREA --- */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {view === 'flow' ? (
            <div className="flex-1 bg-[#0a1120] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect}
                onNodeClick={(_, node) => { setSelectedTaskId(node.id); setInspectorTab('execution'); }}
                onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedTaskId(null); }}
                onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }}
                onInit={setReactFlowInstance}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.03)" gap={40} size={1} />
                <Controls className="!bg-[#1e293b] !border-white/10" />
                <Panel position="bottom-center" className="mb-6">
                   <div className="flex items-center gap-2 p-1.5 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50">
                    <button onClick={() => addNewNode('GUI')} className="flex items-center gap-2 px-5 py-2.5 bg-theme-accent text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-theme-accent/20">
                      <Plus size={16} /> Add Task
                    </button>
                    <button onClick={() => addNewNode('DECISION')} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all">
                      <Zap size={16} /> Add Decision
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-2 bg-[#0a1120]">
              {tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  onClick={() => { setSelectedTaskId(task.id); setInspectorTab('execution'); }}
                  className={cn("border transition-all rounded-xl cursor-pointer p-4 flex items-center gap-4", selectedTaskId === task.id ? "border-theme-accent bg-theme-accent/5" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]")}
                >
                    <span className="text-[12px] font-black text-white/10 w-6">{idx + 1}</span>
                    <div className="flex-1 font-black text-white uppercase">{task.name}</div>
                    <div className="text-[11px] text-white/40 font-black">{task.task_type}</div>
                    <div className="text-[11px] text-white font-black">{task.manual_time_minutes + task.automation_time_minutes}m</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- INSPECTOR --- */}
        <div className="w-[450px] border-l border-white/10 bg-[#0a1120] flex flex-col z-40 shadow-2xl">
          <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
            {[
              { id: 'execution', label: 'Task Detail', icon: <Activity size={12} />, hidden: !selectedTaskId },
              { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: !selectedTaskId },
              { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: !selectedTaskId },
              { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: !selectedTaskId },
              { id: 'process', label: 'Workflow Definition', icon: <Settings size={12} />, hidden: false }
            ].filter(t => !t.hidden).map(t => (
              <button 
                key={t.id}
                onClick={() => { setInspectorTab(t.id as any); if (t.id === 'process') setSelectedTaskId(null); }}
                className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2", 
                  inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white')}
              >
                {t.icon}
                <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-6">
            {selectedTaskId && selectedTask ? (
              <div className="space-y-8 animate-apple-in">
                {inspectorTab === 'execution' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Name</label>
                        <button onClick={() => setSelectedTaskId(null)} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button>
                      </div>
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId, { name: e.target.value })} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                      <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/60 outline-none focus:border-theme-accent h-24 resize-none leading-relaxed" placeholder="Task objective and core logic..." value={selectedTask.description} onChange={e => updateTask(selectedTaskId, { description: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Type</label>
                        <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-white outline-none focus:border-theme-accent appearance-none" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId, { task_type: e.target.value })}>
                          {taskTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Interface</label>
                        <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-white outline-none focus:border-theme-accent appearance-none" value={selectedTask.interface_type} onChange={e => updateTask(selectedTaskId, { interface_type: e.target.value as any })}>
                          <option value="GUI">GUI</option>
                          <option value="CLI">CLI</option>
                          <option value="API">API</option>
                          <option value="DECISION">Conditional</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1">Manual (m)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-black text-white outline-none focus:border-blue-400" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1">Automation (m)</label>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-black text-white outline-none focus:border-purple-400" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) })} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Involved Systems</label>
                         <button onClick={() => updateTask(selectedTaskId, { target_systems: [...selectedTask.target_systems, { id: Date.now().toString(), name: '', purpose: '', access_method: '' }] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.target_systems.map(s => (
                          <div key={s.id} className="flex gap-2 p-2 bg-white/5 border border-white/10 rounded-xl group relative">
                            <input placeholder="System Name" className="flex-1 bg-transparent text-[11px] font-black text-white outline-none px-2 uppercase" value={s.name} onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(ts => ts.id === s.id ? { ...ts, name: e.target.value } : ts) })} />
                            <button onClick={() => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.filter(ts => ts.id !== s.id) })} className="opacity-0 group-hover:opacity-100 text-status-error p-1 transition-opacity hover:scale-110"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'appendix' && (
                  <div className="space-y-8" onPaste={handleImagePaste}>
                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Visual Documentation</label>
                      <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group">
                         <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             const reader = new FileReader();
                             reader.onload = (evt) => {
                               const url = evt.target?.result as string;
                               updateTask(selectedTaskId, { media: [...selectedTask.media, { id: Date.now().toString(), type: 'image', url, label: file.name }] });
                             };
                             reader.readAsDataURL(file);
                           }
                         }} />
                         <ImageIcon size={32} className="text-white/10 group-hover:text-theme-accent transition-colors" />
                         <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Paste or Upload Figure</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedTask.media.map(m => (
                          <div key={m.id} className="aspect-video rounded-xl border border-white/10 overflow-hidden relative group bg-black shadow-lg">
                             <img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                             <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
                                <p className="text-[8px] font-black text-white uppercase truncate">{m.label}</p>
                             </div>
                             <button onClick={() => updateTask(selectedTaskId, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-95"><Trash size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* ... existing data/exceptions tabs should stay, let's keep them ... */}
                {inspectorTab === 'data' && (
                  <div className="space-y-8 animate-apple-in">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Source Data</label>
                        <div className="flex gap-2">
                           <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), is_manual: true, name: '', source_location: '', format: '', example: '', description: '', purpose: '' }] })} className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 text-white rounded text-[9px] font-black uppercase hover:bg-white/10 transition-all">
                            <Plus size={12} /> Manual
                          </button>
                        </div>
                      </div>

                      {allAvailableOutputs.filter(o => o.nodeId !== selectedTaskId).length > 0 && (
                        <div className="space-y-2">
                           <label className="text-[8px] font-black text-theme-accent uppercase tracking-widest px-1">Link From Upstream</label>
                           <select 
                            className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-white outline-none focus:border-theme-accent appearance-none"
                            onChange={(e) => {
                              const selected = allAvailableOutputs.find(o => o.output.id === e.target.value);
                              if (selected) {
                                updateTask(selectedTaskId, { 
                                  source_data_list: [...selectedTask.source_data_list, { 
                                    id: Date.now().toString(), 
                                    is_manual: false, 
                                    name: selected.output.name, 
                                    source_location: selected.nodeName, 
                                    format: selected.output.format, 
                                    example: selected.output.example, 
                                    description: selected.output.description, 
                                    purpose: `Linked from ${selected.nodeName}`,
                                    origin_node_id: selected.nodeId
                                  }] 
                                });
                              }
                            }}
                            value=""
                           >
                            <option value="">Select Upstream Output...</option>
                            {allAvailableOutputs.filter(o => o.nodeId !== selectedTaskId).map(o => (
                              <option key={o.output.id} value={o.output.id}>{o.nodeName} → {o.output.name}</option>
                            ))}
                           </select>
                        </div>
                      )}

                      <div className="space-y-3">
                        {selectedTask.source_data_list.map(sd => (
                          <div key={sd.id} className={cn("p-4 border rounded-2xl relative group shadow-sm transition-all", sd.is_manual ? "bg-white/5 border-white/10" : "bg-theme-accent/5 border-theme-accent/20")}>
                            <div className="flex items-center gap-2 mb-2">
                               {!sd.is_manual && <Layers size={12} className="text-theme-accent" />}
                               <input placeholder="Data Label" className="bg-transparent text-[12px] font-black text-white outline-none border-b border-white/10 w-full uppercase" value={sd.name} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="space-y-1">
                                  <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Source</span>
                                  <input placeholder="Location" className="bg-transparent text-[10px] text-white/40 outline-none w-full" value={sd.source_location} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, source_location: e.target.value } : x) })} />
                               </div>
                               <div className="space-y-1 text-right">
                                  <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Format</span>
                                  <input placeholder="Format" className="bg-transparent text-[10px] text-white/40 outline-none w-full text-right" value={sd.format} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, format: e.target.value } : x) })} />
                               </div>
                            </div>
                            <button onClick={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="absolute -right-2 -top-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 shadow-lg transition-all hover:scale-110"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Generated Outputs</label>
                        <button onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', format: '', example: '', saved_location: '' }] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-3">
                        {selectedTask.output_data_list.map(od => (
                          <div key={od.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl relative group">
                             <input placeholder="Output Name" className="bg-transparent text-[12px] font-black text-white outline-none border-b border-white/10 w-full mb-2 uppercase" value={od.name} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} />
                             <div className="grid grid-cols-2 gap-2">
                               <input placeholder="Format" className="bg-transparent text-[10px] text-white/40 outline-none" value={od.format} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, format: e.target.value } : x) })} />
                               <input placeholder="Destination" className="bg-transparent text-[10px] text-white/40 outline-none text-right" value={od.saved_location} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, saved_location: e.target.value } : x) })} />
                             </div>
                             <button onClick={() => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })} className="absolute -right-2 -top-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 shadow-lg"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'exceptions' && (
                  <div className="space-y-8 animate-apple-in">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Blockers</label>
                        <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 0, average_delay_minutes: 0, standard_mitigation: '' }] })} className="text-amber-500 hover:bg-amber-500/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-3">
                        {selectedTask.blockers.map(b => (
                          <div key={b.id} className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl relative group shadow-sm transition-all hover:bg-amber-500/10">
                            <input placeholder="Blocking Entity" className="bg-transparent text-[12px] font-black text-amber-500 outline-none border-b border-amber-500/10 w-full mb-2 uppercase" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
                            <textarea placeholder="Reason" className="bg-transparent text-[10px] text-white/60 outline-none w-full h-12 resize-none leading-relaxed" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} />
                            <button onClick={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute -right-2 -top-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 shadow-lg transition-all hover:scale-110"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedEdgeId && selectedEdge ? (
              <div className="p-6 space-y-10 animate-apple-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-theme-accent/20 rounded-lg">
                      <Link2 size={16} className="text-theme-accent" />
                    </div>
                    <span className="text-[14px] font-black text-white uppercase tracking-widest">Connection Attributes</span>
                  </div>
                  <button onClick={() => setSelectedEdgeId(null)} className="text-white/20 hover:text-white transition-colors"><X size={16} /></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Transition Label</label>
                    <input 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" 
                      placeholder="e.g. YES, NO, ERROR..."
                      value={selectedEdge.data?.label || ''} 
                      onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Visual Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'solid', label: 'Solid' },
                        { id: 'dashed', label: 'Dashed' }
                      ].map(s => (
                        <button 
                          key={s.id}
                          onClick={() => updateEdge(selectedEdgeId, { style: s.id })}
                          className={cn("px-4 py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest", 
                            selectedEdge.data?.style === s.id ? 'bg-theme-accent border-theme-accent text-white shadow-lg shadow-theme-accent/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white')}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Signal Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(c => (
                        <button 
                          key={c}
                          onClick={() => updateEdge(selectedEdgeId, { color: c })}
                          className={cn("aspect-square rounded-xl border-2 transition-all hover:scale-110 active:scale-95", 
                            selectedEdge.data?.color === c ? 'border-white shadow-lg' : 'border-transparent opacity-40 hover:opacity-100')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-10 border-t border-white/10">
                  <button 
                    onClick={() => setEdges(eds => eds.filter(e => e.id !== selectedEdgeId))}
                    className="w-full py-4 bg-status-error/10 border border-status-error/20 text-status-error rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-xl hover:shadow-status-error/20"
                  >
                    <Trash size={14} /> Sever Connection
                  </button>
                </div>
              </div>
            ) : (
                <div className="space-y-10 animate-apple-in">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                       <LucideWorkflow className="text-theme-accent" size={18} />
                       <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Process Definition</h2>
                    </div>
                    
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-white/40 uppercase px-1">PRC Code</label>
                             <select 
                                className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[12px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                                value={metadata.prc}
                                onChange={e => setMetadata({...metadata, prc: e.target.value})}
                             >
                               <option value="">Select PRC...</option>
                               {taxonomy.filter(t => t.category === 'PRC' || t.key === 'PRC').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-white/40 uppercase px-1">Workflow Type</label>
                             <select 
                                className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[12px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                                value={metadata.workflow_type}
                                onChange={e => setMetadata({...metadata, workflow_type: e.target.value})}
                             >
                               <option value="">Select Type...</option>
                               {taxonomy.filter(t => t.category === 'WORKFLOW_TYPE' || t.key === 'WORKFLOW_TYPE').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}
                             </select>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-white/40 uppercase px-1">Occurrence</label>
                          <div className="flex items-center gap-2 bg-[#1e293b] border border-white/10 rounded-xl p-1">
                            <input 
                              type="number" 
                              className="w-16 bg-black/40 font-black text-[13px] text-white text-center py-2 rounded-lg focus:border-theme-accent outline-none" 
                              value={metadata.cadence_count} 
                              onChange={e => setMetadata({...metadata, cadence_count: parseFloat(e.target.value)})} 
                            />
                            <select 
                              className="flex-1 bg-transparent text-white font-black text-center appearance-none cursor-pointer uppercase text-[10px] tracking-tight outline-none py-2"
                              value={metadata.cadence_unit}
                              onChange={e => setMetadata({...metadata, cadence_unit: e.target.value as any})}
                            >
                              <option value="day">DAILY</option>
                              <option value="week">WEEKLY</option>
                              <option value="month">MONTHLY</option>
                              <option value="year">YEARLY</option>
                            </select>
                          </div>
                       </div>
                    </div>
                  </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                     <Zap className="text-amber-500" size={16} />
                     <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Trigger Architecture</h2>
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-2 p-5 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">{metadata.trigger_type}</span>
                        <p className="text-[11px] text-white/60 font-bold leading-relaxed italic">{metadata.trigger_description || 'No trigger details provided.'}</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                     <Layers className="text-theme-accent" size={16} />
                     <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Output Classification</h2>
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-2 p-5 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm">
                        <span className="text-[9px] font-black text-theme-accent uppercase tracking-[0.2em]">{metadata.output_type}</span>
                        <p className="text-[11px] text-white/60 font-bold leading-relaxed italic">{metadata.output_description || 'No output details provided.'}</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                     <Building2 className="text-white/40" size={16} />
                     <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Organization Context</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                     {[
                       { label: 'Organization', value: metadata.org },
                       { label: 'Team', value: metadata.team },
                       { label: 'Point of Contact', value: metadata.poc }
                     ].map(item => (
                       <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/10 shadow-sm hover:bg-white/[0.05] transition-all group">
                          <span className="text-[10px] font-black text-white/40 uppercase group-hover:text-white/60 transition-colors">{item.label}</span>
                          <span className="text-[11px] font-black text-white uppercase">{item.value || 'Not Set'}</span>
                       </div>
                     ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (
  <ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
