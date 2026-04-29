import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import ReactFlow, { 
  Handle, 
  Position, 
  Background, 
  Controls, 
  MiniMap,
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
  Edit3,
  MessageSquare,
  History,
  ShieldCheck,
  FileDown,
  FileUp,
  GitBranch,
  Users,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchableSelect } from './IntakeGatekeeper';
import { auditWorkflowDraft, summarizeAuditIssues, type WorkflowAuditIssue } from '../testing/workflowQuality';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type BuilderMode = 'guided' | 'advanced';
type InspectorTab = 'overview' | 'data' | 'exceptions' | 'validation' | 'appendix' | 'governance' | 'history';
type BuilderDockSide = 'left' | 'right';

interface BuilderLayoutPrefs {
  inspectorDock: BuilderDockSide;
  inspectorCollapsed: boolean;
  showMiniMap: boolean;
  showCanvasControls: boolean;
}

interface WorkflowComment {
  id: string;
  scope: 'workflow' | 'task' | 'section';
  scope_id?: string;
  author: string;
  message: string;
  mentions: string[];
  parent_id?: string;
  assignee?: string;
  review_state: string;
  created_at?: string;
  resolved: boolean;
}

interface ReviewRequestDraft {
  id: string;
  role: string;
  requested_by: string;
  status: string;
  due_at: string;
  note: string;
}

interface AccessControlState {
  visibility: string;
  viewers: string[];
  editors: string[];
  mention_groups: string[];
  owner: string;
}

interface OwnershipState {
  owner: string;
  smes: string[];
  backup_owners: string[];
  automation_owner?: string;
  reviewers: string[];
}

const getWorkflowBuilderDraftKey = (workflowId?: string | number | null) => `pathos-workflow-builder-draft-${workflowId ?? 'new'}`;
const getWorkflowBuilderLayoutKey = (workflowId?: string | number | null) => `pathos-workflow-builder-layout-${workflowId ?? 'new'}`;

const createWorkflowComment = (scope: WorkflowComment['scope'] = 'workflow', scopeId = ''): WorkflowComment => ({
  id: `comment-${Date.now()}`,
  scope,
  scope_id: scopeId || undefined,
  author: 'system_user',
  message: '',
  mentions: [],
  review_state: 'open',
  created_at: new Date().toISOString(),
  resolved: false,
});

const createReviewRequestDraft = (): ReviewRequestDraft => ({
  id: `review-${Date.now()}`,
  role: '',
  requested_by: 'system_user',
  status: 'open',
  due_at: '',
  note: '',
});

const normalizeStringList = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
const parseIsoDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const scoreTextMatch = (value: unknown, query: string) => {
  const haystack = String(value ?? '').toLowerCase();
  if (!query) return 0;
  if (!haystack) return 0;
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 80;
  if (haystack.includes(query)) return 55;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  return matchedTokens > 0 ? matchedTokens * 12 : 0;
};

