import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
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
  getSmoothStepPath,
  getStraightPath,
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
  Search,
  Paperclip,
  Cpu,
  Edit3
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchableSelect } from './IntakeGatekeeper';

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
  figures: string[];
  links: string[];
}

interface TaskSystem {
  id: string;
  name: string;
  usage: string;
  figures: string[];
  link: string;
}

interface DataItem {
  id: string;
  name: string;
  description: string;
  figures: string[];
  link: string;
  data_example: string;
  from_task_id?: string;
  from_task_name?: string;
}

interface ValidationStep {
  id: string;
  description: string;
  figures: string[];
}

interface TaskEntity {
  id: string;
  node_id?: string;
  name: string;
  description: string;
  task_type: string;
  involved_systems: TaskSystem[];
  interface?: 'TRIGGER' | 'OUTCOME';
  manual_time_minutes: number;
  automation_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrence: number;
  occurrence_explanation: string;
  source_data_list: DataItem[];
  output_data_list: DataItem[];
  manual_inputs: string[];
  manual_outputs: string[];
  verification_steps: any[];
  blockers: any[];
  errors: any[];
  tribal_knowledge: string[];
  validation_needed: boolean;
  validation_procedure_steps: ValidationStep[];
  media: TaskMedia[];
  reference_links: TaskReference[];
  instructions: TaskInstruction[];
  position_x?: number;
  position_y?: number;
  owning_team?: string;
  owner_positions?: string[];
}

const ManagedListSection: React.FC<{
  title: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  toggle: () => void;
}> = ({ title, items, onUpdate, placeholder, icon, isOpen, toggle }) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  return (
    <CollapsibleSection title={title} count={items.length} isOpen={isOpen} toggle={toggle} icon={icon}>
      <div className="space-y-3 pt-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 group relative">
            {editingIdx === idx ? (
              <div className="space-y-2 animate-apple-in">
                <textarea 
                  autoFocus
                  className="w-full bg-black/40 border border-theme-accent rounded-lg p-3 text-[12px] text-white outline-none min-h-[80px]"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (editVal.trim()) {
                        const newItems = [...items];
                        newItems[idx] = editVal.trim();
                        onUpdate(newItems);
                        setEditingIdx(null);
                      }
                    }}
                    className="flex-1 py-1.5 bg-theme-accent text-white text-[9px] font-black uppercase rounded-lg"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => setEditingIdx(null)}
                    className="px-4 py-1.5 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <p className="text-[12px] text-white/80 font-medium leading-relaxed flex-1">{item}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button 
                    onClick={() => { setEditingIdx(idx); setEditVal(item); }}
                    className="p-1.5 hover:bg-theme-accent/20 text-white/40 hover:text-theme-accent rounded-md transition-all"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    onClick={() => onUpdate(items.filter((_, i) => i !== idx))}
                    className="p-1.5 hover:bg-status-error/20 text-white/40 hover:text-status-error rounded-md transition-all"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingIdx === -1 ? (
          <div className="bg-white/[0.02] border border-theme-accent rounded-xl p-3 space-y-2 animate-apple-in">
            <textarea 
              autoFocus
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none min-h-[80px] focus:border-theme-accent"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              placeholder={placeholder || "Enter details..."}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (editVal.trim()) {
                    onUpdate([...items, editVal.trim()]);
                    setEditingIdx(null);
                    setEditVal('');
                  }
                }}
                className="flex-1 py-1.5 bg-theme-accent text-white text-[9px] font-black uppercase rounded-lg"
              >
                Add Entry
              </button>
              <button 
                onClick={() => { setEditingIdx(null); setEditVal(''); }}
                className="px-4 py-1.5 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => { setEditingIdx(-1); setEditVal(''); }}
            className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-theme-accent transition-all rounded-xl"
          >
            + Add {title.replace(/s$/, '')}
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
};

interface WorkflowMetadata {
  name: string;
  version: number;
  description: string;
  prc: string;
  workflow_type: string;
  tool_family: string[];
  applicable_tools: string[];
  trigger_type: string;
  trigger_description: string;
  output_type: string;
  output_description: string;
  cadence_count: number;
  cadence_unit: string;
  repeatability_check?: boolean;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  templates?: any[];
  relatedWorkflows?: any[];
  insights?: any;
  policyOverlay?: any;
  rollbackPreview?: any;
  runtimeConfig?: any;
  onSave: (data: any) => void;
  onBack: (metadata: any) => void;
  onExit: () => void;
  onCreateRollbackDraft?: () => void;
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
  isLocked?: boolean;
}> = ({ title, isOpen, toggle, children, onDelete, badge, isLocked }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden group/item animate-apple-in mt-2">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={toggle}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isOpen ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />}
          <span className={cn("text-[11px] font-black uppercase tracking-widest truncate", isOpen ? "text-white" : "text-white/40")}>
            {title || "Untitled Item"}
          </span>
          {isLocked && <Link2 size={10} className="text-theme-accent" />}
          {badge}
        </div>
        {onDelete && !isLocked && (
          <div className="flex items-center gap-2">
            {isConfirming ? (
              <div className="flex items-center gap-1 bg-status-error/20 rounded-lg p-1 animate-apple-in">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsConfirming(false); onDelete(); }}
                  className="px-2 py-1 bg-status-error text-white text-[8px] font-black uppercase rounded-md"
                >
                  Confirm
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
                  className="px-2 py-1 text-white/40 text-[8px] font-black uppercase"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} 
                className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-status-error/20 text-white/20 hover:text-status-error transition-all rounded-lg"
              >
                <Trash size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      {isOpen && <div className="p-4 border-t border-white/5 bg-black/20">{children}</div>}
    </div>
  );
};

