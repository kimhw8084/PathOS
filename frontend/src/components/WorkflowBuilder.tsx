import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Handle, 
  Position, 
  Background, 
  Controls, 
  addEdge, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
  EdgeLabelRenderer,
  ConnectionLineType,
  type Connection,
  type Edge,
  type Node
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { 
  Save, 
  Plus, 
  Trash, 
  Activity, 
  Database, 
  AlertCircle, 
  ChevronLeft, 
  X, 
  Zap, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  Link2,
  Workflow as LucideWorkflow,
  Settings,
  Brain,
  Paperclip,
  Copy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TaskMedia {
  id: string;
  type: 'image' | 'video' | 'doc';
  url: string;
  label: string;
}

interface TaskReference {
  id: string;
  url: string;
  label: string;
  description?: string;
}

interface TaskInstruction {
  id: string;
  description: string;
  image?: string;
  links: string[];
}

interface TaskEntity {
  id: string;
  node_id?: string;
  name: string;
  description: string;
  task_type: string;
  target_systems: any[];
  interface_type: string;
  interface?: 'TRIGGER' | 'OUTCOME';
  manual_time_minutes: number;
  automation_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrence: number;
  occurrence_explanation: string;
  source_data_list: any[];
  output_data_list: any[];
  verification_steps: any[];
  blockers: any[];
  errors: any[];
  tribal_knowledge: any[];
  validation_needed: boolean;
  validation_procedure: string;
  media: TaskMedia[];
  reference_links: TaskReference[];
  instructions: TaskInstruction[];
  position_x?: number;
  position_y?: number;
  owning_team?: string;
  owner_positions?: string[];
}

interface WorkflowMetadata {
  name: string;
  version: number;
  prc: string;
  workflow_type: string;
  tool_family: string;
  tool_family_count: number;
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
  onBack: (metadata: any) => void;
  onExit: () => void;
  setIsDirty?: (dirty: boolean) => void;
}

const CollapsibleSection: React.FC<{ 
  title: string; 
  count?: number; 
  isOpen: boolean; 
  toggle: () => void; 
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, isOpen, toggle, icon, children }) => (
  <div className="border-b border-white/5 pb-4">
    <button onClick={toggle} className="w-full flex items-center justify-between py-2 group">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[11px] font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-theme-accent/20 text-theme-accent text-[9px] font-black">{count}</span>
        )}
      </div>
      {isOpen ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
    </button>
    {isOpen && <div className="animate-apple-in">{children}</div>}
  </div>
);