const rankItemsByQuery = <T,>(
  items: T[],
  query: string,
  fields: Array<(item: T) => unknown>,
  limit = 6,
) => {
  const trimmed = query.trim().toLowerCase();
  return [...items]
    .map((item) => ({
      item,
      score: trimmed
        ? Math.max(...fields.map((field) => scoreTextMatch(field(item), trimmed)))
        : 1,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
};

const buildFixSuggestion = (issue: WorkflowAuditIssue) => {
  const code = issue.code || '';
  if (code.includes('workflow.name')) return 'Open Workflow Definition and enter a more specific process name.';
  if (code.includes('workflow.description')) return 'Add the current-state description in the Workflow Definition panel.';
  if (code.includes('workflow.trigger') || code.includes('workflow.output')) return 'Set trigger and output metadata in the Workflow Definition panel.';
  if (code.includes('task.name')) return 'Select the task node and rename it in the Overview tab.';
  if (code.includes('task.description')) return 'Add a plain-language description to the selected task.';
  if (code.includes('task.blocker')) return 'Fill all blocker fields or remove the incomplete blocker entry.';
  if (code.includes('task.error')) return 'Complete the error type and recovery description or remove the incomplete error entry.';
  if (code.includes('task.validation_step')) return 'Add a validation step description or remove the empty validation row.';
  if (code.includes('edge.self_loop')) return 'Delete the self-loop or reconnect the edge to a different target.';
  if (code.includes('edge.endpoint_missing') || code.includes('edge.endpoint_invalid')) return 'Reconnect the route to existing nodes.';
  if (code.includes('graph.trigger_incoming')) return 'Remove any incoming edge into the trigger node.';
  if (code.includes('graph.outcome_outgoing')) return 'Remove any outgoing edge from the outcome node.';
  if (code.includes('graph.decision_route_count')) return 'Ensure the decision node has exactly two outgoing routes.';
  if (code.includes('graph.decision_labels')) return 'Label the decision routes True and False.';
  if (code.includes('graph.unreachable') || code.includes('graph.disconnected')) return 'Add routes so every node is connected to both the trigger and outcome path.';
  return 'Open the matching node or workflow section and correct the missing field.';
};

const BUILDER_PANEL = 'rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]';
const BUILDER_FIELD = 'w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] text-white outline-none focus:border-theme-accent';
const BUILDER_BUTTON = 'rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all';

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
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 group relative">
            {editingIdx === idx ? (
              <div className="space-y-2 animate-apple-in">
                <textarea 
                  autoFocus
                  className={cn(BUILDER_FIELD, "min-h-[80px]")}
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
                    className="flex-1 py-2 bg-theme-accent text-white text-[9px] font-black uppercase rounded-2xl"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => setEditingIdx(null)}
                    className="px-4 py-2 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-2xl"
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
          <div className="bg-white/[0.02] border border-theme-accent rounded-2xl p-3 space-y-2 animate-apple-in">
            <textarea 
              autoFocus
              className={cn(BUILDER_FIELD, "min-h-[80px]")}
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
                className="flex-1 py-2 bg-theme-accent text-white text-[9px] font-black uppercase rounded-2xl"
              >
                Add Entry
              </button>
              <button 
                onClick={() => { setEditingIdx(null); setEditVal(''); }}
                className="px-4 py-2 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-2xl"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => { setEditingIdx(-1); setEditVal(''); }}
            className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-theme-accent transition-all rounded-2xl"
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
  onGovernanceAction?: (action: string, requestId?: string) => void;
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
    <div className="bg-white/[0.02] border border-white/5 rounded-[24px] overflow-hidden group/item animate-apple-in mt-2">
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
              <div className="flex items-center gap-1 bg-status-error/20 rounded-[24px] p-1 animate-apple-in">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsConfirming(false); onDelete(); }}
                  className="px-2 py-1 bg-status-error text-white text-[8px] font-black uppercase rounded-2xl"
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
                className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-status-error/20 text-white/20 hover:text-status-error transition-all rounded-2xl"
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
          <div key={idx} className="flex-shrink-0 w-24 h-full rounded-2xl border border-white/10 overflow-hidden relative group bg-black/40">
            <img src={fig} className="w-full h-full object-cover" />
            {!isLocked && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all p-2">
                <button 
                  onClick={() => {
                    onPaste(figures.filter((_, i) => i !== idx));
                  }}
                  className="w-full h-full bg-status-error/80 text-white rounded-2xl flex items-center justify-center hover:bg-status-error transition-colors"
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
            className="flex-shrink-0 w-24 h-full border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-white/20 hover:text-white hover:border-theme-accent transition-all cursor-pointer outline-none focus:border-theme-accent bg-black/20"
          >
            <Plus size={14} />
            <span className="text-[7px] font-black uppercase mt-1">Paste</span>
          </div>
        )}
        {isLocked && figures.length === 0 && (
          <div className="flex-shrink-0 w-full h-full border border-white/5 rounded-2xl flex items-center justify-center text-white/5 italic text-[10px]">No Figures</div>
        )}
      </div>
    </div>
  );
};

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
  const titleFontSize = Math.max(22, baseFontSize + 8);
  if (isTemplate) {
    return (
      <div className={cn(
        "apple-glass !bg-[#0b1221]/96 !rounded-[28px] px-6 sm:px-7 py-5 sm:py-6 shadow-2xl transition-all duration-300 group relative border-2 flex flex-col items-center justify-center w-[clamp(180px,22vw,260px)] max-w-[90vw] h-auto hover:z-[1000]",
        selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
      )}>
        <div className={cn("absolute -top-3 left-4 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-[0.2em] border z-20 shadow-lg", isTrigger ? "bg-cyan-500 border-cyan-400 text-white" : "bg-rose-500 border-rose-400 text-white")}>
          {isTrigger ? "TRIGGER" : "OUTCOME"}
        </div>
        <div className="w-full relative flex justify-center">
          <h4
            className="max-w-full text-center font-black text-white tracking-tight leading-tight uppercase"
            style={{ fontSize: `${titleFontSize}px` }}
            title={data.label}
          >
            {data.label}
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
      "apple-glass !bg-[#0f172a]/95 !rounded-2xl px-5 sm:px-7 py-5 sm:py-6 w-[clamp(320px,32vw,460px)] max-w-[92vw] shadow-2xl transition-all duration-300 relative border-2 h-auto min-h-[380px] hover:z-[1000]",
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
            className="font-black text-white tracking-tight leading-tight hover:text-theme-accent transition-colors line-clamp-2 overflow-hidden min-h-[2.4em]"
            style={{ fontSize: `${titleFontSize}px` }}
            title={data.label || 'Untitled Task'}
          >
            {data.label || "Untitled Task"}
          </h4>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-black/40 rounded-[22px] p-4 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-1">Manual</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/40 rounded-[22px] p-4 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-1">Machine</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 border-t border-white/5">
             <div className="flex items-center gap-6 flex-1 justify-center min-w-0">
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
               <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[12px] font-bold text-white/40 uppercase">{s.name}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[12px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
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

const DiamondNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const baseFontSize = data.baseFontSize || 14;
  const titleFontSize = Math.max(22, baseFontSize + 8);
  return (
    <div className={cn("relative w-[clamp(220px,24vw,280px)] h-[clamp(220px,24vw,280px)] flex items-center justify-center transition-all duration-300 hover:z-[1000]", selected ? 'scale-105 z-50' : 'z-10')}>
      <div className={cn("absolute w-[clamp(174px,17vw,198px)] h-[clamp(174px,17vw,198px)] rotate-45 border-2 transition-all duration-300 bg-[#0b1221]/96 rounded-[28px]", selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20', data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : '')} />
      
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
          className="max-w-[180px] text-center font-bold text-white leading-tight break-words line-clamp-3 transition-colors"
          style={{ fontSize: `${titleFontSize}px` }}
          title={data.label || 'Condition'}
        >
          {data.label || "Condition"}
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
  <div className="bg-status-error/10 border border-status-error/30 rounded-2xl p-4 flex flex-col gap-3 animate-apple-in">
    <div className="flex items-center gap-3">
      <AlertCircle size={14} className="text-status-error" />
      <span className="text-[10px] font-black text-white uppercase tracking-tight">{label}</span>
    </div>
    <div className="flex gap-2">
      <button onClick={(e) => { e.stopPropagation(); onConfirm(); }} className="flex-1 py-2 bg-status-error text-white text-[9px] font-black uppercase rounded-2xl shadow-lg shadow-status-error/20 hover:bg-status-error/80 transition-colors">Confirm Delete</button>
      <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="flex-1 py-2 bg-white/5 text-white/40 text-[9px] font-black uppercase rounded-2xl hover:bg-white/10 transition-colors">Cancel</button>
    </div>
  </div>
);

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, templates = [], relatedWorkflows = [], rollbackPreview, onSave, onBack, onExit, onCreateRollbackDraft, onGovernanceAction, setIsDirty }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project, fitView, zoomIn, zoomOut, setViewport } = useReactFlow();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [layoutPrefs, setLayoutPrefs] = useState<BuilderLayoutPrefs>({
    inspectorDock: 'right',
    inspectorCollapsed: false,
    showMiniMap: true,
    showCanvasControls: true,
  });
  const [baseFontSize] = useState(14);
  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<'bezier' | 'smoothstep' | 'straight'>('smoothstep');
  const [builderMode, setBuilderMode] = useState<BuilderMode>('guided');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: false, outputs: false, manual_inputs: false, manual_outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [isOutputPickerOpen, setIsOutputPickerOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [isMetadataEditMode, setIsMetadataEditMode] = useState(false);
  const [ownerPositionsCollapsed, setOwnerPositionsCollapsed] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [workflowComments, setWorkflowComments] = useState<WorkflowComment[]>([]);
  const [accessControl, setAccessControl] = useState<AccessControlState>({
    visibility: 'private',
    viewers: [],
    editors: [],
    mention_groups: [],
    owner: 'system_user',
  });
  const [ownership, setOwnership] = useState<OwnershipState>({
    owner: 'system_user',
    smes: [],
    backup_owners: [],
    automation_owner: '',
    reviewers: [],
  });
  const [relatedWorkflowIds, setRelatedWorkflowIds] = useState<number[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequestDraft[]>([]);
  const [commentDraft, setCommentDraft] = useState<WorkflowComment>(createWorkflowComment());
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState('');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [saveConflict, setSaveConflict] = useState<any>(null);
  const [focusMode, setFocusMode] = useState(false);
  const draftSaveTimer = useRef<number | null>(null);
  const draftRestoreAttempted = useRef(false);
  const initialSnapshotRef = useRef<any>(null);
  const layoutPrefsKey = useMemo(() => getWorkflowBuilderLayoutKey(workflow?.id), [workflow?.id]);

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
  const [builderSearch, setBuilderSearch] = useState('');

  const validationIssues = useMemo(() => auditWorkflowDraft({ metadata, tasks, edges }), [metadata, tasks, edges]);
  const validationErrorCount = useMemo(() => validationIssues.filter(issue => issue.severity === 'error').length, [validationIssues]);
  const validationWarningCount = useMemo(() => validationIssues.filter(issue => issue.severity === 'warning').length, [validationIssues]);
  const validationSummary = useMemo(() => summarizeAuditIssues(validationIssues), [validationIssues]);
  const blockingValidationIssues = useMemo(() => validationIssues.filter((issue) => new Set([
    'graph.unreachable',
    'graph.disconnected',
    'graph.cycle',
    'edge.endpoint_missing',
    'edge.endpoint_invalid',
    'edge.self_loop',
    'graph.trigger_incoming',
    'graph.outcome_outgoing',
    'graph.decision_route_count',
    'graph.decision_labels',
    'workflow.trigger_missing',
    'workflow.outcome_missing'
  ]).has(issue.code)), [validationIssues]);
  const workflowBuilderDraftKey = useMemo(() => getWorkflowBuilderDraftKey(workflow?.id), [workflow?.id]);
  const workflowSourceStamp = useMemo(() => workflow?.updated_at || workflow?.updatedAt || workflow?.version || null, [workflow?.updated_at, workflow?.updatedAt, workflow?.version]);
  const templateList = useMemo(() => (Array.isArray(templates) ? templates : []), [templates]);
  const relatedWorkflowList = useMemo(() => (Array.isArray(relatedWorkflows) ? relatedWorkflows : []), [relatedWorkflows]);

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedNodeIds.includes(String(task.node_id || task.id))),
    [tasks, selectedNodeIds]
  );
  const selectedNodesAreProtected = selectedTasks.some((task) => task.interface === 'TRIGGER' || task.interface === 'OUTCOME');
  const selectedItemCount = selectedNodeIds.length + selectedEdgeIds.length;
  const savedAtLabel = useMemo(() => {
    const parsed = parseIsoDate(lastSavedAt);
    return parsed ? parsed.toLocaleString() : 'Not saved yet';
  }, [lastSavedAt]);
  const draftSavedAtLabel = useMemo(() => {
    const parsed = parseIsoDate(lastDraftSavedAt);
    return parsed ? parsed.toLocaleString() : 'Waiting for local draft save';
  }, [lastDraftSavedAt]);

  const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
  const updateLayoutPrefs = useCallback((updates: Partial<BuilderLayoutPrefs>) => {
    setLayoutPrefs((prev) => ({ ...prev, ...updates }));
  }, []);

  const builderSuggestions = useMemo(() => {
    const templateMatches = rankItemsByQuery(
      templateList,
      builderSearch,
      [
        (template: any) => template?.label,
        (template: any) => template?.description,
        (template: any) => template?.workflow_type,
        (template: any) => template?.key,
      ],
      6,
    );
    const workflowMatches = rankItemsByQuery(
      relatedWorkflowList,
      builderSearch,
      [
        (item: any) => item?.name,
        (item: any) => item?.description,
        (item: any) => item?.workflow_type,
      ],
      6,
    );
    const taskLibrary = rankItemsByQuery(
      tasks.filter((task) => task.interface !== 'TRIGGER' && task.interface !== 'OUTCOME'),
      builderSearch,
      [
        (task) => task.name,
        (task) => task.description,
        (task) => task.task_type,
        (task) => task.owning_team,
      ],
      6,
    );
    return { templateMatches, workflowMatches, taskLibrary };
  }, [templateList, relatedWorkflowList, tasks, builderSearch]);

  const clearSelection = useCallback(() => {
    setSelectedTaskId(null);
    setSelectedEdgeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, []);

  const focusAuditIssue = useCallback((issue: WorkflowAuditIssue) => {
    if (issue.scope === 'workflow' || !issue.targetId) {
      setSelectedTaskId(null);
      setSelectedEdgeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setInspectorTab('overview');
      setIsMetadataEditMode(true);
      return;
    }
    const targetNode = nodes.find((node) => node.id === issue.targetId);
    const targetEdge = edges.find((edge) => edge.id === issue.targetId);
    if (targetNode) {
      setSelectedTaskId(targetNode.id);
      setSelectedEdgeId(null);
      setSelectedNodeIds([targetNode.id]);
      setSelectedEdgeIds([]);
      setInspectorTab(issue.code.includes('validation') ? 'validation' : 'overview');
      return;
    }
    if (targetEdge) {
      setSelectedEdgeId(targetEdge.id);
      setSelectedTaskId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([targetEdge.id]);
    }
  }, [edges, nodes]);

  const restoreDraft = useCallback((draft: any) => {
    if (!draft) return;
    setMetadata(draft.metadata || {});
    setTasks(draft.tasks || []);
    setNodes(draft.nodes || []);
    setEdges(draft.edges || []);
    setBuilderMode(draft.builderMode || 'guided');
    setShowGuide(draft.showGuide ?? true);
    setIsMetadataEditMode(draft.isMetadataEditMode ?? false);
    setSelectedTaskId(draft.selectedTaskId || null);
    setSelectedEdgeId(draft.selectedEdgeId || null);
    setSelectedNodeIds(Array.isArray(draft.selectedNodeIds) ? draft.selectedNodeIds : []);
    setSelectedEdgeIds(Array.isArray(draft.selectedEdgeIds) ? draft.selectedEdgeIds : []);
    setWorkflowComments(Array.isArray(draft.workflowComments) ? draft.workflowComments : []);
    setAccessControl(draft.accessControl || accessControl);
    setOwnership(draft.ownership || ownership);
    setRelatedWorkflowIds(Array.isArray(draft.relatedWorkflowIds) ? draft.relatedWorkflowIds : []);
    setReviewRequests(Array.isArray(draft.reviewRequests) ? draft.reviewRequests : []);
    if (draft.commentDraft) setCommentDraft(draft.commentDraft);
    if (typeof draft.importDraft === 'string') setImportDraft(draft.importDraft);
    setDraftRestored(true);
    setSaveStatus('saved');
    toast.success('Builder draft restored');
    window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 300 }));
  }, [accessControl, fitView, ownership]);

  const saveToHistory = useCallback(() => {
    // Optimization: Only save if state actually changed
    const currentState = JSON.stringify({ nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, reviewRequests });
    const lastHistory = history.length > 0 ? JSON.stringify(history[history.length - 1]) : null;
    if (currentState === lastHistory) return;

    setHistory(prev => [...prev.slice(-49), {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      tasks: JSON.parse(JSON.stringify(tasks)),
      metadata: JSON.parse(JSON.stringify(metadata)),
      workflowComments: JSON.parse(JSON.stringify(workflowComments)),
      accessControl: JSON.parse(JSON.stringify(accessControl)),
      ownership: JSON.parse(JSON.stringify(ownership)),
      relatedWorkflowIds: JSON.parse(JSON.stringify(relatedWorkflowIds)),
      reviewRequests: JSON.parse(JSON.stringify(reviewRequests)),
    }]);
    setRedoStack([]);
  }, [nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, reviewRequests, history]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setRedoStack(prev => [...prev, {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      tasks: JSON.parse(JSON.stringify(tasks)),
      metadata: JSON.parse(JSON.stringify(metadata)),
      workflowComments: JSON.parse(JSON.stringify(workflowComments)),
      accessControl: JSON.parse(JSON.stringify(accessControl)),
      ownership: JSON.parse(JSON.stringify(ownership)),
      relatedWorkflowIds: JSON.parse(JSON.stringify(relatedWorkflowIds)),
      reviewRequests: JSON.parse(JSON.stringify(reviewRequests)),
    }]);
    
    setNodes(lastState.nodes);
    setEdges(lastState.edges);
    setTasks(lastState.tasks);
    setMetadata(lastState.metadata);
    setWorkflowComments(lastState.workflowComments || []);
    setAccessControl(lastState.accessControl || accessControl);
    setOwnership(lastState.ownership || ownership);
    setRelatedWorkflowIds(lastState.relatedWorkflowIds || []);
    setReviewRequests(lastState.reviewRequests || []);
    setHistory(prev => prev.slice(0, -1));
  }, [history, nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, reviewRequests, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      tasks: JSON.parse(JSON.stringify(tasks)),
      metadata: JSON.parse(JSON.stringify(metadata)),
      workflowComments: JSON.parse(JSON.stringify(workflowComments)),
      accessControl: JSON.parse(JSON.stringify(accessControl)),
      ownership: JSON.parse(JSON.stringify(ownership)),
      relatedWorkflowIds: JSON.parse(JSON.stringify(relatedWorkflowIds)),
      reviewRequests: JSON.parse(JSON.stringify(reviewRequests)),
    }]);
    
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setTasks(nextState.tasks);
    setMetadata(nextState.metadata);
    setWorkflowComments(nextState.workflowComments || []);
    setAccessControl(nextState.accessControl || accessControl);
    setOwnership(nextState.ownership || ownership);
    setRelatedWorkflowIds(nextState.relatedWorkflowIds || []);
    setReviewRequests(nextState.reviewRequests || []);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, reviewRequests, setNodes, setEdges]);

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

  const workflowDiff = useMemo(() => {
    const baseline = initialSnapshotRef.current || {};
    const baselineMetadata = baseline.metadata || {};
    const baselineTasks = new Map((baseline.tasks || []).map((task: any) => [String(task.node_id || task.id), task]));
    const currentTasks = new Map(tasks.map((task) => [String(task.node_id || task.id), task]));
    const addedTasks = tasks.filter((task) => !baselineTasks.has(String(task.node_id || task.id)));
    const removedTasks = (baseline.tasks || []).filter((task: any) => !currentTasks.has(String(task.node_id || task.id)));
    const changedTasks = tasks
      .map((task) => {
        const baselineTask = baselineTasks.get(String(task.node_id || task.id));
        if (!baselineTask) return null;
        const comparisons = ['name', 'description', 'task_type', 'manual_time_minutes', 'automation_time_minutes', 'machine_wait_time_minutes', 'occurrence', 'owning_team', 'validation_needed'];
        const changedFields = comparisons.filter((key) => JSON.stringify((task as any)[key]) !== JSON.stringify((baselineTask as any)[key]));
        return changedFields.length > 0 ? { id: String(task.node_id || task.id), name: task.name, changedFields } : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; changedFields: string[] }>;
    const edgeKey = (edge: any) => String(edge.id || `${edge.source}::${edge.target}`);
    const baselineEdges = new Map((baseline.edges || []).map((edge: any) => [edgeKey(edge), edge]));
    const currentEdges = new Map(edges.map((edge) => [edgeKey(edge), edge]));
    const addedEdges = edges.filter((edge) => !baselineEdges.has(edgeKey(edge)));
    const removedEdges = (baseline.edges || []).filter((edge: any) => !currentEdges.has(edgeKey(edge)));
    const changedEdges = edges
      .map((edge) => {
        const baselineEdge = baselineEdges.get(edgeKey(edge));
        if (!baselineEdge) return null;
        const changedFields = ['source', 'target', 'label', 'edge_style', 'line_style', 'color'].filter((key) => {
          const currentValue = key === 'label' ? edge.data?.label : key === 'edge_style' ? edge.data?.edgeStyle : key === 'line_style' ? edge.data?.lineStyle : key === 'color' ? edge.data?.color : (edge as any)[key];
          const baselineValue = (baselineEdge as any)[key];
          return JSON.stringify(currentValue) !== JSON.stringify(baselineValue);
        });
        return changedFields.length > 0 ? { id: String(edge.id), changedFields } : null;
      })
      .filter(Boolean) as Array<{ id: string; changedFields: string[] }>;
    const changedMetadata = Object.entries(metadata)
      .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((baselineMetadata as any)[key]))
      .map(([key]) => key);
    return {
      addedTasks,
      removedTasks,
      changedTasks,
      addedEdges,
      removedEdges,
      changedEdges,
      changedMetadata,
    };
  }, [edges, metadata, tasks]);

  const versionHistory = useMemo(() => {
    const currentVersion = workflow?.version || metadata.version || 1;
    const relatedVersions = [workflow, ...relatedWorkflowList]
      .filter(Boolean)
      .filter((item: any) => {
        if (!workflow?.version_group) return item?.id === workflow?.id || String(item?.name || '').toLowerCase() === String(workflow?.name || '').toLowerCase();
        return item?.version_group === workflow.version_group || item?.parent_workflow_id === workflow?.id || item?.id === workflow?.id;
      })
      .map((item: any) => ({
        id: item.id,
        version: item.version || currentVersion,
        name: item.name,
        state: item.approval_state || item.review_state || 'Draft',
        updated_at: item.updated_at || item.created_at || null,
        isCurrent: item.id === workflow?.id,
      }))
      .sort((a: any, b: any) => Number(b.version) - Number(a.version));
    return relatedVersions.length > 0 ? relatedVersions : [{
      id: workflow?.id,
      version: currentVersion,
      name: workflow?.name,
      state: workflow?.approval_state || 'Draft',
      updated_at: workflow?.updated_at || null,
      isCurrent: true,
    }];
  }, [metadata.version, relatedWorkflowList, workflow]);

  const auditTrail = useMemo(() => workflow?.activity_timeline || [], [workflow?.activity_timeline]);
  const frictionSignals = useMemo(() => {
    const analysis = workflow?.analysis || {};
    const topRisks = ((analysis.task_diagnostic_summary || {}).top_risk_nodes || []).slice(0, 5);
    return {
      reviewQueue: reviewRequests.filter((request) => request.status === 'open').length,
      unresolvedComments: workflowComments.filter((comment) => !comment.resolved).length,
      bottlenecks: (analysis.bottlenecks || []).slice(0, 3),
      topRisks,
      standardsFlags: (workflow?.governance?.standards_flags || []).slice(0, 5),
      auditEntries: auditTrail.length,
    };
  }, [auditTrail.length, reviewRequests, workflow, workflowComments]);

  const commentThreads = useMemo(() => {
    const byParent = new Map<string | undefined, WorkflowComment[]>();
    workflowComments.forEach((comment) => {
      const key = comment.parent_id || undefined;
      const list = byParent.get(key) || [];
      list.push(comment);
      byParent.set(key, list);
    });
    const sortByTime = (items: WorkflowComment[]) => [...items].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return sortByTime(byParent.get(undefined) || []).map((comment) => ({
      comment,
      replies: sortByTime(byParent.get(comment.id) || []),
    }));
  }, [workflowComments]);

  const replyTargetComment = useMemo(
    () => workflowComments.find((comment) => comment.id === replyTargetCommentId) || null,
    [replyTargetCommentId, workflowComments]
  );

  const exportWorkflowDraft = useCallback(() => {
    const payload = {
      metadata,
      tasks,
      edges,
      workflowComments,
      accessControl,
      ownership,
      relatedWorkflowIds,
      reviewRequests,
      builderMode,
      versionHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(metadata.name || workflow?.name || 'workflow-builder').toLowerCase().replace(/\s+/g, '-')}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    toast.success('Workflow draft exported');
  }, [accessControl, builderMode, edges, metadata, ownership, relatedWorkflowIds, reviewRequests, tasks, versionHistory, workflow?.name, workflowComments]);

  const importWorkflowDraft = useCallback(() => {
    if (!importDraft.trim()) {
      toast.error('Paste a workflow JSON payload first.');
      return;
    }
    try {
      const parsed = JSON.parse(importDraft);
      if (parsed.metadata) setMetadata(parsed.metadata);
      if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
      if (Array.isArray(parsed.edges)) setEdges(parsed.edges);
      if (Array.isArray(parsed.workflowComments)) setWorkflowComments(parsed.workflowComments);
      if (parsed.accessControl) setAccessControl(parsed.accessControl);
      if (parsed.ownership) setOwnership(parsed.ownership);
      if (Array.isArray(parsed.relatedWorkflowIds)) setRelatedWorkflowIds(parsed.relatedWorkflowIds);
      if (Array.isArray(parsed.reviewRequests)) setReviewRequests(parsed.reviewRequests);
      if (parsed.builderMode) setBuilderMode(parsed.builderMode);
      setShowGuide(false);
      setIsDirty?.(true);
      toast.success('Workflow draft imported');
    } catch (error) {
      toast.error('Invalid workflow JSON payload.');
    }
  }, [importDraft, setEdges, setIsDirty]);

  const addWorkflowComment = useCallback(() => {
    if (!commentDraft.message.trim()) {
      toast.error('Comment message is required.');
      return;
    }
    const nextComment = {
      ...commentDraft,
      id: commentDraft.id || `comment-${Date.now()}`,
      created_at: commentDraft.created_at || new Date().toISOString(),
      scope: commentDraft.scope || 'workflow',
      scope_id: commentDraft.scope_id || selectedTaskId || undefined,
      parent_id: replyTargetCommentId || commentDraft.parent_id,
    };
    saveToHistory();
    setWorkflowComments((prev) => [nextComment, ...prev]);
    setCommentDraft(createWorkflowComment(selectedTaskId ? 'task' : 'workflow', selectedTaskId || ''));
    setReplyTargetCommentId(null);
    setIsDirty?.(true);
    toast.success('Comment added');
  }, [commentDraft, replyTargetCommentId, saveToHistory, selectedTaskId, setIsDirty]);

  const toggleCommentResolved = useCallback((commentId: string) => {
    saveToHistory();
    setWorkflowComments((prev) => prev.map((comment) => comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const updateRelatedWorkflowIds = useCallback((workflowId: number) => {
    saveToHistory();
    setRelatedWorkflowIds((prev) => prev.includes(workflowId) ? prev.filter((id) => id !== workflowId) : [...prev, workflowId]);
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const updateAccessControl = useCallback((updates: Partial<AccessControlState>) => {
    saveToHistory();
    setAccessControl((prev) => ({ ...prev, ...updates }));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const updateOwnership = useCallback((updates: Partial<OwnershipState>) => {
    saveToHistory();
    setOwnership((prev) => ({ ...prev, ...updates }));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const addReviewRequest = useCallback(() => {
    saveToHistory();
    setReviewRequests((prev) => [createReviewRequestDraft(), ...prev]);
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const updateReviewRequest = useCallback((id: string, updates: Partial<ReviewRequestDraft>) => {
    saveToHistory();
    setReviewRequests((prev) => prev.map((request) => request.id === id ? { ...request, ...updates } : request));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const deleteReviewRequest = useCallback((id: string) => {
    saveToHistory();
    setReviewRequests((prev) => prev.filter((request) => request.id !== id));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const runGovernanceAction = useCallback((action: string, requestId?: string) => {
    if (typeof (onGovernanceAction) !== 'function') {
      toast.error('Governance actions are unavailable in this view.');
      return;
    }
    onGovernanceAction(action, requestId);
  }, [onGovernanceAction]);

  const renderWorkflowOpsSurface = () => (
    <div className="space-y-8 animate-apple-in pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Diff and Version History</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Compare this draft to the baseline and review the version line.</p>
            </div>
            <History size={16} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Metadata Changes</p>
              <p className="mt-2 text-[22px] font-black text-theme-accent">{workflowDiff.changedMetadata.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Route Changes</p>
              <p className="mt-2 text-[22px] font-black text-emerald-300">{workflowDiff.addedEdges.length + workflowDiff.removedEdges.length}</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[12rem] overflow-auto pr-1 custom-scrollbar">
            {workflowDiff.addedTasks.length === 0 && workflowDiff.removedTasks.length === 0 && workflowDiff.changedMetadata.length === 0 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">
                This draft is aligned with the current baseline snapshot.
              </div>
            )}
            {workflowDiff.addedTasks.slice(0, 4).map((task: any) => (
              <div key={`added-${task.node_id || task.id}`} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-200">
                Added task: {task.name}
              </div>
            ))}
            {workflowDiff.changedTasks.slice(0, 4).map((task: any) => (
              <div key={`changed-${task.id}`} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[11px] font-bold text-amber-200">
                Updated task: {task.name} ({task.changedFields.join(', ')})
              </div>
            ))}
            {workflowDiff.removedTasks.slice(0, 4).map((task: any) => (
              <div key={`removed-${task.node_id || task.id}`} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-200">
                Removed task: {task.name}
              </div>
            ))}
            {workflowDiff.changedEdges.slice(0, 4).map((edge: any) => (
              <div key={`edge-${edge.id}`} className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-[11px] font-bold text-sky-200">
                Updated route: {edge.changedFields.join(', ')}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {versionHistory.map((version) => (
              <span key={`${version.id}-${version.version}`} className={cn("rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em]", version.isCurrent ? "border-theme-accent/20 bg-theme-accent/10 text-theme-accent" : "border-white/10 bg-white/5 text-white/55")}>
                v{version.version} {version.isCurrent ? 'Current' : version.state}
              </span>
            ))}
          </div>
          {rollbackPreview?.available && onCreateRollbackDraft && (
            <button onClick={onCreateRollbackDraft} className="w-full rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
              Create Rollback Draft
            </button>
          )}
        </div>

        <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Approvals and Review</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Publish, request changes, or certify without leaving the builder.</p>
            </div>
            <ShieldCheck size={16} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => runGovernanceAction('approve_review')} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">Approve Review</button>
            <button onClick={() => runGovernanceAction('request_changes')} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white transition-all">Request Changes</button>
            <button onClick={() => runGovernanceAction('approve_workflow')} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">Approve Workflow</button>
            <button onClick={() => runGovernanceAction('certify')} className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300 hover:bg-violet-500 hover:text-white transition-all">Certify</button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Review Request Editor</p>
              <button onClick={addReviewRequest} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">Add Request</button>
            </div>
            <div className="space-y-2 max-h-[11rem] overflow-auto pr-1 custom-scrollbar">
              {reviewRequests.map((request) => (
                <div key={request.id} className="rounded-[22px] border border-white/10 bg-black/20 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <input className="w-full max-w-[12rem] rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black text-white outline-none focus:border-theme-accent" value={request.role} onChange={(e) => updateReviewRequest(request.id, { role: e.target.value })} placeholder="Reviewer role" />
                    <button onClick={() => deleteReviewRequest(request.id)} className="rounded-2xl border border-status-error/20 bg-status-error/10 px-2 py-1 text-[8px] font-black uppercase text-status-error">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-theme-accent" value={request.requested_by} onChange={(e) => updateReviewRequest(request.id, { requested_by: e.target.value })} placeholder="Requested by" />
                    <input className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-theme-accent" value={request.due_at} onChange={(e) => updateReviewRequest(request.id, { due_at: e.target.value })} placeholder="Due date" />
                    <select className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black text-white outline-none focus:border-theme-accent" value={request.status} onChange={(e) => updateReviewRequest(request.id, { status: e.target.value })}>
                      <option value="open">Open</option>
                      <option value="approved">Approved</option>
                      <option value="changes_requested">Changes Requested</option>
                    </select>
                  </div>
                  <textarea className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold text-white/70 outline-none focus:border-theme-accent resize-none min-h-[4.5rem]" value={request.note} onChange={(e) => updateReviewRequest(request.id, { note: e.target.value })} placeholder="Request note" />
                </div>
              ))}
              {reviewRequests.length === 0 && <p className="text-[11px] font-bold text-white/40">No review requests configured yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Comments and Annotations</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Capture review context and keep the reason for change visible.</p>
            </div>
            <MessageSquare size={16} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={commentDraft.scope} onChange={(e) => setCommentDraft((prev) => ({ ...prev, scope: e.target.value as WorkflowComment['scope'] }))}>
              <option value="workflow">Workflow</option>
              <option value="task">Task</option>
              <option value="section">Section</option>
            </select>
            <input className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={commentDraft.scope_id || ''} onChange={(e) => setCommentDraft((prev) => ({ ...prev, scope_id: e.target.value }))} placeholder={selectedTaskId ? selectedTask?.name || 'Selected task' : 'Scope id'} />
          </div>
          <textarea className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] font-bold text-white/80 outline-none focus:border-theme-accent min-h-[7rem] resize-none" value={commentDraft.message} onChange={(e) => setCommentDraft((prev) => ({ ...prev, message: e.target.value }))} placeholder="Write a clear review note or annotation..." />
          <div className="flex items-center justify-between gap-3">
            <input className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white/70 outline-none focus:border-theme-accent" value={commentDraft.assignee || ''} onChange={(e) => setCommentDraft((prev) => ({ ...prev, assignee: e.target.value }))} placeholder="Optional assignee" />
            <button onClick={addWorkflowComment} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">Add Comment</button>
          </div>
          {replyTargetCommentId && (
            <div className="rounded-[22px] border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[11px] font-bold text-theme-accent flex items-center justify-between gap-3">
              <span>Replying to {replyTargetComment?.author || replyTargetComment?.scope || 'selected comment'}</span>
              <button onClick={() => setReplyTargetCommentId(null)} className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase text-white/55">Clear</button>
            </div>
          )}
          <div className="space-y-3 max-h-[16rem] overflow-auto pr-1 custom-scrollbar">
            {commentThreads.map(({ comment, replies }) => (
              <div key={comment.id} className="space-y-2">
                <button onClick={() => setSelectedCommentId(comment.id)} className={cn("w-full rounded-[22px] border p-4 text-left transition-all", selectedCommentId === comment.id ? "border-theme-accent/30 bg-theme-accent/10" : "border-white/10 bg-black/20 hover:bg-white/[0.05]")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{comment.author}</p>
                    <span className={cn("rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em]", comment.resolved ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300")}>{comment.resolved ? 'Resolved' : comment.review_state || 'Open'}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-white/70 leading-relaxed">{comment.message}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">{comment.scope}{comment.scope_id ? ` • ${comment.scope_id}` : ''}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setReplyTargetCommentId(comment.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">Reply</button>
                      <button onClick={() => toggleCommentResolved(comment.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">{comment.resolved ? 'Reopen' : 'Resolve'}</button>
                    </div>
                  </div>
                </button>
                {replies.length > 0 && (
                  <div className="ml-4 space-y-2 border-l border-white/10 pl-3">
                    {replies.map((reply) => (
                      <button key={reply.id} onClick={() => setSelectedCommentId(reply.id)} className={cn("w-full rounded-[20px] border p-3 text-left transition-all", selectedCommentId === reply.id ? "border-theme-accent/30 bg-theme-accent/10" : "border-white/10 bg-black/15 hover:bg-white/[0.04]")}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/80">{reply.author}</p>
                          <span className={cn("rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em]", reply.resolved ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300")}>{reply.resolved ? 'Resolved' : reply.review_state || 'Open'}</span>
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-white/65 leading-relaxed">{reply.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {workflowComments.length === 0 && <p className="text-[11px] font-bold text-white/40">No annotations have been added yet.</p>}
          </div>
        </div>

        <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Access, Ownership, and Reuse</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Standardize who owns the workflow and what can be reused.</p>
            </div>
            <Users size={16} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={accessControl.visibility} onChange={(e) => updateAccessControl({ visibility: e.target.value })}>
              <option value="private">Private</option>
              <option value="workspace">Workspace</option>
              <option value="org">Org</option>
            </select>
            <input className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={accessControl.owner} onChange={(e) => updateAccessControl({ owner: e.target.value })} placeholder="Access owner" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <textarea className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white/70 outline-none focus:border-theme-accent min-h-[5.5rem] resize-none" value={accessControl.editors.join('\n')} onChange={(e) => updateAccessControl({ editors: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="Editors, one per line" />
            <textarea className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white/70 outline-none focus:border-theme-accent min-h-[5.5rem] resize-none" value={accessControl.viewers.join('\n')} onChange={(e) => updateAccessControl({ viewers: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="Viewers, one per line" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <textarea className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white/70 outline-none focus:border-theme-accent min-h-[5.5rem] resize-none" value={ownership.smes.join('\n')} onChange={(e) => updateOwnership({ smes: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="SMEs, one per line" />
            <textarea className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white/70 outline-none focus:border-theme-accent min-h-[5.5rem] resize-none" value={ownership.reviewers.join('\n')} onChange={(e) => updateOwnership({ reviewers: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="Reviewers, one per line" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={ownership.owner} onChange={(e) => updateOwnership({ owner: e.target.value })} placeholder="Workflow owner" />
            <input className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={ownership.automation_owner || ''} onChange={(e) => updateOwnership({ automation_owner: e.target.value })} placeholder="Automation owner" />
          </div>
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Reusable Linked Workflows</p>
            <div className="space-y-2 max-h-[12rem] overflow-auto pr-1 custom-scrollbar">
              {relatedWorkflowList.slice(0, 6).map((item: any) => (
                <button key={item.id} onClick={() => updateRelatedWorkflowIds(Number(item.id))} className={cn("w-full rounded-2xl border px-4 py-3 text-left transition-all", relatedWorkflowIds.includes(Number(item.id)) ? "border-theme-accent/30 bg-theme-accent/10" : "border-white/10 bg-black/20 hover:bg-white/[0.05]")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">{relatedWorkflowIds.includes(Number(item.id)) ? 'Linked' : 'Link'}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{item.workflow_type || item.description || 'Reusable component'}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 border-t border-white/5 pt-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Suggested Reuse</p>
            <div className="space-y-2 max-h-[12rem] overflow-auto pr-1 custom-scrollbar">
                  {(builderSuggestions.workflowMatches.length > 0 ? builderSuggestions.workflowMatches : relatedWorkflowList).slice(0, 6).map((item: any) => (
                    <div key={`suggested-${item.id}`} className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Suggested</span>
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-white/55">{item.workflow_type || item.description || 'Reusable component'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {relatedWorkflowIds.includes(Number(item.id)) ? (
                          <span className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent">
                            Linked
                          </span>
                        ) : (
                          <button onClick={() => updateRelatedWorkflowIds(Number(item.id))} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                            Link Workflow
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-4">
        <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Audit Trail and Usage Friction</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Keep the review record visible and surface the most likely adoption blockers.</p>
            </div>
            <GitBranch size={16} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Audit Entries</p>
              <p className="mt-2 text-[22px] font-black text-theme-accent">{frictionSignals.auditEntries}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Open Comments</p>
              <p className="mt-2 text-[22px] font-black text-amber-300">{frictionSignals.unresolvedComments}</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[14rem] overflow-auto pr-1 custom-scrollbar">
            {auditTrail.map((entry: any) => (
              <div key={entry.id || `${entry.type}-${entry.created_at}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{entry.type}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">{entry.actor || 'system'}</p>
                </div>
                <p className="mt-1 text-[11px] font-bold text-white/55">{entry.message}</p>
              </div>
            ))}
            {auditTrail.length === 0 && <p className="text-[11px] font-bold text-white/40">No activity has been captured yet.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(frictionSignals.bottlenecks || []).map((item: any) => (
              <div key={item.node_id || item.task_name} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">{item.task_name || 'Bottleneck'}</p>
                <p className="mt-2 text-[16px] font-black text-rose-300">{Number(item.total_burden_minutes || 0).toFixed(1)}m</p>
                <p className="mt-1 text-[10px] font-bold text-white/45">{item.blocker_count || 0} blockers / {item.error_count || 0} errors</p>
              </div>
            ))}
            {((frictionSignals.bottlenecks || []).length === 0) && <p className="text-[11px] font-bold text-white/40">No major friction points are reported in the current analysis.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Import and Export</p>
              <p className="mt-1 text-[12px] font-bold text-white/55">Move workflow definitions in and out as JSON.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportWorkflowDraft} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center gap-2"><FileDown size={12} /> Export</button>
              <button onClick={() => setShowImportPanel((prev) => !prev)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white transition-all flex items-center gap-2"><FileUp size={12} /> Import</button>
            </div>
          </div>
          {showImportPanel && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <textarea className="min-h-[12rem] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-mono text-white/70 outline-none focus:border-theme-accent resize-none" value={importDraft} onChange={(e) => setImportDraft(e.target.value)} placeholder="Paste workflow JSON here..." />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold text-white/45">Import replaces the current builder draft state.</p>
                <button onClick={importWorkflowDraft} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">Apply Import</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Review Queue</p>
              <p className="mt-2 text-[22px] font-black text-white">{frictionSignals.reviewQueue}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Standards Flags</p>
              <p className="mt-2 text-[22px] font-black text-violet-300">{frictionSignals.standardsFlags.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            {frictionSignals.standardsFlags.map((flag: string) => (
              <div key={flag} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[11px] font-bold text-white/60">
                {flag}
              </div>
            ))}
            {frictionSignals.standardsFlags.length === 0 && <p className="text-[11px] font-bold text-white/40">No standards flags are attached yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );

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
    draftRestoreAttempted.current = false;
  }, [workflow?.id]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(layoutPrefsKey);
      if (!raw) {
        setLayoutPrefs({
          inspectorDock: 'right',
          inspectorCollapsed: false,
          showMiniMap: true,
          showCanvasControls: true,
        });
        return;
      }
      const parsed = JSON.parse(raw);
      setLayoutPrefs({
        inspectorDock: parsed?.inspectorDock === 'left' ? 'left' : 'right',
        inspectorCollapsed: Boolean(parsed?.inspectorCollapsed),
        showMiniMap: parsed?.showMiniMap !== false,
        showCanvasControls: parsed?.showCanvasControls !== false,
      });
    } catch (error) {
      console.warn('[WorkflowBuilder] Failed to restore layout prefs:', error);
    }
  }, [layoutPrefsKey, workflow?.id]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(layoutPrefsKey, JSON.stringify(layoutPrefs));
    } catch (error) {
      console.warn('[WorkflowBuilder] Failed to persist layout prefs:', error);
    }
  }, [layoutPrefs, layoutPrefsKey, workflow?.id]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    if (draftRestoreAttempted.current) return;
    try {
      const raw = window.localStorage.getItem(workflowBuilderDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.workflowId !== workflow.id) return;
      if (parsed?.workflowSourceStamp && workflowSourceStamp && parsed.workflowSourceStamp !== workflowSourceStamp) return;
      draftRestoreAttempted.current = true;
      restoreDraft(parsed);
    } catch (error) {
      console.warn('[WorkflowBuilder] Failed to restore draft:', error);
    }
  }, [workflow?.id, workflowBuilderDraftKey, workflowSourceStamp, restoreDraft]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    if (draftSaveTimer.current) {
      window.clearTimeout(draftSaveTimer.current);
    }
    draftSaveTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(workflowBuilderDraftKey, JSON.stringify({
          workflowId: workflow.id,
          workflowSourceStamp,
          metadata,
          tasks,
          edges,
          nodes,
          selectedTaskId,
          selectedEdgeId,
          selectedNodeIds,
          selectedEdgeIds,
          builderMode,
          showGuide,
          isMetadataEditMode,
          workflowComments,
          accessControl,
          ownership,
          relatedWorkflowIds,
          reviewRequests,
          commentDraft,
          importDraft,
        }));
        setLastDraftSavedAt(new Date().toISOString());
        setSaveStatus((current) => current === 'saving' ? current : 'saved');
      } catch (error) {
        console.warn('[WorkflowBuilder] Failed to persist draft:', error);
      }
    }, 450);

    return () => {
      if (draftSaveTimer.current) {
        window.clearTimeout(draftSaveTimer.current);
      }
    };
  }, [
    workflow?.id,
    workflowBuilderDraftKey,
    workflowSourceStamp,
    metadata,
    tasks,
    edges,
    nodes,
    selectedTaskId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    builderMode,
    showGuide,
    isMetadataEditMode,
    workflowComments,
    accessControl,
    ownership,
    relatedWorkflowIds,
    reviewRequests,
    commentDraft,
    importDraft,
    draftRestored,
  ]);

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
      setLastSavedAt(workflow?.updated_at || workflow?.updatedAt || null);
      setWorkflowComments(Array.isArray(workflow?.comments) ? workflow.comments : []);
      setAccessControl({
        visibility: workflow?.access_control?.visibility || 'private',
        viewers: normalizeStringList(workflow?.access_control?.viewers),
        editors: normalizeStringList(workflow?.access_control?.editors),
        mention_groups: normalizeStringList(workflow?.access_control?.mention_groups),
        owner: workflow?.access_control?.owner || workflow?.ownership?.owner || workflow?.created_by || 'system_user',
      });
      setOwnership({
        owner: workflow?.ownership?.owner || workflow?.created_by || workflow?.access_control?.owner || 'system_user',
        smes: normalizeStringList(workflow?.ownership?.smes),
        backup_owners: normalizeStringList(workflow?.ownership?.backup_owners),
        automation_owner: workflow?.ownership?.automation_owner || '',
        reviewers: normalizeStringList(workflow?.ownership?.reviewers),
      });
      setRelatedWorkflowIds(normalizeStringList(workflow?.related_workflow_ids).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
      setReviewRequests(Array.isArray(workflow?.review_requests) ? workflow.review_requests.map((request: any) => ({
        id: String(request.id || `review-${Date.now()}`),
        role: String(request.role || request.requested_from || ''),
        requested_by: String(request.requested_by || request.requested_from || workflow?.created_by || 'system_user'),
        status: String(request.status || 'open'),
        due_at: String(request.due_at || request.review_due_at || ''),
        note: String(request.note || request.message || ''),
      })) : []);
      setCommentDraft(createWorkflowComment());
      setImportDraft('');
      initialSnapshotRef.current = JSON.parse(JSON.stringify({
        metadata: initialMetadata,
        comments: Array.isArray(workflow?.comments) ? workflow.comments : [],
        tasks: Array.isArray(workflow?.tasks) ? workflow.tasks : [],
        edges: Array.isArray(workflow?.edges) ? workflow.edges : [],
        accessControl: workflow?.access_control || {},
        ownership: workflow?.ownership || {},
        relatedWorkflowIds: workflow?.related_workflow_ids || [],
        reviewRequests: Array.isArray(workflow?.review_requests) ? workflow.review_requests : [],
        version: workflow?.version || 1,
        updated_at: workflow?.updated_at || workflow?.updatedAt || null,
      }));

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

  const updateSelectedTasks = useCallback((updates: Partial<TaskEntity>) => {
    if (selectedNodeIds.length === 0) return;
    saveToHistory();
    setTasks(prev => prev.map((task) => {
      if (!selectedNodeIds.includes(String(task.node_id || task.id)) || task.interface === 'TRIGGER' || task.interface === 'OUTCOME') return task;
      const updated = { ...task, ...updates };
      return updated;
    }));
    setNodes(prev => prev.map((node) => selectedNodeIds.includes(node.id) ? { ...node, data: { ...node.data, ...updates, label: (updates as any).name ?? node.data?.label } } : node));
    setIsDirty?.(true);
  }, [selectedNodeIds, saveToHistory, setIsDirty]);

  const alignSelectedNodes = useCallback((mode: 'left' | 'top' | 'center' | 'horizontal' | 'vertical') => {
    if (selectedNodeIds.length < 2) return;
    const targetNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (targetNodes.length < 2) return;
    saveToHistory();
    const xs = targetNodes.map((node) => node.position.x);
    const ys = targetNodes.map((node) => node.position.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const centerX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const sortedByX = [...targetNodes].sort((a, b) => a.position.x - b.position.x);
    const sortedByY = [...targetNodes].sort((a, b) => a.position.y - b.position.y);
    const horizontalStep = Math.max(240, (Math.max(...xs) - Math.min(...xs)) / Math.max(targetNodes.length - 1, 1));

    setNodes(prev => prev.map((node) => {
      if (!selectedNodeIds.includes(node.id)) return node;
      const index = targetNodes.findIndex((selected) => selected.id === node.id);
      if (mode === 'left') return { ...node, position: { ...node.position, x: left } };
      if (mode === 'top') return { ...node, position: { ...node.position, y: top } };
      if (mode === 'center') return { ...node, position: { ...node.position, x: centerX } };
      if (mode === 'horizontal') return { ...node, position: { ...node.position, x: Math.round((sortedByX[index]?.position.x ?? node.position.x) / 10) * 10, y: top + index * 40 } };
      return { ...node, position: { ...node.position, x: left + index * horizontalStep, y: Math.round((sortedByY[index]?.position.y ?? node.position.y) / 10) * 10 } };
    }));
    setIsDirty?.(true);
  }, [nodes, saveToHistory, selectedNodeIds, setIsDirty, setNodes]);

  const applyTemplateToMetadata = useCallback((template: any) => {
    if (!template) return;
    saveToHistory();
    setMetadata((prev) => ({
      ...prev,
      name: template.label || prev.name,
      description: template.description || prev.description,
      workflow_type: template.workflow_type || prev.workflow_type,
      prc: template.prc || prev.prc,
      trigger_type: template.trigger_type || prev.trigger_type,
      trigger_description: template.trigger_description || prev.trigger_description,
      output_type: template.output_type || prev.output_type,
      output_description: template.output_description || prev.output_description,
      tool_family: Array.isArray(template.tool_family) ? template.tool_family : prev.tool_family,
      applicable_tools: Array.isArray(template.applicable_tools) ? template.applicable_tools : prev.applicable_tools,
    }));
    setIsMetadataEditMode(true);
    setShowGuide(true);
    setBuilderMode('guided');
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const clearBuilderDraft = useCallback(() => {
    if (typeof window === 'undefined' || !workflow?.id) return;
    window.localStorage.removeItem(workflowBuilderDraftKey);
    setDraftRestored(false);
    toast.success('Builder draft cleared');
  }, [workflow?.id, workflowBuilderDraftKey]);

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
    setSelectedNodeIds([id]);
    setSelectedEdgeIds([]);
    setIsDirty?.(true);
  };

  const handleSave = () => {
    if (tasks.length === 0) return;
    try {
      setSaveStatus('saving');
      setSaveConflict(null);
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
      if (blockingValidationIssues.length > 0) {
        toast.error(summarizeAuditIssues(blockingValidationIssues));
        return;
      }

      const finalData = {
        ...metadata,
        expected_updated_at: workflow?.updated_at || workflow?.updatedAt || null,
        comments: workflowComments,
        access_control: accessControl,
        ownership,
        related_workflow_ids: relatedWorkflowIds,
        review_requests: reviewRequests,
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
      Promise.resolve(onSave(finalData)).then(() => {
        if (typeof window !== 'undefined' && workflow?.id) {
          window.localStorage.removeItem(workflowBuilderDraftKey);
        }
        setDraftRestored(false);
        const now = new Date().toISOString();
        setLastSavedAt(now);
        setSaveStatus('saved');
        setLastDraftSavedAt(now);
      }).catch((error) => {
        if (error?.response?.status === 409) {
          setSaveConflict(error.response.data || error.response);
          setSaveStatus('conflict');
          toast.error(error.response.data?.message || 'Save conflict detected. Reload the latest workflow before saving again.');
          return;
        }
        setSaveStatus('error');
        toast.error(error?.response?.data?.message || error?.message || 'Failed to save workflow.');
      });
    } catch (err) {
      setSaveStatus('error');
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
      setSelectedNodeIds(prev => prev.filter(id => !ids.includes(id)));
      setIsDirty?.(true);
    } else {
      saveToHistory();
      const ids = deleted.map(n => n.id);
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      setNodes(nds => nds.filter(n => !ids.includes(n.id)));
      setEdges(eds => eds.filter(e => !ids.includes(e.source) && !ids.includes(e.target)));
      setSelectedNodeIds(prev => prev.filter(id => !ids.includes(id)));
      setIsDirty?.(true);
    }
  }, [saveToHistory, setTasks, setNodes, setEdges, setIsDirty]);

  return (
    <div className="flex h-full min-h-0 w-full bg-[#050914] overflow-hidden">
      {/* Existing Output Picker Modal */}
      {isOutputPickerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-apple-in">
          <div className="w-[min(96vw,64rem)] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between gap-3">
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
                          className="px-4 py-2 bg-theme-accent text-white text-[9px] font-black uppercase rounded-2xl opacity-0 group-hover:opacity-100 hover:scale-105 transition-all"
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

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
        <div className={cn("min-h-16 border-b border-white/10 bg-[#0a1120]/92 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 relative z-[100]")}>
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => onBack(metadata)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest mb-1">Workflow Builder</span>
              <h1 className="text-[14px] font-black text-white uppercase truncate max-w-[55vw] sm:max-w-[300px]">{workflow?.name}</h1>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent/80">Repository Definition Surface</span>
            </div>
          </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <div className="flex bg-white/5 border border-white/10 rounded-[24px] p-0.5 mr-2 h-[38px] items-center">
            <button onClick={undo} disabled={history.length === 0} className="px-3 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all border-r border-white/5"><RefreshCw size={14} className="-scale-x-100" /></button>
            <button onClick={redo} disabled={redoStack.length === 0} className="px-3 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all"><RefreshCw size={14} /></button>
          </div>
          <div className="flex bg-white/5 border border-white/10 rounded-[24px] p-0.5 mr-2 h-[38px] items-center">
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
          <button onClick={() => handleLayout(nodes, edges)} className={cn(BUILDER_BUTTON, "flex items-center gap-2 px-4 h-[38px] bg-white/5 border border-white/10 text-white uppercase hover:bg-white/10 transition-all")}><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
          <button data-testid="builder-commit" onClick={handleSave} className={cn(BUILDER_BUTTON, "flex items-center gap-2 px-6 h-[38px] bg-theme-accent text-white shadow-xl shadow-theme-accent/20 hover:scale-[1.02]")}><Save size={14} /> Commit Changes</button>
          <button onClick={onExit} className="p-2 text-white/20 hover:text-status-error"><X size={20} /></button>
        </div>
        </div>

        <div className="flex-1 relative min-h-0 flex flex-col">
          <div className="shrink-0 border-b border-white/10 bg-[#0a1120]/95 backdrop-blur-xl px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button onClick={() => setBuilderMode('guided')} className={cn("px-3 py-2 text-[9px] font-black uppercase rounded-2xl transition-all whitespace-nowrap", builderMode === 'guided' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Guided</button>
                <button onClick={() => setBuilderMode('advanced')} className={cn("px-3 py-2 text-[9px] font-black uppercase rounded-2xl transition-all whitespace-nowrap", builderMode === 'advanced' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Advanced</button>
              </div>
              <button onClick={() => setInspectorTab('validation')} className={cn("px-3 py-2 text-[9px] font-black uppercase rounded-2xl transition-all whitespace-nowrap border", validationErrorCount > 0 ? "border-status-error/30 bg-status-error/10 text-status-error" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {validationErrorCount} Errors · {validationWarningCount} Warnings
              </button>
              <div className={cn("rounded-2xl border px-3 py-2", saveStatus === 'conflict' ? "border-status-error/30 bg-status-error/10 text-status-error" : saveStatus === 'saving' ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : saveStatus === 'saved' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/45")}>
                <p className="text-[8px] font-black uppercase tracking-[0.18em]">Save</p>
                <p className="text-[9px] font-bold leading-none">{saveStatus === 'conflict' ? 'Conflict' : saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Idle'}</p>
              </div>
              <button onClick={() => setFocusMode((prev) => !prev)} className={cn("px-3 py-2 text-[9px] font-black uppercase rounded-2xl transition-all whitespace-nowrap border", focusMode ? "border-theme-accent/30 bg-theme-accent/10 text-theme-accent" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {focusMode ? 'Exit Focus' : 'Focus Mode'}
              </button>
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button onClick={() => updateLayoutPrefs({ inspectorDock: 'left' })} className={cn("rounded-xl px-3 py-2 text-[9px] font-black uppercase transition-all", layoutPrefs.inspectorDock === 'left' ? "bg-theme-accent text-white" : "text-white/45 hover:text-white")}>Dock Left</button>
                <button onClick={() => updateLayoutPrefs({ inspectorDock: 'right' })} className={cn("rounded-xl px-3 py-2 text-[9px] font-black uppercase transition-all", layoutPrefs.inspectorDock === 'right' ? "bg-theme-accent text-white" : "text-white/45 hover:text-white")}>Dock Right</button>
                <button onClick={() => updateLayoutPrefs({ inspectorCollapsed: !layoutPrefs.inspectorCollapsed })} className={cn("rounded-xl px-3 py-2 text-[9px] font-black uppercase transition-all", layoutPrefs.inspectorCollapsed ? "bg-theme-accent text-white" : "text-white/45 hover:text-white")}>{layoutPrefs.inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}</button>
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button onClick={() => updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap })} className={cn("rounded-xl px-3 py-2 text-[9px] font-black uppercase transition-all", layoutPrefs.showMiniMap ? "bg-theme-accent text-white" : "text-white/45 hover:text-white")}>{layoutPrefs.showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}</button>
                <button onClick={() => updateLayoutPrefs({ showCanvasControls: !layoutPrefs.showCanvasControls })} className={cn("rounded-xl px-3 py-2 text-[9px] font-black uppercase transition-all", layoutPrefs.showCanvasControls ? "bg-theme-accent text-white" : "text-white/45 hover:text-white")}>{layoutPrefs.showCanvasControls ? 'Hide Controls' : 'Show Controls'}</button>
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button onClick={() => zoomOut({ duration: 150 })} className="rounded-xl px-3 py-2 text-[9px] font-black uppercase text-white/45 hover:text-white">-</button>
                <button onClick={() => fitView({ padding: 0.12, duration: 250 })} className="rounded-xl px-3 py-2 text-[9px] font-black uppercase text-white/45 hover:text-white">Fit</button>
                <button onClick={() => zoomIn({ duration: 150 })} className="rounded-xl px-3 py-2 text-[9px] font-black uppercase text-white/45 hover:text-white">+</button>
                <button onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 150 })} className="rounded-xl px-3 py-2 text-[9px] font-black uppercase text-white/45 hover:text-white">Reset</button>
              </div>
              {selectedItemCount > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/55">
                    {selectedNodeIds.length} Nodes · {selectedEdgeIds.length} Edges Selected
                  </span>
                  <button onClick={clearSelection} className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase text-white/45 hover:text-white transition-colors">
                    Clear
                  </button>
                </div>
              )}
              {draftRestored && (
                <button onClick={clearBuilderDraft} className="px-3 py-2 text-[9px] font-black uppercase rounded-2xl transition-all whitespace-nowrap border border-theme-accent/20 bg-theme-accent/10 text-theme-accent hover:bg-theme-accent hover:text-white">
                  Clear Draft
                </button>
              )}
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Draft</p>
                <p className="text-[9px] font-bold text-white/70 leading-none">{draftSavedAtLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Server</p>
                <p className="text-[9px] font-bold text-white/70 leading-none">{savedAtLabel}</p>
              </div>
              <input
                value={builderSearch}
                onChange={(e) => setBuilderSearch(e.target.value)}
                placeholder="Search templates, workflows, tasks"
                className="min-w-[220px] flex-1 sm:flex-none sm:w-[280px] bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-theme-accent"
              />
              <div className="ml-auto flex flex-wrap gap-2">
                <button data-testid="builder-add-task" onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-2xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all whitespace-nowrap"><Plus size={12} /> Add Task</button>
                <button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all whitespace-nowrap"><Plus size={12} /> Add Condition</button>
              </div>
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onConnect={onConnect} 
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes} 
            edgeTypes={edgeTypes} 
            onSelectionChange={({ nodes: selectedFlowNodes, edges: selectedFlowEdges }) => {
              const nodeIds = selectedFlowNodes.map((node) => node.id);
              const edgeIds = selectedFlowEdges.map((edge) => edge.id);
              if (!sameIds(nodeIds, selectedNodeIds)) setSelectedNodeIds(nodeIds);
              if (!sameIds(edgeIds, selectedEdgeIds)) setSelectedEdgeIds(edgeIds);
              const nextTaskId = nodeIds.length > 0 ? nodeIds[0] : null;
              const nextEdgeId = edgeIds.length > 0 ? edgeIds[0] : null;
              setSelectedTaskId((current) => current === nextTaskId ? current : nextTaskId);
              setSelectedEdgeId((current) => current === nextEdgeId ? current : nextEdgeId);
            }}
            onNodeClick={(_, n) => { setSelectedTaskId(n.id); setSelectedEdgeId(null); setSelectedNodeIds([n.id]); setSelectedEdgeIds([]); setInspectorTab('overview'); }} 
            onEdgeClick={(_, e) => { setSelectedEdgeId(e.id); setSelectedTaskId(null); setSelectedNodeIds([]); setSelectedEdgeIds([e.id]); }} 
            onPaneClick={clearSelection} 
            fitView 
            snapToGrid 
            snapGrid={[10, 10]} 
            connectionMode={ConnectionMode.Loose} 
            connectionLineType={defaultEdgeStyle === 'straight' ? ConnectionLineType.Straight : defaultEdgeStyle === 'smoothstep' ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier} 
            className="react-flow-industrial"
            >
              <Background color="#1e293b" gap={30} size={1} />
              {layoutPrefs.showCanvasControls && <Controls className="!bg-[#0a1120] !border-white/10 !rounded-xl overflow-hidden" />}
              {layoutPrefs.showMiniMap && (
                <MiniMap
                  nodeColor={(node) => node.data?.interface === 'TRIGGER' ? '#22d3ee' : node.data?.interface === 'OUTCOME' ? '#fb7185' : node.type === 'diamond' ? '#f59e0b' : '#60a5fa'}
                  maskColor="rgba(3, 7, 18, 0.75)"
                  className="!bg-[#0a1120] !border !border-white/10 !rounded-2xl overflow-hidden"
                  pannable
                  zoomable
                />
              )}
            </ReactFlow>
          </div>
          {saveStatus === 'conflict' && saveConflict && (
            <div className="absolute top-[86px] left-4 right-4 z-30 rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-[11px] font-bold text-status-error shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{saveConflict.message || 'Save conflict detected. Reload the latest workflow before saving again.'}</span>
                <button onClick={() => window.location.reload()} className="rounded-xl border border-status-error/20 bg-black/20 px-3 py-2 text-[8px] font-black uppercase tracking-[0.18em] text-status-error">
                  Reload Latest
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!focusMode && (
        <div className={cn(
          "relative border-t xl:border-t-0 xl:border-l border-white/10 bg-[#09111d] flex flex-col z-[70] w-full xl:flex-none h-full min-h-0 overflow-hidden",
          layoutPrefs.inspectorDock === 'left' ? "xl:order-first" : "xl:order-last",
          layoutPrefs.inspectorCollapsed ? "xl:w-[92px]" : "xl:[width:var(--inspector-width)]",
        )} style={{ '--inspector-width': `${inspectorWidth}px` } as React.CSSProperties}>
        <div onMouseDown={handleMouseDown} className="hidden xl:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent z-50" />
        <div className="min-h-14 flex border-b border-white/10 bg-white/[0.02] overflow-x-auto">
          {[ 
            { id: 'overview', label: 'Overview', icon: <Activity size={12} /> }, 
            { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' },
            { id: 'governance', label: 'Governance', icon: <ShieldCheck size={12} /> },
            { id: 'history', label: 'History', icon: <History size={12} /> },
          ].filter(t => !t.hidden && (selectedTaskId || ['overview', 'governance', 'history'].includes(t.id))).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 min-w-[84px] flex flex-col items-center justify-center gap-0.5 border-b-2 px-2", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white transition-all')}>{t.icon}<span className="text-[8px] font-black uppercase whitespace-nowrap">{t.label}</span></button>
          ))}
          {selectedEdgeId && (<div className="flex-1 min-w-[84px] flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white px-2"><Link2 size={12} /><span className="text-[8px] font-black uppercase whitespace-nowrap">Edge</span></div>)}
          <button onClick={() => updateLayoutPrefs({ inspectorCollapsed: !layoutPrefs.inspectorCollapsed })} className="px-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/35 hover:text-white border-l border-white/10">
            {layoutPrefs.inspectorCollapsed ? 'Open' : 'Collapse'}
          </button>
        </div>
        {layoutPrefs.inspectorCollapsed ? (
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4">
            <div className="flex flex-col items-stretch gap-2 w-full">
              <button onClick={() => updateLayoutPrefs({ inspectorCollapsed: false })} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white">
                Open Inspector
              </button>
              <button onClick={() => updateLayoutPrefs({ inspectorDock: layoutPrefs.inspectorDock === 'left' ? 'right' : 'left' })} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
                Dock {layoutPrefs.inspectorDock === 'left' ? 'Right' : 'Left'}
              </button>
              <button onClick={() => updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap })} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
                {layoutPrefs.showMiniMap ? 'Hide' : 'Show'} MiniMap
              </button>
              <button onClick={() => updateLayoutPrefs({ showCanvasControls: !layoutPrefs.showCanvasControls })} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
                {layoutPrefs.showCanvasControls ? 'Hide' : 'Show'} Controls
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 sm:p-6">
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              {selectedNodeIds.length > 1 && !selectedNodesAreProtected && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Bulk Edit</p>
                      <p className="mt-1 text-[12px] font-bold text-white/55">{selectedNodeIds.length} nodes selected. Apply shared changes or align them as a group.</p>
                    </div>
                    <button onClick={() => { setSelectedNodeIds([]); setSelectedTaskId(null); }} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/45">Clear</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <input className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk owner team" value={selectedTask.owning_team || ''} onChange={e => updateSelectedTasks({ owning_team: e.target.value })} />
                    <select className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={selectedTask.task_type} onChange={e => updateSelectedTasks({ task_type: e.target.value })}>
                      {taskTypes.map((type: any) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <button onClick={() => updateSelectedTasks({ validation_needed: !selectedTask.validation_needed })} className={cn("rounded-2xl border px-4 py-3 text-[10px] font-black uppercase transition-all", selectedTask.validation_needed ? "border-orange-500/30 bg-orange-500/10 text-orange-400" : "border-white/10 bg-white/5 text-white/45 hover:text-white")}>
                      Toggle Validation
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => alignSelectedNodes('left')} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/50 hover:text-white">Align Left</button>
                    <button onClick={() => alignSelectedNodes('top')} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/50 hover:text-white">Align Top</button>
                    <button onClick={() => alignSelectedNodes('center')} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/50 hover:text-white">Center X</button>
                    <button onClick={() => alignSelectedNodes('horizontal')} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/50 hover:text-white">Line Up</button>
                    <button onClick={() => alignSelectedNodes('vertical')} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-white/50 hover:text-white">Stack</button>
                  </div>
                </div>
              )}
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1 text-center block">TAT Manual (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-blue-400 text-center" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1 text-center block">TAT Machine (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-purple-400 text-center" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owner Team</label>
                          <input className={BUILDER_FIELD.replace('py-3', 'h-11 py-2.5')} value={selectedTask.owning_team} onChange={e => updateTask(selectedTaskId, { owning_team: e.target.value })} placeholder="Team Name" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owner Positions</label>
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                            <button
                              onClick={() => setOwnerPositionsCollapsed(!ownerPositionsCollapsed)}
                              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 h-11 flex items-center justify-between hover:bg-white/10 transition-colors"
                            >
                              <span className="text-[12px] font-bold text-white truncate">
                                {selectedTask.owner_positions?.length || 0} Positions
                              </span>
                              {ownerPositionsCollapsed ? <ChevronDown size={14} className="text-white/20" /> : <ChevronUp size={14} className="text-white/20" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {!ownerPositionsCollapsed && (
                        <div className="animate-apple-in -mt-2">
                          <ManagedListSection
                            title="Position Entries"
                            items={selectedTask.owner_positions || []}
                            onUpdate={(items) => updateTask(selectedTaskId, { owner_positions: items })}
                            placeholder="Add a role title, responsibility, or backup assignment..."
                            icon={<Users size={12} className="text-theme-accent" />}
                            isOpen={!ownerPositionsCollapsed}
                            toggle={() => setOwnerPositionsCollapsed((prev) => !prev)}
                          />
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
                          <button onClick={() => updateTask(selectedTaskId, { involved_systems: [...(selectedTask.involved_systems || []), { id: Date.now().toString(), name: '', usage: '', figures: [], link: '' }] })} className="w-full py-2.5 bg-white/5 border border-dashed border-white/10 rounded-2xl text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all">+ Add System Dependency</button>
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
                          className="w-full py-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-2xl text-[10px] font-black uppercase hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-2"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="py-3 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-2xl flex items-center justify-center gap-2"><Plus size={12} /> Add Manual Input</button>
                        <button onClick={() => setIsOutputPickerOpen(true)} className="py-3 bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-2xl flex items-center justify-center gap-2"><Search size={12} /> Registry Search</button>
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
                      <button onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="w-full py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-2xl flex items-center justify-center gap-2"><Plus size={12} /> Add Output Artifact</button>
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
                      <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', average_delay_minutes: 0, frequency: 1 }] })} className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase text-amber-500 hover:bg-amber-500/20 transition-all rounded-2xl flex items-center justify-center gap-2"><Plus size={12} /> Add Roadblock</button>
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
                      <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', recovery_time_minutes: 0, frequency: 1 }] })} className="w-full py-3 bg-status-error/10 border border-status-error/20 text-[10px] font-black uppercase text-status-error hover:bg-status-error/20 transition-all rounded-2xl flex items-center justify-center gap-2"><Plus size={12} /> Add Human Error</button>
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
                          <button onClick={() => updateTask(selectedTaskId, { validation_procedure_steps: [...(selectedTask.validation_procedure_steps || []), { id: Date.now().toString(), description: '', figures: [] }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-orange-500 transition-all rounded-2xl">+ Add Verification Step</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {validationIssues.map((issue) => (
                      <button key={`${issue.code}-${issue.targetId || 'workflow'}`} onClick={() => focusAuditIssue(issue)} className={cn("w-full text-left rounded-2xl border p-4 transition-all", issue.severity === 'error' ? "border-status-error/20 bg-status-error/10 hover:bg-status-error/15" : "border-white/10 bg-black/20 hover:bg-white/5")}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-[9px] font-black uppercase tracking-[0.18em]", issue.severity === 'error' ? "text-status-error" : "text-amber-400")}>{issue.scope}</span>
                          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">{issue.code}</span>
                        </div>
                        <p className="mt-2 text-[12px] font-bold text-white/75 leading-relaxed">{issue.message}</p>
                        <p className="mt-2 text-[10px] text-white/35">{buildFixSuggestion(issue)}</p>
                      </button>
                    ))}
                  </div>
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
                      <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-2xl mt-2">+ Add Reference Link</button>
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
                      <button onClick={() => updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id: Date.now().toString(), description: '', figures: [], links: [] }] })} className="w-full py-3 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-2xl">+ Add Instruction Step</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
              {(inspectorTab === 'governance' || inspectorTab === 'history') && renderWorkflowOpsSurface()}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="p-6 space-y-10 animate-apple-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Edge Configuration</span></div>
                <div className="flex gap-2">
                  <button onClick={() => swapEdgeDirection(selectedEdgeId)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-2xl transition-all"><LucideWorkflow size={16} className="rotate-90" /></button>
                  <button onClick={() => { setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-2xl transition-all"><Trash size={16} /></button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Route Inspection</p>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold text-white/65">
                  <span className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">From: {nodes.find((node) => node.id === selectedEdge.source)?.data?.label || selectedEdge.source}</span>
                  <span className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">To: {nodes.find((node) => node.id === selectedEdge.target)?.data?.label || selectedEdge.target}</span>
                  <span className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">Style: {selectedEdge.data?.edgeStyle || 'bezier'}</span>
                  <span className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">Line: {selectedEdge.data?.lineStyle || 'solid'}</span>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Style</label>
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                      <button key={s} onClick={() => updateEdge(selectedEdgeId, { edgeStyle: s })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-2xl transition-all", (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Line Style</label>
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    {(['solid', 'dashed'] as const).map((s) => (
                      <button key={s} onClick={() => updateEdge(selectedEdgeId, { lineStyle: s })} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-2xl transition-all", (selectedEdge.data?.lineStyle || 'solid') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
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
              {(inspectorTab === 'governance' || inspectorTab === 'history') && renderWorkflowOpsSurface()}
            </div>
          ) : (
            <div className="space-y-8 animate-apple-in pb-20">
              {showGuide && (
                <div className={cn(BUILDER_PANEL, "p-5")}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Builder Guide</p>
                      <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/60">
                        1. Choose a template or start from the current workflow. 2. Click a node to edit its details. 3. Commit once validation is clean.
                      </p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          'Start with templates or related workflows',
                          'Click nodes, edges, or fields to edit',
                          'Fix validation issues before commit',
                        ].map((step, index) => (
                          <div key={step} className="rounded-[22px] border border-white/10 bg-black/20 px-3 py-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent">Step {index + 1}</p>
                            <p className="mt-1 text-[11px] font-bold leading-relaxed text-white/65">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      data-testid="builder-guide-dismiss"
                      onClick={() => setShowGuide(false)}
                    className={cn(BUILDER_BUTTON, "border border-white/10 bg-white/5 px-4 py-2 text-white/60 hover:bg-white/10 hover:text-white")}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {(inspectorTab === 'governance' || inspectorTab === 'history') && renderWorkflowOpsSurface()}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Quick Start Library</p>
                      <p className="mt-1 text-[12px] font-bold text-white/55">Reuse approved metadata and workflow patterns.</p>
                    </div>
                    <Search size={14} className="text-white/25" />
                  </div>
                  <div className="flex gap-2">
                    <input value={builderSearch} onChange={(e) => setBuilderSearch(e.target.value)} placeholder="Search templates or related workflows" className={cn(BUILDER_FIELD, "flex-1 py-2.5")} />
                  </div>
                  <div className="space-y-2">
                    {(builderSuggestions.templateMatches || []).slice(0, 3).map((template: any) => (
                      <div key={template.key || template.label} className="rounded-[22px] border border-white/10 bg-black/25 p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase text-white truncate">{template.label || template.key}</p>
                          <p className="text-[10px] text-white/45 leading-relaxed mt-1">{template.description || template.workflow_type || 'Template starter'}</p>
                        </div>
                        <button onClick={() => applyTemplateToMetadata(template)} className={cn(BUILDER_BUTTON, "shrink-0 bg-theme-accent text-white whitespace-nowrap")}>Use</button>
                      </div>
                    ))}
                    {(builderSuggestions.templateMatches || []).length === 0 && (
                      <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 p-4 text-[11px] font-bold text-white/35">
                        No matching templates. Start from the current workflow and use the metadata panel below.
                      </div>
                    )}
                  </div>
                  {(builderSuggestions.workflowMatches || []).length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">Related Workflows</p>
                      {builderSuggestions.workflowMatches.slice(0, 3).map((item: any) => (
                        <div key={item.id || item.name} className="rounded-[22px] border border-white/10 bg-black/25 p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-white truncate">{item.name || item.label || 'Related workflow'}</p>
                            <p className="text-[10px] text-white/45 leading-relaxed mt-1">{item.description || item.workflow_type || 'Reusable workflow example'}</p>
                          </div>
                          <button onClick={() => applyTemplateToMetadata(item)} className={cn(BUILDER_BUTTON, "shrink-0 bg-white/5 border border-white/10 text-white/50 whitespace-nowrap")}>Borrow</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {builderSuggestions.taskLibrary.length > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">Current Draft Tasks</p>
                      {builderSuggestions.taskLibrary.map((task: any) => (
                        <button key={task.id} onClick={() => { setSelectedTaskId(task.id); setSelectedNodeIds([task.id]); setInspectorTab('overview'); }} className="w-full rounded-[22px] border border-white/10 bg-black/25 p-3 flex items-start justify-between gap-3 text-left hover:bg-white/5 transition-all">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-white truncate">{task.name || 'Untitled task'}</p>
                            <p className="text-[10px] text-white/45 leading-relaxed mt-1">{task.description || task.task_type || 'Draft task'}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-black uppercase text-white/40">Open</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={cn(BUILDER_PANEL, "p-5 space-y-4")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Validation Health</p>
                      <p className="mt-1 text-[12px] font-bold text-white/55">{validationSummary}</p>
                    </div>
                    <button onClick={() => setInspectorTab('validation')} className={cn(BUILDER_BUTTON, "shrink-0 border border-white/10 bg-white/5 text-white/60")}>Open</button>
                  </div>
                  {blockingValidationIssues.length > 0 && (
                    <div className="rounded-[22px] border border-status-error/20 bg-status-error/10 px-4 py-3 text-[11px] font-bold text-status-error">
                      Fix the blocking issues before saving. Select any item below to jump to the affected field or node.
                    </div>
                  )}
                  <div className="space-y-2 max-h-[12rem] overflow-auto pr-1 custom-scrollbar">
                    {validationIssues.slice(0, 6).map((issue) => (
                      <button key={`${issue.code}-${issue.targetId || 'workflow'}`} onClick={() => focusAuditIssue(issue)} className={cn("w-full text-left rounded-[22px] border p-3 transition-all", issue.severity === 'error' ? "border-status-error/20 bg-status-error/10 hover:bg-status-error/15" : "border-white/10 bg-black/20 hover:bg-white/5")}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-[9px] font-black uppercase tracking-[0.18em]", issue.severity === 'error' ? "text-status-error" : "text-amber-400")}>{issue.severity}</span>
                          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">{issue.scope}</span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-white/75 leading-relaxed">{issue.message}</p>
                        <p className="mt-2 text-[10px] text-white/35">{buildFixSuggestion(issue)}</p>
                      </button>
                    ))}
                    {validationIssues.length === 0 && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">
                        The current draft is structurally clean.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <LucideWorkflow className="text-theme-accent" size={18} />
                  <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Workflow Definition</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">v{metadata.version}</span>
                  <button 
                    onClick={() => setIsMetadataEditMode(!isMetadataEditMode)}
                    className={cn("px-4 py-1.5 rounded-2xl text-[9px] font-black uppercase transition-all", isMetadataEditMode ? "bg-theme-accent text-white" : "bg-white/5 text-white/40 hover:text-white")}
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
                  <div className={cn(BUILDER_PANEL, "space-y-6 !bg-white/[0.02] border-white/5 p-6")}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Workflow Name</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.name.length} / 60</span>
                      </div>
                      <input 
                        data-testid="builder-workflow-name"
                        className={cn(BUILDER_FIELD, "text-[14px] font-black uppercase")} 
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
                        className={cn(BUILDER_FIELD, "text-[12px] font-bold text-white/80 h-32 resize-none leading-relaxed")} 
                        value={metadata.description} 
                        onChange={e => { saveToHistory(); setMetadata({...metadata, description: e.target.value}); }} 
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <div className={cn(BUILDER_PANEL, "space-y-6 !bg-white/[0.02] border-white/5 p-6")}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                          className={cn(BUILDER_FIELD, "text-[11px] font-bold text-white/80 h-24 resize-none leading-relaxed")} 
                          value={metadata.trigger_description} 
                          onChange={e => { saveToHistory(); setMetadata({...metadata, trigger_description: e.target.value}); }} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Output Description</label>
                        <textarea 
                          className={cn(BUILDER_FIELD, "text-[11px] font-bold text-white/80 h-24 resize-none leading-relaxed")} 
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
      )}
      </div>
    )}
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (<ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>);
export default WrappedWorkflowBuilder;