const ImagePasteField: React.FC<{
  figures: string[];
  onPaste: (figures: string[]) => void;
  label?: string;
  isLocked?: boolean;
}> = ({ figures, onPaste, label, isLocked }) => {
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isLocked) return;
    const items = e.clipboardData.items;
    const newFigures = [...figures];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            newFigures.push(evt.target?.result as string);
            onPaste(newFigures);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">{label}</label>}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 h-20">
        {figures.map((fig, idx) => (
          <div key={idx} className="flex-shrink-0 w-24 h-full rounded-xl border border-white/10 overflow-hidden relative group bg-black/40">
            <img src={fig} className="w-full h-full object-cover" />
            {!isLocked && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all p-2">
                <button 
                  onClick={() => {
                    onPaste(figures.filter((_, i) => i !== idx));
                  }}
                  className="w-full h-full bg-status-error/80 text-white rounded-lg flex items-center justify-center hover:bg-status-error transition-colors"
                >
                  <Trash size={12} />
                </button>
              </div>
            )}

          </div>
        ))}
        {!isLocked && (
          <div 
            onPaste={handlePaste}
            tabIndex={0}
            className="flex-shrink-0 w-24 h-full border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-white/20 hover:text-white hover:border-theme-accent transition-all cursor-pointer outline-none focus:border-theme-accent bg-black/20"
          >
            <Plus size={14} />
            <span className="text-[7px] font-black uppercase mt-1">Paste</span>
          </div>
        )}
        {isLocked && figures.length === 0 && (
          <div className="flex-shrink-0 w-full h-full border border-white/5 rounded-xl flex items-center justify-center text-white/5 italic text-[10px]">No Figures</div>
        )}
      </div>
    </div>
  );
};

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
            {data.label}
            {!dragging && (
              <div className="absolute top-full left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-white/20 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 overflow-hidden text-left">
                 <div className={cn("absolute top-0 left-0 w-full h-1", isTrigger ? "bg-cyan-500" : "bg-rose-500")} />
                 <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight text-left" style={{ fontSize: `${titleFontSize + 2}px` }}>
                   {data.label}
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

  const involvedSystems: TaskSystem[] = data.involved_systems || [];
  const visibleSystems = involvedSystems.slice(0, 3);
  const hiddenSystemsCount = involvedSystems.length - visibleSystems.length;

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
            className="font-black text-white tracking-tight leading-tight hover:text-theme-accent transition-colors line-clamp-2 cursor-help overflow-hidden group/title min-h-[2.4em]"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {data.label || "Untitled Task"}
            {!dragging && (
              <div className="absolute top-full left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-theme-accent/50 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 overflow-hidden text-left">
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
             {visibleSystems.map((s: TaskSystem, i: number) => (
               <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[12px] font-bold text-white/40 uppercase">{s.name}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[12px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
             )}
             {involvedSystems.length === 0 && (
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
      <div className={cn("absolute w-[197.99px] h-[197.99px] rotate-45 border-2 transition-all duration-300 bg-[#0f172a]/95 rounded-2xl", selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20', data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : '')} />
      
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
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: any) => {
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (![sourceX, sourceY, targetX, targetY].every(v => typeof v === 'number' && !isNaN(v))) {
      return ['', 0, 0];
    }

    if (data?.edgeStyle === 'straight') {
      return getStraightPath({ sourceX, sourceY, targetX, targetY });
    }
    
    if (data?.edgeStyle === 'smoothstep') {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 20
      });
    }

    // Default Bezier
    const cx = (sourceX + targetX) / 2;
    return [`M ${sourceX},${sourceY} C ${cx},${sourceY} ${cx},${targetY} ${targetX},${targetY}`, cx, (sourceY + targetY) / 2];
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data?.edgeStyle]);

  if (!edgePath) return null;

  return (
    <>
      <path 
        id="edge-path-interaction" 
        className="react-flow__edge-path" 
        d={edgePath} 
        style={{ ...style, stroke: 'transparent', strokeWidth: 40, fill: 'none', pointerEvents: 'stroke' }} 
      />
      <path 
        id="edge-path" 
        className="react-flow__edge-path" 
        d={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          stroke: data?.color || '#ffffff', 
          strokeWidth: selected ? '20px' : '10px', 
          strokeDasharray: data?.lineStyle === 'dashed' ? '15,15' : undefined, 
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'none'
        }} 
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: 100 }} className="bg-[#0f172a] px-3 py-1 rounded-lg border border-white/20 shadow-2xl pointer-events-none">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = { matrix: MatrixNode, diamond: DiamondNode };
const edgeTypes = { custom: CustomEdge };

const ConfirmDeleteOverlay: React.FC<{ onConfirm: () => void, onCancel: () => void, label: string }> = ({ onConfirm, onCancel, label }) => (
  <div className="bg-status-error/10 border border-status-error/30 rounded-xl p-4 flex flex-col gap-3 animate-apple-in">
    <div className="flex items-center gap-3">
      <AlertCircle size={14} className="text-status-error" />
      <span className="text-[10px] font-black text-white uppercase tracking-tight">{label}</span>
    </div>
    <div className="flex gap-2">
      <button onClick={(e) => { e.stopPropagation(); onConfirm(); }} className="flex-1 py-2 bg-status-error text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-status-error/20 hover:bg-status-error/80 transition-colors">Confirm Delete</button>
      <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="flex-1 py-2 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-lg hover:bg-white/10 transition-colors">Cancel</button>
    </div>
  </div>
);

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack, onExit, setIsDirty }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project, fitView } = useReactFlow();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'data' | 'exceptions' | 'validation' | 'appendix'>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [baseFontSize] = useState(14);
  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<'bezier' | 'smoothstep' | 'straight'>('smoothstep');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: false, outputs: false, manual_inputs: false, manual_outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [isOutputPickerOpen, setIsOutputPickerOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [isMetadataEditMode, setIsMetadataEditMode] = useState(false);
  const [ownerPositionsCollapsed, setOwnerPositionsCollapsed] = useState(true);

  const toggleSection = (section: string) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const toggleItem = (itemId: string) => { setOpenItems(prev => ({ ...prev, [itemId]: !prev[itemId] })); };

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow?.name || '',
    version: workflow?.version || 1,
    description: workflow?.description || workflow?.forensic_description || '',
    prc: workflow?.prc || '',
    workflow_type: workflow?.workflow_type || '',
    tool_family: Array.isArray(workflow?.tool_family) ? workflow.tool_family : (workflow?.tool_family ? workflow.tool_family.split(', ') : []),
    applicable_tools: Array.isArray(workflow?.applicable_tools) ? workflow.applicable_tools : (workflow?.tool_id ? (typeof workflow.tool_id === 'string' ? workflow.tool_id.split(', ') : [workflow.tool_id]) : []),
    trigger_type: workflow?.trigger_type || '',
    trigger_description: workflow?.trigger_description || '',
    output_type: workflow?.output_type || '',
    output_description: workflow?.output_description || '',
    cadence_count: workflow?.cadence_count || 1,
    cadence_unit: workflow?.cadence_unit || 'week',
    repeatability_check: workflow?.repeatability_check ?? true
  });

  const [tasks, setTasks] = useState<TaskEntity[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [clipboard, setClipboard] = useState<any>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const saveToHistory = useCallback(() => {
    // Optimization: Only save if state actually changed
    const currentState = JSON.stringify({ nodes, edges, tasks, metadata });
    const lastHistory = history.length > 0 ? JSON.stringify(history[history.length - 1]) : null;
    if (currentState === lastHistory) return;

    setHistory(prev => [...prev.slice(-49), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), tasks: JSON.parse(JSON.stringify(tasks)), metadata: JSON.parse(JSON.stringify(metadata)) }]);
    setRedoStack([]);
  }, [nodes, edges, tasks, metadata, history]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setRedoStack(prev => [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), tasks: JSON.parse(JSON.stringify(tasks)), metadata: JSON.parse(JSON.stringify(metadata)) }]);
    
    setNodes(lastState.nodes);
    setEdges(lastState.edges);
    setTasks(lastState.tasks);
    setMetadata(lastState.metadata);
    setHistory(prev => prev.slice(0, -1));
  }, [history, nodes, edges, tasks, metadata, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), tasks: JSON.parse(JSON.stringify(tasks)), metadata: JSON.parse(JSON.stringify(metadata)) }]);
    
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setTasks(nextState.tasks);
    setMetadata(nextState.metadata);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, nodes, edges, tasks, metadata, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedTaskId) {
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task && !task.interface) {
          setClipboard({ task: JSON.parse(JSON.stringify(task)), node: JSON.parse(JSON.stringify(nodes.find(n => n.id === selectedTaskId))) });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        saveToHistory();
        const id = `node-${Date.now()}`;
        const newNode = { ...clipboard.node, id, position: { x: (clipboard.node.position?.x || 0) + 40, y: (clipboard.node.position?.y || 0) + 40 }, selected: true };
        const newTask = { ...clipboard.task, id, node_id: id };
        setTasks(prev => [...prev, newTask]);
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNode));
        setSelectedTaskId(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedTaskId, tasks, nodes, clipboard, saveToHistory]);

  useEffect(() => {
    setTasks(prev => prev.map(t => {
      if (t.interface === 'TRIGGER') return { ...t, name: metadata.trigger_type || t.name, description: metadata.trigger_description || t.description };
      if (t.interface === 'OUTCOME') return { ...t, name: metadata.output_type || t.name, description: metadata.output_description || t.description };
      return t;
    }));
    setNodes(nds => nds.map(n => {
      if (n.data?.interface === 'TRIGGER') return { ...n, data: { ...n.data, label: metadata.trigger_type || n.data.label, description: metadata.trigger_description || n.data.description } };
      if (n.data?.interface === 'OUTCOME') return { ...n, data: { ...n.data, label: metadata.output_type || n.data.label, description: metadata.output_description || n.data.description } };
      return n;
    }));
  }, [metadata.trigger_type, metadata.trigger_description, metadata.output_type, metadata.output_description]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface === 'TRIGGER' || selectedTask?.interface === 'OUTCOME';

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

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'LR', ranker: 'network-simplex', ranksep: 200, nodesep: 100, edgesep: 50 });

      nds.forEach((n) => {
        const isDiamond = n.type === 'diamond';
        const isTemplate = n.data?.interface === 'TRIGGER' || n.data?.interface === 'OUTCOME';
        dagreGraph.setNode(n.id, { width: isDiamond ? 280 : (isTemplate ? 260 : 460), height: isTemplate ? 160 : (isDiamond ? 280 : 440) });
      });

      eds.forEach((e) => {
        if (dagreGraph.hasNode(e.source) && dagreGraph.hasNode(e.target)) {
          dagreGraph.setEdge(e.source, e.target);
        }
      });

      dagre.layout(dagreGraph);

      const layoutedNodes = nds.map(n => {
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
            edgeStyle: e.data?.edgeStyle || defaultEdgeStyle
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
  }, [fitView, setNodes, setEdges, setIsDirty, defaultEdgeStyle]);

  // Ensure fitView on initial load
  const initialFitPerformed = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !initialFitPerformed.current) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.1, duration: 400 });
        initialFitPerformed.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  useEffect(() => {
    if (!workflow) return;
    try {
      const seenNodeIds = new Set<string>();
      
      // Update metadata state when workflow changes
      const initialMetadata = {
        name: workflow?.name || '',
        version: workflow?.version || 1,
        description: workflow?.description || workflow?.forensic_description || '',
        prc: workflow?.prc || '',
        workflow_type: workflow?.workflow_type || '',
        tool_family: Array.isArray(workflow?.tool_family) ? workflow.tool_family : (workflow?.tool_family ? workflow.tool_family.split(', ') : []),
        applicable_tools: Array.isArray(workflow?.applicable_tools) ? workflow.applicable_tools : (workflow?.tool_id ? (typeof workflow.tool_id === 'string' ? workflow.tool_id.split(', ') : [workflow.tool_id]) : []),
        trigger_type: workflow?.trigger_type || '',
        trigger_description: workflow?.trigger_description || '',
        output_type: workflow?.output_type || '',
        output_description: workflow?.output_description || '',
        cadence_count: workflow?.cadence_count || 1,
        cadence_unit: workflow?.cadence_unit || 'week',
        repeatability_check: workflow?.repeatability_check ?? true
      };
      setMetadata(initialMetadata);

      let initializedTasks = (workflow?.tasks || []).map((t: any) => {
        let stableId = t.node_id ? String(t.node_id) : String(t.id);
        if (!stableId || stableId === 'undefined' || stableId === 'null') {
          stableId = `node-${Math.random().toString(36).substr(2, 9)}`;
        }
        if (t.interface === 'TRIGGER') stableId = 'node-trigger';
        if (t.interface === 'OUTCOME') stableId = 'node-outcome';
        if (seenNodeIds.has(stableId)) {
          stableId = `${stableId}-dup-${Math.random().toString(36).substr(2, 9)}`;
        }
        seenNodeIds.add(stableId);
        
        return {
          ...t,
          id: stableId,
          node_id: stableId,
          involved_systems: Array.isArray(t.involved_systems) ? t.involved_systems : [],
          blockers: Array.isArray(t.blockers) ? t.blockers : [],
          errors: Array.isArray(t.errors) ? t.errors : [],
          media: Array.isArray(t.media) ? t.media : [],
          reference_links: Array.isArray(t.reference_links) ? t.reference_links : [],
          instructions: (Array.isArray(t.instructions) ? t.instructions : []).map((ins: any) => ({
            ...ins,
            figures: Array.isArray(ins.figures) ? ins.figures : (ins.image ? [ins.image] : [])
          })),
          source_data_list: (Array.isArray(t.source_data_list) ? t.source_data_list : []).map((sd: any) => ({
            ...sd,
            figures: Array.isArray(sd.figures) ? sd.figures : (sd.figure ? [sd.figure] : [])
          })),
          output_data_list: (Array.isArray(t.output_data_list) ? t.output_data_list : []).map((od: any) => ({
            ...od,
            figures: Array.isArray(od.figures) ? od.figures : (od.figure ? [od.figure] : [])
          })),
          manual_inputs: Array.isArray(t.manual_inputs) ? t.manual_inputs : [],
          manual_outputs: Array.isArray(t.manual_outputs) ? t.manual_outputs : [],
          tribal_knowledge: Array.isArray(t.tribal_knowledge) ? t.tribal_knowledge : (t.tribal_knowledge ? [t.tribal_knowledge] : []),
          validation_procedure_steps: Array.isArray(t.validation_procedure_steps) ? t.validation_procedure_steps : (t.validation_procedure ? [{ id: 'v1', description: t.validation_procedure, figures: [] }] : []),
          occurrence: t.occurrence || t.occurrences_per_cycle || 1,
          manual_time_minutes: t.manual_time_minutes || 0,
          automation_time_minutes: t.automation_time_minutes || 0,
          machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
        };
      });

      const trigger = initializedTasks.find((t: any) => t.interface === 'TRIGGER');
      if (!trigger) {
        initializedTasks.unshift({
          id: 'node-trigger', node_id: 'node-trigger', name: initialMetadata.trigger_type || 'START', description: initialMetadata.trigger_description || '', task_type: 'TRIGGER', interface: 'TRIGGER', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: [], manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, validation_procedure_steps: []
        });
      } else {
        trigger.id = trigger.node_id = 'node-trigger';
        trigger.name = initialMetadata.trigger_type || trigger.name;
      }

      const outcome = initializedTasks.find((t: any) => t.interface === 'OUTCOME');
      if (!outcome) {
        initializedTasks.push({
          id: 'node-outcome', node_id: 'node-outcome', name: initialMetadata.output_type || 'END', description: initialMetadata.output_description || '', task_type: 'OUTCOME', interface: 'OUTCOME', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: [], manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, validation_procedure_steps: []
        });
      } else {
        outcome.id = outcome.node_id = 'node-outcome';
        outcome.name = initialMetadata.output_type || outcome.name;
      }

      setTasks(initializedTasks);
      const initialNodes: Node[] = initializedTasks.map((t: any) => ({
        id: String(t.node_id),
        type: t.task_type === 'LOOP' ? 'diamond' : 'matrix',
        position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
        data: {
          ...t, label: t.name, task_type: t.task_type || 'GENERAL', manual_time: t.manual_time_minutes || 0, automation_time: t.automation_time_minutes || 0, occurrence: t.occurrence || 1, involved_systems: t.involved_systems, owningTeam: t.owning_team, ownerPositions: t.owner_positions, sourceCount: (t.source_data_list || []).length, outputCount: (t.output_data_list || []).length, interface: t.interface, validation_needed: t.validation_needed, blockerCount: (t.blockers || []).length, errorCount: (t.errors || []).length, description: t.description || '', id: String(t.node_id), baseFontSize: 14
        },
      }));
      const initialEdges: Edge[] = (workflow?.edges || []).map((e: any, idx: number) => {
        const sourceId = String(e.source || '');
        const targetId = String(e.target || '');
        if (!sourceId || !targetId) return null;
        const sourceExists = initializedTasks.some((t: any) => String(t.node_id) === sourceId);
        const targetExists = initializedTasks.some((t: any) => String(t.node_id) === targetId);
        if (!sourceExists || !targetExists) return null;
        return {
          id: String(e.id || `e-${sourceId}-${targetId}-${idx}`), source: sourceId, target: targetId, sourceHandle: e.source_handle || e.sourceHandle || 'right-source', targetHandle: e.target_handle || e.targetHandle || 'left-target', type: 'custom', data: { label: e.label || '', edgeStyle: e.edge_style || e.edgeStyle || defaultEdgeStyle, color: e.color || '#ffffff', lineStyle: e.line_style || e.style || 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: e.color || '#ffffff' },
        };
      }).filter(Boolean);
      setNodes(initialNodes);
      setEdges(initialEdges);
      if (initializedTasks.every((t: any) => !t.position_x && !t.position_y)) {
        setTimeout(() => handleLayout(initialNodes, initialEdges), 100);
      }
    } catch (err) {
      console.error("[WorkflowBuilder] Critical Initialization Failure:", err);
    }
  }, [workflow]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    saveToHistory();
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { 
          ...n.data, label: updated.name, task_type: updated.task_type, manual_time: updated.manual_time_minutes, automation_time: updated.automation_time_minutes, occurrence: updated.occurrence, involved_systems: updated.involved_systems, owningTeam: updated.owning_team, ownerPositions: updated.owner_positions, sourceCount: (updated.source_data_list || []).length, outputCount: (updated.output_data_list || []).length, validation_needed: updated.validation_needed, blockerCount: (updated.blockers || []).length, errorCount: (updated.errors || []).length, description: updated.description 
        } } : n));
        return updated;
      }
      return t;
    }));
    setIsDirty?.(true);
  };

  const updateEdge = (id: string, updates: any) => {
    saveToHistory();
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates }, markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } } : e));
    setIsDirty?.(true);
  };

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    saveToHistory();
    const newEdge: Edge = { ...params, id: `e-${params.source}-${params.target}-${Date.now()}`, type: 'custom', data: { label: '', edgeStyle: defaultEdgeStyle, color: '#ffffff', lineStyle: 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, source: params.source, target: params.target };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const deleteTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return;
    saveToHistory();
    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setConfirmingDelete(null);
    setIsDirty?.(true);
  }, [tasks, setNodes, setEdges, setIsDirty, saveToHistory]);

