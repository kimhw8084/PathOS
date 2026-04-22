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
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  Link2,
  Workflow as LucideWorkflow,
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

const NestedCollapsible: React.FC<{
  title: string;
  isOpen: boolean;
  toggle: () => void;
  children: React.ReactNode;
  onDelete?: () => void;
  badge?: React.ReactNode;
}> = ({ title, isOpen, toggle, children, onDelete, badge }) => (
  <div className="bg-white/[0.02] border border-white/5 rounded-md overflow-hidden group/item animate-apple-in mt-2">
    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={toggle}>
      <div className="flex items-center gap-3">
        {isOpen ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />}
        <span className={cn("text-[11px] font-black uppercase tracking-widest truncate max-w-[200px]", isOpen ? "text-white" : "text-white/40")}>
          {title || "Untitled Item"}
        </span>
        {badge}
      </div>
      {onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-status-error/20 text-white/20 hover:text-status-error transition-all rounded"
        >
          <Trash size={12} />
        </button>
      )}
    </div>
    {isOpen && <div className="p-4 border-t border-white/5 bg-black/20">{children}</div>}
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
  const titleFontSize = Math.max(20, baseFontSize + 6);
  const descFontSize = Math.max(12, titleFontSize - 6);

  if (isTemplate) {
    return (
      <div className={cn(
        "apple-glass !bg-[#0f172a]/95 !rounded-2xl px-8 py-6 shadow-2xl transition-all duration-300 group relative border-2 flex flex-col items-center justify-center min-w-[200px] h-auto hover:z-[1000]",
        selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
      )}>
        <div className={cn("absolute -top-3 left-4 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-[0.2em] border z-20 shadow-lg", isTrigger ? "bg-cyan-500 border-cyan-400 text-white" : "bg-rose-500 border-rose-400 text-white")}>
          {isTrigger ? "TRIGGER" : "OUTCOME"}
        </div>
        <div className="w-full relative flex justify-center">
          <h4 
            className="font-black text-white tracking-tighter leading-tight uppercase text-center cursor-help group/title relative"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {data.label || (isTrigger ? "START" : "END")}
            {!dragging && (
              <div className="absolute top-full left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-white/20 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 overflow-hidden text-left">
                 <div className={cn("absolute top-0 left-0 w-full h-1", isTrigger ? "bg-cyan-500" : "bg-rose-500")} />
                 <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight text-left" style={{ fontSize: `${titleFontSize + 2}px` }}>
                   {data.label || (isTrigger ? "TRIGGER" : "OUTCOME")}
                 </p>
                 <div className="flex items-center gap-3 mb-4">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest", isTrigger ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30")}>
                      {isTrigger ? "Input Origin" : "Process Termination"}
                    </span>
                 </div>
                 <p className="text-white/80 font-medium leading-relaxed italic text-left" style={{ fontSize: `${descFontSize}px` }}>{data.description || (isTrigger ? 'Initial state that activates this workflow sequence.' : 'The final deliverable or state reached upon successful completion.')}</p>
              </div>
            )}
          </h4>
        </div>
        
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
      "apple-glass !bg-[#0f172a]/95 !rounded-2xl px-7 py-6 w-[460px] shadow-2xl transition-all duration-300 relative border-2 h-auto min-h-[380px] hover:z-[1000]",
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : 'border-white/10 hover:border-white/20',
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    )}>
      {data.validation_needed && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VALIDATION REQUIRED
        </div>
      )}
      <div className="flex flex-col gap-5 h-full">
        <div className="flex items-center justify-between">
          <div className={cn("px-3 py-1 rounded-md text-[13px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2">
            {data.occurrence > 1 && (
              <div className="flex items-center gap-1.5 bg-blue-500 text-white px-3 py-1 rounded-lg text-[14px] font-black shadow-lg shadow-blue-500/20">
                <RefreshCw size={14} /> {data.occurrence}
              </div>
            )}
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1 rounded-lg text-[14px] font-black shadow-lg shadow-amber-500/20">
                <AlertCircle size={14} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-error text-white px-3 py-1 rounded-lg text-[14px] font-black shadow-lg shadow-status-error/20">
                <X size={14} /> {data.errorCount}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-1 relative">
          <h4 
            className="font-black text-white tracking-tight leading-tight hover:text-theme-accent transition-colors line-clamp-2 cursor-help overflow-visible group/title min-h-[2.4em]"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {data.label || "Untitled Task"}
            {!dragging && (
              <div className="absolute top-full left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-theme-accent/50 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10">
                 <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight text-left" style={{ fontSize: `${titleFontSize + 2}px` }}>{data.label}</p>
                 <p className="text-white/80 font-medium leading-relaxed italic text-left" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
              </div>
            )}
          </h4>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-1">Manual</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-1">Machine</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-white/5">
             <div className="flex items-center gap-6 flex-1 justify-center">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black text-white/20 uppercase tracking-widest">Input</span>
                 <span className="text-[20px] font-black text-white leading-none">{data.sourceCount || 0}</span>
               </div>
               <div className="w-px h-8 bg-white/5" />
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black text-white/20 uppercase tracking-widest">Output</span>
                 <span className="text-[20px] font-black text-white leading-none">{data.outputCount || 0}</span>
               </div>
             </div>
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                   <span className="text-[13px] font-black text-white/60 uppercase truncate max-w-[120px]">{(data.ownerPositions || [])[0] || 'Unassigned'}</span>
                   {(data.ownerPositions || []).length > 1 && (
                     <span className="text-[11px] font-black text-theme-accent">+{(data.ownerPositions || []).length - 1}</span>
                   )}
                </div>
                {data.owningTeam && (
                  <span className="text-[11px] font-black text-theme-accent/60 uppercase tracking-widest leading-none mt-1">{data.owningTeam}</span>
                )}
             </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-white/5 min-h-[42px]">
             {visibleSystemBadges.map((s: string, i: number) => (
               <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[12px] font-bold text-white/40 uppercase">{s}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[12px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
             )}
             {systemBadges.length === 0 && (
               <span className="text-[11px] font-black text-white/10 uppercase tracking-widest">No Systems</span>
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
    <div className={cn("relative w-[280px] h-[280px] flex items-center justify-center transition-all duration-300 hover:z-[1000]", selected ? 'scale-105 z-50' : 'z-10')}>
      <div className={cn("absolute w-[197.99px] h-[197.99px] rotate-45 border-2 transition-all duration-300 bg-[#0f172a]/95", selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20', data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : '', "rounded-sm")} />
      
      {/* Handles at lower z-index than tooltip container */}
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-20 opacity-0" />

      <div className="relative z-40 flex flex-col items-center justify-center p-8 w-full h-full pointer-events-none">
        <span 
          className="font-bold text-white text-center leading-tight break-words max-w-[180px] line-clamp-3 overflow-visible cursor-help hover:text-amber-400 transition-colors group/title pointer-events-auto relative"
          style={{ fontSize: `${titleFontSize}px` }}
        >
          {data.label || "Condition"}
          {!dragging && (
            <div className="absolute top-[85%] left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-amber-400/50 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 text-left">
               <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight" style={{ fontSize: `${titleFontSize - 4}px` }}>{data.label || 'Condition'}</p>
               <p className="text-white/80 font-medium leading-relaxed italic" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
            </div>
          )}
        </span>
      </div>
    {data.validation_needed && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120px] px-1.5 py-0.5 rounded-sm text-[6px] font-black uppercase bg-orange-500 border border-orange-400 text-white z-30 shadow-lg animate-pulse">VALID</div>
    )}
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
    // Safety check for NaN or undefined coordinates
    if (![sourceX, sourceY, targetX, targetY].every(v => typeof v === 'number' && !isNaN(v))) {
      console.warn("[CustomEdge] Invalid coordinates detected:", { sourceX, sourceY, targetX, targetY });
      return ['', 0, 0];
    }

    if (data?.edgeStyle === 'smoothstep') {
      const radius = 20;
      let path = `M ${sourceX},${sourceY}`;
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const midX = sourceX + dx / 2;
      
      // Prevent crazy paths if too close
      if (Math.abs(dx) < 40) {
         return [`M ${sourceX},${sourceY} L ${targetX},${targetY}`, midX, sourceY + dy / 2];
      }

      path += ` L ${midX - radius},${sourceY} Q ${midX},${sourceY} ${midX},${sourceY + (dy > 0 ? radius : -radius)} L ${midX},${targetY - (dy > 0 ? radius : -radius)} Q ${midX},${targetY} ${midX + radius},${targetY} L ${targetX},${targetY}`;
      return [path, midX, sourceY + dy / 2];
    } else if (data?.edgeStyle === 'straight') {
      return [`M ${sourceX},${sourceY} L ${targetX},${targetY}`, (sourceX + targetX) / 2, (sourceY + targetY) / 2];
    }
    const cx = (sourceX + targetX) / 2;
    return [`M ${sourceX},${sourceY} C ${cx},${sourceY} ${cx},${targetY} ${targetX},${targetY}`, cx, (sourceY + targetY) / 2];
  }, [sourceX, sourceY, targetX, targetY, data?.edgeStyle]);

  if (!edgePath) return null;

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
  const { project, fitView, getNodes, getEdges } = useReactFlow();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'data' | 'exceptions' | 'validation' | 'appendix'>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [baseFontSize] = useState(14);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: false, outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const toggleItem = (itemId: string) => { setOpenItems(prev => ({ ...prev, [itemId]: !prev[itemId] })); };

  const [isAppendixFocused, setIsAppendixFocused] = useState(false);

  const [metadata] = useState<WorkflowMetadata>({
    name: workflow?.name || '', version: workflow?.version || 1, prc: workflow?.prc || '', workflow_type: workflow?.workflow_type || '', tool_family: workflow?.tool_family || '', tool_family_count: workflow?.tool_family_count || 1, tool_id: workflow?.tool_id || '', trigger_type: workflow?.trigger_type || '', trigger_description: workflow?.trigger_description || '', output_type: workflow?.output_type || '', output_description: workflow?.output_description || '', cadence_count: workflow?.cadence_count || 1, cadence_unit: workflow?.cadence_unit || 'month', total_roi_saved_hours: workflow?.total_roi_saved_hours || 0, org: workflow?.org || '', team: workflow?.team || '', poc: workflow?.poc || '', flow_summary: workflow?.flow_summary || '', description: workflow?.description || workflow?.forensic_description || ''
  });

  const [tasks, setTasks] = useState<TaskEntity[]>([]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface_type === 'TRIGGER' || selectedTask?.interface_type === 'OUTCOME';

  const taskTypes = useMemo(() => {
    const fromTaxonomy = taxonomy.find(t => t.category === 'TASK_TYPE');
    if (fromTaxonomy && (fromTaxonomy as any).cached_values) return (fromTaxonomy as any).cached_values;
    return ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];
  }, [taxonomy]);

  const handleLayout = useCallback((nodesToLayout?: Node[], edgesToLayout?: Edge[]) => {
    try {
      const nds = nodesToLayout || getNodes();
      const eds = edgesToLayout || getEdges();
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
        dagreGraph.setNode(n.id, { width: isDiamond ? 280 : (isTemplate ? 260 : 460), height: isTemplate ? 160 : (isDiamond ? 280 : 440) });
      });

      // Add actual edges
      eds.forEach((e) => {
        if (dagreGraph.hasNode(e.source) && dagreGraph.hasNode(e.target)) {
          dagreGraph.setEdge(e.source, e.target);
        }
      });

      // Force horizontal distribution for unconnected nodes by adding dummy sequential edges
      // This ensures Trigger is left, Outcome is right, and others are in the middle
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const sourceId = sortedNodes[i].id;
        const targetId = sortedNodes[i+1].id;
        // Add dummy low-weight edge to encourage horizontal flow for unconnected components
        dagreGraph.setEdge(sourceId, targetId, { weight: 0.001, minlen: 1 });
      }

      dagre.layout(dagreGraph);

      const layoutedNodes = sortedNodes.map(n => {
        const nodeWithPos = dagreGraph.node(n.id);
        if (!nodeWithPos) return n;
        const isDiamond = n.type === 'diamond';
        const isTemplate = n.data?.interface === 'TRIGGER' || n.data?.interface === 'OUTCOME';
        
        return {
          ...n,
          position: {
            x: Math.round((nodeWithPos.x - (isDiamond ? 140 : (isTemplate ? 130 : 230))) / 10) * 10,
            y: Math.round((nodeWithPos.y - (isTemplate ? 80 : (isDiamond ? 140 : 220))) / 10) * 10
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
    console.log("[WorkflowBuilder] Syncing with workflow state:", workflow.id, "Tasks:", workflow.tasks?.length);

    try {
      const seenIds = new Set<string>();
      let initializedTasks = (workflow?.tasks || []).map((t: any) => {
        // Ensure we use node_id as the primary identifier for React Flow stability
        let stableId = String(t.node_id || t.id || `node-${Math.random().toString(36).substr(2, 9)}`);
        
        // Prevent ID collisions which cause React Flow to crash
        if (seenIds.has(stableId)) {
          stableId = `${stableId}-dup-${Math.random().toString(36).substr(2, 9)}`;
        }
        seenIds.add(stableId);
        
        return {
          ...t,
          id: stableId,
          node_id: stableId,
          target_systems: Array.isArray(t.target_systems) ? t.target_systems : [],
          blockers: Array.isArray(t.blockers) ? t.blockers : [],
          errors: Array.isArray(t.errors) ? t.errors : [],
          media: Array.isArray(t.media) ? t.media : [],
          reference_links: Array.isArray(t.reference_links) ? t.reference_links : [],
          instructions: Array.isArray(t.instructions) ? t.instructions : [],
          source_data_list: Array.isArray(t.source_data_list) ? t.source_data_list : [],
          output_data_list: Array.isArray(t.output_data_list) ? t.output_data_list : [],
          verification_steps: Array.isArray(t.verification_steps) ? t.verification_steps : [],
          tribal_knowledge: Array.isArray(t.tribal_knowledge) ? t.tribal_knowledge : [],
          occurrence: t.occurrence || t.occurrences_per_cycle || 1,
          manual_time_minutes: t.manual_time_minutes || 0,
          automation_time_minutes: t.automation_time_minutes || 0,
          machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
        };
      });

      // Ensure boundary nodes exist
      if (!initializedTasks.find((t: any) => t.interface === 'TRIGGER')) {
        initializedTasks.unshift({
          id: 'node-trigger', node_id: 'node-trigger', name: 'START', description: '', task_type: 'TRIGGER', interface: 'TRIGGER', interface_type: 'TRIGGER', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: []
        });
      }
      if (!initializedTasks.find((t: any) => t.interface === 'OUTCOME')) {
        initializedTasks.push({
          id: 'node-outcome', node_id: 'node-outcome', name: 'END', description: '', task_type: 'OUTCOME', interface: 'OUTCOME', interface_type: 'OUTCOME', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: []
        });
      }

      setTasks(initializedTasks);
      
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
          systems: (t.target_systems || []).map((s: any) => s.name || s).join(', '), 
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
          baseFontSize: 14
        },
      }));

      const initialEdges: Edge[] = (workflow?.edges || []).map((e: any, idx: number) => {
        const sourceId = String(e.source || '');
        const targetId = String(e.target || '');
        if (!sourceId || !targetId) return null;
        
        // Verify source and target nodes exist before creating edge
        if (!initializedTasks.some((t: any) => String(t.node_id || t.id) === sourceId) || 
            !initializedTasks.some((t: any) => String(t.node_id || t.id) === targetId)) {
          console.warn(`[WorkflowBuilder] Dropping edge ${idx} - missing endpoint node`, { sourceId, targetId });
          return null;
        }

        let sHandle = e.source_handle || e.sourceHandle || 'right-source';
        let tHandle = e.target_handle || e.targetHandle || 'left-target';
        
        return {
          ...e, 
          id: String(e.id || `e-${sourceId}-${targetId}-${idx}`), 
          source: sourceId, 
          target: targetId, 
          sourceHandle: sHandle, 
          targetHandle: tHandle, 
          type: 'custom', 
          data: { 
            label: e.label || '', 
            edgeStyle: e.edge_style || e.edgeStyle || 'bezier', 
            color: e.color || '#ffffff', 
            style: e.style || 'solid' 
          }, 
          markerEnd: { type: MarkerType.ArrowClosed, color: e.color || '#ffffff' },
        };
      }).filter(Boolean);

      setNodes(initialNodes);
      setEdges(initialEdges);

      // Only auto-layout if no positions are saved
      if (initializedTasks.every((t: any) => !t.position_x && !t.position_y)) {
        setTimeout(() => handleLayout(initialNodes, initialEdges), 100);
      }
    } catch (err) {
      console.error("[WorkflowBuilder] Critical Initialization Failure:", err);
    }
  }, [workflow, handleLayout, setNodes, setEdges]);

  const handleImagePaste = useCallback((e: React.ClipboardEvent, instructionId?: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && selectedTaskId) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target?.result as string;
            if (instructionId) {
              updateTask(selectedTaskId, {
                instructions: (selectedTask?.instructions || []).map(s => s.id === instructionId ? { ...s, image: dataUrl } : s)
              });
            } else {
              const newMedia: TaskMedia = { id: Date.now().toString(), type: 'image', url: dataUrl, label: 'Pasted Image' };
              updateTask(selectedTaskId, {
                media: [...(selectedTask?.media || []), newMedia]
              });
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [selectedTaskId, selectedTask]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: updated.name, task_type: updated.task_type, manual_time: updated.manual_time_minutes, automation_time: updated.automation_time_minutes, occurrence: updated.occurrence, systems: (updated.target_systems || []).map((s:any) => s.name || s).join(', '), owningTeam: updated.owning_team, ownerPositions: updated.owner_positions, sourceCount: (updated.source_data_list || []).length, outputCount: (updated.output_data_list || []).length, validation_needed: updated.validation_needed, blockerCount: (updated.blockers || []).length, errorCount: (updated.errors || []).length, description: updated.description } } : n));
        return updated;
      }
      return t;
    }));
    setIsDirty?.(true);
  };

  const handleSave = () => {
    console.log("[WorkflowBuilder] handleSave initiated. Tasks:", tasks.length, "Edges:", edges.length);
    if (tasks.length === 0) return;
    
    try {
      // Validate IDs before sending to backend to prevent sync corruption
      const finalData = {
        ...metadata,
        tasks: tasks.map(t => {
          const node = nodes.find(n => String(n.id) === String(t.id));
          return { 
            ...t, 
            id: undefined, // Let backend assign primary key
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
      console.error("[WorkflowBuilder] Failed to prepare save data:", err);
    }
  };

  const updateEdge = (id: string, updates: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates }, markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } } : e));
    setIsDirty?.(true);
  };

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    const newEdge: Edge = { ...params, id: `e-${params.source}-${params.target}-${Date.now()}`, type: 'custom', data: { label: '', edgeStyle: 'bezier', color: '#ffffff', style: 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, source: params.source, target: params.target };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const deleteTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setIsDirty?.(true);
  }, [tasks, setNodes, setEdges, setIsDirty]);

  const onAddNode = (type: 'TASK' | 'CONDITION') => {
    const id = `node-${Date.now()}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    const newNode: Node = { id, type: type === 'CONDITION' ? 'diamond' : 'matrix', position: { x: Math.round((center.x - 160) / 10) * 10, y: Math.round((center.y - 140) / 10) * 10 }, data: { label: type === 'TASK' ? 'New Task' : 'New Condition', task_type: type === 'TASK' ? 'Documentation' : 'LOOP', manual_time: 0, automation_time: 0, occurrence: 1, systems: '', validation_needed: false, blockerCount: 0, errorCount: 0, baseFontSize } };
    const newTask: TaskEntity = { id, node_id: id, name: newNode.data.label, description: '', task_type: newNode.data.task_type, target_systems: [], interface_type: type === 'TASK' ? 'GUI' : 'CONDITION', manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, occurrence: 1, occurrence_explanation: '', source_data_list: [], output_data_list: [], verification_steps: [], blockers: [], errors: [], tribal_knowledge: [], validation_needed: false, validation_procedure: '', media: [], reference_links: [], instructions: [] };
    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX; const startWidth = inspectorWidth;
    const handleMouseMove = (mv: MouseEvent) => setInspectorWidth(Math.max(300, Math.min(800, startWidth - (mv.pageX - startX))));
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
            <button onClick={() => onBack(metadata)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
            <div className="flex flex-col"><span className="text-[10px] font-black text-theme-accent uppercase tracking-widest mb-1">Workflow Builder</span><h1 className="text-[14px] font-black text-white uppercase truncate max-w-[300px]">{workflow?.name}</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleLayout()} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-theme-accent/20 hover:scale-[1.02] transition-all"><Save size={14} /> Commit Changes</button>
            <button onClick={onExit} className="p-2 text-white/20 hover:text-status-error"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 relative">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={(_, n) => { setSelectedTaskId(n.id); setSelectedEdgeId(null); }} onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }} fitView snapToGrid snapGrid={[10, 10]} connectionMode={ConnectionMode.Loose} connectionLineType={ConnectionLineType.SmoothStep} className="react-flow-industrial"><Background color="#1e293b" gap={30} size={1} /><Controls className="!bg-[#0a1120] !border-white/10 !rounded-xl overflow-hidden" /></ReactFlow>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl"><button onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Task</button><button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Condition</button></div>
        </div>
      </div>

      <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70]" style={{ width: `${inspectorWidth}px` }}>
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent z-50" />
        <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
          {[ { id: 'overview', label: 'Overview', icon: <Activity size={12} /> }, { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: isProtected }, { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: isProtected }, { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: isProtected }, { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: isProtected } ].filter(t => !t.hidden && (selectedTaskId || t.id === 'overview')).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white')}>{t.icon}<span className="text-[8px] font-black uppercase">{t.label}</span></button>
          ))}
          {selectedEdgeId && (<div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white"><Link2 size={12} /><span className="text-[8px] font-black uppercase">Edge</span></div>)}
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar p-6">
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              {inspectorTab === 'overview' && (
                <div className="space-y-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Nomenclature</label><input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent" value={selectedTask.name} onChange={e => updateTask(selectedTaskId, { name: e.target.value })} /></div>
                  {!isProtected && (
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Logic Type</label><select className="w-full bg-white/5 border border-white/10 rounded-md px-3 h-11 text-[11px] font-black text-white outline-none" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId, { task_type: e.target.value })}>{taskTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}</select></div><div className="space-y-2"><label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Interface Mode</label><select className="w-full bg-white/5 border border-white/10 rounded-md px-3 h-11 text-[11px] font-black text-white outline-none" value={selectedTask.interface_type} onChange={e => updateTask(selectedTaskId, { interface_type: e.target.value })}><option value="GUI">GUI INTERACTION</option><option value="CLI">CLI / TERMINAL</option><option value="API">API CALL</option></select></div></div>
                  )}
                  <div className="space-y-2"><label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Contextual Description</label><textarea className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-medium text-white/60 outline-none focus:border-theme-accent h-32 resize-none" value={selectedTask.description} onChange={e => updateTask(selectedTaskId, { description: e.target.value })} /></div>
                  {!isProtected && (
                    <div className="pt-6 border-t border-white/5"><button onClick={() => deleteTask(selectedTaskId)} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-md text-[10px] font-black uppercase hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2"><Trash size={12} /> Delete Entity</button></div>
                  )}
                </div>
              )}
              {inspectorTab === 'data' && (
                <div className="space-y-8">
                  <CollapsibleSection title="Input Data (Sources)" isOpen={expandedSections.inputs} toggle={() => toggleSection('inputs')} count={selectedTask.source_data_list.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.source_data_list.map((sd) => (
                        <NestedCollapsible key={sd.id} title={sd.name || "New Source"} isOpen={openItems[sd.id]} toggle={() => toggleItem(sd.id)} onDelete={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Source Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={sd.name} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., FDC Log, SPC Chart" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Retrieval Method</label>
                              <select className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[11px] font-bold text-white outline-none" value={sd.is_manual ? 'Manual' : 'Automated'} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, is_manual: e.target.value === 'Manual' } : x) })}>
                                <option value="Manual">MANUAL DOWNLOAD/EXTRACT</option>
                                <option value="Automated">SYSTEM AUTOMATED</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Field Requirements / Details</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none" value={sd.description} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} placeholder="What specific columns or values are needed?" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', is_manual: true }] })} className="w-full py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Source Entity</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Output Artifacts" isOpen={expandedSections.outputs} toggle={() => toggleSection('outputs')} count={selectedTask.output_data_list.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.output_data_list.map((od) => (
                        <NestedCollapsible key={od.id} title={od.name || "New Artifact"} isOpen={openItems[od.id]} toggle={() => toggleItem(od.id)} onDelete={() => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Artifact Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={od.name} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., Final Report, Updated DB Entry" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Output Fields / format</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none" value={od.description} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the output structure..." />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '' }] })} className="w-full py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Output Artifact</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
              {inspectorTab === 'exceptions' && (
                <div className="space-y-8">
                  <CollapsibleSection title="Process Blockers" isOpen={expandedSections.blockers} toggle={() => toggleSection('blockers')} count={selectedTask.blockers.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.blockers.map((b) => (
                        <NestedCollapsible key={b.id} title={b.blocking_entity || "New Blocker"} isOpen={openItems[b.id]} toggle={() => toggleItem(b.id)} onDelete={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Blocking Entity / System *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-amber-500 outline-none focus:border-amber-500" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} placeholder="Who or what stops the process?" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Avg Delay (min)</label>
                                <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={b.average_delay_minutes || 0} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Probability (%)</label>
                                <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={b.probability_percent || 0} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, probability_percent: parseFloat(e.target.value) || 0 } : x) })} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Reason / Mitigation</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} placeholder="Why does this happen and how is it resolved?" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', average_delay_minutes: 0, probability_percent: 0, standard_mitigation: '' }] })} className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase text-amber-500 hover:bg-amber-500/20 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Process Blocker</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Expected Errors" isOpen={expandedSections.errors} toggle={() => toggleSection('errors')} count={selectedTask.errors.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.errors.map((er) => (
                        <NestedCollapsible key={er.id} title={er.error_type || "New Error"} isOpen={openItems[er.id]} toggle={() => toggleItem(er.id)} onDelete={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== er.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Error Type / Code *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-status-error outline-none focus:border-status-error" value={er.error_type} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, error_type: e.target.value } : x) })} placeholder="e.g., Database Timeout, Invalid Format" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Recovery (min)</label>
                                <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={er.recovery_time_minutes || 0} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Probability (%)</label>
                                <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={er.probability_percent || 0} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, probability_percent: parseFloat(e.target.value) || 0 } : x) })} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Correction Method</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none" value={er.description} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, description: e.target.value } : x) })} placeholder="How is this error corrected?" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', recovery_time_minutes: 0, probability_percent: 0 }] })} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-[10px] font-black uppercase text-status-error hover:bg-status-error/20 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Failure Mode</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Tribal Knowledge" isOpen={expandedSections.tribal} toggle={() => toggleSection('tribal')} count={selectedTask.tribal_knowledge.length} icon={<Brain size={12} className="text-purple-400" />}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.tribal_knowledge.map((tk) => (
                        <NestedCollapsible key={tk.id} title={tk.knowledge || "New Insight"} isOpen={openItems[tk.id]} toggle={() => toggleItem(tk.id)} onDelete={() => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.filter(x => x.id !== tk.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Insight / Secret Sauce *</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white h-24 resize-none outline-none focus:border-purple-500" value={tk.knowledge} onChange={e => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} placeholder="What do experienced people know that others don't?" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Captured From</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[11px] text-white/60" value={tk.captured_from} onChange={e => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, captured_from: e.target.value } : x) })} placeholder="Source person or role" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { tribal_knowledge: [...selectedTask.tribal_knowledge, { id: Date.now().toString(), knowledge: '', captured_from: '' }] })} className="w-full py-3 bg-purple-500/10 border border-purple-500/20 text-[10px] font-black uppercase text-purple-500 hover:bg-purple-500/20 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Tribal Insight</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}

              {inspectorTab === 'validation' && (
                <div className="space-y-8 animate-apple-in">
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-md space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1"><h3 className="text-[14px] font-black text-white uppercase tracking-tight">Validation</h3><p className="text-[10px] text-white/40 font-bold">Verification required?</p></div>
                      <button onClick={() => updateTask(selectedTaskId, { validation_needed: !selectedTask.validation_needed })} className={cn("relative w-12 h-6 rounded-full transition-all duration-300", selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10")}><div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1")} /></button>
                    </div>
                    {selectedTask.validation_needed && (
                      <div className="space-y-4 animate-apple-in pt-4 border-t border-white/5">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Procedure</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-md p-4 text-[13px] font-mono text-white/80 outline-none h-64 resize-none leading-relaxed" value={selectedTask.validation_procedure} onChange={e => updateTask(selectedTaskId, { validation_procedure: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {inspectorTab === 'appendix' && (
                <div className="space-y-12">
                  <CollapsibleSection title="Internal Reference Links" isOpen={expandedSections.references} toggle={() => toggleSection('references')} count={selectedTask.reference_links.length}>
                    <div className="space-y-1 pt-4">
                      {selectedTask.reference_links.map(l => (
                        <NestedCollapsible key={l.id} title={l.label || "New Link"} isOpen={openItems[l.id]} toggle={() => toggleItem(l.id)} onDelete={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== l.id) })}>
                          <input className="w-full bg-black/40 border border-white/10 rounded p-2 text-[11px] text-white mb-2" value={l.label} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) })} placeholder="Label" />
                          <input className="w-full bg-black/40 border border-white/10 rounded p-2 text-[10px] text-theme-accent" value={l.url} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x) })} placeholder="URL" />
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} className="w-full py-2 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/20 hover:text-white mt-4">+ Add Link</button>
                    </div>
                  </CollapsibleSection>
                  <CollapsibleSection title="Global Visual Assets" isOpen={expandedSections.assets} toggle={() => toggleSection('assets')} count={selectedTask.media.length}>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      {selectedTask.media.map(m => (
                        <div key={m.id} className="aspect-video bg-black rounded border border-white/10 relative group overflow-hidden">
                          <img src={m.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" alt={m.label} />
                          <button onClick={() => updateTask(selectedTaskId, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="absolute top-1 right-1 p-1 bg-status-error text-white rounded opacity-0 group-hover:opacity-100"><Trash size={10} /></button>
                        </div>
                      ))}
                      <div tabIndex={0} onFocus={() => setIsAppendixFocused(true)} onBlur={() => setIsAppendixFocused(false)} onPaste={(e) => handleImagePaste(e)} className={cn("aspect-video border-2 border-dashed flex flex-col items-center justify-center bg-white/[0.02] cursor-pointer group transition-all outline-none", isAppendixFocused ? "border-theme-accent" : "border-white/10 hover:border-theme-accent")}>
                        <Copy size={16} className={cn("mb-2 transition-all", isAppendixFocused ? "text-theme-accent scale-110" : "text-white/20 group-hover:text-theme-accent")} />
                        <span className="text-[10px] font-bold text-white/40 uppercase">Paste Asset</span>
                      </div>
                    </div>
                  </CollapsibleSection>
                  <CollapsibleSection title="Step-by-Step Instructions" isOpen={expandedSections.instructions} toggle={() => toggleSection('instructions')} count={selectedTask.instructions.length}>
                    <div className="space-y-4 pt-4">
                      {selectedTask.instructions.map((step, idx) => (
                        <div key={step.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl group relative">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest">Step {idx + 1}</span>
                            <button onClick={() => updateTask(selectedTaskId, { instructions: selectedTask.instructions.filter(x => x.id !== step.id) })} className="text-white/10 hover:text-status-error opacity-0 group-hover:opacity-100"><Trash size={12} /></button>
                          </div>
                          <div className="space-y-3">
                            <textarea 
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/80 h-28 resize-none outline-none focus:border-theme-accent transition-all" 
                              value={step.description} 
                              onPaste={(e) => handleImagePaste(e, step.id)}
                              onChange={e => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                              placeholder="Describe the action... (Tip: Paste image here)"
                            />
                            
                            {!step.image ? (
                              <div 
                                onClick={() => {
                                  // Focus the textarea to allow pasting
                                  const el = document.activeElement as HTMLElement;
                                  if (el) el.blur();
                                }}
                                onPaste={(e) => handleImagePaste(e, step.id)}
                                tabIndex={0}
                                className="w-full aspect-video border-2 border-dashed border-white/5 rounded-xl bg-white/[0.02] flex flex-col items-center justify-center group hover:border-theme-accent hover:bg-theme-accent/5 transition-all cursor-pointer outline-none focus:border-theme-accent"
                              >
                                <Paperclip size={20} className="text-white/10 group-hover:text-theme-accent mb-2 transition-all" />
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest group-hover:text-theme-accent transition-all">Click & Paste Step Image</span>
                              </div>
                            ) : (
                              <div className="aspect-video rounded-xl border border-white/10 overflow-hidden relative group shadow-2xl">
                                <img src={step.image} className="w-full h-full object-cover" alt="Step Instruction" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                                   <button onClick={() => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, image: undefined } : x) })} className="p-2 bg-status-error text-white rounded-lg shadow-xl hover:scale-110 transition-all"><Trash size={16} /></button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id: Date.now().toString(), description: '', links: [] }] })} className="w-full py-3 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-theme-accent transition-all">+ Add Instruction Step</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="p-6 space-y-10 animate-apple-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Edge Configuration</span></div>
                <div className="flex gap-2">
                  <button onClick={() => swapEdgeDirection(selectedEdgeId)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-md transition-all"><LucideWorkflow size={16} className="rotate-90" /></button>
                  <button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-md transition-all"><Trash size={16} /></button>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Style</label>
                  <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                    {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                      <button key={s} onClick={() => updateEdge(selectedEdgeId, { edgeStyle: s })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Color Palette</label>
                  <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => (
                      <button key={c} onClick={() => updateEdge(selectedEdgeId, { color: c })} className={cn("w-6 h-6 rounded-full border transition-all", (selectedEdge.data?.color || '#ffffff') === c ? "border-white scale-125" : "border-transparent hover:scale-110")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-apple-in">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <LucideWorkflow className="text-theme-accent" size={18} />
                <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Workflow Definition</h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Workflow Nomenclature</label>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[16px] font-bold text-white uppercase">{metadata.name || 'Untitled'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">PRC</label>
                    <div className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-[12px] font-bold text-white uppercase">{metadata.prc || 'N/A'}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Org / Team</label>
                    <div className="bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-[12px] font-bold text-white uppercase">{metadata.org} / {metadata.team}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Description</label>
                  <p className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-[13px] text-white/60 font-medium leading-relaxed italic">{metadata.description || 'No description provided.'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (<ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>);
export default WrappedWorkflowBuilder;