const MatrixNode = ({ data, selected, dragging }: { data: any, selected: boolean, dragging?: boolean }) => {
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
  const descFontSize = Math.max(12, titleFontSize - 3);

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
        <Handle type="source" position={Position.Left} id="left-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-left-1.5 !top-1/2 -translate-y-1/2 shadow-xl z-20 opacity-0" />
        
        <Handle type="target" position={Position.Right} id="right-target" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl z-10" />
        <Handle type="source" position={Position.Right} id="right-source" className="!bg-theme-accent !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !-right-1.5 !top-1/2 -translate-y-1/2 shadow-xl z-20 opacity-0" />
      </div>
    );
  }

  const systemBadges = (data.systems || '').split(', ').filter(Boolean);
  const visibleSystemBadges = systemBadges.slice(0, 3);
  const hiddenSystemsCount = systemBadges.length - visibleSystemBadges.length;

  return (
    <div className={cn(
      "apple-glass !bg-[#0f172a]/95 !rounded-lg px-6 py-5 w-[320px] shadow-2xl transition-all duration-300 relative border-2 h-[280px]",
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : 'border-white/10 hover:border-white/20',
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    )}>
      {data.validation_needed && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VALIDATION REQUIRED
        </div>
      )}
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <div className={cn("px-2.5 py-1 rounded-sm text-[11px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2">
            {data.occurrence > 1 && (
              <div className="flex items-center gap-1.5 bg-blue-500 text-white px-2 py-1 rounded-md text-[11px] font-black shadow-lg shadow-blue-500/20">
                <RefreshCw size={12} /> {data.occurrence}
              </div>
            )}
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-2.5 py-1 rounded-md text-[12px] font-black shadow-lg shadow-amber-500/20">
                <AlertCircle size={14} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-error text-white px-2.5 py-1 rounded-md text-[12px] font-black shadow-lg shadow-status-error/20">
                <X size={14} /> {data.errorCount}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-1 relative group/title">
          <h4 
            className="font-bold text-white tracking-tight leading-tight group-hover/title:text-theme-accent transition-colors line-clamp-2 cursor-help overflow-hidden"
            style={{ fontSize: `${titleFontSize}px`, height: `${titleFontSize * 2.4}px` }}
          >
            {data.label || "Untitled Task"}
          </h4>
          {!dragging && (
            <div className="absolute top-full left-0 w-[800px] bg-[#1e293b] border border-white/20 p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-t-theme-accent/50 border-t-2">
               <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight" style={{ fontSize: `${titleFontSize + 2}px` }}>{data.label}</p>
               <p className="text-white/80 font-medium leading-relaxed italic" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[10px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-0.5">Manual</span>
               <span className="text-[22px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[10px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-0.5">Machine</span>
               <span className="text-[22px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-t border-white/5">
             <div className="flex items-center gap-4 flex-1 justify-center">
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Input</span>
                 <span className="text-[14px] font-black text-white">{data.sourceCount || 0}</span>
               </div>
               <div className="w-px h-6 bg-white/5" />
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Output</span>
                 <span className="text-[14px] font-black text-white">{data.outputCount || 0}</span>
               </div>
             </div>
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                   <span className="text-[11px] font-black text-white/60 uppercase truncate max-w-[80px]">{(data.ownerPositions || [])[0] || 'Unassigned'}</span>
                   {(data.ownerPositions || []).length > 1 && (
                     <span className="text-[10px] font-black text-theme-accent">+{(data.ownerPositions || []).length - 1}</span>
                   )}
                </div>
                {data.owningTeam && (
                  <span className="text-[10px] font-black text-theme-accent/60 uppercase tracking-widest leading-none mt-1">{data.owningTeam}</span>
                )}
             </div>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center pt-1.5 border-t border-white/5 min-h-[36px]">
             {visibleSystemBadges.map((s: string, i: number) => (
               <span key={i} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 uppercase">{s}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
             )}
             {systemBadges.length === 0 && (
               <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">No Systems</span>
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

const DiamondNode = ({ data, selected, dragging }: { data: any, selected: boolean, dragging?: boolean }) => {
  const baseFontSize = data.baseFontSize || 14;
  const titleFontSize = Math.max(24, baseFontSize + 10);
  const descFontSize = Math.max(12, titleFontSize - 3);
  return (
    <div className={`relative w-[250px] h-[250px] flex items-center justify-center transition-all duration-300 ${selected ? 'scale-105' : ''}`}>
      <div className={`absolute w-[176.77px] h-[176.77px] rotate-45 border-2 transition-all duration-300 bg-[#1e293b]/90 ${selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20'} ${data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : ''} rounded-sm`} />
      <div className="relative z-10 flex flex-col items-center justify-center p-8 w-full h-full group/title">
        <span 
          className="font-bold text-white text-center leading-tight break-words max-w-[160px] line-clamp-3 overflow-hidden cursor-help"
          style={{ fontSize: `${titleFontSize}px` }}
        >
          {data.label || "Condition"}
        </span>
        {!dragging && (
          <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-[800px] bg-[#1e293b] border border-white/20 p-6 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-t-amber-400/50 border-t-2">
             <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight" style={{ fontSize: `${titleFontSize - 4}px` }}>{data.label || 'Condition'}</p>
             <p className="text-white/80 font-medium leading-relaxed italic" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
          </div>
        )}
      </div>
    {data.validation_needed && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[100px] px-1.5 py-0.5 rounded-sm text-[6px] font-black uppercase bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">VALID</div>
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
  style = {},
  markerEnd,
  data,
  selected
}: any) => {
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (data?.edgeStyle === 'smoothstep') {
      const radius = 20;
      let path = `M ${sourceX},${sourceY}`;
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const midX = sourceX + dx / 2;
      path += ` L ${midX - radius},${sourceY} Q ${midX},${sourceY} ${midX},${sourceY + (dy > 0 ? radius : -radius)} L ${midX},${targetY - (dy > 0 ? radius : -radius)} Q ${midX},${targetY} ${midX + radius},${targetY} L ${targetX},${targetY}`;
      return [path, midX, sourceY + dy / 2];
    } else if (data?.edgeStyle === 'straight') {
      return [`M ${sourceX},${sourceY} L ${targetX},${targetY}`, (sourceX + targetX) / 2, (sourceY + targetY) / 2];
    }
    const cx = (sourceX + targetX) / 2;
    return [`M ${sourceX},${sourceY} C ${cx},${sourceY} ${cx},${targetY} ${targetX},${targetY}`, cx, (sourceY + targetY) / 2];
  }, [sourceX, sourceY, targetX, targetY, data?.edgeStyle]);

  return (
    <>
      <path id="edge-path" className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: data?.color || '#ffffff', strokeWidth: selected ? 4 : 2, strokeDasharray: data?.style === 'dashed' ? '5,5' : undefined, transition: 'all 0.3s' }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: 100 }} className="bg-[#0f172a] px-2 py-0.5 rounded border border-white/20 shadow-xl pointer-events-none">
            <span className="text-[9px] font-black text-white uppercase tracking-widest">{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = { matrix: MatrixNode, diamond: DiamondNode };
const edgeTypes = { custom: CustomEdge };

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
    inputs: false, outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false
  });

  const toggleSection = (section: string) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const [isAppendixFocused, setIsAppendixFocused] = useState(false);
  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow.name, version: workflow.version, prc: workflow.prc, workflow_type: workflow.workflow_type, tool_family: workflow.tool_family, tool_family_count: workflow.tool_family_count || 1, tool_id: workflow.tool_id, trigger_type: workflow.trigger_type, trigger_description: workflow.trigger_description, output_type: workflow.output_type, output_description: workflow.output_description, cadence_count: workflow.cadence_count || 1, cadence_unit: workflow.cadence_unit || 'month', total_roi_saved_hours: workflow.total_roi_saved_hours || 0, org: workflow.org, team: workflow.team, poc: workflow.poc, flow_summary: workflow.flow_summary || '', description: workflow.description || workflow.forensic_description || ''
  });

  const [tasks, setTasks] = useState<TaskEntity[]>([]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface_type === 'TRIGGER' || selectedTask?.interface_type === 'OUTCOME';

  const taskTypes = useMemo(() => {
    const fromTaxonomy = taxonomy.find(t => t.category === 'TASK_TYPE');
    if (fromTaxonomy && (fromTaxonomy as any).cached_values) return (fromTaxonomy as any).cached_values;
    return ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];
  }, [taxonomy]);

  const handleLayout = useCallback((nodesToLayout?: Node[], edgesToLayout?: Edge[]) => {
    try {
      const nds = nodesToLayout || nodes;
      const eds = edgesToLayout || edges;
      if (!nds || nds.length === 0) return;

      const sortedNodes = [...nds].sort((a, b) => {
        const aInterface = a.data?.interface;
        const bInterface = b.data?.interface;
        if (aInterface === 'TRIGGER') return -1;
        if (bInterface === 'TRIGGER') return 1;
        if (aInterface === 'OUTCOME') return 1;
        if (bInterface === 'OUTCOME') return -1;
        return 0;
      });

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'LR', ranker: 'network-simplex', ranksep: 200, nodesep: 100, edgesep: 50 });

      sortedNodes.forEach((n) => {
        const isDiamond = n.type === 'diamond';
        const isTemplate = n.data?.interface === 'TRIGGER' || n.data?.interface === 'OUTCOME';
        dagreGraph.setNode(n.id, { width: isDiamond ? 250 : 320, height: isTemplate ? 120 : (isDiamond ? 250 : 280) });
      });

      eds.forEach((e) => {
        if (dagreGraph.hasNode(e.source) && dagreGraph.hasNode(e.target)) {
          dagreGraph.setEdge(e.source, e.target);
        }
      });

      dagre.layout(dagreGraph);

      const layoutedNodes = sortedNodes.map(n => {
        const nodeWithPos = dagreGraph.node(n.id);
        if (!nodeWithPos) return n;
        const isDiamond = n.type === 'diamond';
        const isTemplate = n.data?.interface === 'TRIGGER' || n.data?.interface === 'OUTCOME';
        return {
          ...n,
          position: {
            x: Math.round((nodeWithPos.x - (isDiamond ? 125 : 160)) / 10) * 10,
            y: Math.round((nodeWithPos.y - (isTemplate ? 60 : (isDiamond ? 125 : 140))) / 10) * 10
          }
        };
      });

      const layoutedEdges = eds.map(e => {
        const sourceNode = layoutedNodes.find(n => n.id === e.source);
        const targetNode = layoutedNodes.find(n => n.id === e.target);
        if (!sourceNode || !targetNode) return e;
        
        let sourceHandle = 'right-source';
        let targetHandle = 'left-target';
        
        if (targetNode.position.x < sourceNode.position.x) {
          sourceHandle = 'left-source';
          targetHandle = 'right-target';
        }
        
        return {
          ...e,
          sourceHandle,
          targetHandle,
          type: 'custom',
          data: {
            ...e.data,
            edgeStyle: Math.abs(targetNode.position.y - sourceNode.position.y) < 5 ? 'straight' : 'smoothstep'
          }
        };
      });

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setIsDirty?.(true);
      window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 800 }));
    } catch (error) {
      console.error("Dagre Layout Error:", error);
    }
  }, [fitView, setNodes, setEdges, setIsDirty]);

  useEffect(() => {
    if (!workflow) return;

    try {
      const seenIds = new Set<string>();
      let initializedTasks = (workflow?.tasks || []).map((t: any) => {
        let stableId = String(t.node_id || t.id || `node-${Math.random().toString(36).substr(2, 9)}`);
        if (seenIds.has(stableId)) {
          stableId = `${stableId}-dup-${Math.random().toString(36).substr(2, 9)}`;
        }
        seenIds.add(stableId);
        
        return {
          ...t,
          id: stableId,
          node_id: stableId,
          target_systems: t.target_systems || [],
          blockers: t.blockers || [],
          errors: t.errors || [],
          media: t.media || [],
          reference_links: t.reference_links || [],
          instructions: t.instructions || [],
          source_data_list: t.source_data_list || [],
          output_data_list: t.output_data_list || [],
          verification_steps: t.verification_steps || [],
          tribal_knowledge: t.tribal_knowledge || [],
          active_touch_time_minutes: t.active_touch_time_minutes || 0,
          machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
          occurrence: t.occurrence || t.occurrences_per_cycle || 1,
          occurrence_explanation: t.occurrence_explanation || '',
          automation_time_minutes: t.automation_time_minutes || 0,
          manual_time_minutes: t.manual_time_minutes || 0,
          validation_needed: t.validation_needed || false,
          validation_procedure: t.validation_procedure || '',
        };
      });

      // Add boundary nodes if missing
      if (!initializedTasks.find((t: any) => t.interface === 'TRIGGER')) {
        initializedTasks.unshift({
          id: 'node-trigger',
          node_id: 'node-trigger',
          name: taxonomy.find(tx => tx.category === 'TriggerType' && tx.value === workflow?.trigger_type)?.label || workflow?.trigger_type || 'TRIGGER',
          description: workflow?.trigger_description || '',
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
          instructions: [],
          position_x: 0,
          position_y: 100
        });
      }

      if (!initializedTasks.find((t: any) => t.interface === 'OUTCOME')) {
        initializedTasks.push({
          id: 'node-outcome',
          node_id: 'node-outcome',
          name: taxonomy.find(tx => tx.category === 'OutputType' && tx.value === workflow?.output_type)?.label || workflow?.output_type || 'OUTCOME',
          description: workflow?.output_description || '',
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
          instructions: [],
          position_x: 1000,
          position_y: 100
        });
      }

      setTasks(initializedTasks);
      setMetadata({
        name: workflow?.name || 'Untitled',
        version: workflow?.version || 1,
        prc: workflow?.prc || '',
        workflow_type: workflow?.workflow_type || '',
        tool_family: workflow?.tool_family || '',
        tool_family_count: workflow?.tool_family_count || 1,
        tool_id: workflow?.tool_id || '',
        trigger_type: workflow?.trigger_type || 'Manual',
        trigger_description: workflow?.trigger_description || '',
        output_type: workflow?.output_type || 'Report',
        output_description: workflow?.output_description || '',
        cadence_count: workflow?.cadence_count || 1,
        cadence_unit: workflow?.cadence_unit || 'month',
        total_roi_saved_hours: workflow?.total_roi_saved_hours || 0,
        org: workflow?.org || '',
        team: workflow?.team || '',
        poc: workflow?.poc || '',
        flow_summary: workflow?.flow_summary || '',
        description: workflow?.description || workflow?.forensic_description || ''
      });
      
      const initialNodes: Node[] = initializedTasks.map((t: any) => ({
        id: String(t.node_id || t.id),
        type: t.interface_type === 'CONDITION' ? 'diamond' : 'matrix',
        position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
        data: {
          ...t,
          label: t.name,
          task_type: t.task_type || 'GENERAL',
          manual_time: t.manual_time_minutes || 0,
          automation_time: t.automation_time_minutes || 0,
          occurrence: t.occurrence || 1,
          systems: (t.target_systems || []).map((s: any) => s.name).join(', '),
          owningTeam: t.owning_team,
          ownerPositions: t.owner_positions,
          sourceCount: (t.source_data_list || []).length,
          outputCount: (t.output_data_list || []).length,
          interface: t.interface,
          validation_needed: t.validation_needed,
          blockerCount: (t.blockers || []).length,
          errorCount: (t.errors || []).length,
          description: t.description || '',
          id: String(t.node_id || t.id),
          baseFontSize
        },
      }));

      const initialEdges: Edge[] = (workflow?.edges || []).map((e: any, idx: number) => {
        const sourceId = String(e.source || '');
        const targetId = String(e.target || '');
        if (!sourceId || !targetId) return null;

        let sHandle = e.source_handle || e.sourceHandle;
        let tHandle = e.target_handle || e.targetHandle;

        if (sourceId === 'node-trigger' && sHandle === 'right-target') sHandle = 'right-source';
        if (!sHandle) sHandle = 'right-source';
        if (!tHandle) tHandle = 'left-target';

        return {
          ...e,
          id: String(e.id || `e-${sourceId}-${targetId}-${idx}-${Date.now()}`),
          source: sourceId,
          target: targetId,
          sourceHandle: sHandle,
          targetHandle: tHandle,
          type: 'custom',
          data: {
            label: e.label || e.data?.label || '',
            edgeStyle: e.edge_style || e.data?.edgeStyle || 'bezier',
            color: e.color || e.data?.color || '#ffffff',
            style: e.style || e.data?.style || 'solid'
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: e.color || e.data?.color || '#ffffff'
          },
        };
      }).filter((e: any) => {
        if (!e) return false;
        const sourceExists = initializedTasks.some((t: any) => String(t.node_id || t.id) === e.source);
        const targetExists = initializedTasks.some((t: any) => String(t.node_id || t.id) === e.target);
        return sourceExists && targetExists;
      });

      setNodes(initialNodes);
      setEdges(initialEdges);

      if (initializedTasks.every((t: any) => !t.position_x && !t.position_y)) {
        setTimeout(() => {
          handleLayout(initialNodes, initialEdges);
        }, 200);
      }
    } catch (err) {
      console.error("CRITICAL: WorkflowBuilder initialization failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONLY once on mount. The key in App.tsx handles re-initialization on workflow change.

  useEffect(() => {
    if (selectedTaskId && !tasks.find(t => String(t.id) === String(selectedTaskId))) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

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
  }, [metadata, baseFontSize, taxonomy, setNodes]);

  const handleImagePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && selectedTaskId) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const newMedia: TaskMedia = {
              id: Date.now().toString(),
              type: 'image',
              url: evt.target?.result as string,
              label: 'Pasted Image'
            };
            updateTask(selectedTaskId, {
              media: [...(selectedTask?.media || []), newMedia]
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [selectedTaskId, selectedTask]);

  const deleteTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return;

    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setIsDirty?.(true);
  }, [tasks, setNodes, setEdges, setIsDirty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

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
              systems: clipboard.target_systems.map((s:any) => s.name).join(', '),
              owningTeam: clipboard.owning_team,
              ownerPositions: clipboard.owner_positions,
              sourceCount: clipboard.source_data_list.length,
              outputCount: clipboard.output_data_list.length,
              validation_needed: clipboard.validation_needed,
              blockerCount: clipboard.blockers.length,
              errorCount: clipboard.errors.length,
              interface: undefined,
              baseFontSize
            },
          };
          const newTask: TaskEntity = {
            ...clipboard,
            id,
            node_id: id,
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
        } else if (selectedEdgeId) {
          setEdges(eds => eds.filter(e => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
          setIsDirty?.(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, selectedEdgeId, selectedTask, isProtected, clipboard, project, setEdges, setNodes, setIsDirty, baseFontSize, deleteTask]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    if (updates.name !== undefined && updates.name.trim() === '') {
      updates.name = 'Untitled';
    }
    
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
            occurrence: updated.occurrence,
            systems: updated.target_systems.map((s:any) => s.name).join(', '),
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
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: updates.color || e.data?.color || '#ffffff'
      }
    } : e));
    setIsDirty?.(true);
  };

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    const newEdge: Edge = {
      ...params,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      type: 'custom',
      data: {
        label: '',
        edgeStyle: 'bezier',
        color: '#ffffff',
        style: 'solid'
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#ffffff'
      },
      source: params.source,
      target: params.target
    };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const onAddNode = (type: 'TASK' | 'CONDITION') => {
    const id = `node-${Date.now()}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    
    const newNode: Node = {
      id,
      type: type === 'CONDITION' ? 'diamond' : 'matrix',
      position: { 
        x: Math.round((center.x - (type === 'CONDITION' ? 125 : 160)) / 10) * 10, 
        y: Math.round((center.y - (type === 'CONDITION' ? 125 : 140)) / 10) * 10 
      },
      data: {
        label: type === 'TASK' ? 'New Task' : 'New Condition',
        task_type: type === 'TASK' ? 'Documentation' : 'LOOP',
        manual_time: 0,
        automation_time: 0,
        occurrence: 1,
        systems: '',
        validation_needed: false,
        blockerCount: 0,
        errorCount: 0,
        baseFontSize
      },
    };

    const newTask: TaskEntity = {
      id,
      node_id: id,
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
      reference_links: [],
      instructions: []
    };

    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };

  const handleSave = () => {
    try {
      if (tasks.length === 0) {
        console.warn("Attempted to save empty task list. Aborting save to prevent data loss.");
        return;
      }

      const finalData = {
        ...metadata,
        tasks: tasks.map(t => {
          const node = nodes.find(n => String(n.id) === String(t.id));
          return {
            ...t,
            id: undefined, // Let backend handle DB ID
            node_id: String(t.node_id || t.id),
            position_x: node?.position.x ?? t.position_x ?? 0,
            position_y: node?.position.y ?? t.position_y ?? 0
          };
        }),
        edges: edges.map(e => ({
          source: String(e.source),
          target: String(e.target),
          source_handle: String(e.sourceHandle || 'right-source'),
          target_handle: String(e.targetHandle || 'left-target'),
          label: String(e.data?.label || ''),
          edge_style: String(e.data?.edgeStyle || 'bezier'),
          color: String(e.data?.color || '#ffffff'),
          style: String(e.data?.style || 'solid')
        }))
      };
      onSave(finalData);
    } catch (err) {
      console.error("Critical error during save preparation:", err);
      // Removed the onSave with empty tasks to prevent wiping data on error
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX; const startWidth = inspectorWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => { setInspectorWidth(Math.max(300, Math.min(800, startWidth - (moveEvent.pageX - startX)))); };
    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  };

  const swapEdgeDirection = (id: string) => {
    setEdges(eds => eds.map(e => {
      if (e.id === id) { const newSourceHandle = e.targetHandle?.replace('-target', '-source'); const newTargetHandle = e.sourceHandle?.replace('-source', '-target'); return { ...e, source: e.target, target: e.source, sourceHandle: newSourceHandle, targetHandle: newTargetHandle }; }
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
            <div className="flex flex-col"><span className="text-[10px] font-black text-theme-accent uppercase tracking-widest leading-none mb-1">Workflow Builder</span><h1 className="text-[14px] font-black text-white uppercase tracking-tight leading-none truncate max-w-[300px]">{workflow.name}</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative"><button onClick={() => setShowFontSettings(!showFontSettings)} className={cn("p-2 rounded-md transition-all border", showFontSettings ? "bg-theme-accent border-theme-accent text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white")} title="Adjust Typography"><span className="text-[10px] font-black uppercase">AA</span></button>{showFontSettings && (<div className="absolute right-0 top-full mt-2 w-48 apple-glass border border-white/10 p-4 rounded-xl shadow-2xl z-[100] animate-apple-in"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest block mb-3">Global Font Scale</label><input type="range" min="10" max="24" value={baseFontSize} onChange={(e) => setBaseFontSize(parseInt(e.target.value))} className="w-full accent-theme-accent"/><div className="flex justify-between mt-2 text-[9px] font-black text-white/20 uppercase"><span>Small</span><span className="text-theme-accent">{baseFontSize}px</span><span>Large</span></div><button onClick={() => setBaseFontSize(14)} className="w-full mt-4 py-1.5 text-[8px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors">Reset Default</button></div>)}</div>
            <button onClick={() => handleLayout()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-black text-white transition-all uppercase tracking-widest"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-theme-accent hover:bg-blue-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-theme-accent/20"><Save size={14} /> Commit Changes</button>
            <div className="w-px h-6 bg-white/10 mx-2" /><button onClick={onExit} className="p-2 hover:bg-status-error/10 text-white/20 hover:text-status-error rounded-md transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 relative">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={(_, n) => { setSelectedTaskId(n.id); setSelectedEdgeId(null); setInspectorTab('overview'); }} onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedTaskId(null); }} onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }} fitView snapToGrid snapGrid={[10, 10]} connectionMode={ConnectionMode.Loose} connectionLineType={ConnectionLineType.SmoothStep} connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 3 }} defaultEdgeOptions={{ type: 'custom', animated: false, data: { style: 'solid' } }} className="react-flow-industrial" deleteKeyCode={null}><Background color="#1e293b" gap={30} size={1} /><Controls className="!bg-[#0a1120] !border-white/10 !rounded-md !shadow-2xl backdrop-blur-md [&_button]:!border-white/5 [&_button]:!fill-white" /></ReactFlow>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-md shadow-2xl"><button onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-3 py-1.5 bg-theme-accent hover:bg-blue-500 text-white rounded-md text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-theme-accent/20"><Plus size={12} /> Add Task</button><button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-md text-[9px] font-black uppercase tracking-widest transition-all"><Plus size={12} /> Add Condition</button></div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3 pointer-events-none"><div className="bg-[#0a1120]/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl"><div className="flex flex-col items-center"><span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Entities</span><span className="text-[14px] font-black text-white leading-none">{tasks.length}</span></div><div className="w-px h-6 bg-white/10" /><div className="flex flex-col items-center"><span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Edges</span><span className="text-[14px] font-black text-theme-accent leading-none">{edges.length}</span></div></div></div>
        </div>
      </div>
      <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70] shadow-2xl transition-width duration-75" style={{ width: `${inspectorWidth}px` }}>
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent transition-colors z-50 group" />
        <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
          {[ { id: 'overview', label: 'Overview', icon: <Activity size={12} />, hidden: !selectedTaskId }, { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: !selectedTaskId || isProtected }, { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: !selectedTaskId || isProtected }, { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: !selectedTaskId || isProtected }, { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: !selectedTaskId || isProtected } ].filter(t => !t.hidden).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white')}>{t.icon}<span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span></button>
          ))}
          {!selectedTaskId && !selectedEdgeId && (<div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white"><Settings size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Workflow Definition</span></div>)}
          {selectedEdgeId && (<div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white"><Link2 size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Edge Properties</span></div>)}
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar p-6" key={selectedTaskId || 'workflow'}>
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              {isProtected ? (
                <div className="space-y-8 animate-apple-in"><div className="flex items-center gap-4 p-5 bg-theme-accent/5 border border-theme-accent/10 rounded-xl"><div className={cn("w-10 h-10 rounded-full flex items-center justify-center shadow-lg", selectedTask.interface === 'TRIGGER' ? "bg-cyan-500 text-white" : "bg-rose-500 text-white")}><Zap size={20} /></div><div><span className="text-[10px] font-black text-theme-accent uppercase tracking-[0.2em] block mb-0.5">Boundary System</span><h2 className="text-[16px] font-black text-white uppercase tracking-tight">{selectedTask.interface}</h2></div></div><div className="space-y-6"><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Type Classification</label><div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[14px] font-bold text-white uppercase">{selectedTask.name}</div></div><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Description & Context</label><p className="bg-white/[0.02] border border-white/5 rounded-lg p-5 text-[12px] text-white/60 font-medium leading-relaxed italic">{selectedTask.description || 'No description provided.'}</p></div></div></div>
              ) : selectedTask.interface_type === 'CONDITION' ? (
                <div className="space-y-6"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><Activity size={18} className="text-amber-400" /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Condition Entity</h2></div><button onClick={() => { setSelectedTaskId(null); setInspectorTab('overview'); }} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button></div><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Condition Label</label><input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} /></div><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Logic Description</label><textarea className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-medium text-white/60 outline-none focus:border-theme-accent h-32 resize-none leading-relaxed" value={selectedTask.description} onChange={e => updateTask(selectedTaskId as string, { description: e.target.value })} /></div><div className="pt-6 border-t border-white/5"><button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2"><Trash size={12} /> Delete Entity</button></div></div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><Activity size={18} className="text-theme-accent" /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Task Definition</h2></div><button onClick={() => { setSelectedTaskId(null); setInspectorTab('overview'); }} className="text-white/20 hover:text-white transition-colors"><X size={14} /></button></div>
                  {inspectorTab === 'overview' && (
                    <div className="space-y-8 animate-apple-in"><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Nomenclature</label><input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent transition-all" value={selectedTask.name} onChange={e => updateTask(selectedTaskId as string, { name: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Logic Type</label><select className="w-full bg-white/5 border border-white/10 rounded-md px-3 h-11 text-[11px] font-black text-white outline-none focus:border-theme-accent uppercase" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId as string, { task_type: e.target.value })}>{taskTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}</select></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Interface Mode</label><select className="w-full bg-white/5 border border-white/10 rounded-md px-3 h-11 text-[11px] font-black text-white outline-none focus:border-theme-accent uppercase" value={selectedTask.interface_type} onChange={e => updateTask(selectedTaskId as string, { interface_type: e.target.value })}><option value="GUI">GUI INTERACTION</option><option value="CLI">CLI / TERMINAL</option><option value="API">API CALL</option><option value="PHYSICAL">PHYSICAL ACTION</option><option value="VERBAL">VERBAL / COMMS</option></select></div></div><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Essence (Why?)</label><textarea className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-medium text-white/60 outline-none focus:border-theme-accent h-24 resize-none leading-relaxed" value={selectedTask.description} onChange={e => updateTask(selectedTaskId as string, { description: e.target.value })} /></div><div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-6"><div className="flex items-center gap-2 mb-2"><Clock size={14} className="text-theme-accent" /><span className="text-[10px] font-black text-white uppercase tracking-widest">Chronometry</span></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Manual (min)</label><input type="number" step="1" min="0" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-12 text-[18px] font-black text-white text-center outline-none focus:border-theme-accent" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId as string, { manual_time_minutes: Math.max(0, parseInt(e.target.value) || 0) })} /></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Machine (min)</label><input type="number" step="1" min="0" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-12 text-[18px] font-black text-white text-center outline-none focus:border-theme-accent" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId as string, { automation_time_minutes: Math.max(0, parseInt(e.target.value) || 0) })} /></div></div><div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Wait Time (min)</label><input type="number" step="1" min="0" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-12 text-[18px] font-black text-white text-center outline-none focus:border-theme-accent" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTaskId as string, { machine_wait_time_minutes: Math.max(0, parseInt(e.target.value) || 0) })} /></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Occurrences</label><input type="number" step="1" min="1" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-12 text-[18px] font-black text-white text-center outline-none focus:border-theme-accent" value={selectedTask.occurrence} onChange={e => updateTask(selectedTaskId as string, { occurrence: Math.max(1, parseInt(e.target.value) || 1) })} /></div></div></div><div className="pt-6 border-t border-white/5"><button onClick={() => deleteTask(selectedTaskId as string)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[10px] font-black uppercase tracking-[0.2em] hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2"><Trash size={12} /> Delete Task Entity</button></div></div>
                  )}
                  {inspectorTab === 'data' && (
                    <div className="space-y-10 animate-apple-in"><div className="space-y-4"><CollapsibleSection title="Input Data (Sources)" isOpen={expandedSections.inputs} toggle={() => toggleSection('inputs')} count={selectedTask.source_data_list.length}><div className="space-y-6 pt-4"><div className="flex justify-end px-1"><button onClick={() => updateTask(selectedTaskId as string, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', format: '', is_manual: true, source_location: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"><Plus size={12} /> Add Manual Input</button></div>{selectedTask.source_data_list.map((sd, idx) => (<div key={sd.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-md space-y-5 group relative animate-apple-in"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-black text-white/20">{idx + 1}.</span>{!sd.is_manual && <Link2 size={12} className="text-blue-400" />}<span className="text-[10px] font-black uppercase tracking-widest text-white/40">{sd.is_manual ? 'Manual Source' : 'System Reference'}</span></div><button onClick={() => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Source Data Identity</label><input readOnly={!sd.is_manual} className={cn("w-full bg-black/40 border rounded-md px-4 py-2.5 text-[14px] font-bold outline-none focus:border-theme-accent", sd.is_manual ? "text-white border-white/10" : "text-white/40 border-transparent")} value={sd.name} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label><input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} value={sd.format} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, format: e.target.value } : x) })} /></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Location</label><input readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium", sd.is_manual ? "text-white border-white/5" : "text-white/40 border-transparent")} value={sd.source_location} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, source_location: e.target.value } : x) })} /></div></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Description</label><textarea readOnly={!sd.is_manual} className={cn("w-full bg-black/20 border rounded-md px-3 py-2 text-[12px] font-medium h-16 resize-none outline-none italic", sd.is_manual ? "text-white/80 border-white/5" : "text-white/30 border-transparent")} value={sd.description} onChange={e => updateTask(selectedTaskId as string, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} /></div></div>))}</div></CollapsibleSection></div><div className="space-y-4"><CollapsibleSection title="Output Data (Deliverables)" isOpen={expandedSections.outputs} toggle={() => toggleSection('outputs')} count={selectedTask.output_data_list.length}><div className="space-y-6 pt-4"><div className="flex justify-end px-1"><button onClick={() => updateTask(selectedTaskId as string, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', format: '', example: '', saved_location: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20"><Plus size={12} /> Add New Output</button></div>{selectedTask.output_data_list.map((od, idx) => (<div key={od.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-md space-y-5 group relative animate-apple-in"><span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span><button onClick={() => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={12} /></button><div className="space-y-2 pt-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Output Identity</label><input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-white outline-none focus:border-theme-accent" value={od.name} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Format</label><input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={od.format} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, format: e.target.value } : x) })} /></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Destination</label><input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={od.saved_location} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, saved_location: e.target.value } : x) })} /></div></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Description</label><textarea className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white/80 font-medium h-16 resize-none outline-none italic" value={od.description} onChange={e => updateTask(selectedTaskId as string, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} /></div></div>))}</div></CollapsibleSection></div></div>
                  )}
                  {inspectorTab === 'exceptions' && (
                    <div className="space-y-10 animate-apple-in">
                      <div className="space-y-4">
                        <CollapsibleSection title="Process Blockers" isOpen={expandedSections.blockers} toggle={() => toggleSection('blockers')} count={selectedTask.blockers.length}>
                          <div className="space-y-6 pt-4">
                            <div className="flex justify-end px-1">
                              <button onClick={() => updateTask(selectedTaskId as string, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 10, average_delay_minutes: 0, standard_mitigation: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all"><Plus size={12} /> Add Blocker</button>
                            </div>
                            {selectedTask.blockers.map((b, idx) => (
                              <div key={b.id} className="p-5 bg-[#1e293b]/50 border border-white/10 rounded-md space-y-5 group relative animate-apple-in">
                                <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                                <button onClick={() => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                                <div className="space-y-2 pt-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Identity</label>
                                  <input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-amber-500 outline-none focus:border-amber-500" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
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
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Mitigation</label>
                                  <textarea className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white/80 font-medium h-16 resize-none outline-none" value={b.standard_mitigation} onChange={e => updateTask(selectedTaskId as string, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, standard_mitigation: e.target.value } : x) })} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleSection>
                      </div>
                      <div className="space-y-4">
                        <CollapsibleSection title="Expected Errors" isOpen={expandedSections.errors} toggle={() => toggleSection('errors')} count={selectedTask.errors.length}>
                          <div className="space-y-6 pt-4">
                            <div className="flex justify-end px-1">
                              <button onClick={() => updateTask(selectedTaskId as string, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', probability_percent: 10, recovery_time_minutes: 0, correction_method: '' }] })} className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-status-error hover:text-white transition-all"><Plus size={12} /> Add Error</button>
                            </div>
                            {selectedTask.errors.map((err, idx) => (
                              <div key={err.id} className="p-5 bg-status-error/5 border border-status-error/10 rounded-md space-y-5 group relative animate-apple-in">
                                <span className="text-[10px] font-black text-white/20 absolute top-5 left-5">{idx + 1}.</span>
                                <button onClick={() => updateTask(selectedTaskId as string, { errors: selectedTask.errors.filter(x => x.id !== err.id) })} className="absolute top-5 right-5 text-white/10 hover:text-status-error transition-colors"><Trash size={14} /></button>
                                <div className="space-y-2 pt-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase tracking-wider px-1">Type</label>
                                  <input className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-2.5 text-[14px] font-bold text-status-error outline-none focus:border-status-error" value={err.error_type} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, error_type: e.target.value } : x) })} />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Cause</label>
                                  <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.description} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, description: e.target.value } : x) })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-white/40 uppercase px-1">Recovery</label>
                                    <input className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.correction_method} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, correction_method: e.target.value } : x) })} />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-black text-white/40 uppercase px-1">Time</label>
                                    <input type="number" min="0" className="w-full bg-black/20 border border-white/5 rounded-md px-3 py-2 text-[12px] text-white font-medium" value={err.recovery_time_minutes} onChange={e => updateTask(selectedTaskId as string, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, recovery_time_minutes: Math.max(0, Math.round(parseFloat(e.target.value))) } : x) })} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleSection>
                      </div>
                      <CollapsibleSection title="Tribal Knowledge" count={selectedTask.tribal_knowledge.length} isOpen={expandedSections.tribal} toggle={() => toggleSection('tribal')} icon={<Brain size={12} className="text-purple-400" />}>
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
                                  <label className="text-[8px] font-black text-white/20 uppercase">Insight</label>
                                  <textarea className="w-full bg-transparent text-[13px] font-medium text-white outline-none h-24 resize-none leading-relaxed" value={tk.knowledge} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} />
                                </div>
                                <div className="flex items-center gap-3 border-t border-white/5 pt-3">
                                  <label className="text-[8px] font-black text-white/20 uppercase">Source:</label>
                                  <input className="bg-transparent text-[11px] font-black text-white outline-none w-full uppercase" value={tk.captured_from} onChange={e => updateTask(selectedTaskId as string, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, captured_from: e.target.value } : x) })} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleSection>
                    </div>
                  )}
                  {inspectorTab === 'validation' && (
                    <div className="space-y-8 animate-apple-in"><div className="p-6 bg-white/[0.02] border border-white/5 rounded-md space-y-6"><div className="flex items-center justify-between"><div className="space-y-1"><h3 className="text-[14px] font-black text-white uppercase tracking-tight">Validation</h3><p className="text-[10px] text-white/40 font-bold">Verification required?</p></div><button onClick={() => updateTask(selectedTaskId as string, { validation_needed: !selectedTask.validation_needed })} className={cn("relative w-12 h-6 rounded-full transition-all duration-300", selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10")}><div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1")} /></button></div>{selectedTask.validation_needed && (<div className="space-y-4 animate-apple-in pt-4 border-t border-white/5"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Procedure</label><div className="relative"><textarea className="w-full bg-white/5 border border-white/10 rounded-md p-6 text-[13px] font-mono text-white/80 outline-none h-64 resize-none leading-loose custom-scrollbar pl-12" value={selectedTask.validation_procedure} onChange={e => updateTask(selectedTaskId as string, { validation_procedure: e.target.value })} /><div className="absolute top-6 left-4 flex flex-col pointer-events-none select-none">{selectedTask.validation_procedure.split('\n').map((_, i) => (<span key={i} className="text-[13px] font-mono text-white/10 leading-loose text-right w-6 pr-2">{i + 1}</span>))}</div></div></div>)}</div></div>
                  )}
                  {inspectorTab === 'appendix' && (
                     <div className="space-y-10 animate-apple-in">
                        <CollapsibleSection title="Internal Reference Links" isOpen={expandedSections.references} toggle={() => toggleSection('references')} count={selectedTask.reference_links.length}><div className="space-y-4 pt-4">{selectedTask.reference_links.map((link, idx) => (<div key={link.id || idx} className="flex gap-2 group"><div className="flex-1 flex flex-col gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-lg"><input className="bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-white/10" placeholder="Label" value={link.label || link.description || ''} onChange={e => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? {...l, label: e.target.value} : l) })} /><div className="flex items-center gap-2 text-theme-accent"><Link2 size={10} /><input className="bg-transparent text-[10px] font-medium text-white/40 outline-none w-full" placeholder="https://..." value={link.url} onChange={e => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.map(l => l.id === link.id ? {...l, url: e.target.value} : l) })} /></div></div><button onClick={() => updateTask(selectedTaskId as string, { reference_links: selectedTask.reference_links.filter(l => l.id !== link.id) })} className="p-2 h-fit bg-status-error/10 text-status-error rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-status-error hover:text-white"><Trash size={12} /></button></div>))}<button onClick={() => updateTask(selectedTaskId as string, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} className="w-full py-3 border border-dashed border-white/10 rounded-lg text-[10px] font-black text-white/20 hover:text-white hover:border-theme-accent/50 hover:bg-theme-accent/5 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"><Plus size={12} /> Add Reference</button></div></CollapsibleSection>
                        <CollapsibleSection title="Global Visual Assets" isOpen={expandedSections.assets} toggle={() => toggleSection('assets')} count={selectedTask.media.length}><div className="space-y-6 pt-4"><div className="grid grid-cols-2 gap-4">{selectedTask.media.map((m, idx) => (<div key={m.id} className="aspect-video rounded-md overflow-hidden border border-white/10 relative group bg-black"><span className="text-[10px] font-black text-white absolute top-2 left-2 z-10 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-md">{idx + 1}</span><img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" /><button onClick={() => updateTask(selectedTaskId as string, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-2 right-2 p-1.5 bg-status-error text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash size={12} /></button></div>))}<div tabIndex={0} onFocus={() => setIsAppendixFocused(true)} onBlur={() => setIsAppendixFocused(false)} onPaste={(e) => handleImagePaste(e)} className={cn("aspect-video rounded-md border-2 border-dashed flex flex-col items-center justify-center bg-white/[0.02] gap-2 p-4 text-center group transition-all outline-none", isAppendixFocused ? "border-theme-accent bg-theme-accent/5 ring-4 ring-theme-accent/10" : "border-white/5 hover:border-theme-accent/50")}><div className={cn("w-10 h-10 rounded-full bg-white/5 flex items-center justify-center transition-all", isAppendixFocused ? "text-theme-accent scale-110" : "text-white/20 group-hover:scale-110 group-hover:text-theme-accent")}><Copy size={20} /></div><div className="space-y-1"><p className={cn("text-[11px] font-bold transition-colors", isAppendixFocused ? "text-theme-accent" : "text-white")}>Paste Asset</p><p className="text-[8px] text-white/40 font-black uppercase tracking-widest leading-tight">Cmd+V</p></div></div></div></div></CollapsibleSection>
                        <CollapsibleSection title="Step-by-Step Instructions" isOpen={expandedSections.instructions} toggle={() => toggleSection('instructions')} count={selectedTask.instructions.length}><div className="space-y-6 pt-4">{selectedTask.instructions.map((step, idx) => (<div key={step.id || idx} className="p-5 bg-white/[0.02] border border-white/5 rounded-xl group relative"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-theme-accent/20 text-theme-accent text-[11px] font-black flex items-center justify-center border border-theme-accent/30">{idx + 1}</span><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Execution Step</span></div><button onClick={() => updateTask(selectedTaskId as string, { instructions: selectedTask.instructions.filter(s => s.id !== step.id) })} className="opacity-0 group-hover:opacity-100 text-status-error/40 hover:text-status-error transition-all"><Trash size={14} /></button></div><textarea className="w-full bg-black/20 border border-white/5 rounded-lg p-4 text-[13px] font-medium text-white/80 leading-relaxed min-h-[100px] outline-none focus:border-theme-accent transition-all resize-none" value={step.description} onChange={e => updateTask(selectedTaskId as string, { instructions: selectedTask.instructions.map(s => s.id === step.id ? {...s, description: e.target.value} : s) })} /><div className="mt-4 space-y-3"><div className="flex items-center justify-between px-1"><label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label><button onClick={() => updateTask(selectedTaskId as string, { instructions: selectedTask.instructions.map(s => s.id === step.id ? {...s, links: [...(s.links || []), '']} : s) })} className="text-[9px] font-black text-theme-accent hover:underline uppercase tracking-widest">+ Add Link</button></div><div className="grid grid-cols-1 gap-2">{(step.links || []).map((link, lIdx) => (<div key={lIdx} className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-md px-3 py-2"><Link2 size={10} className="text-white/20" /><input className="bg-transparent text-[11px] font-medium text-white/60 outline-none w-full" value={link} onChange={e => updateTask(selectedTaskId as string, { instructions: selectedTask.instructions.map(s => s.id === step.id ? {...s, links: s.links.map((l, i) => i === lIdx ? e.target.value : l)} : s) })} /><button onClick={() => updateTask(selectedTaskId as string, { instructions: selectedTask.instructions.map(s => s.id === step.id ? {...s, links: s.links.filter((_, i) => i !== lIdx)} : s) })} className="text-white/10 hover:text-status-error"><X size={10} /></button></div>))}</div></div></div>))}<button onClick={() => updateTask(selectedTaskId as string, { instructions: [...(selectedTask.instructions || []), { id: Date.now().toString(), description: '', links: [] }] })} className="w-full py-4 border-2 border-dashed border-white/5 rounded-xl text-white/20 hover:text-white hover:border-theme-accent/50 hover:bg-theme-accent/5 transition-all flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest"><Plus size={16} /> Add Execution Step</button></div></CollapsibleSection>
                     </div>
                   )}
                </>
              )}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="p-6 space-y-10 animate-apple-in"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Edge Configuration</span></div><div className="flex gap-2"><button onClick={() => swapEdgeDirection(selectedEdgeId as string)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-md transition-all"><LucideWorkflow size={16} className="rotate-90" /></button><button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-md transition-all"><Trash size={16} /></button></div></div><div className="space-y-6"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label><input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId as string, { label: e.target.value })} /></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Style</label><div className="flex bg-white/5 p-1 rounded-md border border-white/10">{(['smoothstep', 'bezier', 'straight'] as const).map((s) => (<button key={s} onClick={() => updateEdge(selectedEdgeId as string, { edgeStyle: s })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>))}</div></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Color</label><div className="flex gap-2">{['#ffffff', '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#a855f7'].map(c => (<button key={c} onClick={() => updateEdge(selectedEdgeId as string, { color: c })} className={cn("w-8 h-8 rounded-full border-2 transition-all", (selectedEdge.data?.color || '#ffffff') === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-40 hover:opacity-100")} style={{ backgroundColor: c }} />))}</div></div></div></div>
          ) : (
            <div className="space-y-10 animate-apple-in pb-20"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><LucideWorkflow className="text-theme-accent" size={18} /><h2 className="text-[14px] font-black text-white uppercase tracking-widest">Process Definition</h2></div><button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className={cn("px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all", isEditingMetadata ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/20" : "bg-white/5 border border-white/10 text-white/40 hover:text-white")}>{isEditingMetadata ? 'Save & Finish' : 'Edit Definition'}</button></div><div className="space-y-12"><div className="space-y-6"><div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1">Workflow Nomenclature</label>{isEditingMetadata ? (<input className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent" value={metadata.name} onChange={e => { setMetadata({...metadata, name: e.target.value}); setIsDirty?.(true); }} />) : (<h3 className="text-[18px] font-bold text-white uppercase tracking-tight px-1 leading-tight">{metadata.name || 'Untitled'}</h3>)}</div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">PRC</label>{isEditingMetadata ? (<select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.prc} onChange={e => { setMetadata({...metadata, prc: e.target.value}); setIsDirty?.(true); }}><option value="">Select...</option>{taxonomy.filter(t => t.category === 'PRC').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>) : (<div className="bg-white/5 border border-white/5 rounded-md px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.prc || 'N/A'}</div>)}</div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Type</label>{isEditingMetadata ? (<select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[44px] text-[11px] font-black text-white outline-none" value={metadata.workflow_type} onChange={e => { setMetadata({...metadata, workflow_type: e.target.value}); setIsDirty?.(true); }}><option value="">Select...</option>{taxonomy.filter(t => t.category === 'WORKFLOW_TYPE').flatMap(t => t.cached_values || []).map((v: any) => <option key={v} value={v}>{v}</option>)}</select>) : (<div className="bg-white/5 border border-white/5 rounded-md px-4 py-2.5 text-[12px] font-black text-white uppercase">{metadata.workflow_type || 'N/A'}</div>)}</div></div></div><div className="p-6 bg-white/[0.02] border border-white/5 rounded-md space-y-6"><div className="flex items-center gap-2 mb-2"><Clock size={14} className="text-theme-accent" /><span className="text-[10px] font-black text-white uppercase tracking-widest">Operational Cadence</span></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Count</label>{isEditingMetadata ? (<input type="number" step="0.1" className="w-full bg-black/40 border border-white/10 rounded-md px-4 h-[52px] text-[24px] font-black text-white text-center outline-none" value={metadata.cadence_count} onChange={e => { setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 1}); setIsDirty?.(true); }} />) : (<div className="bg-black/40 border border-white/5 rounded-md flex items-center justify-center h-[52px] text-[24px] font-black text-white">{metadata.cadence_count}</div>)}</div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase px-1">Unit</label>{isEditingMetadata ? (<select className="w-full bg-[#1e293b] border border-white/10 rounded-md px-4 h-[52px] text-[12px] font-black text-white text-center appearance-none outline-none" value={metadata.cadence_unit} onChange={e => { setMetadata({...metadata, cadence_unit: e.target.value}); setIsDirty?.(true); }}><option value="day">PER DAY</option><option value="week">PER WEEK</option><option value="month">PER MONTH</option><option value="year">PER YEAR</option></select>) : (<div className="bg-white/5 border border-white/5 rounded-md flex items-center justify-center h-[52px] text-[12px] font-black text-white uppercase tracking-widest">PER {metadata.cadence_unit}</div>)}</div></div></div></div></div>
          )}
        </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (<ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>);
export default WrappedWorkflowBuilder;