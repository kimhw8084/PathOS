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
  addEdge,
  type Connection,
  type EdgeProps,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, 
  Workflow as LucideWorkflow, 
  X, Zap,
  Activity, Database, AlertCircle,
  Clock,
  Plus, 
  Paperclip,
  ChevronLeft,
  Settings,
  Trash,
  Link2,
  Search,
  MousePointer2,
  RefreshCw,
  Copy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dagre from 'dagre';

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

interface TaskEntity {
  id: string;
  name: string;
  description: string;
  task_type: string;
  target_systems: TargetSystem[];
  interface_type: 'GUI' | 'CLI' | 'API' | 'CONDITION' | 'TRIGGER' | 'OUTCOME' | 'LOOP';
  interface?: 'TRIGGER' | 'OUTCOME';
  manual_time_minutes: number;
  automation_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrences_per_cycle: number;
  occurrence_condition?: string;
  source_data_list: SourceData[];
  output_data_list: OutputData[];
  verification_steps: VerificationStep[];
  blockers: Blocker[];
  errors: TaskError[];
  tribal_knowledge: TribalKnowledge[];
  validation_needed: boolean;
  validation_procedure: string;
  media: TaskMedia[];
  reference_links: ReferenceLink[];
  position_x?: number;
  position_y?: number;
}

interface WorkflowMetadata {
  name: string;
  version: number;
  prc: string;
  workflow_type: string;
  tool_family: string;
  tool_family_count?: number;
  tool_id: string;
  trigger_type: string;
  trigger_description: string;
  output_type: string;
  output_description: string;
  cadence_count: number;
  cadence_unit: string;
  total_roi_saved_hours: number;
  org: string;
  team: string;
  poc: string;
  yield_risk?: boolean;
  involves_equipment?: boolean;
  cleanroom_execution_required: boolean;
  cleanroom_class: string;
  automation_notes: string;
  flow_summary: string;
  forensic_description: string;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  onSave: (data: any) => void;
  onBack: () => void;
  onExit: () => void;
  isDirty?: boolean;
  setIsDirty?: (v: boolean) => void;
}

// --- CUSTOM NODES & EDGES ---

const MatrixNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const typeColors: Record<string, string> = {
    'Admin': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
    'Technical': 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    'Physical': 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    'Validation': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    'TRIGGER': 'text-cyan-400 border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]',
    'OUTCOME': 'text-rose-400 border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    'LOOP': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  };

  const typeColor = typeColors[data.task_type] || 'text-white/40 border-white/10 bg-white/5';
  const isTrigger = data.interface === 'TRIGGER';
  const isOutcome = data.interface === 'OUTCOME';
  const isTemplate = isTrigger || isOutcome;

  return (
    <div className={cn(
      "apple-glass !bg-[#0f172a]/95 !rounded-2xl px-6 py-5 w-[320px] shadow-2xl transition-all duration-300 group relative border-2",
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : (isTemplate ? 'border-dashed opacity-80 hover:opacity-100' : 'border-white/10 hover:border-white/20'),
      isTemplate && !selected && (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
      data.validation_needed && !isTemplate && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    )}>
      {isTemplate && (
        <div className={cn("absolute -top-3 left-4 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-[0.2em] border z-20", isTrigger ? "bg-cyan-500 border-cyan-400 text-white" : "bg-rose-500 border-rose-400 text-white")}>
          SYSTEM BOUNDARY
        </div>
      )}
      {data.validation_needed && !isTemplate && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VALIDATION REQUIRED
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2">
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-warning text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg shadow-status-warning/20">
                <AlertCircle size={12} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-error text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg shadow-status-error/20">
                <X size={12} /> {data.errorCount}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-1.5">
          <h4 className="text-[15px] font-black text-white tracking-tighter leading-tight uppercase group-hover:text-theme-accent transition-colors truncate">{data.label || "Untitled Task"}</h4>
          <div className="flex items-center gap-2 pt-1">
             <span className="text-[9px] font-black text-white/20 uppercase tracking-widest truncate">{data.systems || 'NO INTERFACE DEFINED'}</span>
          </div>
        </div>

        {!isTemplate && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
               <span className="text-[7px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-1">Manual (Min)</span>
               <span className="text-[28px] font-black text-white leading-none tracking-tighter">{(data.manual_time || 0).toFixed(0)}</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
               <span className="text-[7px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-1">Machine (Min)</span>
               <span className="text-[28px] font-black text-white leading-none tracking-tighter">{(data.automation_time || 0).toFixed(0)}</span>
            </div>
          </div>
        )}

        {isTemplate && (
          <div className="pt-2">
             <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight line-clamp-2 italic">{data.description || 'No description provided.'}</p>
          </div>
        )}
      </div>
      
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-transform z-10" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-transform opacity-0 z-20" />

      <Handle type="target" position={Position.Right} id="right-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-transform z-10" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-transform opacity-0 z-20" />

      <Handle type="target" position={Position.Top} id="top-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-top-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-transform z-10" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-top-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-transform opacity-0 z-20" />

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-bottom-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-transform z-10" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-bottom-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-transform opacity-0 z-20" />
    </div>
  );
};

const DiamondNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`relative w-28 h-28 flex items-center justify-center transition-all duration-300 group ${selected ? 'scale-110' : ''}`}>
    <div className={`absolute inset-0 rotate-45 border-2 transition-all duration-300 bg-[#1e293b]/90 ${selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20 group-hover:border-white/40'} ${data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : ''}`} />
    <div className="relative z-10 flex flex-col items-center p-4">
      <span className="text-[10px] font-black text-white uppercase tracking-tighter text-center leading-tight truncate w-full px-2">{data.label || "CONDITION"}</span>
    </div>
    
    {data.validation_needed && (
      <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[6px] font-black uppercase bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
        VALID
      </div>
    )}

    <Handle type="target" position={Position.Left} id="left-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-left-1.5 shadow-lg z-10" />
    <Handle type="source" position={Position.Left} id="left-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-left-1.5 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Right} id="right-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-right-1.5 shadow-lg z-10" />
    <Handle type="source" position={Position.Right} id="right-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-right-1.5 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Top} id="top-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-top-1.5 shadow-lg z-10" />
    <Handle type="source" position={Position.Top} id="top-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-top-1.5 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-bottom-1.5 shadow-lg z-10" />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !-bottom-1.5 shadow-lg z-20 opacity-0" />
  </div>
);

const CustomEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) => {
  const edgeStyle = data?.edgeStyle || 'bezier';
  
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (edgeStyle === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else if (edgeStyle === 'bezier') {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    });
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: data?.color || '#ffffff',
          strokeWidth: selected ? 4 : 2,
          strokeDasharray: data?.style === 'dashed' ? '5,5' : undefined,
          transition: 'all 0.3s',
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: 100,
            }}
            className="bg-[#0f172a] px-2 py-0.5 rounded border border-white/20 shadow-xl pointer-events-none"
          >
            <span className="text-[9px] font-black text-white uppercase tracking-widest">{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = {
  matrix: MatrixNode,
  diamond: DiamondNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack, onExit, setIsDirty }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project, fitView } = useReactFlow();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'data' | 'exceptions' | 'validation' | 'appendix'>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  
  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow.name,
    version: workflow.version,
    prc: workflow.prc,
    workflow_type: workflow.workflow_type,
    tool_family: workflow.tool_family,
    tool_family_count: workflow.tool_family_count || 1,
    tool_id: workflow.tool_id,
    trigger_type: workflow.trigger_type,
    trigger_description: workflow.trigger_description,
    output_type: workflow.output_type,
    output_description: workflow.output_description,
    cadence_count: workflow.cadence_count || 1,
    cadence_unit: workflow.cadence_unit || 'month',
    total_roi_saved_hours: workflow.total_roi_saved_hours || 0,
    org: workflow.org,
    team: workflow.team,
    poc: workflow.poc,
    yield_risk: workflow.yield_risk || false,
    involves_equipment: workflow.involves_equipment || false,
    cleanroom_execution_required: workflow.cleanroom_execution_required || false,
    cleanroom_class: workflow.cleanroom_class || 'UNCONTROLLED',
    automation_notes: workflow.automation_notes || '',
    flow_summary: workflow.flow_summary || '',
    forensic_description: workflow.forensic_description || ''
  });

  const [tasks, setTasks] = useState<TaskEntity[]>(() => {
    return (workflow.tasks || []).map((t: any) => ({
      ...t,
      target_systems: t.target_systems || [],
      blockers: t.blockers || [],
      errors: t.errors || [],
      media: t.media || [],
      reference_links: t.reference_links || [],
      source_data_list: t.source_data_list || [],
      output_data_list: t.output_data_list || [],
      verification_steps: t.verification_steps || [],
      tribal_knowledge: t.tribal_knowledge || [],
      active_touch_time_minutes: t.active_touch_time_minutes || 0,
      machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
      occurrences_per_cycle: t.occurrences_per_cycle || 1,
      automation_time_minutes: t.automation_time_minutes || 0,
      manual_time_minutes: t.manual_time_minutes || 0,
      validation_needed: t.validation_needed || false,
      validation_procedure: t.validation_procedure || '',
    }));
  });

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface_type === 'TRIGGER' || selectedTask?.interface_type === 'OUTCOME';

  const taskTypes = taxonomy.find(t => t.category === 'TASK_TYPE')?.cached_values || ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];

  // Initialize nodes and ensure Trigger/Outcome exist
  useEffect(() => {
    let currentTasks = [...tasks];
    let needsUpdate = false;

    if (!currentTasks.find(t => t.interface === 'TRIGGER')) {
      const trigger: TaskEntity = {
        id: 'node-trigger',
        name: 'TRIGGER',
        description: metadata.trigger_description,
        task_type: 'TRIGGER',
        target_systems: [],
        interface_type: 'TRIGGER',
        interface: 'TRIGGER',
        manual_time_minutes: 0,
        automation_time_minutes: 0,
        machine_wait_time_minutes: 0,
        occurrences_per_cycle: 1,
        source_data_list: [],
        output_data_list: [],
        verification_steps: [],
        blockers: [],
        errors: [],
        tribal_knowledge: [],
        validation_needed: false,
        validation_procedure: '',
        media: [],
        reference_links: [],
        position_x: 0,
        position_y: 100
      };
      currentTasks.unshift(trigger);
      needsUpdate = true;
    }

    if (!currentTasks.find(t => t.interface === 'OUTCOME')) {
      const outcome: TaskEntity = {
        id: 'node-outcome',
        name: 'OUTCOME',
        description: metadata.output_description,
        task_type: 'OUTCOME',
        target_systems: [],
        interface_type: 'OUTCOME',
        interface: 'OUTCOME',
        manual_time_minutes: 0,
        automation_time_minutes: 0,
        machine_wait_time_minutes: 0,
        occurrences_per_cycle: 1,
        source_data_list: [],
        output_data_list: [],
        verification_steps: [],
        blockers: [],
        errors: [],
        tribal_knowledge: [],
        validation_needed: false,
        validation_procedure: '',
        media: [],
        reference_links: [],
        position_x: 1000,
        position_y: 100
      };
      currentTasks.push(outcome);
      needsUpdate = true;
    }

    if (needsUpdate) {
      setTasks(currentTasks);
    }

    const initialNodes: Node[] = currentTasks.map((t) => ({
      id: t.id,
      type: t.interface_type === 'CONDITION' ? 'diamond' : 'matrix',
      position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
      data: { 
        label: t.name, 
        task_type: t.task_type,
        manual_time: t.manual_time_minutes,
        automation_time: t.automation_time_minutes,
        systems: t.target_systems.map(s => s.name).join(', '),
        interface: t.interface,
        validation_needed: t.validation_needed,
        blockerCount: t.blockers.length,
        errorCount: t.errors.length,
        description: t.description
      },
    }));

    const initialEdges: Edge[] = (workflow.edges || []).map((e: any) => ({
      ...e,
      id: `e-${e.source}-${e.target}`,
      type: 'custom',
      data: { label: e.label, edgeStyle: e.edge_style || 'bezier', color: e.color || '#ffffff', style: e.style || 'solid' },
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color || '#ffffff' },
    }));

    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // Auto layout on initial load if no positions
    if (currentTasks.every(t => t.position_x === undefined)) {
       setTimeout(() => handleLayout(), 100);
    }
  }, []);

  // Sync Trigger/Outcome data with Metadata
  useEffect(() => {
    setTasks(prev => prev.map(t => {
      if (t.interface === 'TRIGGER') {
        const typeLabel = taxonomy.find(tx => tx.category === 'TriggerType' && tx.value === metadata.trigger_type)?.label || metadata.trigger_type;
        return { ...t, name: typeLabel || 'TRIGGER', description: metadata.trigger_description };
      }
      if (t.interface === 'OUTCOME') {
        const typeLabel = taxonomy.find(tx => tx.category === 'OutputType' && tx.value === metadata.output_type)?.label || metadata.output_type;
        return { ...t, name: typeLabel || 'OUTCOME', description: metadata.output_description };
      }
      return t;
    }));
    
    setNodes(nds => nds.map(n => {
      if (n.id === 'node-trigger') {
        const typeLabel = taxonomy.find(tx => tx.category === 'TriggerType' && tx.value === metadata.trigger_type)?.label || metadata.trigger_type;
        return { ...n, data: { ...n.data, label: typeLabel || 'TRIGGER', description: metadata.trigger_description } };
      }
      if (n.id === 'node-outcome') {
        const typeLabel = taxonomy.find(tx => tx.category === 'OutputType' && tx.value === metadata.output_type)?.label || metadata.output_type;
        return { ...n, data: { ...n.data, label: typeLabel || 'OUTCOME', description: metadata.output_description } };
      }
      return n;
    }));
  }, [metadata.trigger_type, metadata.trigger_description, metadata.output_type, metadata.output_description]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        setNodes(nds => nds.map(n => n.id === id ? { 
          ...n, 
          data: { 
            ...n.data, 
            label: updated.name, 
            task_type: updated.task_type,
            manual_time: updated.manual_time_minutes,
            automation_time: updated.automation_time_minutes,
            systems: updated.target_systems.map(s => s.name).join(', '),
            validation_needed: updated.validation_needed,
            blockerCount: updated.blockers.length,
            errorCount: updated.errors.length,
            description: updated.description
          } 
        } : n));
        return updated;
      }
      return t;
    }));
    setIsDirty?.(true);
  };

  const updateEdge = (id: string, updates: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { 
      ...e, 
      data: { ...e.data, ...updates }, 
      markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } 
    } : e));
    setIsDirty?.(true);
  };

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    const newEdge: Edge = {
      ...params,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      type: 'custom',
      data: { label: '', edgeStyle: 'bezier', color: '#ffffff', style: 'solid' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' },
      source: params.source,
      target: params.target
    };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const onAddNode = (type: 'TASK' | 'CONDITION') => {
    const id = `node-${Date.now()}`;
    const center = project({
      x: (window.innerWidth - inspectorWidth) / 2,
      y: window.innerHeight / 2
    });

    const newNode: Node = {
      id,
      type: type === 'CONDITION' ? 'diamond' : 'matrix',
      position: { x: center.x - 160, y: center.y - 90 },
      data: { 
        label: type === 'TASK' ? 'New Task' : 'New Condition', 
        task_type: type === 'TASK' ? 'Documentation' : 'LOOP',
        manual_time: 0,
        automation_time: 0,
        systems: '',
        validation_needed: false,
        blockerCount: 0,
        errorCount: 0
      },
    };

    const newTask: TaskEntity = {
      id,
      name: newNode.data.label,
      description: '',
      task_type: newNode.data.task_type,
      target_systems: [],
      interface_type: type === 'TASK' ? 'GUI' : 'CONDITION',
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrences_per_cycle: 1,
      source_data_list: [],
      output_data_list: [],
      verification_steps: [],
      blockers: [],
      errors: [],
      tribal_knowledge: [],
      validation_needed: false,
      validation_procedure: '',
      media: [],
      reference_links: []
    };

    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return; // Cannot delete Trigger/Outcome

    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setIsDirty?.(true);
  };

  const handleLayout = useCallback(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', ranker: 'network-simplex', ranksep: 200, nodesep: 150 });

    nodes.forEach((n) => {
      const isDiamond = n.type === 'diamond';
      dagreGraph.setNode(n.id, { width: isDiamond ? 120 : 320, height: isDiamond ? 120 : 250 });
    });
    edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));

    dagre.layout(dagreGraph);

    setNodes(nds => nds.map(n => {
      const nodeWithPos = dagreGraph.node(n.id);
      const isDiamond = n.type === 'diamond';
      return { 
        ...n, 
        position: { 
          x: nodeWithPos.x - (isDiamond ? 60 : 160), 
          y: nodeWithPos.y - (isDiamond ? 60 : 125) 
        } 
      };
    }));

    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  }, [nodes, edges, fitView]);

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && selectedTaskId) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const newMedia: TaskMedia = { id: Date.now().toString(), type: 'image', url: evt.target?.result as string, label: 'Pasted Image' };
            updateTask(selectedTaskId, { media: [...(selectedTask?.media || []), newMedia] });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleSave = () => {
    const finalData = {
      ...metadata,
      tasks: tasks.map(t => {
        const node = nodes.find(n => n.id === t.id);
        return { ...t, position_x: node?.position.x, position_y: node?.position.y };
      }),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle,
        target_handle: e.targetHandle,
        label: e.data?.label,
        edge_style: e.data?.edgeStyle,
        color: e.data?.color,
        style: e.data?.style
      }))
    };
    onSave(finalData);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX;
    const startWidth = inspectorWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setInspectorWidth(Math.max(300, Math.min(800, startWidth - (moveEvent.pageX - startX))));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const swapEdgeDirection = (id: string) => {
    setEdges(eds => eds.map(e => e.id === id ? { 
      ...e, 
      source: e.target, 
      target: e.source,
      sourceHandle: e.targetHandle,
      targetHandle: e.sourceHandle
    } : e));
    setIsDirty?.(true);
  };

  return (
    <div className="flex h-full w-full bg-[#050914] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-16 border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest leading-none mb-1">Workflow Builder</span>
              <h1 className="text-[14px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[300px]">{workflow.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLayout} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white transition-all uppercase tracking-widest"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-theme-accent hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/20"><Save size={14} /> Commit Changes</button>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button onClick={onExit} className="p-2 hover:bg-status-error/10 text-white/20 hover:text-status-error rounded-lg transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, n) => { setSelectedTaskId(n.id); setSelectedEdgeId(null); setInspectorTab('overview'); }}
            onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedTaskId(null); }}
            onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ type: 'custom', animated: true }}
            className="react-flow-industrial"
          >
            <Background color="#1e293b" gap={30} size={1} />
            <Controls className="!bg-[#0a1120] !border-white/10 !rounded-xl !shadow-2xl backdrop-blur-md [&_button]:!border-white/5 [&_button]:!fill-white" />
          </ReactFlow>

          {/* Entity Fabrication Bar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl">
             <button onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-3 py-1.5 bg-theme-accent hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-theme-accent/20">
                <Plus size={12} /> Add Task
             </button>
             <button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                <Plus size={12} /> Add Condition
             </button>
          </div>

          {/* Quick Stats Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3 pointer-events-none">
            <div className="bg-[#0a1120]/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl">
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Entities</span>
                <span className="text-[14px] font-black text-white leading-none">{tasks.length}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Edges</span>
                <span className="text-[14px] font-black text-theme-accent leading-none">{edges.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Pane / Inspector */}
      <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70] shadow-2xl transition-width duration-75" style={{ width: `${inspectorWidth}px` }}>
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent transition-colors z-50 group" />
        <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
          {[
            { id: 'overview', label: 'Overview', icon: <Activity size={12} />, hidden: !selectedTaskId },
            { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: !selectedTaskId || isProtected },
            { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: !selectedTaskId || isProtected },
            { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: !selectedTaskId || isProtected },
            { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: !selectedTaskId || isProtected }
          ].filter(t => !t.hidden).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white')}>
              {t.icon}<span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
            </button>
          ))}
          {!selectedTaskId && !selectedEdgeId && (
            <div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white">
              <Settings size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Workflow Definition</span>
            </div>
          )}
          {selectedEdgeId && (
            <div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white">
              <Link2 size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Edge Properties</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-6" key={selectedTaskId || 'workflow'}>
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              {isProtected ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-theme-accent/10 border border-theme-accent/20 rounded-2xl mb-6">
                     <Activity size={18} className="text-theme-accent" />
                     <span className="text-[11px] font-black text-theme-accent uppercase tracking-widest">System Boundary Entity</span>
                  </div>
                  
                  <div className="space-y-6 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Classification</label>
                        <div className="text-[18px] font-black text-white uppercase tracking-tight">{selectedTask.name}</div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Description</label>
                        <p className="text-[12px] text-white/60 font-medium leading-relaxed italic">{selectedTask.description || 'No description provided in workflow definition.'}</p>
                     </div>
                  </div>

                  <p className="text-[10px] text-white/20 font-black uppercase tracking-widest text-center py-6 border border-dashed border-white/10 rounded-2xl">
                    Boundary properties are managed via Workflow Definition
                  </p>
                </div>
              ) : selectedTask.interface_type === 'CONDITION' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <Activity size={18} className="text-amber-400" />
                      <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Condition Entity</h2>
                    </div>
                    <button onClick={() => { setSelectedTaskId(null); setInspectorTab('overview'); }} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Condition Label</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} />
                  </div>
                  <button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2">
                    <Trash size={12} /> Delete Entity
                  </button>
                </div>
              ) : (
                <>
                  {inspectorTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Name</label>
                          <button onClick={() => { setSelectedTaskId(null); setInspectorTab('overview'); }} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button>
                        </div>
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-bold text-white/60 outline-none focus:border-theme-accent h-24 resize-none leading-relaxed" placeholder="Task objective and core logic..." value={selectedTask.description} onChange={e => updateTask(selectedTaskId as string, { description: e.target.value })} />
                      </div>

                      <div className="space-y-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Involved Systems</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { target_systems: [...selectedTask.target_systems, { id: Date.now().toString(), name: '', purpose: '', access_method: 'GUI' }] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                        </div>
                        <div className="space-y-3">
                          {selectedTask.target_systems.map((sys, idx) => (
                            <div key={sys.id} className="flex flex-col gap-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                               <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-white/20 mr-1">{idx + 1}.</span>
                                  <input className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 text-[11px] font-bold text-white outline-none focus:border-theme-accent" placeholder="System Name..." value={sys.name} onChange={e => updateTask(selectedTaskId as string, { target_systems: selectedTask.target_systems.map(s => s.id === sys.id ? { ...s, name: e.target.value } : s) })} />
                                  <button onClick={() => updateTask(selectedTaskId as string, { target_systems: selectedTask.target_systems.filter(s => s.id !== sys.id) })} className="text-white/10 hover:text-status-error transition-colors p-1"><X size={14} /></button>
                               </div>
                               <textarea className="w-full bg-transparent text-[10px] text-white/40 outline-none resize-none h-12" placeholder="Purpose of using this system..." value={sys.purpose} onChange={e => updateTask(selectedTaskId as string, { target_systems: selectedTask.target_systems.map(s => s.id === sys.id ? { ...s, purpose: e.target.value } : s) })} />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Type</label>
                          <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[52px] text-[11px] font-black text-white outline-none focus:border-theme-accent appearance-none text-center" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId as string, { task_type: e.target.value })}>
                            {taskTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Repetition</label>
                          <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[52px] text-[22px] font-black text-white text-center outline-none focus:border-theme-accent shadow-inner" value={selectedTask.occurrences_per_cycle} onChange={e => updateTask(selectedTaskId as string, { occurrences_per_cycle: Math.round(parseInt(e.target.value)) || 1 })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block text-center">Manual (min)</label>
                            <div className="bg-black/60 border border-white/10 rounded-xl flex items-center justify-center h-24 shadow-2xl">
                                <input 
                                    type="number" 
                                    className="bg-transparent w-full text-[32px] font-black text-white text-center outline-none focus:text-blue-400" 
                                    value={selectedTask.manual_time_minutes} 
                                    onChange={e => updateTask(selectedTaskId as string, { manual_time_minutes: Math.round(parseFloat(e.target.value)) || 0 })} 
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block text-center">Machine (min)</label>
                            <div className="bg-black/60 border border-white/10 rounded-xl flex items-center justify-center h-24 shadow-2xl">
                                <input 
                                    type="number" 
                                    className="bg-transparent w-full text-[32px] font-black text-white text-center outline-none focus:text-purple-400" 
                                    value={selectedTask.automation_time_minutes} 
                                    onChange={e => updateTask(selectedTaskId as string, { automation_time_minutes: Math.round(parseFloat(e.target.value)) || 0 })} 
                                />
                            </div>
                        </div>
                      </div>

                      <button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2">
                        <Trash size={12} /> Delete Entity
                      </button>
                    </div>
                  )}

                  {inspectorTab === 'data' && (
                    <div className="space-y-10 animate-apple-in">
                      <div className="space-y-4 relative z-[2]">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Source Data (Inputs)</label>
                          <div className="flex gap-2">
                             <div className="relative group/search">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                                  <Activity size={12} /> Add Existing
                                </button>
                                <div className="absolute top-full right-0 mt-2 w-80 bg-[#1e293b]/95 border border-white/10 rounded-2xl shadow-2xl z-[100] p-4 opacity-0 invisible group-hover/search:opacity-100 group-hover/search:visible transition-all backdrop-blur-3xl scale-95 group-hover/search:scale-100 origin-top-right">
                                   <p className="text-[9px] font-black text-theme-accent uppercase px-1 pb-3 border-b border-white/5 mb-3 flex items-center gap-2">
                                     <MousePointer2 size={10} /> Link Upstream Deliverable
                                   </p>
                                   
                                   <div className="relative mb-4">
                                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                                      <input 
                                        type="text" 
                                        placeholder="Search outputs..." 
                                        className="w-full bg-black/20 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[11px] font-bold text-white outline-none focus:border-theme-accent transition-all"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          const val = e.target.value.toLowerCase();
                                          const items = e.currentTarget.parentElement?.nextElementSibling?.querySelectorAll('button');
                                          items?.forEach(item => {
                                            const text = item.textContent?.toLowerCase() || '';
                                            (item as HTMLElement).style.display = text.includes(val) ? 'block' : 'none';
                                          });
                                        }}
                                      />
                                   </div>

                                   <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                                      {tasks.filter(t => t.id !== selectedTaskId).flatMap(t => t.output_data_list.map(o => ({ ...o, origin: t.name, originId: t.id }))).length === 0 ? (
                                        <div className="py-6 text-center">
                                           <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2"><Database size={16} className="text-white/10" /></div>
                                           <p className="text-[10px] text-white/20 font-black uppercase">No upstream outputs</p>
                                        </div>
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
                                              purpose: `Referenced from ${o.origin}`,
                                              origin_node_id: o.originId
                                            };
                                            updateTask(selectedTaskId as string, { source_data_list: [...selectedTask.source_data_list, newSource] });
                                          }} 
                                          className="w-full text-left p-3 rounded-xl hover:bg-theme-accent/20 border border-transparent hover:border-theme-accent/30 transition-all group/item"
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                             <span className="text-[11px] font-black text-white uppercase truncate">{o.name}</span>
                                             <span className="px-1.5 py-0.5 bg-white/5 rounded text-[7px] font-black text-white/40">{o.format}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                             <LucideWorkflow size={8} className="text-theme-accent" />
                                             <span className="text-[8px] font-bold text-white/30 uppercase truncate">Source: {o.origin}</span>
                                          </div>
                                        </button>
                                      ))}
                                   </div>
                                </div>
                             </div>
                             <button onClick={() => updateTask(selectedTaskId as string, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), is_manual: true, name: '', source_location: '', format: '', example: '', description: '', purpose: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">
                               <Plus size={12} /> Add New
                             </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.source_data_list.map((sd, idx) => (
                            <div key={sd.id} className={cn("p-5 border rounded-2xl space-y-5 group relative animate-apple-in", sd.is_manual ? "bg-[#1e293b]/50 border-white/10" : "bg-blue-500/5 border-blue-500/20")}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-white/20">{idx + 1}.</span>
                                {!sd.is_manual && <Link2 size={12} className="text-blue-400" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{sd.is_manual ? 'Manual Source' : 'System Reference'}</span>
                              </div>
                              <button onClick={() => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Source Data Identity</label>
                                <input readOnly={!sd.is_manual} className={cn("w-full bg-black/40 border rounded-xl px-4 py-2.5 text-[14px] font-black uppercase outline-none focus:border-blue-500", sd.is_manual ? "text-blue-400 border-white/10" : "text-white/40 border-transparent")} placeholder="E.G. RAW TELEMETRY LOG" value={sd.name} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label>
                                  <input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-lg px-3 py-2 text-[12px] font-bold", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} placeholder="e.g. CSV, JSON" value={sd.format} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, format: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Location</label>
                                  <input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-lg px-3 py-2 text-[12px] font-bold", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} placeholder="Source Path..." value={sd.source_location} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, source_location: e.target.value } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Purpose & Context</label>
                                <textarea readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-lg px-3 py-2 text-[12px] font-bold h-16 resize-none outline-none italic", sd.is_manual ? "text-white/80 border-white/5" : "text-white/30 border-transparent")} placeholder="Description of this input..." value={sd.description} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 relative z-[1]">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Output Data (Deliverables)</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', format: '', example: '', saved_location: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">
                             <Plus size={12} /> Add New
                          </button>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.output_data_list.map((od, idx) => (
                            <div key={od.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-2xl space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Output Delivery Identity</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] font-black text-white uppercase outline-none focus:border-theme-accent" placeholder="E.G. FINAL INSPECTION REPORT" value={od.name} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" placeholder="e.g. PDF, Report" value={od.format} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, format: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Destination</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" placeholder="Save Path..." value={od.saved_location} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, saved_location: e.target.value } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Output Verification Goal</label>
                                <textarea className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white/80 font-bold h-16 resize-none outline-none italic" placeholder="Final state and verification purpose..." value={od.description} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {inspectorTab === 'exceptions' && (
                    <div className="space-y-10 animate-apple-in">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Process Blockers</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 10, average_delay_minutes: 0, standard_mitigation: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all"><Plus size={12} /> Add Blocker</button>
                        </div>
                        <div className="space-y-6">
                          {selectedTask.blockers.map((b, idx) => (
                            <div key={b.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-2xl space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Blocker Identity</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] font-black text-amber-500 uppercase outline-none focus:border-amber-500" placeholder="E.G. PENDING APPROVAL" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Reason</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" value={b.reason} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Delay (min)</label>
                                  <input type="number" className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" value={b.average_delay_minutes} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: Math.round(parseFloat(e.target.value)) } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Standard Mitigation</label>
                                <textarea className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white/80 font-bold h-16 resize-none outline-none" placeholder="Official response protocol..." value={b.standard_mitigation} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, standard_mitigation: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[11px] font-black text-status-error uppercase tracking-widest">Expected Errors</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', probability_percent: 10, recovery_time_minutes: 0, correction_method: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-status-error hover:text-white transition-all"><Plus size={12} /> Add Error</button>
                        </div>
                        <div className="space-y-6">
                          {selectedTask.errors.map((err, idx) => (
                            <div key={err.id} className="p-5 bg-status-error/5 border border-status-error/10 rounded-2xl space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { errors: selectedTask.errors.filter(x => x.id !== err.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Error Type</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] font-black text-status-error uppercase outline-none focus:border-status-error" placeholder="E.G. SYSTEM TIMEOUT" value={err.error_type} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, error_type: e.target.value } : x) })} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Causality / Root Cause</label>
                                <input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" value={err.description} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, description: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Recovery Protocol</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" value={err.correction_method} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, correction_method: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Recovery (min)</label>
                                  <input type="number" className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-white font-bold" value={err.recovery_time_minutes} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, recovery_time_minutes: Math.round(parseFloat(e.target.value)) } : x) })} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[11px] font-black text-white uppercase tracking-widest">Tribal Knowledge & Implicit Rules</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { tribal_knowledge: [...selectedTask.tribal_knowledge, { id: Date.now().toString(), knowledge: '', captured_from: '' }] })} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-lg transition-colors"><Plus size={14} /></button>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.tribal_knowledge.map((tk, idx) => (
                            <div key={tk.id} className="p-5 bg-[#0f172a]/80 border border-white/10 rounded-2xl space-y-4 relative group animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.filter(x => x.id !== tk.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[8px] font-black text-white/20 uppercase">Operational Insight</label>
                                <textarea className="w-full bg-transparent text-[13px] font-bold text-white outline-none h-24 resize-none leading-relaxed" value={tk.knowledge} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} placeholder="Implicit knowledge or domain expertise tips..." />
                              </div>
                              <div className="flex items-center gap-3 border-t border-white/5 pt-3">
                                <label className="text-[8px] font-black text-white/20 uppercase whitespace-nowrap">Source POC:</label>
                                <input className="bg-transparent text-[11px] font-black text-white outline-none w-full uppercase" placeholder="NAME / DEPARTMENT" value={tk.captured_from} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, captured_from: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {inspectorTab === 'validation' && (
                    <div className="space-y-8 animate-apple-in">
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Industrial Validation</h3>
                            <p className="text-[10px] text-white/40 font-bold uppercase">Is formal verification required for this entity?</p>
                          </div>
                          <button 
                            onClick={() => updateTask(selectedTaskId as string, { validation_needed: !selectedTask.validation_needed })}
                            className={cn(
                              "relative w-12 h-6 rounded-full transition-all duration-300",
                              selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                              selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1"
                            )} />
                          </button>
                        </div>

                        {selectedTask.validation_needed && (
                          <div className="space-y-4 animate-apple-in pt-4 border-t border-white/5">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Validation Procedure</label>
                            <div className="relative">
                              <textarea 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-[13px] font-mono text-white/80 outline-none focus:border-theme-accent h-64 resize-none leading-loose custom-scrollbar pl-12"
                                placeholder="1. Step one...\n2. Step two..."
                                value={selectedTask.validation_procedure}
                                onChange={e => updateTask(selectedTaskId as string, { validation_procedure: e.target.value })}
                              />
                              <div className="absolute top-6 left-4 flex flex-col pointer-events-none select-none">
                                {selectedTask.validation_procedure.split('\n').map((_, i) => (
                                  <span key={i} className="text-[13px] font-mono text-white/10 leading-loose text-right w-6 pr-2">{i + 1}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {inspectorTab === 'appendix' && (
                    <div className="space-y-8" onPaste={handleImagePaste}>
                       <div className="space-y-4">
                         <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Visual Figures & Assets</label>
                         <div className="grid grid-cols-2 gap-4">
                           {selectedTask.media.map((m, idx) => (
                             <div key={m.id} className="aspect-video rounded-xl overflow-hidden border border-white/10 relative group bg-black">
                                <span className="text-[10px] font-black text-white absolute top-2 left-2 z-10 bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-md">{idx + 1}</span>
                                <img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                <button onClick={() => updateTask(selectedTaskId as string, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1.5 bg-status-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash size={12} /></button>
                             </div>
                           ))}
                           <div className="aspect-video rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center bg-white/[0.02] gap-2 p-4 text-center group hover:border-theme-accent/50 transition-all">
                              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:scale-110 group-hover:text-theme-accent transition-all">
                                <Copy size={20} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-white">Paste Asset</p>
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest leading-tight">Cmd+V to Attach</p>
                              </div>
                           </div>
                         </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Internal Reference Links</label>
                            <button onClick={() => updateTask(selectedTaskId as string, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), url: '', description: '' }] })} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black text-white transition-all uppercase tracking-widest">
                               <Plus size={12} className="text-theme-accent" /> Add New
                            </button>
                          </div>
                          <div className="space-y-3">
                            {selectedTask.reference_links.map((link, idx) => (
                              <div key={link.id} className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3 relative group">
                                <span className="text-[10px] font-black text-white/20 absolute top-4 left-4">{idx + 1}.</span>
                                <button onClick={() => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.filter(l => l.id !== link.id) })} className="absolute top-4 right-4 text-white/10 hover:text-status-error transition-colors"><X size={14} /></button>
                                <div className="flex items-center gap-3 pt-4 pl-4">
                                   <Link2 size={14} className="text-blue-400 shrink-0" />
                                   <input className="bg-transparent text-[12px] text-blue-400 font-bold outline-none w-full border-b border-white/5 focus:border-blue-400" value={link.url} onChange={e => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l) })} placeholder="https://industrial-docs.internal/..." />
                                </div>
                                <input className="bg-transparent text-[11px] text-white/40 font-bold outline-none w-full pl-10" value={link.description} onChange={e => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? { ...l, description: e.target.value } : l) })} placeholder="Add context for this reference..." />
                              </div>
                            ))}
                          </div>
                       </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="p-6 space-y-10 animate-apple-in">
               <div className="flex items-center justify-between border-b border-white/10 pb-4">
                 <div className="flex items-center gap-3">
                   <Link2 size={16} className="text-theme-accent" />
                   <span className="text-[14px] font-black text-white uppercase tracking-widest">Edge Configuration</span>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => swapEdgeDirection(selectedEdgeId as string)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-lg transition-all">
                     <LucideWorkflow size={16} className="rotate-90" />
                   </button>
                   <button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-lg transition-all">
                     <Trash size={16} />
                   </button>
                 </div>
               </div>
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
                   <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" placeholder="E.G. YES / NO / RETRY" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId as string, { label: e.target.value })} />
                 </div>
                 
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Visual Path Style</label>
                   <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                     {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                       <button 
                         key={s} 
                         onClick={() => updateEdge(selectedEdgeId as string, { edgeStyle: s })} 
                         className={cn(
                           "flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", 
                           (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white"
                         )}
                       >
                         {s}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Line Color</label>
                   <div className="flex gap-2">
                     {['#ffffff', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#a855f7'].map(c => (
                       <button 
                         key={c} 
                         onClick={() => updateEdge(selectedEdgeId as string, { color: c })}
                         className={cn(
                           "w-8 h-8 rounded-full border-2 transition-all",
                           (selectedEdge.data?.color || '#ffffff') === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-40 hover:opacity-100"
                         )}
                         style={{ backgroundColor: c }}
                       />
                     ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Interaction Mode</label>
                   <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                     <button onClick={() => updateEdge(selectedEdgeId as string, { style: 'solid' })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", selectedEdge.data?.style !== 'dashed' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Solid</button>
                     <button onClick={() => updateEdge(selectedEdgeId as string, { style: 'dashed' })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", selectedEdge.data?.style === 'dashed' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Dashed</button>
                   </div>
                 </div>
               </div>
            </div>
          ) : (
            <div className="space-y-10 animate-apple-in pb-20">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                 <div className="flex items-center gap-3">
                    <LucideWorkflow className="text-theme-accent" size={18} />
                    <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Process Definition</h2>
                 </div>
                 <button 
                   onClick={() => setIsEditingMetadata(!isEditingMetadata)} 
                   className={cn(
                     "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                     isEditingMetadata ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/20" : "bg-white/5 border border-white/10 text-white/40 hover:text-white"
                   )}
                 >
                   {isEditingMetadata ? 'Save & Finish' : 'Edit Definition'}
                 </button>
              </div>

              <div className="space-y-12">
                {/* 1. Strategic Identity */}
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Workflow Nomenclature</label>
                      {isEditingMetadata ? (
                        <input className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white outline-none focus:border-theme-accent" value={metadata.name} onChange={e => { setMetadata({...metadata, name: e.target.value}); setIsDirty?.(true); }} />
                      ) : (
                        <h3 className="text-[18px] font-black text-white uppercase tracking-tight px-1 leading-tight">{metadata.name || 'Untitled Workflow'}</h3>
                      )}
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">PRC (Process Code)</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.prc} onChange={e => { setMetadata({...metadata, prc: e.target.value}); setIsDirty?.(true); }}><option value="">Select PRC...</option>{taxonomy.filter(t => t.category === 'PRC').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.prc || 'N/A'}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Operational Type</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.workflow_type} onChange={e => { setMetadata({...metadata, workflow_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Type...</option>{taxonomy.filter(t => t.category === 'WORKFLOW_TYPE').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.workflow_type || 'N/A'}</div>
                         )}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Tool Family</label>
                         {isEditingMetadata ? (
                           <input className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.tool_family} onChange={e => { setMetadata({...metadata, tool_family: e.target.value}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.tool_family || 'N/A'}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Family Count</label>
                         {isEditingMetadata ? (
                           <input type="number" className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.tool_family_count || 1} onChange={e => { setMetadata({...metadata, tool_family_count: parseInt(e.target.value) || 1}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.tool_family_count || 1} Tools</div>
                         )}
                      </div>
                   </div>
                </div>

                {/* 2. Execution Cadence */}
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
                   <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-theme-accent" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Operational Cadence</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase px-1">Cycle Frequency</label>
                         {isEditingMetadata ? (
                           <input type="number" step="0.1" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 h-[52px] text-[24px] font-black text-white text-center outline-none focus:border-theme-accent" value={metadata.cadence_count} onChange={e => { setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 1}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="bg-black/40 border border-white/5 rounded-xl flex items-center justify-center h-[52px] text-[24px] font-black text-white">{metadata.cadence_count}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase px-1">Time Unit</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 h-[52px] text-[12px] font-black text-white text-center appearance-none outline-none focus:border-theme-accent" value={metadata.cadence_unit} onChange={e => { setMetadata({...metadata, cadence_unit: e.target.value}); setIsDirty?.(true); }}><option value="day">PER DAY</option><option value="week">PER WEEK</option><option value="month">PER MONTH</option><option value="year">PER YEAR</option></select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-xl flex items-center justify-center h-[52px] text-[12px] font-black text-white uppercase tracking-widest">PER {metadata.cadence_unit}</div>
                         )}
                      </div>
                   </div>
                </div>

                {/* 3. Trigger & Outcome Architecture */}
                <div className="space-y-8">
                   <div className="space-y-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
                      <div className="flex items-center gap-2 mb-1">
                         <Activity size={14} className="text-blue-400" />
                         <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Trigger Mechanism</span>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Trigger Classification</label>
                            {isEditingMetadata ? (
                              <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-white outline-none" value={metadata.trigger_type} onChange={e => { setMetadata({...metadata, trigger_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Trigger...</option>{taxonomy.filter(t => t.category === 'TriggerType').map((v: any) => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                            ) : (
                              <div className="text-[13px] font-black text-white uppercase">{taxonomy.find(t => t.category === 'TriggerType' && t.value === metadata.trigger_type)?.label || metadata.trigger_type || 'N/A'}</div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Causal Description</label>
                            {isEditingMetadata ? (
                              <textarea className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 text-[11px] font-bold text-white h-24 resize-none outline-none focus:border-blue-500" value={metadata.trigger_description} onChange={e => { setMetadata({...metadata, trigger_description: e.target.value}); setIsDirty?.(true); }} />
                            ) : (
                              <p className="text-[12px] text-white/60 font-medium leading-relaxed italic">{metadata.trigger_description || 'No trigger description provided.'}</p>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4 p-5 bg-purple-500/5 border border-purple-500/10 rounded-3xl">
                      <div className="flex items-center gap-2 mb-1">
                         <Database size={14} className="text-purple-400" />
                         <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Process Deliverable</span>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Output Classification</label>
                            {isEditingMetadata ? (
                              <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-white outline-none" value={metadata.output_type} onChange={e => { setMetadata({...metadata, output_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Output...</option>{taxonomy.filter(t => t.category === 'OutputType').map((v: any) => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                            ) : (
                              <div className="text-[13px] font-black text-white uppercase">{taxonomy.find(t => t.category === 'OutputType' && t.value === metadata.output_type)?.label || metadata.output_type || 'N/A'}</div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Deliverable Nature</label>
                            {isEditingMetadata ? (
                              <textarea className="w-full bg-[#0f172a] border border-white/10 rounded-xl p-4 text-[11px] font-bold text-white h-24 resize-none outline-none focus:border-purple-500" value={metadata.output_description} onChange={e => { setMetadata({...metadata, output_description: e.target.value}); setIsDirty?.(true); }} />
                            ) : (
                              <p className="text-[12px] text-white/60 font-medium leading-relaxed italic">{metadata.output_description || 'No output description provided.'}</p>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* 4. Industrial Risk & Documentation */}
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase px-1">Forensic Description</label>
                      {isEditingMetadata ? (
                        <textarea className="w-full bg-[#1e293b] border border-white/10 rounded-xl p-4 text-[11px] font-bold text-white/80 leading-relaxed h-32 resize-none outline-none focus:border-theme-accent" placeholder="Provide a deep technical summary of the process lifecycle..." value={metadata.forensic_description} onChange={e => { setMetadata({...metadata, forensic_description: e.target.value}); setIsDirty?.(true); }} />
                      ) : (
                        <p className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-[11px] font-bold text-white/60 leading-relaxed">{metadata.forensic_description || 'No forensic description provided.'}</p>
                      )}
                   </div>

                   <div className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Yield Risk Profile</h4>
                            <p className="text-[8px] text-white/40 font-black uppercase">Does failure result in immediate wafer scrap?</p>
                         </div>
                         <button 
                            onClick={() => isEditingMetadata && setMetadata({...metadata, yield_risk: !metadata.yield_risk})}
                            className={cn(
                              "relative w-10 h-5 rounded-full transition-all duration-300",
                              metadata.yield_risk ? "bg-status-error" : "bg-white/10",
                              !isEditingMetadata && "opacity-50 cursor-not-allowed"
                            )}
                         >
                            <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300", metadata.yield_risk ? "left-6" : "left-1")} />
                         </button>
                      </div>
                      
                      <div className="h-[1px] bg-white/5" />

                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Equipment Interaction</h4>
                            <p className="text-[8px] text-white/40 font-black uppercase">Direct physical or remote tool state change?</p>
                         </div>
                         <button 
                            onClick={() => isEditingMetadata && setMetadata({...metadata, involves_equipment: !metadata.involves_equipment})}
                            className={cn(
                              "relative w-10 h-5 rounded-full transition-all duration-300",
                              metadata.involves_equipment ? "bg-theme-accent" : "bg-white/10",
                              !isEditingMetadata && "opacity-50 cursor-not-allowed"
                            )}
                         >
                            <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300", metadata.involves_equipment ? "left-6" : "left-1")} />
                         </button>
                      </div>

                      <div className="h-[1px] bg-white/5" />

                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Cleanroom Execution</h4>
                            <p className="text-[8px] text-white/40 font-black uppercase">Requires physical presence in controlled environment?</p>
                         </div>
                         <button 
                            onClick={() => isEditingMetadata && setMetadata({...metadata, cleanroom_execution_required: !metadata.cleanroom_execution_required})}
                            className={cn(
                              "relative w-10 h-5 rounded-full transition-all duration-300",
                              metadata.cleanroom_execution_required ? "bg-theme-accent" : "bg-white/10",
                              !isEditingMetadata && "opacity-50 cursor-not-allowed"
                            )}
                         >
                            <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300", metadata.cleanroom_execution_required ? "left-6" : "left-1")} />
                         </button>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase px-1">Automation Strategy Notes</label>
                      {isEditingMetadata ? (
                        <textarea className="w-full bg-[#1e293b] border border-white/10 rounded-xl p-4 text-[11px] font-bold text-white h-24 resize-none outline-none focus:border-theme-accent" value={metadata.automation_notes} onChange={e => { setMetadata({...metadata, automation_notes: e.target.value}); setIsDirty?.(true); }} />
                      ) : (
                        <p className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-[11px] font-bold text-white/40 leading-relaxed italic">{metadata.automation_notes || 'No automation notes recorded.'}</p>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (
  <ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