const onAddNode = (type: 'TASK' | 'CONDITION') => {
    saveToHistory();
    const id = `node-${Date.now()}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    const newNode: Node = { id, type: type === 'CONDITION' ? 'diamond' : 'matrix', position: { x: Math.round((center.x - 160) / 10) * 10, y: Math.round((center.y - 140) / 10) * 10 }, data: { label: type === 'TASK' ? 'New Task' : 'New Condition', task_type: type === 'TASK' ? 'Documentation' : 'LOOP', manual_time: 0, automation_time: 0, occurrence: 1, involved_systems: [], validation_needed: false, blockerCount: 0, errorCount: 0, baseFontSize } };
    const newTask: TaskEntity = { id, node_id: id, name: newNode.data.label, description: '', task_type: newNode.data.task_type, involved_systems: [], manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, occurrence: 1, occurrence_explanation: '', source_data_list: [], output_data_list: [], manual_inputs: [], manual_outputs: [], verification_steps: [], blockers: [], errors: [], tribal_knowledge: [], validation_needed: false, validation_procedure_steps: [], media: [], reference_links: [], instructions: [] };
    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };

  const handleSave = () => {
    if (tasks.length === 0) return;
    try {
      const nodeIds = tasks.map((task) => String(task.node_id || task.id)).filter(Boolean);
      if (nodeIds.length > 1) {
        const adjacency = new Map<string, Set<string>>();
        nodeIds.forEach((id) => adjacency.set(id, new Set()));
        edges.forEach((edge) => {
          const source = String(edge.source || '');
          const target = String(edge.target || '');
          if (adjacency.has(source) && adjacency.has(target)) {
            adjacency.get(source)!.add(target);
            adjacency.get(target)!.add(source);
          }
        });
        const queue = [nodeIds[0]];
        const visited = new Set<string>(queue);
        while (queue.length > 0) {
          const current = queue.shift()!;
          adjacency.get(current)?.forEach((next) => {
            if (!visited.has(next)) {
              visited.add(next);
              queue.push(next);
            }
          });
        }
        if (visited.size !== nodeIds.length) {
          toast.error('All nodes must remain connected before saving.');
          return;
        }
      }

      const finalData = {
        ...metadata,
        tasks: tasks.map(t => {
          const node = nodes.find(n => String(n.id) === String(t.node_id));
          return { 
            ...t, id: undefined, node_id: String(t.node_id || t.id), position_x: node?.position.x ?? t.position_x ?? 0, position_y: node?.position.y ?? t.position_y ?? 0 
          };
        }),
        edges: edges.map(e => ({ 
          source: String(e.source), target: String(e.target), source_handle: String(e.sourceHandle || 'right-source'), target_handle: String(e.targetHandle || 'left-target'), label: String(e.data?.label || ''), edge_style: String(e.data?.edgeStyle || 'bezier'), color: String(e.data?.color || '#ffffff'), line_style: String(e.data?.lineStyle || 'solid') 
        }))
      };
      onSave(finalData);
    } catch (err) {
      console.error("[WorkflowBuilder] Failed to prepare save data:", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX; const startWidth = inspectorWidth;
    const handleMouseMove = (mv: MouseEvent) => setInspectorWidth(Math.max(300, Math.min(800, startWidth - (mv.pageX - startX))));
    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  };

  const swapEdgeDirection = (id: string) => {
    saveToHistory();
    setEdges(eds => eds.map(e => {
      if (e.id === id) { const newSourceHandle = e.targetHandle?.replace('-target', '-source'); const newTargetHandle = e.sourceHandle?.replace('-source', '-target'); return { ...e, source: e.target, target: e.source, sourceHandle: newSourceHandle, targetHandle: newTargetHandle }; }
      return e;
    }));
    setIsDirty?.(true);
  };

  const onNodesDelete = useCallback((deleted: Node[]) => {
    const protectedNodes = deleted.filter(n => n.data?.interface === 'TRIGGER' || n.data?.interface === 'OUTCOME');
    if (protectedNodes.length > 0) {
      const allowedToDelete = deleted.filter(n => n.data?.interface !== 'TRIGGER' && n.data?.interface !== 'OUTCOME');
      if (allowedToDelete.length === 0) return;
      
      saveToHistory();
      const ids = allowedToDelete.map(n => n.id);
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      setNodes(nds => nds.filter(n => !ids.includes(n.id)));
      setEdges(eds => eds.filter(e => !ids.includes(e.source) && !ids.includes(e.target)));
      setIsDirty?.(true);
    } else {
      saveToHistory();
      const ids = deleted.map(n => n.id);
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      setNodes(nds => nds.filter(n => !ids.includes(n.id)));
      setEdges(eds => eds.filter(e => !ids.includes(e.source) && !ids.includes(e.target)));
      setIsDirty?.(true);
    }
  }, [saveToHistory, setTasks, setNodes, setEdges, setIsDirty]);

  return (
    <div className="flex h-full w-full bg-[#050914] overflow-hidden">
      {/* Existing Output Picker Modal */}
      {isOutputPickerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-apple-in">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="text-theme-accent" size={20} />
                <h3 className="text-[18px] font-black text-white uppercase tracking-tight">Select Existing Output</h3>
              </div>
              <button onClick={() => setIsOutputPickerOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} className="text-white/40 hover:text-white" /></button>
            </div>
            <div className="flex-1 overflow-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0f172a] z-10 shadow-lg shadow-black/20">
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Source Task</th>
                    <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Output Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tasks.filter(t => t.id !== selectedTaskId).flatMap(t => (t.output_data_list || []).map(o => ({ ...o, taskName: t.name, taskId: t.id }))).map((output, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-[12px] font-bold text-theme-accent uppercase">{output.taskName}</td>
                      <td className="px-6 py-4 text-[12px] font-bold text-white uppercase">{output.name}</td>
                      <td className="px-6 py-4 text-[11px] text-white/40 line-clamp-2">{output.description || 'No description'}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            updateTask(selectedTaskId!, { 
                              source_data_list: [...(selectedTask?.source_data_list || []), { 
                                id: Date.now().toString(), 
                                name: output.name, 
                                description: output.description, 
                                figures: output.figures || [], 
                                link: output.link, 
                                data_example: output.data_example,
                                from_task_id: output.id,
                                from_task_name: output.taskName
                              }] 
                            });
                            setIsOutputPickerOpen(false);
                          }}
                          className="px-4 py-2 bg-theme-accent text-white text-[9px] font-black uppercase rounded-lg opacity-0 group-hover:opacity-100 hover:scale-105 transition-all"
                        >
                          Select Output
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.every(t => (t.output_data_list || []).length === 0) && (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-white/20 italic text-[13px]">No outputs available from other tasks yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-16 border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl flex items-center justify-between px-6 relative z-[100]">
          <div className="flex items-center gap-4">
            <button onClick={() => onBack(metadata)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest mb-1">Workflow Builder</span>
              <h1 className="text-[14px] font-black text-white uppercase truncate max-w-[300px]">{workflow?.name}</h1>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent/80">Repository Definition Surface</span>
            </div>
          </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5 mr-2 h-[38px] items-center">
            <button onClick={undo} disabled={history.length === 0} className="px-3 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all border-r border-white/5"><RefreshCw size={14} className="-scale-x-100" /></button>
            <button onClick={redo} disabled={redoStack.length === 0} className="px-3 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all"><RefreshCw size={14} /></button>
          </div>
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5 mr-2 h-[38px] items-center">
            {(['bezier', 'smoothstep', 'straight'] as const).map(s => (
              <button 
                key={s} 
                onClick={() => {
                  setDefaultEdgeStyle(s);
                  setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, edgeStyle: s } })));
                }} 
                className={cn("px-3 h-full text-[9px] font-black uppercase rounded-lg transition-all", defaultEdgeStyle === s ? "bg-theme-accent text-white" : "text-white/20 hover:text-white/40")}
              >
                {s === 'smoothstep' ? 'Angled' : s === 'bezier' ? 'Smooth' : 'Straight'}
              </button>
            ))}
          </div>
          <button onClick={() => handleLayout(nodes, edges)} className="flex items-center gap-2 px-4 h-[38px] bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
          <button data-testid="builder-commit" onClick={handleSave} className="flex items-center gap-2 px-6 h-[38px] bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-theme-accent/20 hover:scale-[1.02] transition-all"><Save size={14} /> Commit Changes</button>
          <button onClick={onExit} className="p-2 text-white/20 hover:text-status-error"><X size={20} /></button>
        </div>
        </div>

        <div className="flex-1 relative">
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onConnect={onConnect} 
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes} 
            edgeTypes={edgeTypes} 
            onNodeClick={(_, n) => { setSelectedTaskId(n.id); setSelectedEdgeId(null); setInspectorTab('overview'); }} 
            onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedTaskId(null); }} 
            onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }} 
            fitView 
            snapToGrid 
            snapGrid={[10, 10]} 
            connectionMode={ConnectionMode.Loose} 
            connectionLineType={ConnectionLineType.Bezier} 
            className="react-flow-industrial"
          >
            <Background color="#1e293b" gap={30} size={1} />
            <Controls className="!bg-[#0a1120] !border-white/10 !rounded-xl overflow-hidden" />
          </ReactFlow>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl"><button data-testid="builder-add-task" onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Task</button><button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Condition</button></div>
        </div>
      </div>

      <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70]" style={{ width: `${inspectorWidth}px` }}>
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent z-50" />
        <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
          {[ 
            { id: 'overview', label: 'Overview', icon: <Activity size={12} /> }, 
            { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' } 
          ].filter(t => !t.hidden && (selectedTaskId || t.id === 'overview')).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white transition-all')}>{t.icon}<span className="text-[8px] font-black uppercase">{t.label}</span></button>
          ))}
          {selectedEdgeId && (<div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white"><Link2 size={12} /><span className="text-[8px] font-black uppercase">Edge</span></div>)}
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar p-6">
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              {inspectorTab === 'overview' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">
                      {selectedTask.interface ? (selectedTask.interface === 'TRIGGER' ? 'Trigger Origin' : 'Outcome Result') : (selectedTask.task_type === 'LOOP' ? 'Condition Nomenclature' : 'Task Nomenclature')}
                    </label>
                    <input 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-bold text-white outline-none focus:border-theme-accent disabled:opacity-50 disabled:cursor-not-allowed" 
                      value={selectedTask.name} 
                      onChange={e => updateTask(selectedTaskId, { name: e.target.value })} 
                      disabled={isProtected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Contextual Description</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-medium text-white/60 outline-none focus:border-theme-accent h-32 resize-none disabled:opacity-50" 
                      value={selectedTask.description} 
                      onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                      disabled={isProtected}
                    />
                  </div>

                  {!isProtected && selectedTask.task_type !== 'LOOP' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task Logic Type</label>
                        <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-11 text-[11px] font-black text-white outline-none" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId, { task_type: e.target.value })}>{taskTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}</select>
                      </div>

                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1 text-center block">TAT Manual (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-blue-400 text-center" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1 text-center block">TAT Machine (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-purple-400 text-center" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owner Team</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-[12px] font-bold text-white outline-none focus:border-theme-accent placeholder:text-white/10" value={selectedTask.owning_team} onChange={e => updateTask(selectedTaskId, { owning_team: e.target.value })} placeholder="Team Name" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owner Positions</label>
                          <button 
                            onClick={() => setOwnerPositionsCollapsed(!ownerPositionsCollapsed)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 flex items-center justify-between hover:bg-white/10 transition-colors"
                          >
                            <span className="text-[12px] font-bold text-white truncate">
                              {selectedTask.owner_positions?.length || 0} Positions
                            </span>
                            {ownerPositionsCollapsed ? <ChevronDown size={14} className="text-white/20" /> : <ChevronUp size={14} className="text-white/20" />}
                          </button>
                        </div>
                      </div>
                      {!ownerPositionsCollapsed && (
                        <div className="p-4 space-y-3 border border-white/10 bg-black/40 rounded-xl animate-apple-in -mt-2">
                          {(selectedTask.owner_positions || []).map((pos, idx) => (
                            <div key={idx} className="flex gap-2 group/pos animate-apple-in">
                              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-bold text-white flex items-center justify-between">
                                <span className="truncate">{pos || 'Untitled Position'}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover/pos:opacity-100 transition-opacity">
                                  <button onClick={() => {
                                    const newTitle = prompt('Edit Position Title:', pos);
                                    if (newTitle !== null && newTitle.trim()) {
                                      updateTask(selectedTaskId, { owner_positions: selectedTask.owner_positions?.map((p, i) => i === idx ? newTitle.trim() : p) });
                                    }
                                  }} className="p-1.5 hover:bg-theme-accent/20 text-white/40 hover:text-theme-accent rounded-md transition-all"><Edit3 size={12} /></button>
                                  <button onClick={() => {
                                    if (confirm('Permanently remove this owner position?')) {
                                      updateTask(selectedTaskId, { owner_positions: selectedTask.owner_positions?.filter((_, i) => i !== idx) });
                                    }
                                  }} className="p-1.5 hover:bg-status-error/20 text-white/40 hover:text-status-error rounded-md transition-all"><Trash size={12} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => {
                            const newTitle = prompt('New Position Title:');
                            if (newTitle && newTitle.trim()) {
                              updateTask(selectedTaskId, { owner_positions: [...(selectedTask.owner_positions || []), newTitle.trim()] });
                            }
                          }} className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all">+ Add Position</button>
                        </div>
                      )}

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Involved IT Systems</label>
                        <div className="space-y-3">
                          {(selectedTask.involved_systems || []).map(sys => (
                            <NestedCollapsible key={sys.id} title={sys.name || "New System Entry"} isOpen={openItems[sys.id]} toggle={() => toggleItem(sys.id)} onDelete={() => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.filter(x => x.id !== sys.id) })}>
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">System Name</label>
                                  <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={sys.name} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., SAP, Salesforce, Internal Tool" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Usage Context</label>
                                  <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent" value={sys.usage} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, usage: e.target.value } : x) })} placeholder="Describe how the system is used in this task..." />
                                </div>
                                <ImagePasteField figures={sys.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, figures: figs } : x) })} label="System Screenshots (Ctrl+V)" />
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Documentation Link</label>
                                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    <Link2 size={12} className="text-theme-accent" />
                                    <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={sys.link} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, link: e.target.value } : x) })} placeholder="URL to SOP or Wiki" />
                                  </div>
                                </div>
                              </div>
                            </NestedCollapsible>
                          ))}
                          <button onClick={() => updateTask(selectedTaskId, { involved_systems: [...(selectedTask.involved_systems || []), { id: Date.now().toString(), name: '', usage: '', figures: [], link: '' }] })} className="w-full py-2.5 bg-white/5 border border-dashed border-white/10 rounded-xl text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all">+ Add System Dependency</button>
                        </div>
                      </div>
                    </>
                  )}

                  {!isProtected && (
                    <div className="pt-6 border-t border-white/5 space-y-4">
                      {confirmingDelete === selectedTaskId ? (
                        <ConfirmDeleteOverlay 
                          label={`Delete ${selectedTask.task_type === 'LOOP' ? 'Condition' : 'Task'}?`}
                          onConfirm={() => deleteTask(selectedTaskId)}
                          onCancel={() => setConfirmingDelete(null)}
                        />
                      ) : (
                        <button 
                          onClick={() => setConfirmingDelete(selectedTaskId)} 
                          className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-xl text-[10px] font-black uppercase hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Trash size={12} /> Permanent Deletion
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {inspectorTab === 'data' && (
                <div className="space-y-8 animate-apple-in">
                  <CollapsibleSection title="Task Inputs" isOpen={expandedSections.inputs} toggle={() => toggleSection('inputs')} count={selectedTask.source_data_list.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.source_data_list.map((sd) => (
                        <NestedCollapsible key={sd.id} title={sd.name || "New Input"} isOpen={openItems[sd.id]} toggle={() => toggleItem(sd.id)} onDelete={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} isLocked={!!sd.from_task_id}>
                          <div className="space-y-4">
                            {sd.from_task_name && (
                              <div className="px-3 py-1 bg-theme-accent/20 border border-theme-accent/30 rounded text-[9px] font-black text-theme-accent uppercase flex items-center gap-2">
                                <Link2 size={10} /> Referenced from: {sd.from_task_name}
                              </div>
                            )}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Input Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent disabled:opacity-50" value={sd.name} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., FDC Log, SPC Chart" disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent disabled:opacity-50" value={sd.description} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the input..." disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 outline-none focus:border-theme-accent disabled:opacity-50" value={sd.data_example} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" disabled={!!sd.from_task_id} />
                            </div>
                            <ImagePasteField figures={sd.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" isLocked={!!sd.from_task_id} />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none disabled:opacity-50" value={sd.link} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" disabled={!!sd.from_task_id} />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="py-3 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Manual Input</button>
                        <button onClick={() => setIsOutputPickerOpen(true)} className="py-3 bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-xl flex items-center justify-center gap-2"><Search size={12} /> Registry Search</button>
                      </div>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Task Outputs" isOpen={expandedSections.outputs} toggle={() => toggleSection('outputs')} count={selectedTask.output_data_list.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.output_data_list.map((od) => (
                        <NestedCollapsible key={od.id} title={od.name || "New Output"} isOpen={openItems[od.id]} toggle={() => toggleItem(od.id)} onDelete={() => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Output Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={od.name} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., Final Report, Updated DB Entry" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent" value={od.description} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the output artifact..." />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 outline-none focus:border-theme-accent" value={od.data_example} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" />
                            </div>
                            <ImagePasteField figures={od.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none" value={od.link} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="w-full py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Output Artifact</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
              {inspectorTab === 'exceptions' && (
                <div className="space-y-8">
                  <CollapsibleSection title="Operational Roadblocks" isOpen={expandedSections.blockers} toggle={() => toggleSection('blockers')} count={selectedTask.blockers.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.blockers.map((b) => (
                        <NestedCollapsible key={b.id} title={b.blocking_entity || "New Roadblock"} isOpen={openItems[b.id]} toggle={() => toggleItem(b.id)} onDelete={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Roadblock Description *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-amber-500" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} placeholder="What stops the process?" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Average Delay (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={b.average_delay_minutes || 0} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Frequency ({b.frequency || 1} / 10)</label>
                              </div>
                              <input type="range" min="1" max="10" step="1" className="w-full accent-amber-500" value={b.frequency || 1} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, frequency: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Mitigation Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-amber-500" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} placeholder="Action to reduce delay..." />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', average_delay_minutes: 0, frequency: 1 }] })} className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase text-amber-500 hover:bg-amber-500/20 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Roadblock</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Human Errors & Recoveries" isOpen={expandedSections.errors} toggle={() => toggleSection('errors')} count={selectedTask.errors.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.errors.map((er) => (
                        <NestedCollapsible key={er.id} title={er.error_type || "New Error"} isOpen={openItems[er.id]} toggle={() => toggleItem(er.id)} onDelete={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== er.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Error Description *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-status-error" value={er.error_type} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, error_type: e.target.value } : x) })} placeholder="Describe the common human error" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Recovery (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={er.recovery_time_minutes || 0} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Frequency ({er.frequency || 1} / 10)</label>
                              </div>
                              <input type="range" min="1" max="10" step="1" className="w-full accent-status-error" value={er.frequency || 1} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, frequency: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Correction Method</label>
                              <textarea 
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-32 resize-none outline-none focus:border-status-error" 
                                value={er.description} 
                                onBlur={(e) => {
                                  const lines = e.target.value.split('\n').filter(l => l.trim());
                                  if (lines.length > 1) {
                                    const numbered = lines.map((l, i) => {
                                      const clean = l.replace(/^\d+\.\s*/, '');
                                      return `${i + 1}. ${clean}`;
                                    }).join('\n');
                                    updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, description: numbered } : x) });
                                  }
                                }}
                                onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, description: e.target.value } : x) })}
                                placeholder="Steps to correct this error (auto-numbered if multiple lines)..." 
                              />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', recovery_time_minutes: 0, frequency: 1 }] })} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-[10px] font-black uppercase text-status-error hover:bg-status-error/20 transition-all rounded-xl flex items-center justify-center gap-2"><Plus size={12} /> Add Human Error</button>
                    </div>
                  </CollapsibleSection>

                  <ManagedListSection 
                    title="Tribal Knowledge Entries" 
                    items={selectedTask.tribal_knowledge || []} 
                    onUpdate={(items) => updateTask(selectedTaskId, { tribal_knowledge: items })}
                    isOpen={expandedSections.tribal}
                    toggle={() => toggleSection('tribal')}
                    placeholder="Capture unwritten knowledge or tips..."
                  />
                </div>
              )}

              {inspectorTab === 'validation' && (
                <div className="space-y-8 animate-apple-in">
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Post-Task Validation</h3>
                        <p className="text-[10px] text-white/40 font-bold uppercase">Manual verification required?</p>
                      </div>
                      <button 
                        onClick={() => updateTask(selectedTaskId, { validation_needed: !selectedTask.validation_needed })} 
                        className={cn("relative w-12 h-6 rounded-full transition-all duration-300", selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1")} />
                      </button>
                    </div>

                    {selectedTask.validation_needed && (
                      <div className="space-y-6 animate-apple-in pt-6 border-t border-white/5">
                        <div className="space-y-4">
                          {(selectedTask.validation_procedure_steps || []).map((step, idx) => (
                            <NestedCollapsible key={step.id} title={`Verification Step ${idx + 1}`} isOpen={openItems[step.id]} toggle={() => toggleItem(step.id)} onDelete={() => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.filter(x => x.id !== step.id) })}>
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description *</label>
                                  <textarea 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] text-white/80 h-24 resize-none outline-none focus:border-orange-500" 
                                    value={step.description} 
                                    onChange={e => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                    placeholder="Describe the verification action..."
                                  />
                                </div>
                                <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" />
                              </div>
                            </NestedCollapsible>
                          ))}
                          <button onClick={() => updateTask(selectedTaskId, { validation_procedure_steps: [...(selectedTask.validation_procedure_steps || []), { id: Date.now().toString(), description: '', figures: [] }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-orange-500 transition-all rounded-xl">+ Add Verification Step</button>
                        </div>
                      </div>
                    )}                  </div>
                </div>
              )}
              {inspectorTab === 'appendix' && (
                <div className="space-y-12 pb-20">
                  <CollapsibleSection title="Operational References" isOpen={expandedSections.references} toggle={() => toggleSection('references')} count={selectedTask.reference_links.length}>
                    <div className="space-y-3 pt-4">
                      {selectedTask.reference_links.map(l => (
                        <NestedCollapsible key={l.id} title={l.label || "New Reference"} isOpen={openItems[l.id]} toggle={() => toggleItem(l.id)} onDelete={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== l.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Reference Label *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={l.label} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) })} placeholder="e.g., SOP v1.2" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Target URL / Path</label>
                              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                <Link2 size={12} className="text-theme-accent" />
                                <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={l.url} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x) })} placeholder="https://..." />
                              </div>
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-xl mt-2">+ Add Reference Link</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Task Visual Assets" isOpen={expandedSections.assets} toggle={() => toggleSection('assets')} count={selectedTask.media.length}>
                    <div className="pt-4">
                      <ImagePasteField figures={selectedTask.media.map(m => m.url)} onPaste={(figs) => updateTask(selectedTaskId, { media: figs.map(f => ({ id: Date.now().toString(), type: 'image', url: f, label: 'Pasted Asset' })) })} label="Visual Assets (Ctrl+V)" />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Step-by-Step Instructions" isOpen={expandedSections.instructions} toggle={() => toggleSection('instructions')} count={selectedTask.instructions.length}>
                    <div className="space-y-4 pt-4">
                      {selectedTask.instructions.map((step, idx) => (
                        <NestedCollapsible key={step.id} title={`Instruction Step ${idx + 1}`} isOpen={openItems[step.id]} toggle={() => toggleItem(step.id)} onDelete={() => updateTask(selectedTaskId, { instructions: selectedTask.instructions.filter(x => x.id !== step.id) })}>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description *</label>
                              <textarea 
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/80 h-32 resize-none outline-none focus:border-theme-accent transition-all" 
                                value={step.description} 
                                onChange={e => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                placeholder="Describe the action..."
                              />
                            </div>
                            <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Step Figures (Ctrl+V)" />
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button onClick={() => updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id: Date.now().toString(), description: '', figures: [], links: [] }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-xl">+ Add Instruction Step</button>
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
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Line Style</label>
                  <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                    {(['solid', 'dashed'] as const).map((s) => (
                      <button key={s} onClick={() => updateEdge(selectedEdgeId, { lineStyle: s })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.lineStyle || 'solid') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
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
            <div className="space-y-8 animate-apple-in pb-20">
              {showGuide && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Builder Guide</p>
                      <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/60">
                        Edit the workflow definition here, then use the canvas to inspect nodes, routes, and protected trigger/output entities.
                      </p>
                    </div>
                    <button
                      data-testid="builder-guide-dismiss"
                      onClick={() => setShowGuide(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 transition-all hover:bg-white/10 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <LucideWorkflow className="text-theme-accent" size={18} />
                  <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Workflow Definition</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">v{metadata.version}</span>
                  <button 
                    onClick={() => setIsMetadataEditMode(!isMetadataEditMode)}
                    className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", isMetadataEditMode ? "bg-theme-accent text-white" : "bg-white/5 text-white/40 hover:text-white")}
                  >
                    {isMetadataEditMode ? "Finish Editing" : "Edit Definition"}
                  </button>
                </div>
              </div>
              
              <div className={cn("space-y-8 transition-all", !isMetadataEditMode && "opacity-80 pointer-events-none")}>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-theme-accent font-black px-1">
                    <Cpu size={14} />
                    <span className="text-[10px] tracking-[0.2em] uppercase">Overview</span>
                  </div>
                  <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Workflow Name</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.name.length} / 60</span>
                      </div>
                      <input 
                        data-testid="builder-workflow-name"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase focus:border-theme-accent outline-none" 
                        value={metadata.name} 
                        onChange={e => { saveToHistory(); setMetadata({...metadata, name: e.target.value}); }} 
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Description</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.description.length} / 500</span>
                      </div>
                      <textarea 
                        data-testid="builder-workflow-description"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-32 resize-none focus:border-theme-accent outline-none leading-relaxed" 
                        value={metadata.description} 
                        onChange={e => { saveToHistory(); setMetadata({...metadata, description: e.target.value}); }} 
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <SearchableSelect 
                        label="PRC"
                        options={(taxonomy.find(t => t.category === 'PRC') as any)?.cached_values || []}
                        value={metadata.prc}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, prc: val}); }}
                        placeholder="SELECT PRC..."
                      />
                      <SearchableSelect 
                        label="Type"
                        options={(taxonomy.find(t => t.category === 'WORKFLOW_TYPE') as any)?.cached_values || []}
                        value={metadata.workflow_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, workflow_type: val}); }}
                        placeholder="SELECT TYPE..."
                      />
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Occurrence</label>
                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 h-[48px]">
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-12 bg-black/40 font-black text-[11px] text-white text-center py-2 rounded-lg outline-none" 
                            value={metadata.cadence_count} 
                            onChange={e => { saveToHistory(); setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 1}); }} 
                          />
                          <select 
                            className="flex-1 bg-transparent text-white font-black text-[9px] uppercase outline-none cursor-pointer"
                            value={metadata.cadence_unit}
                            onChange={e => { saveToHistory(); setMetadata({...metadata, cadence_unit: e.target.value}); }}
                          >
                            <option value="day">DAILY</option>
                            <option value="week">WEEKLY</option>
                            <option value="month">MONTHLY</option>
                            <option value="year">YEARLY</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect 
                        label="Tool Family"
                        options={(taxonomy.find(t => t.category === 'ToolType') as any)?.cached_values || []}
                        value={metadata.tool_family}
                        onChange={vals => { saveToHistory(); setMetadata({...metadata, tool_family: vals}); }}
                        placeholder="SELECT FAMILIES..."
                        isMulti
                      />
                      <SearchableSelect 
                        label="Applicable Tools"
                        options={(taxonomy.find(t => t.category === 'TOOL_ID') as any)?.cached_values || []}
                        value={metadata.applicable_tools}
                        onChange={vals => { saveToHistory(); setMetadata({...metadata, applicable_tools: vals}); }}
                        placeholder="SELECT TOOLS..."
                        isMulti
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-theme-accent font-black px-1">
                    <Zap size={14} />
                    <span className="text-[10px] tracking-[0.2em] uppercase">Trigger & Output</span>
                  </div>
                  <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect 
                        label="Trigger Type"
                        options={(taxonomy.find(t => t.category === 'TriggerType') as any)?.cached_values || []}
                        value={metadata.trigger_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, trigger_type: val}); }}
                        placeholder="SELECT TRIGGER..."
                      />
                      <SearchableSelect 
                        label="Output Type"
                        options={(taxonomy.find(t => t.category === 'OutputType') as any)?.cached_values || []}
                        value={metadata.output_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, output_type: val}); }}
                        placeholder="SELECT OUTPUT..."
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-6 border-t border-white/5 pt-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Trigger Description</label>
                        <textarea 
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white/80 h-24 resize-none focus:border-theme-accent outline-none leading-relaxed" 
                          value={metadata.trigger_description} 
                          onChange={e => { saveToHistory(); setMetadata({...metadata, trigger_description: e.target.value}); }} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Output Description</label>
                        <textarea 
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white/80 h-24 resize-none focus:border-theme-accent outline-none leading-relaxed" 
                          value={metadata.output_description} 
                          onChange={e => { saveToHistory(); setMetadata({...metadata, output_description: e.target.value}); }} 
                        />
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

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (<ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>);
export default WrappedWorkflowBuilder;
