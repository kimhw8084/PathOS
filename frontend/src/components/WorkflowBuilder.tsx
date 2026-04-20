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
  useReactFlow,
  ConnectionMode,
  ConnectionLineType
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
  ChevronRight,
  Brain,
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
  node_id?: string;
  name: string;
  description: string;
  task_type: string;
  target_systems: TargetSystem[];
  interface_type: 'GUI' | 'CLI' | 'API' | 'CONDITION' | 'TRIGGER' | 'OUTCOME' | 'LOOP';
  interface?: 'TRIGGER' | 'OUTCOME';
  manual_time_minutes: number;
  automation_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrence: number;
  occurrence_explanation?: string;
  owning_team?: string;
  owner_positions?: string[];
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
  flow_summary: string;
  description: string;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  onSave: (data: any) => void;
  onBack: (data?: any) => void;
  onExit: () => void;
  isDirty?: boolean;
  setIsDirty?: (v: boolean) => void;
}

// --- CUSTOM NODES & EDGES ---

const CollapsibleSection: React.FC<{ title: string; count: number; isOpen: boolean; onToggle: () => void; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, count, isOpen, onToggle, children, icon }) => (
  <div className="space-y-4">
    <button onClick={onToggle} className="w-full flex items-center justify-between px-1 group">
      <div className="flex items-center gap-2">
        {icon}
        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer">{title}</label>
        <span className="bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-[9px] font-black text-white/20">{count}</span>
      </div>
      <ChevronRight size={14} className={cn("text-white/20 transition-transform duration-300", isOpen && "rotate-90 text-theme-accent")} />
    </button>
    {isOpen && <div className="animate-apple-in">{children}</div>}
  </div>
);

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
  const baseFontSize = data.baseFontSize || 14;
  const titleFontSize = Math.max(24, baseFontSize + 10);

  if (isTemplate) {
    return (
      <div className={cn(
        "apple-glass !bg-[#0f172a]/95 !rounded-lg px-6 py-5 shadow-2xl transition-all duration-300 group relative border-2 flex flex-col items-center justify-center min-w-[200px]",
        selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
      )}>
        <div className={cn("absolute -top-3 left-4 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-[0.2em] border z-20 shadow-lg", isTrigger ? "bg-cyan-500 border-cyan-400 text-white" : "bg-rose-500 border-rose-400 text-white")}>
          {isTrigger ? "TRIGGER" : "OUTCOME"}
        </div>
        <h4 
          className="font-black text-white tracking-tighter leading-tight uppercase text-center"
          style={{ fontSize: `${titleFontSize}px` }}
        >
          {data.label || (isTrigger ? "TRIGGER" : "OUTCOME")}
        </h4>
        
        <Handle type="target" position={Position.Left} id="left-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl z-10" />
        <Handle type="source" position={Position.Right} id="right-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl z-10" />
      </div>
    );
  }

  const systemBadges = (data.systems || '').split(', ').filter(Boolean);
  const visibleSystemBadges = systemBadges.slice(0, 3);
  const hiddenSystemsCount = systemBadges.length - visibleSystemBadges.length;

  return (
    <div className={cn(
      "apple-glass !bg-[#0f172a]/95 !rounded-lg px-6 py-5 w-[320px] shadow-2xl transition-all duration-300 group relative border-2 h-[260px]",
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : 'border-white/10 hover:border-white/20',
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    )}>
      {data.validation_needed && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VALIDATION REQUIRED
        </div>
      )}
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <div className={cn("px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2">
            {data.occurrence > 1 && (
              <div className="flex items-center gap-1.5 bg-blue-500 text-white px-2 py-1 rounded-md text-[10px] font-black shadow-lg shadow-blue-500/20">
                <RefreshCw size={11} /> x{data.occurrence}
              </div>
            )}
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-2.5 py-1 rounded-md text-[11px] font-black shadow-lg shadow-amber-500/20">
                <AlertCircle size={12} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-error text-white px-2.5 py-1 rounded-md text-[11px] font-black shadow-lg shadow-status-error/20">
                <X size={12} /> {data.errorCount}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-1 group/title relative">
          <h4 
            className="font-bold text-white tracking-tight leading-tight group-hover:text-theme-accent transition-colors truncate cursor-help"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {data.label || "Untitled Task"}
          </h4>
          {/* Tooltip for Title & Description */}
          <div className="absolute top-full left-0 w-80 bg-[#1e293b] border border-white/20 p-5 rounded-xl shadow-2xl opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all z-[100] backdrop-blur-2xl pointer-events-none translate-y-2 group-hover/title:translate-y-0">
             <p className="font-black text-white uppercase mb-3 border-b border-white/10 pb-2 leading-tight" style={{ fontSize: `${titleFontSize + 2}px` }}>{data.label}</p>
             <p className="text-[12px] text-white/70 font-medium leading-relaxed italic">{data.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[7px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-0.5">Manual</span>
               <span className="text-[18px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[7px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-0.5">Machine</span>
               <span className="text-[18px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-t border-white/5">
             <div className="flex items-center gap-3">
               <div className="flex flex-col">
                 <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">In</span>
                 <span className="text-[11px] font-black text-white">{data.sourceCount || 0}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Out</span>
                 <span className="text-[11px] font-black text-white">{data.outputCount || 0}</span>
               </div>
             </div>
             
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                   <span className="text-[9px] font-black text-white/60 uppercase truncate max-w-[80px]">{(data.ownerPositions || [])[0] || 'Unassigned'}</span>
                   {(data.ownerPositions || []).length > 1 && (
                     <span className="text-[8px] font-black text-theme-accent">+{(data.ownerPositions || []).length - 1}</span>
                   )}
                </div>
                {data.owningTeam && (
                  <span className="text-[8px] font-black text-theme-accent/60 uppercase tracking-widest leading-none mt-0.5">{data.owningTeam}</span>
                )}
             </div>
          </div>

          <div className="flex flex-wrap gap-1 items-center pt-1.5 border-t border-white/5 min-h-[16px]">
             {visibleSystemBadges.map((s: string, i: number) => (
               <span key={i} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[7px] font-bold text-white/40 uppercase">{s}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[7px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
             )}
             {systemBadges.length === 0 && (
               <span className="text-[7px] font-black text-white/10 uppercase tracking-widest">No Systems</span>
             )}
          </div>
        </div>
      </div>
      
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-all z-10" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-all opacity-0 z-20" />

      <Handle type="target" position={Position.Right} id="right-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-all z-10" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl hover:scale-150 transition-all opacity-0 z-20" />

      <Handle type="target" position={Position.Top} id="top-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-top-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-all z-10" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-top-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-all opacity-0 z-20" />

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-bottom-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-all z-10" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-bottom-1.5 !left-1/2 -translate-x-1/2 shadow-xl hover:scale-150 transition-all opacity-0 z-20" />
    </div>
  );
};

const DiamondNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const baseFontSize = data.baseFontSize || 14;
  return (
    <div className={`relative w-[250px] h-[250px] flex items-center justify-center transition-all duration-300 group ${selected ? 'scale-105' : ''}`}>
      {/* Visual height 250px achieved by side length a = 250 / sqrt(2) = 176.77px */}
      <div className={`absolute w-[176.77px] h-[176.77px] rotate-45 border-2 transition-all duration-300 bg-[#1e293b]/90 ${selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20 group-hover:border-white/40'} ${data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : ''} rounded-sm`} />
      <div className="relative z-10 flex flex-col items-center justify-center p-8 w-full h-full">
        <span 
          className="font-bold text-white text-center leading-relaxed break-words max-w-[160px]"
          style={{ fontSize: `${baseFontSize - 1}px` }}
        >
          {data.label || "Condition"}
        </span>
      </div>
    
    {data.validation_needed && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[100px] px-1.5 py-0.5 rounded-sm text-[6px] font-black uppercase bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
        VALID
      </div>
    )}

    <Handle type="target" position={Position.Left} id="left-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !left-0 shadow-lg z-10" />
    <Handle type="source" position={Position.Left} id="left-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !left-0 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Right} id="right-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !right-0 shadow-lg z-10" />
    <Handle type="source" position={Position.Right} id="right-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !right-0 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Top} id="top-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !top-0 shadow-lg z-10" />
    <Handle type="source" position={Position.Top} id="top-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !top-0 shadow-lg z-20 opacity-0" />

    <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !bottom-0 shadow-lg z-10" />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0a1120] !bottom-0 shadow-lg z-20 opacity-0" />
  </div>
);
};

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
  const [clipboard, setClipboard] = useState<TaskEntity | null>(null);
  const [baseFontSize, setBaseFontSize] = useState(14);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: true,
    outputs: true,
    blockers: true,
    errors: true,
    tribal: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const [isAppendixFocused, setIsAppendixFocused] = useState(false);
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
    flow_summary: workflow.flow_summary || '',
    description: workflow.description || workflow.forensic_description || ''
  });

  const [tasks, setTasks] = useState<TaskEntity[]>([]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface_type === 'TRIGGER' || selectedTask?.interface_type === 'OUTCOME';

  const taskTypes = taxonomy.find(t => t.category === 'TASK_TYPE')?.cached_values || ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];

  // Initialize tasks when workflow changes
  useEffect(() => {
    const initializedTasks = (workflow.tasks || []).map((t: any) => ({
      ...t,
      id: String(t.node_id || t.id),
      node_id: String(t.node_id || t.id),
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
      occurrence: t.occurrence || t.occurrences_per_cycle || 1,
      occurrence_explanation: t.occurrence_explanation || t.occurrence_condition || '',
      automation_time_minutes: t.automation_time_minutes || 0,
      manual_time_minutes: t.manual_time_minutes || 0,
      validation_needed: t.validation_needed || false,
      validation_procedure: t.validation_procedure || '',
    }));
    setTasks(initializedTasks);
    
    // Update metadata as well
    setMetadata({
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
      flow_summary: workflow.flow_summary || '',
      description: workflow.description || workflow.forensic_description || ''
    });
  }, [workflow]);

  // Initialize nodes and ensure Trigger/Outcome exist
  useEffect(() => {
    // We should run this if we have a workflow, even if tasks is empty
    // because we need to at least create Trigger/Outcome nodes
    
    let currentTasks = tasks.length > 0 ? [...tasks] : [];
    let needsUpdate = false;

    if (!currentTasks.find(t => t.interface === 'TRIGGER')) {
      const trigger: TaskEntity = {
        id: 'node-trigger',
        node_id: 'node-trigger',
        name: 'TRIGGER',
        description: metadata.trigger_description,
        task_type: 'TRIGGER',
        target_systems: [],
        interface_type: 'TRIGGER',
        interface: 'TRIGGER',
        manual_time_minutes: 0,
        automation_time_minutes: 0,
        machine_wait_time_minutes: 0,
        occurrence: 1,
        occurrence_explanation: '',
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
        node_id: 'node-outcome',
        name: 'OUTCOME',
        description: metadata.output_description,
        task_type: 'OUTCOME',
        target_systems: [],
        interface_type: 'OUTCOME',
        interface: 'OUTCOME',
        manual_time_minutes: 0,
        automation_time_minutes: 0,
        machine_wait_time_minutes: 0,
        occurrence: 1,
        occurrence_explanation: '',
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
      id: String(t.node_id || t.id),
      type: t.interface_type === 'CONDITION' ? 'diamond' : 'matrix',
      position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
      data: { 
        ...t,
        label: t.name, 
        task_type: t.task_type,
        manual_time: t.manual_time_minutes,
        automation_time: t.automation_time_minutes,
        occurrence: t.occurrence,
        systems: t.target_systems.map(s => s.name).join(', '),
        owningTeam: t.owning_team,
        ownerPositions: t.owner_positions,
        sourceCount: t.source_data_list.length,
        outputCount: t.output_data_list.length,
        interface: t.interface,
        validation_needed: t.validation_needed,
        blockerCount: t.blockers.length,
        errorCount: t.errors.length,
        description: t.description,
        id: String(t.node_id || t.id)
      },
    }));

    const initialEdges: Edge[] = (workflow.edges || []).map((e: any) => ({
      ...e,
      id: String(e.id || `e-${e.source}-${e.target}-${Date.now()}`),
      source: String(e.source),
      target: String(e.target),
      sourceHandle: e.source_handle || e.sourceHandle,
      targetHandle: e.target_handle || e.targetHandle,
      type: 'custom',
      data: { 
        label: e.label, 
        edgeStyle: e.edge_style || e.data?.edgeStyle || 'bezier', 
        color: e.color || e.data?.color || '#ffffff', 
        style: e.style || e.data?.style || 'solid' 
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color || e.data?.color || '#ffffff' },
    }));

    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // Auto layout on initial load if no positions or positions are 0
    if (currentTasks.every(t => !t.position_x && !t.position_y)) {
       setTimeout(() => handleLayout(initialNodes, initialEdges), 200);
    }
  }, [workflow, tasks.length]);

  // Sync Trigger/Outcome data with Metadata
  useEffect(() => {
    setTasks(prev => prev.map(t => {
      if (t.interface === 'TRIGGER') {
        const typeLabel = taxonomy.find(tx => tx.category === 'TriggerType' && tx.value === metadata.trigger_type)?.label || metadata.trigger_type;
        return { 
          ...t, 
          name: typeLabel || 'TRIGGER', 
          description: metadata.trigger_description 
        };
      }
      if (t.interface === 'OUTCOME') {
        const typeLabel = taxonomy.find(tx => tx.category === 'OutputType' && tx.value === metadata.output_type)?.label || metadata.output_type;
        return { 
          ...t, 
          name: typeLabel || 'OUTCOME', 
          description: metadata.output_description 
        };
      }
      return t;
    }));

    setNodes(nds => nds.map(n => {
      // Apply baseFontSize to ALL nodes
      const baseData = { ...n.data, baseFontSize };

      if (n.id === 'node-trigger') {
        const typeLabel = taxonomy.find(tx => tx.category === 'TriggerType' && tx.value === metadata.trigger_type)?.label || metadata.trigger_type;
        return { 
          ...n, 
          data: { 
            ...baseData, 
            label: typeLabel || 'TRIGGER', 
            description: metadata.trigger_description,
            prc: metadata.prc,
            workflow_type: metadata.workflow_type,
            tool_family: metadata.tool_family,
            tool_family_count: metadata.tool_family_count
          } 
        };
      }
      if (n.id === 'node-outcome') {
        const typeLabel = taxonomy.find(tx => tx.category === 'OutputType' && tx.value === metadata.output_type)?.label || metadata.output_type;
        return { 
          ...n, 
          data: { 
            ...baseData, 
            label: typeLabel || 'OUTCOME', 
            description: metadata.output_description,
            prc: metadata.prc,
            workflow_type: metadata.workflow_type,
            tool_family: metadata.tool_family,
            tool_family_count: metadata.tool_family_count
          } 
        };
      }
      return { ...n, data: baseData };
    }));
  }, [metadata, baseFontSize, taxonomy]);
  // Copy-Paste Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedTaskId && selectedTask && !isProtected) {
          setClipboard(JSON.parse(JSON.stringify(selectedTask)));
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard) {
          const id = `node-${Date.now()}`;
          const center = project({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          const newNode: Node = {
            id,
            type: clipboard.interface_type === 'CONDITION' ? 'diamond' : 'matrix',
            position: { x: center.x - 170, y: center.y - 140 },
            data: {
              ...clipboard,
              label: clipboard.name,
              task_type: clipboard.task_type,
              manual_time: clipboard.manual_time_minutes,
              automation_time: clipboard.automation_time_minutes,
              occurrence: clipboard.occurrence,
              systems: clipboard.target_systems.map(s => s.name).join(', '),
              owningTeam: clipboard.owning_team,
              ownerPositions: clipboard.owner_positions,
              sourceCount: clipboard.source_data_list.length,
              outputCount: clipboard.output_data_list.length,
              validation_needed: clipboard.validation_needed,
              blockerCount: clipboard.blockers.length,
              errorCount: clipboard.errors.length,
              interface: undefined 
            },
          };          const newTask: TaskEntity = {
            ...clipboard,
            id,
            interface: undefined,
            interface_type: clipboard.interface_type
          };
          setTasks(prev => [...prev, newTask]);
          setNodes(nds => [...nds, newNode]);
          setSelectedTaskId(id);
          setIsDirty?.(true);
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTaskId && !isProtected) {
          deleteTask(selectedTaskId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, selectedTask, isProtected, clipboard, project]);

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
            owningTeam: updated.owning_team,
            ownerPositions: updated.owner_positions,
            sourceCount: updated.source_data_list.length,
            outputCount: updated.output_data_list.length,
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
      position: { x: center.x - (type === 'CONDITION' ? 125 : 160), y: center.y - (type === 'CONDITION' ? 125 : 90) },
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
      occurrence: 1,
      occurrence_explanation: '',
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

  const handleLayout = useCallback((nodesToLayout?: Node[], edgesToLayout?: Edge[]) => {
    let nds = nodesToLayout || nodes;
    const eds = edgesToLayout || edges;

    if (nds.length === 0 && tasks.length > 0) {
      nds = tasks.map(t => ({
        id: t.id,
        type: t.interface_type === 'CONDITION' ? 'diamond' : 'matrix',
        position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
        data: { 
          label: t.name, 
          task_type: t.task_type,
          manual_time: t.manual_time_minutes,
          automation_time: t.automation_time_minutes,
          systems: t.target_systems.map(s => s.name).join(', '),
          owningTeam: t.owning_team,
          ownerPositions: t.owner_positions,
          sourceCount: t.source_data_list.length,
          outputCount: t.output_data_list.length,
          interface: t.interface,
          validation_needed: t.validation_needed,
          blockerCount: t.blockers.length,
          errorCount: t.errors.length,
          description: t.description
        },
      }));
    }

    if (nds.length === 0) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ 
      rankdir: 'LR', 
      ranker: 'network-simplex', 
      ranksep: 220, 
      nodesep: 150,
      edgesep: 80
    });

    nds.forEach((n) => {
      const isDiamond = n.type === 'diamond';
      const isTemplate = n.data.interface === 'TRIGGER' || n.data.interface === 'OUTCOME';
      dagreGraph.setNode(n.id, { 
        width: isDiamond ? 280 : 340, 
        height: isTemplate ? 120 : 280 
      });
    });
    
    eds.forEach((e) => dagreGraph.setEdge(e.source, e.target));

    dagre.layout(dagreGraph);

    const layoutedNodes = nds.map(n => {
      const nodeWithPos = dagreGraph.node(n.id);
      if (!nodeWithPos) return n;
      const isDiamond = n.type === 'diamond';
      const isTemplate = n.data.interface === 'TRIGGER' || n.data.interface === 'OUTCOME';
      return { 
        ...n, 
        position: { 
          x: nodeWithPos.x - (isDiamond ? 140 : 170), 
          y: nodeWithPos.y - (isTemplate ? 60 : 140) 
        } 
      };
    });

    // Enhanced Handle Assignment for Complex Topologies
    const layoutedEdges = eds.map(e => {
      const sourceNode = layoutedNodes.find(n => n.id === e.source);
      const targetNode = layoutedNodes.find(n => n.id === e.target);
      
      if (!sourceNode || !targetNode) return e;

      let sourceHandle = 'right-source';
      let targetHandle = 'left-target';

      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;

      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) {
          sourceHandle = 'right-source';
          targetHandle = 'left-target';
        } else {
          sourceHandle = 'left-source';
          targetHandle = 'right-target';
        }
      } else {
        if (dy > 0) {
          sourceHandle = 'bottom-source';
          targetHandle = 'top-target';
        } else {
          sourceHandle = 'top-source';
          targetHandle = 'bottom-target';
        }
      }

      return {
        ...e,
        sourceHandle,
        targetHandle,
        type: 'custom',
        data: { ...e.data, edgeStyle: 'smoothstep' }
      };
    });

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setIsDirty?.(true);
    
    window.requestAnimationFrame(() => {
      fitView({ padding: 0.1, duration: 800 });
    });
  }, [nodes, edges, tasks, fitView, setNodes, setEdges, setIsDirty]);

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
        const node = nodes.find(n => String(n.id) === String(t.id));
        return {
          ...t,
          node_id: String(t.node_id || t.id), // Force string conversion for Pydantic
          position_x: node?.position.x,
          position_y: node?.position.y
        };
      }),
      edges: edges.map(e => ({
        source: String(e.source),
        target: String(e.target),
        source_handle: e.sourceHandle,
        target_handle: e.targetHandle,
        label: e.data?.label,
        edge_style: e.data?.edgeStyle,
        color: e.data?.color,
        style: e.data?.style || 'solid'
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
    setEdges(eds => eds.map(e => {
      if (e.id === id) {
        // Correctly swap handles as well (source handles end in -source, target in -target)
        const newSourceHandle = e.targetHandle?.replace('-target', '-source');
        const newTargetHandle = e.sourceHandle?.replace('-source', '-target');
        return { 
          ...e, 
          source: e.target, 
          target: e.source,
          sourceHandle: newSourceHandle,
          targetHandle: newTargetHandle
        };
      }
      return e;
    }));
    setIsDirty?.(true);
  };

  return (
    <div className="flex h-full w-full bg-[#050914] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-16 border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => onBack(metadata)} className="p-2 hover:bg-white/5 rounded-md transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest leading-none mb-1">Workflow Builder</span>
              <h1 className="text-[14px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[300px]">{workflow.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowFontSettings(!showFontSettings)}
                className={cn(
                  "p-2 rounded-md transition-all border",
                  showFontSettings ? "bg-theme-accent border-theme-accent text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                )}
                title="Adjust Typography"
              >
                <span className="text-[10px] font-black uppercase">AA</span>
              </button>

              {showFontSettings && (
                <div className="absolute right-0 top-full mt-2 w-48 apple-glass border border-white/10 p-4 rounded-xl shadow-2xl z-[100] animate-apple-in">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-3">Global Font Scale</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="24" 
                    value={baseFontSize} 
                    onChange={(e) => setBaseFontSize(parseInt(e.target.value))}
                    className="w-full accent-theme-accent"
                  />
                  <div className="flex justify-between mt-2 text-[9px] font-black text-white/20 uppercase">
                    <span>Small</span>
                    <span className="text-theme-accent">{baseFontSize}px</span>
                    <span>Large</span>
                  </div>
                  <button 
                    onClick={() => setBaseFontSize(14)}
                    className="w-full mt-4 py-1.5 text-[8px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors"
                  >
                    Reset Default
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => handleLayout()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-black text-white transition-all uppercase tracking-widest"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-theme-accent hover:bg-blue-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/20"><Save size={14} /> Commit Changes</button>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button onClick={onExit} className="p-2 hover:bg-status-error/10 text-white/20 hover:text-status-error rounded-md transition-colors"><X size={20} /></button>
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
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 3 }}
            defaultEdgeOptions={{ type: 'custom', animated: false, data: { style: 'solid' } }}
            className="react-flow-industrial"
            deleteKeyCode={null} // Handle delete manually to protect boundary nodes
          >
            <Background color="#1e293b" gap={30} size={1} />
            <Controls className="!bg-[#0a1120] !border-white/10 !rounded-md !shadow-2xl backdrop-blur-md [&_button]:!border-white/5 [&_button]:!fill-white" />
          </ReactFlow>

          {/* Entity Fabrication Bar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-md shadow-2xl">
             <button onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-3 py-1.5 bg-theme-accent hover:bg-blue-500 text-white rounded-md text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-theme-accent/20">
                <Plus size={12} /> Add Task
             </button>
             <button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-md text-[9px] font-black uppercase tracking-widest transition-all">
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
                <div className="space-y-8 animate-apple-in">
                  <div className="flex items-center gap-4 p-5 bg-theme-accent/5 border border-theme-accent/10 rounded-xl">
                     <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-lg", selectedTask.interface === 'TRIGGER' ? "bg-cyan-500 text-white" : "bg-rose-500 text-white")}>
                        <Zap size={20} />
                     </div>
                     <div>
                        <span className="text-[10px] font-black text-theme-accent uppercase tracking-[0.2em] block mb-0.5">Boundary System</span>
                        <h2 className="text-[16px] font-black text-white uppercase tracking-tight">{selectedTask.interface}</h2>
                     </div>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Type Classification</label>
                        <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[14px] font-bold text-white uppercase">{selectedTask.name}</div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Description & Context</label>
                        <p className="bg-white/[0.02] border border-white/5 rounded-lg p-5 text-[12px] text-white/60 font-medium leading-relaxed italic">{selectedTask.description || 'No description provided in workflow definition.'}</p>
                     </div>
                  </div>
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
                    <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} />
                  </div>
                  <button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2">
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
                        <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-medium text-white/60 outline-none focus:border-theme-accent h-24 resize-none leading-relaxed" placeholder="Task objective and core logic..." value={selectedTask.description} onChange={e => updateTask(selectedTaskId as string, { description: e.target.value })} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owning Team</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-theme-accent transition-all" placeholder="Team Name..." value={selectedTask.owning_team || ''} onChange={e => updateTask(selectedTaskId as string, { owning_team: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                           <div className="flex items-center justify-between px-1">
                             <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Owner Position</label>
                             <button onClick={() => updateTask(selectedTaskId as string, { owner_positions: [...(selectedTask.owner_positions || []), ''] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={12} /></button>
                           </div>
                           <div className="space-y-2">
                             {(selectedTask.owner_positions || []).map((pos, idx) => (
                               <div key={idx} className="flex gap-2">
                                 <input className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-[11px] font-medium text-white outline-none focus:border-theme-accent" placeholder="Position..." value={pos} onChange={e => updateTask(selectedTaskId as string, { owner_positions: selectedTask.owner_positions?.map((p, i) => i === idx ? e.target.value : p) })} />
                                 <button onClick={() => updateTask(selectedTaskId as string, { owner_positions: selectedTask.owner_positions?.filter((_, i) => i !== idx) })} className="text-white/10 hover:text-status-error transition-colors"><X size={12} /></button>
                               </div>
                             ))}
                             {(selectedTask.owner_positions || []).length === 0 && <div className="text-[9px] text-white/10 italic px-2">No positions assigned</div>}
                           </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 bg-white/[0.02] border border-white/5 rounded-md">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Involved Systems</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { target_systems: [...selectedTask.target_systems, { id: Date.now().toString(), name: '', purpose: '', access_method: 'GUI' }] })} className="text-theme-accent hover:bg-theme-accent/10 p-1 rounded transition-colors"><Plus size={14} /></button>
                        </div>
                        <div className="space-y-3">
                          {selectedTask.target_systems.map((sys, idx) => (
                            <div key={sys.id} className="flex flex-col gap-2 p-3 bg-black/40 border border-white/5 rounded-md">
                               <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-white/20 mr-1">{idx + 1}.</span>
                                  <input className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 text-[11px] font-medium text-white outline-none focus:border-theme-accent" placeholder="System Name..." value={sys.name} onChange={e => updateTask(selectedTaskId as string, { target_systems: selectedTask.target_systems.map(s => s.id === sys.id ? { ...s, name: e.target.value } : s) })} />
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
                          <select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[52px] text-[15px] font-black text-white outline-none focus:border-theme-accent appearance-none text-center" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId as string, { task_type: e.target.value })}>
                            {taskTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Occurrence</label>
                          <input type="number" min="1" className="w-full bg-white/5 border border-white/10 rounded-md px-4 h-[52px] text-[22px] font-black text-white text-center outline-none focus:border-theme-accent shadow-inner" value={selectedTask.occurrence} onChange={e => updateTask(selectedTaskId as string, { occurrence: Math.max(1, Math.round(parseInt(e.target.value)) || 1) })} />
                        </div>
                      </div>

                      {selectedTask.occurrence > 1 && (
                        <div className="space-y-2 animate-apple-in">
                          <label className="text-[10px] font-black text-theme-accent uppercase tracking-widest px-1">Occurrence Logic / Explanation</label>
                          <textarea 
                            className="w-full bg-theme-accent/5 border border-theme-accent/20 rounded-md px-4 py-3 text-[12px] font-medium text-white outline-none focus:border-theme-accent h-20 resize-none leading-relaxed" 
                            placeholder="Why does this task repeat? (e.g., Per wafer, per batch, per tool...)" 
                            value={selectedTask.occurrence_explanation || ''} 
                            onChange={e => updateTask(selectedTaskId as string, { occurrence_explanation: e.target.value })} 
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-md">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-blue-400 tracking-widest block text-center">Manual (min)</label>
                            <div className="bg-black/60 border border-white/10 rounded-md flex items-center justify-center h-24 shadow-2xl">
                                <input 
                                    type="number" 
                                    min="0"
                                    className="bg-transparent w-full text-[32px] font-black text-white text-center outline-none focus:text-blue-400" 
                                    value={selectedTask.manual_time_minutes} 
                                    onChange={e => updateTask(selectedTaskId as string, { manual_time_minutes: Math.max(0, Math.round(parseFloat(e.target.value)) || 0) })} 
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-purple-400 tracking-widest block text-center">Machine (min)</label>
                            <div className="bg-black/60 border border-white/10 rounded-md flex items-center justify-center h-24 shadow-2xl">
                                <input 
                                    type="number" 
                                    min="0"
                                    className="bg-transparent w-full text-[32px] font-black text-white text-center outline-none focus:text-purple-400" 
                                    value={selectedTask.automation_time_minutes} 
                                    onChange={e => updateTask(selectedTaskId as string, { automation_time_minutes: Math.max(0, Math.round(parseFloat(e.target.value)) || 0) })} 
                                />
                            </div>
                        </div>
                      </div>

                      <button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2">
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
                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 rounded-md text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                                  <Activity size={12} /> Add Existing
                                </button>
                                <div className="absolute top-full right-0 mt-2 w-80 bg-[#1e293b]/95 border border-white/10 rounded-md shadow-2xl z-[100] p-4 opacity-0 invisible group-hover/search:opacity-100 group-hover/search:visible transition-all backdrop-blur-3xl scale-95 group-hover/search:scale-100 origin-top-right">
                                   <p className="text-[9px] font-black text-theme-accent uppercase px-1 pb-3 border-b border-white/5 mb-3 flex items-center gap-2">
                                     <MousePointer2 size={10} /> Link Upstream Deliverable
                                   </p>
                                   
                                   <div className="relative mb-4">
                                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                                      <input 
                                        type="text" 
                                        placeholder="Search outputs..." 
                                        className="w-full bg-black/20 border border-white/5 rounded-md pl-9 pr-4 py-2 text-[11px] font-medium text-white outline-none focus:border-theme-accent transition-all"
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
                                          className="w-full text-left p-3 rounded-md hover:bg-theme-accent/20 border border-transparent hover:border-theme-accent/30 transition-all group/item"
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                             <span className="text-[11px] font-bold text-white truncate">{o.name}</span>
                                             <span className="px-1.5 py-0.5 bg-white/5 rounded-sm text-[7px] font-black text-white/40">{o.format}</span>
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
                             <button onClick={() => updateTask(selectedTaskId as string, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), is_manual: true, name: '', source_location: '', format: '', example: '', description: '', purpose: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">
                               <Plus size={12} /> Add New
                             </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.source_data_list.map((sd, idx) => (
                            <div key={sd.id} className={cn("p-5 border rounded-md space-y-5 group relative animate-apple-in", sd.is_manual ? "bg-[#1e293b]/50 border-white/10" : "bg-blue-500/5 border-blue-500/20")}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-white/20">{idx + 1}.</span>
                                {!sd.is_manual && <Link2 size={12} className="text-blue-400" />}
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{sd.is_manual ? 'Manual Source' : 'System Reference'}</span>
                              </div>
                              <button onClick={() => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Source Data Identity</label>
                                <input readOnly={!sd.is_manual} className={cn("w-full bg-black/40 border rounded-md px-4 py-2.5 text-[14px] font-bold outline-none focus:border-theme-accent", sd.is_manual ? "text-white border-white/10" : "text-white/40 border-transparent")} placeholder="e.g. Raw Telemetry Log" value={sd.name} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label>
                                  <input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} placeholder="e.g. CSV, JSON" value={sd.format} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, format: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Location</label>
                                  <input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} placeholder="Source Path..." value={sd.source_location} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, source_location: e.target.value } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Purpose & Context</label>
                                <textarea readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium h-16 resize-none outline-none italic", sd.is_manual ? "text-white/80 border-white/5" : "text-white/30 border-transparent")} placeholder="Description of this input..." value={sd.description} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 relative z-[1]">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Output Data (Deliverables)</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', format: '', example: '', saved_location: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">
                             <Plus size={12} /> Add New
                          </button>
                        </div>
                        <div className="space-y-4">
                          {selectedTask.output_data_list.map((od, idx) => (
                            <div key={od.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-md space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Output Delivery Identity</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-white outline-none focus:border-theme-accent" placeholder="e.g. Final Inspection Report" value={od.name} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" placeholder="e.g. PDF, Report" value={od.format} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, format: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Destination</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" placeholder="Save Path..." value={od.saved_location} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, saved_location: e.target.value } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Output Verification Goal</label>
                                <textarea className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white/80 font-medium h-16 resize-none outline-none italic" placeholder="Final state and verification purpose..." value={od.description} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} />
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
                          <button onClick={() => updateTask(selectedTaskId as string, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 10, average_delay_minutes: 0, standard_mitigation: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all"><Plus size={12} /> Add Blocker</button>
                        </div>
                        <div className="space-y-6">
                          {selectedTask.blockers.map((b, idx) => (
                            <div key={b.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-md space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Blocker Identity</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-amber-500 outline-none focus:border-amber-500" placeholder="e.g. Pending Approval" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Reason</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={b.reason} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Delay (min)</label>
                                  <input type="number" min="0" className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={b.average_delay_minutes} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: Math.max(0, Math.round(parseFloat(e.target.value))) } : x) })} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Standard Mitigation</label>
                                <textarea className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white/80 font-medium h-16 resize-none outline-none" placeholder="Official response protocol..." value={b.standard_mitigation} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, standard_mitigation: e.target.value } : x) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[11px] font-black text-status-error uppercase tracking-widest">Expected Errors</label>
                          <button onClick={() => updateTask(selectedTaskId as string, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', probability_percent: 10, recovery_time_minutes: 0, correction_method: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-status-error hover:text-white transition-all"><Plus size={12} /> Add Error</button>
                        </div>
                        <div className="space-y-6">
                          {selectedTask.errors.map((err, idx) => (
                            <div key={err.id} className="p-5 bg-status-error/5 border border-status-error/10 rounded-md space-y-5 group relative animate-apple-in">
                              <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                              <button onClick={() => updateTask(selectedTaskId as string, { errors: selectedTask.errors.filter(x => x.id !== err.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                              <div className="space-y-2 pt-2">
                                <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Error Type</label>
                                <input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-status-error outline-none focus:border-status-error" placeholder="e.g. System Timeout" value={err.error_type} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, error_type: e.target.value } : x) })} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-white/40 uppercase px-1">Causality / Root Cause</label>
                                <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.description} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, description: e.target.value } : x) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Recovery Protocol</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.correction_method} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, correction_method: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Recovery (min)</label>
                                  <input type="number" min="0" className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.recovery_time_minutes} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, recovery_time_minutes: Math.max(0, Math.round(parseFloat(e.target.value))) } : x) })} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <CollapsibleSection 
                        title="Tribal Knowledge & Implicit Rules" 
                        count={selectedTask.tribal_knowledge.length} 
                        isOpen={expandedSections.tribal} 
                        onToggle={() => toggleSection('tribal')}
                        icon={<Brain size={12} className="text-purple-400" />}
                      >
                        <div className="space-y-6 pt-2">
                          <div className="flex justify-end px-1">
                            <button onClick={() => updateTask(selectedTaskId as string, { tribal_knowledge: [...selectedTask.tribal_knowledge, { id: Date.now().toString(), knowledge: '', captured_from: '' }] })} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md transition-colors"><Plus size={14} /></button>
                          </div>
                          <div className="space-y-4">
                            {selectedTask.tribal_knowledge.map((tk, idx) => (
                              <div key={tk.id} className="p-5 bg-[#0f172a]/80 border border-white/10 rounded-md space-y-4 relative group animate-apple-in">
                                <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                                <button onClick={() => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.filter(x => x.id !== tk.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                                <div className="space-y-2 pt-2">
                                  <label className="text-[8px] font-black text-white/20 uppercase">Operational Insight</label>
                                  <textarea className="w-full bg-transparent text-[13px] font-medium text-white outline-none h-24 resize-none leading-relaxed" value={tk.knowledge} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} placeholder="Implicit knowledge or domain expertise tips..." />
                                </div>
                                <div className="flex items-center gap-3 border-t border-white/5 pt-3">
                                  <label className="text-[8px] font-black text-white/20 uppercase whitespace-nowrap">Source POC:</label>
                                  <input className="bg-transparent text-[11px] font-black text-white outline-none w-full uppercase" placeholder="NAME / DEPARTMENT" value={tk.captured_from} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, captured_from: e.target.value } : x) })} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleSection>
                    </div>
                  )}

                  {inspectorTab === 'validation' && (
                    <div className="space-y-8 animate-apple-in">
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-md space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Industrial Validation</h3>
                            <p className="text-[10px] text-white/40 font-bold">Is formal verification required for this entity?</p>
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
                                className="w-full bg-white/5 border border-white/10 rounded-md p-6 text-[13px] font-mono text-white/80 outline-none focus:border-theme-accent h-64 resize-none leading-loose custom-scrollbar pl-12"
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
                    <div className="space-y-8" onPaste={(e) => isAppendixFocused && handleImagePaste(e)}>
                       <div className="space-y-4">
                         <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Visual Figures & Assets</label>
                         <div className="grid grid-cols-2 gap-4">
                           {selectedTask.media.map((m, idx) => (
                             <div key={m.id} className="aspect-video rounded-md overflow-hidden border border-white/10 relative group bg-black">
                                <span className="text-[10px] font-black text-white absolute top-2 left-2 z-10 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-md">{idx + 1}</span>
                                <img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                <button onClick={() => updateTask(selectedTaskId as string, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1.5 bg-status-error text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash size={12} /></button>
                             </div>
                           ))}
                           <div 
                             tabIndex={0}
                             onFocus={() => setIsAppendixFocused(true)}
                             onBlur={() => setIsAppendixFocused(false)}
                             className={cn(
                               "aspect-video rounded-md border-2 border-dashed flex flex-col items-center justify-center bg-white/[0.02] gap-2 p-4 text-center group transition-all outline-none",
                               isAppendixFocused ? "border-theme-accent bg-theme-accent/5 ring-4 ring-theme-accent/10" : "border-white/5 hover:border-theme-accent/50"
                             )}
                           >
                              <div className={cn(
                                "w-10 h-10 rounded-full bg-white/5 flex items-center justify-center transition-all",
                                isAppendixFocused ? "text-theme-accent scale-110" : "text-white/20 group-hover:scale-110 group-hover:text-theme-accent"
                              )}>
                                <Copy size={20} />
                              </div>
                              <div className="space-y-1">
                                <p className={cn("text-[11px] font-bold transition-colors", isAppendixFocused ? "text-theme-accent" : "text-white")}>Paste Asset</p>
                                <p className="text-[8px] text-white/40 font-black uppercase tracking-widest leading-tight">Cmd+V to Attach</p>
                              </div>
                           </div>
                         </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Internal Reference Links</label>
                            <button onClick={() => updateTask(selectedTaskId as string, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), url: '', description: '' }] })} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[9px] font-black text-white transition-all uppercase tracking-widest">
                               <Plus size={12} className="text-theme-accent" /> Add New
                            </button>
                          </div>
                          <div className="space-y-3">
                            {selectedTask.reference_links.map((link, idx) => (
                              <div key={link.id} className="p-4 bg-white/[0.02] border border-white/10 rounded-md space-y-3 relative group">
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
                   <button onClick={() => swapEdgeDirection(selectedEdgeId as string)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-md transition-all">
                     <LucideWorkflow size={16} className="rotate-90" />
                   </button>
                   <button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-md transition-all">
                     <Trash size={16} />
                   </button>
                 </div>
               </div>
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
                   <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" placeholder="E.G. YES / NO / RETRY" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId as string, { label: e.target.value })} />
                 </div>
                 
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-white/40 uppercase px-1">Visual Path Style</label>
                   <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                     {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                       <button 
                         key={s} 
                         onClick={() => updateEdge(selectedEdgeId as string, { edgeStyle: s })} 
                         className={cn(
                           "flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", 
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
                   <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                     <button onClick={() => updateEdge(selectedEdgeId as string, { style: 'solid' })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.style || 'solid') === 'solid' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Solid</button>
                     <button onClick={() => updateEdge(selectedEdgeId as string, { style: 'dashed' })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", selectedEdge.data?.style === 'dashed' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Dashed</button>
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
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsEditingMetadata(!isEditingMetadata)} 
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                        isEditingMetadata ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/20" : "bg-white/5 border border-white/10 text-white/40 hover:text-white"
                      )}
                    >
                      {isEditingMetadata ? 'Save & Finish' : 'Edit Definition'}
                    </button>
                 </div>
              </div>

              <div className="space-y-12">
                {/* 1. Strategic Identity */}
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Workflow Nomenclature</label>
                      {isEditingMetadata ? (
                        <input className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent" value={metadata.name} onChange={e => { setMetadata({...metadata, name: e.target.value}); setIsDirty?.(true); }} />
                      ) : (
                        <h3 className="text-[18px] font-bold text-white uppercase tracking-tight px-1 leading-tight">{metadata.name || 'Untitled Workflow'}</h3>
                      )}
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">PRC (Process Code)</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.prc} onChange={e => { setMetadata({...metadata, prc: e.target.value}); setIsDirty?.(true); }}><option value="">Select PRC...</option>{taxonomy.filter(t => t.category === 'PRC').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-md px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.prc || 'N/A'}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Operational Type</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.workflow_type} onChange={e => { setMetadata({...metadata, workflow_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Type...</option>{taxonomy.filter(t => t.category === 'WORKFLOW_TYPE').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-md px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.workflow_type || 'N/A'}</div>
                         )}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Tool Family</label>
                         {isEditingMetadata ? (
                           <input className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none focus:border-theme-accent" value={metadata.tool_family} onChange={e => { setMetadata({...metadata, tool_family: e.target.value}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-md px-4 h-[44px] flex items-center text-[12px] font-black text-white uppercase">{metadata.tool_family || 'N/A'}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Applicable Tools</label>
                         {isEditingMetadata ? (
                           <input className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none focus:border-theme-accent" value={metadata.tool_id} onChange={e => { setMetadata({...metadata, tool_id: e.target.value}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="relative group/tooltip flex items-center bg-white/5 border border-white/5 rounded-md px-4 h-[44px] cursor-help">
                              <span className="text-[12px] font-black text-white uppercase truncate">{(metadata.tool_id || '').split(', ')[0] || 'No Tool'}</span>
                              {(metadata.tool_id || '').split(', ').filter(Boolean).length > 1 && (
                                <span className="ml-2 px-1.5 py-0.5 bg-theme-accent/20 text-theme-accent text-[9px] font-black rounded-sm">+{(metadata.tool_id || '').split(', ').filter(Boolean).length - 1}</span>
                              )}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1e293b] border border-white/10 rounded-md shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 min-w-[150px]">
                                <p className="text-[10px] font-black text-white uppercase mb-2 border-b border-white/10 pb-1">Full Equipment List</p>
                                <div className="space-y-1">
                                   {(metadata.tool_id || '').split(', ').filter(Boolean).map((t, i) => (
                                     <p key={i} className="text-[9px] text-white/60 font-medium">{t}</p>
                                   ))}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1e293b]" />
                              </div>
                           </div>
                         )}
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                      {isEditingMetadata ? (
                        <textarea className="w-full bg-[#1e293b] border border-white/10 rounded-md p-4 text-[11px] font-medium text-white/80 leading-relaxed h-24 resize-none outline-none focus:border-theme-accent" placeholder="Provide a deep technical summary of the process lifecycle..." value={metadata.description} onChange={e => { setMetadata({...metadata, description: e.target.value}); setIsDirty?.(true); }} />
                      ) : (
                        <p className="bg-white/[0.02] border border-white/5 rounded-md p-4 text-[11px] font-medium text-white/60 leading-relaxed italic min-h-[60px]">{metadata.description || 'No description provided.'}</p>
                      )}
                   </div>
                </div>

                {/* 2. Execution Cadence */}
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-md space-y-6">
                   <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-theme-accent" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Operational Cadence</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase px-1">Cycle Frequency</label>
                         {isEditingMetadata ? (
                           <input type="number" step="0.1" min="0.1" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-[52px] text-[24px] font-black text-white text-center outline-none focus:border-theme-accent" value={metadata.cadence_count} onChange={e => { setMetadata({...metadata, cadence_count: Math.max(0.1, parseFloat(e.target.value) || 1)}); setIsDirty?.(true); }} />
                         ) : (
                           <div className="bg-black/40 border border-white/5 rounded-md flex items-center justify-center h-[52px] text-[24px] font-black text-white">{metadata.cadence_count}</div>
                         )}
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-white/40 uppercase px-1">Time Unit</label>
                         {isEditingMetadata ? (
                           <select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[52px] text-[12px] font-black text-white text-center appearance-none outline-none focus:border-theme-accent" value={metadata.cadence_unit} onChange={e => { setMetadata({...metadata, cadence_unit: e.target.value}); setIsDirty?.(true); }}><option value="day">PER DAY</option><option value="week">PER WEEK</option><option value="month">PER MONTH</option><option value="year">PER YEAR</option></select>
                         ) : (
                           <div className="bg-white/5 border border-white/5 rounded-md flex items-center justify-center h-[52px] text-[12px] font-black text-white uppercase tracking-widest">PER {metadata.cadence_unit}</div>
                         )}
                      </div>
                   </div>
                </div>

                {/* 3. Trigger & Outcome Architecture */}
                <div className="space-y-8">
                   <div className="space-y-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                         <Activity size={14} className="text-blue-400" />
                         <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Trigger Mechanism</span>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Trigger Classification</label>
                            {isEditingMetadata ? (
                              <select className="w-full bg-[#0f172a] border border-white/10 rounded-md px-4 py-2.5 text-[11px] font-black text-white outline-none" value={metadata.trigger_type} onChange={e => { setMetadata({...metadata, trigger_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Trigger...</option>{taxonomy.filter(t => t.category === 'TriggerType').map((v: any) => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                            ) : (
                              <div className="text-[13px] font-bold text-white uppercase">{taxonomy.find(t => t.category === 'TriggerType' && t.value === metadata.trigger_type)?.label || metadata.trigger_type || 'N/A'}</div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Causal Description</label>
                            {isEditingMetadata ? (
                              <textarea className="w-full bg-[#0f172a] border border-white/10 rounded-md p-4 text-[11px] font-medium text-white h-24 resize-none outline-none focus:border-blue-500" value={metadata.trigger_description} onChange={e => { setMetadata({...metadata, trigger_description: e.target.value}); setIsDirty?.(true); }} />
                            ) : (
                              <p className="text-[12px] text-white/60 font-medium leading-relaxed italic">{metadata.trigger_description || 'No trigger description provided.'}</p>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4 p-5 bg-purple-500/5 border border-purple-500/10 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                         <Database size={14} className="text-purple-400" />
                         <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Process Deliverable</span>
                      </div>
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Output Classification</label>
                            {isEditingMetadata ? (
                              <select className="w-full bg-[#0f172a] border border-white/10 rounded-md px-4 py-2.5 text-[11px] font-black text-white outline-none" value={metadata.output_type} onChange={e => { setMetadata({...metadata, output_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select Output...</option>{taxonomy.filter(t => t.category === 'OutputType').map((v: any) => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
                            ) : (
                              <div className="text-[13px] font-bold text-white uppercase">{taxonomy.find(t => t.category === 'OutputType' && t.value === metadata.output_type)?.label || metadata.output_type || 'N/A'}</div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/30 uppercase px-1">Deliverable Nature</label>
                            {isEditingMetadata ? (
                              <textarea className="w-full bg-[#0f172a] border border-white/10 rounded-md p-4 text-[11px] font-medium text-white h-24 resize-none outline-none focus:border-purple-500" value={metadata.output_description} onChange={e => { setMetadata({...metadata, output_description: e.target.value}); setIsDirty?.(true); }} />
                            ) : (
                              <p className="text-[12px] text-white/60 font-medium leading-relaxed italic">{metadata.output_description || 'No output description provided.'}</p>
                            )}
                         </div>
                      </div>
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
