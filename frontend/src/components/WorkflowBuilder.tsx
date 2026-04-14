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
  Paperclip,
  ChevronLeft,
  User,
  Info,
  Settings,
  Trash,
  Link2,
  Search
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
  correction_method: string;
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
  interface_type: 'GUI' | 'CLI' | 'API' | 'DECISION' | 'TRIGGER' | 'OUTCOME';
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
  tool_id: string;
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
  onExit: () => void;
}

// --- CUSTOM NODES & EDGES ---

const MatrixNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const typeColors: Record<string, string> = {
    'Admin': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    'Technical': 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    'Physical': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    'Validation': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    'TRIGGER': 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    'OUTCOME': 'text-rose-400 border-rose-400/30 bg-rose-400/10',
  };

  const typeColor = typeColors[data.task_type] || 'text-white/40 border-white/10 bg-white/5';

  return (
    <div className={cn(
      "apple-glass !bg-[#0f172a]/95 !rounded-2xl px-6 py-5 min-w-[320px] shadow-2xl transition-all duration-300 group relative border-2",
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : 'border-white/10 hover:border-white/20'
    )}>
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
            <div className="flex items-center gap-3 font-mono text-[11px] font-black">
              <div className="flex items-center gap-1 text-blue-400">
                <User size={10} />
                <span>{data.manual_time || 0}m</span>
              </div>
              <div className="flex items-center gap-1 text-purple-400">
                <Activity size={10} />
                <span>{data.automation_time || 0}m</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <h4 className="text-[15px] font-black text-white tracking-tighter leading-tight uppercase group-hover:text-theme-accent transition-colors">{data.label || "Untitled Task"}</h4>
          {data.description && (
            <p className="text-[10px] text-white/40 font-bold leading-relaxed line-clamp-2 italic uppercase tracking-tight">
              {data.description}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest truncate max-w-[200px]">{data.systems}</span>
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
  TRIGGER: MatrixNode,
  OUTCOME: MatrixNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

// --- MAIN BUILDER ---

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack, onExit }) => {
  const [view, setView] = useState<'flow' | 'table'>('flow');
  const [isSaved, setIsSaved] = useState(false);
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);

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

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    cadence_count: workflow.cadence_count || 1,
    cadence_unit: workflow.cadence_unit || 'week',
    equipment_state: workflow.equipment_state || 'READY',
    cleanroom_class: workflow.cleanroom_class || 'UNCONTROLLED',
    status: workflow.status || 'DRAFT',
    prc: workflow.prc || '',
    workflow_type: workflow.workflow_type || '',
    tool_family: workflow.tool_family || '',
    tool_id: workflow.tool_id || '',
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

  const [tasks, setTasks] = useState<Task[]>(() => {
    const baseTasks = normalizeTasks(workflow.tasks || []);
    const result = [...baseTasks];
    
    // Ensure Trigger Node exists
    if (!result.find(t => t.interface_type === 'TRIGGER')) {
      result.unshift({
        id: 'trigger-node',
        name: workflow.trigger_type || 'TRIGGER EVENT',
        description: workflow.trigger_description || 'Initiating event for the workflow.',
        task_type: 'TRIGGER',
        target_systems: [],
        interface_type: 'TRIGGER',
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
      });
    }

    // Ensure Outcome Node exists
    if (!result.find(t => t.interface_type === 'OUTCOME')) {
      result.push({
        id: 'outcome-node',
        name: workflow.output_type || 'OUTCOME DELIVERABLE',
        description: workflow.output_description || 'Final output or state achieved.',
        task_type: 'OUTCOME',
        target_systems: [],
        interface_type: 'OUTCOME',
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
      });
    }
    return result;
  });

  // Resizer logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 350 && newWidth < 1000) {
      setInspectorWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Keep metadata in sync if workflow prop updates
  useEffect(() => {
    setMetadata({
      cadence_count: workflow.cadence_count || 1,
      cadence_unit: workflow.cadence_unit || 'week',
      equipment_state: workflow.equipment_state || 'READY',
      cleanroom_class: workflow.cleanroom_class || 'UNCONTROLLED',
      status: workflow.status || 'DRAFT',
      prc: workflow.prc || '',
      workflow_type: workflow.workflow_type || '',
      tool_family: workflow.tool_family || '',
      tool_id: workflow.tool_id || '',
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
  }, [workflow]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'execution' | 'data' | 'exceptions' | 'appendix' | 'process'>('process');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Auto-Layout
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

  const deleteTask = (id: string) => {
    if (id === 'trigger-node' || id === 'outcome-node') return;
    
    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setInspectorTab('process');
  };

  // Sync tasks to nodes on load
  useEffect(() => {
    const newNodes: Node[] = tasks.map((t, idx) => ({
      id: t.id,
      type: t.interface_type === 'DECISION' ? 'DECISION' : 
            t.interface_type === 'TRIGGER' ? 'TRIGGER' :
            t.interface_type === 'OUTCOME' ? 'OUTCOME' : 'matrix',
      data: { 
        label: t.name, 
        description: t.description,
        systems: t.target_systems.map(s => s.name).join(', '),
        manual_time: t.manual_time_minutes,
        automation_time: t.automation_time_minutes,
        task_type: t.task_type,
        blockerCount: t.blockers.length,
        errorCount: t.errors.length,
        interface: t.interface_type
      },
      position: nodes.find(n => n.id === t.id)?.position || (
        t.id === 'trigger-node' ? { x: 100, y: 300 } :
        t.id === 'outcome-node' ? { x: 1000, y: 300 } :
        { x: 100 + (idx * 400), y: 300 }
      ),
    }));
    
    // Auto-connect only if edges are empty and we have more than T/O
    if (edges.length === 0 && tasks.length > 2) {
      const newEdges: Edge[] = [];
      const midTasks = tasks.filter(t => t.id !== 'trigger-node' && t.id !== 'outcome-node');
      
      newEdges.push({
        id: `e-trigger-${midTasks[0].id}`,
        source: 'trigger-node',
        target: midTasks[0].id,
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      });

      for (let i = 0; i < midTasks.length - 1; i++) {
        newEdges.push({
          id: `e${midTasks[i].id}-${midTasks[i+1].id}`,
          source: midTasks[i].id,
          target: midTasks[i+1].id,
          type: 'custom',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
        });
      }

      newEdges.push({
        id: `e-${midTasks[midTasks.length-1].id}-outcome`,
        source: midTasks[midTasks.length-1].id,
        target: 'outcome-node',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
      });
      setEdges(newEdges);
    } else {
      setEdges(eds => eds.filter(e => tasks.some(t => t.id === e.source) && tasks.some(t => t.id === e.target)));
    }
    
    setNodes(newNodes);
  }, [tasks]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'custom',
      data: { label: '', color: '#3b82f6', style: 'solid' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, 
    }, eds));
  }, [setEdges]);

  // Handle deletions from React Flow
  const onNodesDelete = useCallback((deleted: Node[]) => {
    const deletedIds = deleted.map(n => n.id);
    if (deletedIds.includes('trigger-node') || deletedIds.includes('outcome-node')) return;
    setTasks(prev => prev.filter(t => !deletedIds.includes(t.id)));
  }, []);

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
    
    setTasks(prev => {
      const outcome = prev.find(t => t.id === 'outcome-node');
      const others = prev.filter(t => t.id !== 'outcome-node');
      return [...others, newTask, outcome].filter(Boolean) as Task[];
    });
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

  // Trigger/Outcome protection
  const isProtected = selectedTaskId === 'trigger-node' || selectedTaskId === 'outcome-node';

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
        <div className="border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl z-[60] flex flex-col">
          <div className="h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <button onClick={onBack} className="flex items-center gap-2 text-theme-muted hover:text-white transition-all group">
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest">Definition</span>
              </button>
              <button onClick={onExit} className="flex items-center gap-2 text-white/20 hover:text-white transition-all group ml-2">
                <X size={14} className="group-hover:rotate-90 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest">Exit</span>
              </button>
              <div className="h-8 w-[1px] bg-white/10" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <LucideWorkflow size={14} className="text-theme-accent" />
                  <span className="text-[13px] font-black text-white tracking-tighter uppercase">{workflow.name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => { setSelectedTaskId(null); setInspectorTab('process'); }} className={cn("flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", inspectorTab === 'process' && !selectedTaskId ? "bg-theme-accent border-theme-accent text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white")}>
                <Settings size={12} /> Definition
              </button>
              <button onClick={autoLayout} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                <Layers size={12} /> Auto-Layout
              </button>
              <div className="flex bg-white/5 p-0.5 rounded-full border border-white/10">
                {[{ id: 'flow', label: 'Designer' }, { id: 'table', label: 'List View' }].map((v) => (
                  <button key={v.id} onClick={() => setView(v.id as any)} className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v.id ? 'bg-theme-accent text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>{v.label}</button>
                ))}
              </div>
              <button onClick={handleSave} className="px-4 py-1.5 bg-theme-accent text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Save size={12} /> {isSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
          <div className="h-10 flex items-center justify-between px-6 border-t border-white/5 bg-white/[0.02]">
             <div className="flex items-center gap-3 flex-1 overflow-hidden">
               <Info size={12} className="text-theme-accent shrink-0" />
               <input className="bg-transparent text-[11px] font-bold text-white/60 outline-none w-full italic truncate" placeholder="Add forensic description for this industrial workflow..." value={metadata.forensic_description} onChange={e => setMetadata({...metadata, forensic_description: e.target.value})} />
             </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {view === 'flow' ? (
              <div className="flex-1 bg-[#0a1120] relative">
                <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodesDelete={onNodesDelete} onNodeClick={(_, node) => { setSelectedTaskId(node.id); setInspectorTab(node.id.includes('node') ? 'execution' : 'process'); }} onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedTaskId(null); }} onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); setInspectorTab('process'); }} onInit={setReactFlowInstance} fitView className="bg-transparent">
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
              <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-10 bg-[#0a1120]">
                {(() => {
                  const sortedTasks = [...tasks]; // Simplified for brevity in list view
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                         <span className="text-[10px] font-black text-theme-accent uppercase tracking-[0.3em]">Workflow Entity Hierarchy</span>
                         <div className="h-[1px] flex-1 bg-white/5" />
                         <span className="text-[10px] font-black text-white/20 uppercase">{tasks.length} Entities</span>
                      </div>
                      <div className="overflow-hidden border border-white/10 rounded-2xl bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                              <th className="p-4 text-[9px] font-black text-white/40 uppercase tracking-widest w-12 text-center">#</th>
                              <th className="p-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Entity Identity</th>
                              <th className="p-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Manual</th>
                              <th className="p-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Auto</th>
                              <th className="p-4 text-[9px] font-black text-white/40 uppercase tracking-widest">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {sortedTasks.map((task, idx) => (
                              <tr key={task.id} onClick={() => { setSelectedTaskId(task.id); setInspectorTab(task.id.includes('node') ? 'execution' : 'process'); }} className={cn("group cursor-pointer transition-all", selectedTaskId === task.id ? "bg-theme-accent/10" : "hover:bg-white/[0.04]")}>
                                <td className="p-4 text-center"><span className="text-[12px] font-black text-white/20">{idx + 1}</span></td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="text-[13px] font-black text-white uppercase">{task.name}</span>
                                    <span className="text-[10px] text-white/40 font-bold italic truncate max-w-[200px] uppercase">{task.description || 'No description'}</span>
                                  </div>
                                </td>
                                <td className="p-4"><span className="text-[12px] font-black text-blue-400">{task.manual_time_minutes}m</span></td>
                                <td className="p-4"><span className="text-[12px] font-black text-purple-400">{task.automation_time_minutes}m</span></td>
                                <td className="p-4">
                                   <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1.5"><AlertCircle size={14} className={task.blockers.length > 0 ? "text-status-warning" : "text-white/10"} /><span className={cn("text-[11px] font-black", task.blockers.length > 0 ? "text-status-warning" : "text-white/10")}>{task.blockers.length}</span></div>
                                      <div className="flex items-center gap-1.5"><X size={14} className={task.errors.length > 0 ? "text-status-error" : "text-white/10"} /><span className={cn("text-[11px] font-black", task.errors.length > 0 ? "text-status-error" : "text-white/10")}>{task.errors.length}</span></div>
                                   </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70] shadow-2xl transition-width duration-75" style={{ width: `${inspectorWidth}px` }}>
            <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent transition-colors z-50 group" />
            <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
              {[
                { id: 'execution', label: 'Task Detail', icon: <Activity size={12} />, hidden: !selectedTaskId || isProtected },
                { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: !selectedTaskId || isProtected },
                { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: !selectedTaskId || isProtected },
                { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: !selectedTaskId || isProtected }
              ].filter(t => !t.hidden).map(t => (
                <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white')}>
                  {t.icon}<span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
                </button>
              ))}
              {(!selectedTaskId || isProtected) && (
                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white">
                  <Settings size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Workflow Definition</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-6">
              {selectedTaskId && selectedTask && !isProtected ? (
                <div className="space-y-8 animate-apple-in">
                  {inspectorTab === 'execution' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Name</label>
                          <button onClick={() => { setSelectedTaskId(null); setInspectorTab('process'); }} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button>
                        </div>
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId, { name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-bold text-white/60 outline-none focus:border-theme-accent h-24 resize-none leading-relaxed" placeholder="Task objective and core logic..." value={selectedTask.description} onChange={e => updateTask(selectedTaskId, { description: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Type</label>
                        <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-white outline-none focus:border-theme-accent appearance-none" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId, { task_type: e.target.value })}>
                          {taskTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1">Manual (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[14px] font-black text-white outline-none focus:border-blue-400" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1">Automation (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[14px] font-black text-white outline-none focus:border-purple-400" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                      <button onClick={() => deleteTask(selectedTaskId)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2">
                        <Trash size={12} /> Delete Task Entity
                      </button>
                    </div>
                  )}
                  {inspectorTab === 'data' && (
                    <div className="space-y-10 animate-apple-in">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Source Data</label>
                          <div className="flex gap-2">
                             <div className="relative group/search">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                                  <Search size={12} /> Search Existing
                                </button>
                                <div className="absolute top-full right-0 mt-2 w-64 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-[100] p-2 opacity-0 invisible group-hover/search:opacity-100 group-hover/search:visible transition-all backdrop-blur-2xl">
                                   <p className="text-[8px] font-black text-white/20 uppercase px-2 py-1 border-b border-white/5 mb-2">Upstream Outputs</p>
                                   <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                      {tasks.filter(t => t.id !== selectedTaskId).flatMap(t => t.output_data_list.map(o => ({ ...o, origin: t.name, originId: t.id }))).length === 0 ? (
                                        <p className="text-[10px] text-white/10 text-center py-4 font-black">NO UPSTREAM OUTPUTS</p>
                                      ) : tasks.filter(t => t.id !== selectedTaskId).flatMap(t => t.output_data_list.map(o => ({ ...o, origin: t.name, originId: t.id }))).map(o => (
                                        <button 
                                          key={o.id} 
                                          onClick={() => {
                                            const newSource: SourceData = {
                                              id: `ref-${Date.now()}`,
                                              is_manual: false,
                                              name: o.name,
                                              source_location: o.saved_location,
                                              format: o.format,
                                              example: o.example,
                                              description: o.description,
                                              purpose: 'Referenced from upstream output',
                                              origin_node_id: o.originId
                                            };
                                            updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, newSource] });
                                          }} 
                                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group/item"
                                        >
                                          <p className="text-[11px] font-black text-white uppercase truncate">{o.name}</p>
                                          <p className="text-[8px] font-bold text-white/20 uppercase truncate">From: {o.origin}</p>
                                        </button>
                                      ))}
                                   </div>
                                </div>
                             </div>
                             <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), is_manual: true, name: '', source_location: '', format: '', example: '', description: '', purpose: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">
                               <Plus size={12} /> Add Manual
                             </button>
                          </div>
                        </div>
                        <div className="overflow-hidden border border-white/10 rounded-xl bg-white/[0.02]">
                          <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/5">
                              {selectedTask.source_data_list.map(sd => (
                                <tr key={sd.id} className="group hover:bg-white/[0.03] transition-colors">
                                  <td className="p-3">
                                    <input className="bg-transparent text-[13px] font-black text-white outline-none w-full uppercase" value={sd.name} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} placeholder="DATA NAME" />
                                    {!sd.is_manual && <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">Linked Source</span>}
                                  </td>
                                  <td className="p-3"><button onClick={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  {inspectorTab === 'exceptions' && (
                    <div className="space-y-10 animate-apple-in">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Blockers</label>
                          <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 10, average_delay_minutes: 0, standard_mitigation: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all"><Plus size={12} /> Add Blocker</button>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.blockers.map(b => (
                            <div key={b.id} className="p-4 bg-[#1e293b]/50 border border-white/10 rounded-2xl space-y-4 group relative">
                              <button onClick={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute top-4 right-4 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-white/20 uppercase">Blocker Name</label>
                                <input className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[13px] font-black text-amber-500 uppercase outline-none focus:border-amber-500" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Reason</label><input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} /></div>
                                <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Delay (min)</label><input type="number" className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={b.average_delay_minutes} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) } : x) })} /></div>
                              </div>
                              <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Mitigation</label><input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={b.standard_mitigation} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, standard_mitigation: e.target.value } : x) })} /></div>
                              <div className="flex items-center justify-between pt-2 border-t border-white/5"><span className="text-[8px] font-black text-white/20 uppercase">Frequency (/10)</span><div className="flex items-center gap-2"><input type="range" min="1" max="10" className="w-24 accent-amber-500" value={Math.round(b.probability_percent / 10)} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, probability_percent: parseInt(e.target.value) * 10 } : x) })} /><span className="text-[10px] font-black text-white">{Math.round(b.probability_percent / 10)}</span></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[9px] font-black text-status-error uppercase tracking-widest">Errors</label>
                          <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', probability_percent: 10, recovery_time_minutes: 0, correction_method: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-status-error hover:text-white transition-all"><Plus size={12} /> Add Error</button>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.errors.map(err => (
                            <div key={err.id} className="p-4 bg-status-error/5 border border-status-error/10 rounded-2xl space-y-4 group relative">
                              <button onClick={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== err.id) })} className="absolute top-4 right-4 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Error Name</label><input className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-[13px] font-black text-status-error uppercase outline-none focus:border-status-error" value={err.error_type} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, error_type: e.target.value } : x) })} /></div>
                              <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Cause</label><input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={err.description} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, description: e.target.value } : x) })} /></div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Correction</label><input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={err.correction_method} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, correction_method: e.target.value } : x) })} /></div>
                                <div className="space-y-1.5"><label className="text-[8px] font-black text-white/20 uppercase">Recovery (min)</label><input type="number" className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white" value={err.recovery_time_minutes} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) } : x) })} /></div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-white/5"><span className="text-[8px] font-black text-white/20 uppercase">Frequency (/10)</span><div className="flex items-center gap-2"><input type="range" min="1" max="10" className="w-24 accent-status-error" value={Math.round(err.probability_percent / 10)} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, probability_percent: parseInt(e.target.value) * 10 } : x) })} /><span className="text-[10px] font-black text-white">{Math.round(err.probability_percent / 10)}</span></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Tribal Knowledge</label>
                          <button onClick={() => updateTask(selectedTaskId, { tribal_knowledge: [...selectedTask.tribal_knowledge, { id: Date.now().toString(), knowledge: '', captured_from: '' }] })} className="text-emerald-500 hover:bg-emerald-500/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                        </div>
                        {selectedTask.tribal_knowledge.map(tk => (
                          <div key={tk.id} className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3 relative group">
                            <button onClick={() => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.filter(x => x.id !== tk.id) })} className="absolute top-4 right-4 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                            <textarea className="w-full bg-transparent text-[11px] text-white/80 outline-none h-16 resize-none" value={tk.knowledge} onChange={e => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} placeholder="implicit rule or tip..." />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {inspectorTab === 'appendix' && (
                    <div className="space-y-8" onPaste={handleImagePaste}>
                       <div className="space-y-4">
                         <label className="text-[9px] font-black text-white/40 uppercase px-1">Visual Figures</label>
                         <div className="grid grid-cols-2 gap-4">
                           {selectedTask.media.map(m => (
                             <div key={m.id} className="aspect-video rounded-xl overflow-hidden border border-white/10 relative group bg-black">
                                <img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                <button onClick={() => updateTask(selectedTaskId, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash size={10} /></button>
                             </div>
                           ))}
                           <div className="aspect-video rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer relative">
                              <input type="file" className="absolute inset-0 opacity-0" onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                   const reader = new FileReader();
                                   reader.onload = (evt) => updateTask(selectedTaskId, { media: [...selectedTask.media, { id: Date.now().toString(), type: 'image', url: evt.target?.result as string, label: file.name }] });
                                   reader.readAsDataURL(file);
                                 }
                              }} />
                              <Plus className="text-white/10" />
                           </div>
                         </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Reference Links</label>
                            <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), url: '', description: '' }] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                          </div>
                          <div className="space-y-3">
                            {selectedTask.reference_links.map(link => (
                              <div key={link.id} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2 relative group">
                                <button onClick={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(l => l.id !== link.id) })} className="absolute top-3 right-3 text-white/10 hover:text-status-error transition-colors"><X size={12} /></button>
                                <div className="flex items-center gap-2"><Link2 size={12} className="text-blue-400" /><input className="bg-transparent text-[11px] text-blue-400 outline-none w-full" value={link.url} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l) })} placeholder="https://..." /></div>
                                <input className="bg-transparent text-[11px] text-white/40 outline-none w-full pl-5" value={link.description} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? { ...l, description: e.target.value } : l) })} placeholder="Description..." />
                              </div>
                            ))}
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              ) : selectedEdgeId && selectedEdge ? (
                <div className="p-6 space-y-10 animate-apple-in">
                   <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Connection</span></div></div>
                   <div className="space-y-6"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label><input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} /></div></div>
                </div>
              ) : (
                <div className="space-y-8 animate-apple-in">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <div className="flex items-center gap-3"><LucideWorkflow className="text-theme-accent" size={18} /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Process Definition</h2></div>
                     <button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", isEditingMetadata ? "bg-theme-accent text-white" : "bg-white/5 border border-white/10 text-white/40 hover:text-white")}>{isEditingMetadata ? 'Finish' : 'Edit'}</button>
                  </div>
                  <div className="space-y-10">
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-white/40 uppercase px-1">PRC</label>
                             {isEditingMetadata ? (
                               <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none" value={metadata.prc} onChange={e => setMetadata({...metadata, prc: e.target.value})}><option value="">Select PRC...</option>{taxonomy.filter(t => t.category === 'PRC').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                             ) : (
                               <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[12px] font-black text-white uppercase">{metadata.prc || 'N/A'}</div>
                             )}
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black text-white/40 uppercase px-1">Type</label>
                             {isEditingMetadata ? (
                               <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none" value={metadata.workflow_type} onChange={e => setMetadata({...metadata, workflow_type: e.target.value})}><option value="">Select Type...</option>{taxonomy.filter(t => t.category === 'WORKFLOW_TYPE').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                             ) : (
                               <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[12px] font-black text-white uppercase">{metadata.workflow_type || 'N/A'}</div>
                             )}
                          </div>
                       </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-white/10 pb-4"><Zap className="text-amber-500" size={16} /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Trigger</h2></div>
                      <div className="space-y-3">
                         {isEditingMetadata ? (
                           <><select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none" value={metadata.trigger_type} onChange={e => setMetadata({...metadata, trigger_type: e.target.value})}><option value="">Select Trigger...</option>{taxonomy.filter(t => t.category === 'TriggerType').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select><textarea className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-[11px] text-white/60 font-bold leading-relaxed h-20 resize-none" value={metadata.trigger_description} onChange={e => setMetadata({...metadata, trigger_description: e.target.value})} /></>
                         ) : (
                           <div className="space-y-3"><div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-[12px] font-black text-amber-500 uppercase">{metadata.trigger_type || 'Manual'}</div><p className="text-[11px] font-bold text-white/60 italic px-1">{metadata.trigger_description || 'No description.'}</p></div>
                         )}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-white/10 pb-4"><Layers className="text-theme-accent" size={16} /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Output</h2></div>
                      <div className="space-y-3">
                         {isEditingMetadata ? (
                           <><select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none" value={metadata.output_type} onChange={e => setMetadata({...metadata, output_type: e.target.value})}><option value="">Select Output Type...</option>{taxonomy.filter(t => t.category === 'OutputType').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select><textarea className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-[11px] text-white/60 font-bold leading-relaxed h-20 resize-none" value={metadata.output_description} onChange={e => setMetadata({...metadata, output_description: e.target.value})} /></>
                         ) : (
                           <div className="space-y-3"><div className="bg-theme-accent/10 border border-theme-accent/20 rounded-xl px-4 py-2 text-[12px] font-black text-theme-accent uppercase">{metadata.output_type || 'Internal'}</div><p className="text-[11px] font-bold text-white/60 italic px-1">{metadata.output_description || 'No description.'}</p></div>
                         )}
                      </div>
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
