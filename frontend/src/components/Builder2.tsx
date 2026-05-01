import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import ReactFlow, { 
  Handle, 
  Position, 
  Background, 
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
import { canApproveWorkflow, canPerformGovernanceAction, canReviewWorkflow, formatGovernanceActor } from '../utils/governance';
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
  Users,
  Satellite,
  Copy,
  ArrowRightLeft,
  Gauge,
  Clock3,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  BriefcaseBusiness,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchableSelect } from './IntakeGatekeeper';
import { auditWorkflowDraft, summarizeAuditIssues, type WorkflowAuditIssue } from '../testing/workflowQuality';
import { deriveToolPropagation, normalizeDefinitionList } from '../utils/workflowDefinition';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type InspectorTab = 'overview' | 'data' | 'exceptions' | 'validation' | 'appendix';
type BuilderUtilityPane = 'comments' | 'history' | 'review' | null;

interface BuilderLayoutPrefs {
  inspectorCollapsed: boolean;
  showMiniMap: boolean;
}

interface BuilderCommandAction {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  group?: string;
  run: () => void;
}

interface WorkflowComment {
  id: string;
  scope: 'workflow' | 'task' | 'section';
  scope_id?: string;
  author: string;
  message: string;
  status?: 'open' | 'resolved';
  created_at?: string;
  updated_at?: string;
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

const getWorkflowBuilderDraftKey = (workflowId?: string | number | null) => `pathos-workflow-builder2-draft-${workflowId ?? 'new'}`;
const getWorkflowBuilderLayoutKey = (workflowId?: string | number | null) => `pathos-workflow-builder2-layout-${workflowId ?? 'new'}`;

const createWorkflowComment = (scope: WorkflowComment['scope'] = 'workflow', scopeId = ''): WorkflowComment => ({
  id: `comment-${Date.now()}`,
  scope,
  scope_id: scopeId || undefined,
  author: 'system_user',
  message: '',
  status: 'open',
  created_at: new Date().toISOString(),
});

const normalizeWorkflowComment = (comment: any): WorkflowComment => ({
  ...comment,
  id: String(comment?.id || `comment-${Date.now()}`),
  scope: comment?.scope === 'task' || comment?.scope === 'section' ? comment.scope : 'workflow',
  scope_id: comment?.scope_id ? String(comment.scope_id) : undefined,
  author: comment?.author || 'system_user',
  message: String(comment?.message || ''),
  status: comment?.status === 'resolved' ? 'resolved' : 'open',
  created_at: comment?.created_at || new Date().toISOString(),
  updated_at: comment?.updated_at || undefined,
});

const getTaskDiagnostics = (task: Partial<TaskEntity> | null | undefined) => {
  const diagnostics = task?.diagnostics && typeof task.diagnostics === 'object' ? task.diagnostics : {};
  const taskProfile = diagnostics.task_profile && typeof diagnostics.task_profile === 'object' ? diagnostics.task_profile : {};
  const taskManagement = diagnostics.task_management && typeof diagnostics.task_management === 'object' ? diagnostics.task_management : {};
  const auditSummary = diagnostics.audit_summary && typeof diagnostics.audit_summary === 'object' ? diagnostics.audit_summary : {};
  return { diagnostics, taskProfile, taskManagement, auditSummary };
};

const buildTaskDiagnostics = (
  task: Partial<TaskEntity> | null | undefined,
  updates: {
    taskProfile?: Record<string, any>;
    taskManagement?: Record<string, any>;
    auditSummary?: Record<string, any>;
  }
) => {
  const current = getTaskDiagnostics(task);
  return {
    ...current.diagnostics,
    ...(updates.taskProfile ? { task_profile: { ...current.taskProfile, ...updates.taskProfile } } : {}),
    ...(updates.taskManagement ? { task_management: { ...current.taskManagement, ...updates.taskManagement } } : {}),
    ...(updates.auditSummary ? { audit_summary: { ...current.auditSummary, ...updates.auditSummary } } : {}),
  };
};

const normalizeStringList = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
const parseIsoDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDiffValue = (value: any) => {
  if (Array.isArray(value)) return value.length === 0 ? '[]' : value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const compactIssueTone = (severity: 'error' | 'warning') => (
  severity === 'error'
    ? 'border-status-error/20 bg-status-error/10 text-status-error'
    : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
);

const issueId = (issue: WorkflowAuditIssue) => `${issue.code}-${issue.targetId || 'workflow'}`;

const issueMatchesField = (issue: WorkflowAuditIssue, fieldKey: string) => (
  issue.code === fieldKey || issue.code.startsWith(`${fieldKey}.`)
);

const issueForTask = (issue: WorkflowAuditIssue, taskId: string) => issue.targetId === taskId;

const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const sanitizeTaskClone = (task: any, nextId: string, nextName: string) => {
  const remapCollection = (items: any[] = [], prefix: string) => items.map((item, idx) => ({
    ...JSON.parse(JSON.stringify(item)),
    id: `${prefix}-${nextId}-${idx}`,
  }));
  return JSON.parse(JSON.stringify({
    ...task,
    id: nextId,
    node_id: nextId,
    name: nextName,
    involved_systems: remapCollection(task?.involved_systems || [], 'sys'),
    blockers: remapCollection(task?.blockers || [], 'blk'),
    errors: remapCollection(task?.errors || [], 'err'),
    media: remapCollection(task?.media || [], 'media'),
    reference_links: remapCollection(task?.reference_links || [], 'ref'),
    instructions: (task?.instructions || []).map((item: any, idx: number) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: `inst-${nextId}-${idx}`,
      figures: Array.isArray(item?.figures) ? item.figures : [],
      links: Array.isArray(item?.links) ? item.links : [],
    })),
    source_data_list: (task?.source_data_list || []).map((item: any, idx: number) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: `src-${nextId}-${idx}`,
      figures: Array.isArray(item?.figures) ? item.figures : [],
    })),
    output_data_list: (task?.output_data_list || []).map((item: any, idx: number) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: `out-${nextId}-${idx}`,
      figures: Array.isArray(item?.figures) ? item.figures : [],
    })),
    validation_procedure_steps: (task?.validation_procedure_steps || []).map((item: any, idx: number) => ({
      ...JSON.parse(JSON.stringify(item)),
      id: `val-${nextId}-${idx}`,
      figures: Array.isArray(item?.figures) ? item.figures : [],
    })),
    tribal_knowledge: Array.isArray(task?.tribal_knowledge) ? [...task.tribal_knowledge] : [],
    diagnostics: task?.diagnostics ? JSON.parse(JSON.stringify(task.diagnostics)) : undefined,
  }));
};

const getCompletenessSectionId = (label: string) => {
  const map: Record<string, string> = {
    Name: 'overview',
    Description: 'overview',
    'Owner team': 'ownership',
    'Owner roles': 'ownership',
    Systems: 'systems',
    Inputs: 'dependencies',
    Outputs: 'dependencies',
    References: 'appendix',
    'Validation detail': 'validation',
    'Risk / readiness': 'ownership',
  };
  return map[label] || 'overview';
};

const getDefinitionIssueShell = (hasIssue: boolean) => cn(
  "rounded-[8px] border bg-white/5 p-[3px]",
  hasIssue ? "border-status-error/40 bg-status-error/10" : "border-white/10",
);

const BUILDER_RADIUS = 'rounded-[8px]';
const BUILDER_PANEL = 'rounded-[8px] border border-white/10 bg-white/[0.03] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.8)]';
const BUILDER_FIELD = 'w-full rounded-[8px] border border-white/10 bg-black/30 px-1.5 py-1.5 text-[10px] text-white outline-none focus:border-theme-accent focus-visible:ring-2 focus-visible:ring-theme-accent/25 focus-visible:ring-offset-0';
const BUILDER_BUTTON = 'rounded-[8px] px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.16em] leading-none transition-all';
const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const scoreCommandMatch = (query: string, text: string) => {
  if (!query) return 0;
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) return -1;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(normalizedQuery)) return 1;
  if (normalizedText.includes(normalizedQuery)) return 2;
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const tokenHits = queryTokens.filter((token) => normalizedText.includes(token)).length;
  return tokenHits > 0 ? 10 - tokenHits : -1;
};

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
  diagnostics?: Record<string, any>;
  decision_details?: Record<string, any>;
  shadow_it_used?: boolean;
  shadow_it_link?: string;
  post_task_verification?: string;
  phase_name?: string;
  subflow_name?: string;
  task_block_key?: string;
  risks_yield_scrap?: boolean;
}

const ManagedListSection: React.FC<{
  title: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  onMoveItem?: (fromIndex: number, direction: -1 | 1) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  toggle: () => void;
}> = ({ title, items, onUpdate, onMoveItem, placeholder, icon, isOpen, toggle }) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  return (
    <CollapsibleSection title={title} count={items.length} isOpen={isOpen} toggle={toggle} icon={icon}>
      <div className="space-y-1.5 pt-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-[8px] p-[7px] group relative">
            {editingIdx === idx ? (
              <div className="space-y-1.5 animate-apple-in">
                <textarea 
                  autoFocus
                  className={cn(BUILDER_FIELD, "min-h-[58px] text-[10px]")}
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => {
                      if (editVal.trim()) {
                        const newItems = [...items];
                        newItems[idx] = editVal.trim();
                        onUpdate(newItems);
                        setEditingIdx(null);
                      }
                    }}
                    className="flex-1 py-[5px] bg-theme-accent text-white text-[8px] font-black uppercase rounded-[8px]"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => setEditingIdx(null)}
                    className="px-1.5 py-[3px] bg-white/5 text-white/40 text-[8px] font-black uppercase rounded-[8px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-1.5">
                <p className="text-[10px] text-white/80 font-medium leading-relaxed flex-1">{item}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {onMoveItem && (
                    <>
                      <button
                        onClick={() => onMoveItem(idx, -1)}
                        disabled={idx === 0}
                        className="p-[5px] hover:bg-white/10 disabled:opacity-20 text-white/40 hover:text-white rounded-[8px] transition-all"
                        title="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => onMoveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="p-[5px] hover:bg-white/10 disabled:opacity-20 text-white/40 hover:text-white rounded-[8px] transition-all"
                        title="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => { setEditingIdx(idx); setEditVal(item); }}
                    className="p-[5px] hover:bg-theme-accent/20 text-white/40 hover:text-theme-accent rounded-[8px] transition-all"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    onClick={() => onUpdate(items.filter((_, i) => i !== idx))}
                    className="p-[5px] hover:bg-status-error/20 text-white/40 hover:text-status-error rounded-[8px] transition-all"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {editingIdx === -1 ? (
          <div className="bg-white/[0.02] border border-theme-accent rounded-[8px] p-[7px] space-y-1.5 animate-apple-in">
            <textarea 
              autoFocus
              className={cn(BUILDER_FIELD, "min-h-[58px] text-[10px]")}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              placeholder={placeholder || "Enter details..."}
            />
            <div className="flex gap-1.5">
              <button 
                onClick={() => {
                  if (editVal.trim()) {
                    onUpdate([...items, editVal.trim()]);
                    setEditingIdx(null);
                    setEditVal('');
                  }
                }}
                className="flex-1 py-[5px] bg-theme-accent text-white text-[8px] font-black uppercase rounded-[8px]"
              >
                Add Entry
              </button>
              <button 
                onClick={() => { setEditingIdx(null); setEditVal(''); }}
                className="px-1.5 py-[3px] bg-white/5 text-white/40 text-[8px] font-black uppercase rounded-[8px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => { setEditingIdx(-1); setEditVal(''); }}
            className="w-full py-1.5 bg-white/5 border border-dashed border-white/10 text-[8px] font-black uppercase text-white/40 hover:text-white hover:border-theme-accent transition-all rounded-[8px]"
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
  purpose_statement: string;
  pre_requisites: string[];
  inline_examples: Record<string, string>;
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
    <div className="border-b border-white/5 pb-2">
    <button onClick={toggle} className="w-full flex items-center justify-between py-0.5 group">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest group-hover:text-white transition-colors">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-1.5 py-0.5 rounded-[8px] bg-theme-accent/20 text-theme-accent text-[8px] font-black">{count}</span>
        )}
      </div>
      {isOpen ? <ChevronUp size={12} className="text-white/20" /> : <ChevronDown size={12} className="text-white/20" />}
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  badge?: React.ReactNode;
  isLocked?: boolean;
}> = ({ title, isOpen, toggle, children, onDelete, onMoveUp, onMoveDown, badge, isLocked }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-[8px] overflow-hidden group/item animate-apple-in mt-1.5">
      <div className="flex items-center justify-between p-[7px] cursor-pointer hover:bg-white/5 transition-colors" onClick={toggle}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isOpen ? <ChevronUp size={11} className="text-white/20" /> : <ChevronDown size={11} className="text-white/20" />}
          <span className={cn("text-[9px] font-black uppercase tracking-widest truncate", isOpen ? "text-white" : "text-white/40")}>
            {title || "Untitled Item"}
          </span>
          {isLocked && <Link2 size={9} className="text-theme-accent" />}
          {badge}
        </div>
        {onDelete && !isLocked && (
          <div className="flex items-center gap-1.5">
            {(onMoveUp || onMoveDown) && (
                <div className="flex items-center gap-1 rounded-[8px] border border-white/10 bg-black/20 p-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                  disabled={!onMoveUp}
                  className="p-[5px] text-white/35 hover:text-white disabled:opacity-20 rounded-[8px] hover:bg-white/5"
                  title="Move up"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                  disabled={!onMoveDown}
                  className="p-[5px] text-white/35 hover:text-white disabled:opacity-20 rounded-[8px] hover:bg-white/5"
                  title="Move down"
                >
                  <ChevronDown size={11} />
                </button>
              </div>
            )}
            {isConfirming ? (
                <div className="flex items-center gap-1 bg-status-error/20 rounded-[8px] p-0.5 animate-apple-in">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsConfirming(false); onDelete(); }}
                  className="px-1.5 py-1 bg-status-error text-white text-[7px] font-black uppercase rounded-[8px]"
                >
                  Confirm
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
                  className="px-1.5 py-1 text-white/40 text-[7px] font-black uppercase"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} 
                className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-status-error/20 text-white/20 hover:text-status-error transition-all rounded-[8px]"
              >
                <Trash size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      {isOpen && <div className="p-1.5 border-t border-white/5 bg-black/20">{children}</div>}
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
    <div className="space-y-1.5">
      {label && <label className="text-[8px] font-black text-white/20 uppercase tracking-widest">{label}</label>}
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1.5 h-[3.25rem]">
        {figures.map((fig, idx) => (
          <div key={idx} className="flex-shrink-0 w-18 h-full rounded-[8px] border border-white/10 overflow-hidden relative group bg-black/40">
            <img src={fig} className="w-full h-full object-cover" />
            {!isLocked && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all p-1.5">
                <button 
                  onClick={() => {
                    onPaste(figures.filter((_, i) => i !== idx));
                  }}
                  className="w-full h-full bg-status-error/80 text-white rounded-[8px] flex items-center justify-center hover:bg-status-error transition-colors"
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
            className="flex-shrink-0 w-18 h-full border border-dashed border-white/10 rounded-[8px] flex flex-col items-center justify-center text-white/20 hover:text-white hover:border-theme-accent transition-all cursor-pointer outline-none focus:border-theme-accent bg-black/20"
          >
            <Plus size={13} />
            <span className="text-[7px] font-black uppercase mt-1">Paste</span>
          </div>
        )}
        {isLocked && figures.length === 0 && (
          <div className="flex-shrink-0 w-full h-full border border-white/5 rounded-[8px] flex items-center justify-center text-white/5 italic text-[8px]">No Figures Yet</div>
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
        `apple-glass !bg-[#0b1221]/96 !${BUILDER_RADIUS} px-5 sm:px-6 py-4 sm:py-5 shadow-2xl transition-all duration-300 group relative border-2 flex flex-col items-center justify-center w-[clamp(180px,22vw,260px)] max-w-[90vw] h-auto hover:z-[1000]`,
        selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
      )}>
        <div className={cn("absolute -top-1.5 left-4 px-1.5 py-0.5 rounded-[8px] text-[8px] font-black uppercase tracking-[0.2em] border z-20 shadow-lg", isTrigger ? "bg-cyan-500 border-cyan-400 text-white" : "bg-rose-500 border-rose-400 text-white")}>
          {isTrigger ? "Start" : "Finish"}
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
      `apple-glass !bg-[#0f172a]/95 !${BUILDER_RADIUS} px-3 sm:px-1.5 py-1.5 sm:py-4 w-[clamp(300px,31vw,430px)] max-w-[92vw] shadow-2xl transition-all duration-300 relative border-2 h-auto min-h-[300px] hover:z-[1000]`,
      selected ? 'border-theme-accent shadow-[0_0_30px_rgba(59,130,246,0.4)] scale-[1.02]' : 'border-white/10 hover:border-white/20',
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    )}>
      {data.validation_needed && (
        <div className="absolute -top-1.5 right-4 px-1.5 py-0.5 rounded-[8px] text-[8px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VERIFY
        </div>
      )}
      {data.commentSummary?.total > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onOpenComments?.(data.id);
          }}
          className="absolute -top-1.5 right-4 flex items-center gap-1.5 rounded-[8px] border border-white/10 bg-[#0b1221]/96 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/60 shadow-lg transition-colors hover:text-white"
          title={`${data.commentSummary.open || 0} open, ${data.commentSummary.resolved || 0} resolved comments`}
        >
          <Satellite size={10} className="text-theme-accent" />
          {data.commentSummary.open || 0}/{data.commentSummary.resolved || 0}
        </button>
      )}
      <div className="flex flex-col gap-1.5 h-full">
        <div className="flex items-center justify-between gap-1.5">
          <div className={cn("px-1.5 py-[3px] rounded-[8px] text-[10px] font-black uppercase tracking-widest border", typeColor)}>
            {data.task_type === 'TRIGGER' ? 'Start' : data.task_type === 'OUTCOME' ? 'Finish' : data.task_type === 'LOOP' ? 'Decision' : 'Task'}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {data.occurrence > 1 && (
              <div className="flex items-center gap-1 bg-blue-500 text-white px-1.5 py-[3px] rounded-[8px] text-[10px] font-black shadow-lg shadow-blue-500/20">
                <RefreshCw size={12} /> Repeat {data.occurrence}
              </div>
            )}
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-500 text-white px-1.5 py-[3px] rounded-[8px] text-[10px] font-black shadow-lg shadow-amber-500/20">
                <AlertCircle size={12} /> {data.blockerCount} blocked
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1 bg-status-error text-white px-1.5 py-[3px] rounded-[8px] text-[10px] font-black shadow-lg shadow-status-error/20">
                <X size={12} /> {data.errorCount} issues
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-1 relative">
          <h4
            className="font-black text-white tracking-tight leading-tight hover:text-theme-accent transition-colors line-clamp-1 overflow-hidden min-h-[2.05em]"
            style={{ fontSize: `${titleFontSize}px` }}
            title={data.label || 'Untitled Task'}
          >
            {data.label || "Untitled Task"}
          </h4>
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="bg-black/40 rounded-[8px] p-1.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[10px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-1">Manual time</span>
               <span className="text-[24px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/40 rounded-[8px] p-1.5 border border-white/5 flex flex-col items-center justify-center">
               <span className="text-[10px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-1">Automated time</span>
               <span className="text-[24px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 py-1.5 border-t border-white/5">
             <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Inputs</span>
                 <span className="text-[16px] font-black text-white leading-none">{data.sourceCount || 0}</span>
               </div>
               <div className="w-px h-6 bg-white/5" />
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Outputs</span>
                 <span className="text-[16px] font-black text-white leading-none">{data.outputCount || 0}</span>
               </div>
             </div>
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                   <span className="text-[11px] font-black text-white/60 uppercase truncate max-w-[120px]">{(data.ownerPositions || [])[0] || 'No owner yet'}</span>
                   {(data.ownerPositions || []).length > 1 && (
                     <span className="text-[10px] font-black text-theme-accent">+{(data.ownerPositions || []).length - 1}</span>
                   )}
                </div>
                {data.owningTeam && (
                  <span className="text-[10px] font-black text-theme-accent/60 uppercase tracking-widest leading-none mt-1">{data.owningTeam}</span>
                )}
             </div>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-white/5 min-h-[24px]">
             {visibleSystems.map((s: TaskSystem, i: number) => (
               <span key={i} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-[8px] text-[10px] font-bold text-white/40 uppercase">{s.name}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-[8px] text-[10px] font-bold text-white/20 uppercase">+{hiddenSystemsCount}</span>
             )}
             {involvedSystems.length === 0 && (
               <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">No systems linked</span>
             )}
          </div>
      {selected && (
            <div className="absolute left-1/2 top-full mt-1.5 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 pointer-events-auto">
              <button onClick={(event) => { event.stopPropagation(); data.onOpenComments?.(data.id); }} className="flex items-center gap-1.5 rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent shadow-lg shadow-black/30">
                <MessageSquare size={10} /> Notes
              </button>
              {data.commentSummary?.total > 0 && (
                <button onClick={(event) => { event.stopPropagation(); data.onOpenComments?.(data.id); }} className="flex items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 shadow-lg shadow-black/30">
                  <Satellite size={10} /> {data.commentSummary.open || 0}/{data.commentSummary.resolved || 0}
                </button>
              )}
            </div>
          )}
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
    <div className={cn("relative w-[clamp(210px,22vw,260px)] h-[clamp(210px,22vw,260px)] flex items-center justify-center transition-all duration-300 hover:z-[1000]", selected ? 'scale-105 z-50' : 'z-10')}>
      <div className={cn(`absolute w-[clamp(168px,16vw,190px)] h-[clamp(168px,16vw,190px)] rotate-45 border-2 transition-all duration-300 bg-[#0b1221]/96 !${BUILDER_RADIUS}`, selected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/20', data.validation_needed ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,158,11,0.3)]' : '')} />
      
      {/* Handles at lower z-index than tooltip container */}
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-amber-400 !w-3.5 !h-3.5 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-20 opacity-0" />

      <div className="relative z-40 flex flex-col items-center justify-center p-4 w-full h-full pointer-events-none">
        <span
          className="max-w-[170px] text-center font-bold text-white leading-tight break-words line-clamp-1 transition-colors"
          style={{ fontSize: `${titleFontSize}px` }}
          title={data.label || 'Condition'}
        >
          {data.label || "Condition"}
        </span>
      </div>
    {data.validation_needed && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[112px] px-1.5 py-0.5 rounded-[8px] text-[6px] font-black uppercase bg-orange-500 border border-orange-400 text-white z-30 shadow-lg animate-pulse">Verify</div>
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
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: 100 }} className="bg-[#0f172a] px-1.5 py-[3px] rounded-[8px] border border-white/20 shadow-2xl pointer-events-none">
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
  <div className="bg-status-error/10 border border-status-error/30 rounded-[8px] p-1.5 flex flex-col gap-1.5 animate-apple-in">
    <div className="flex items-center gap-1.5">
      <AlertCircle size={14} className="text-status-error" />
      <span className="text-[9px] font-black text-white uppercase tracking-tight">{label}</span>
    </div>
    <div className="flex gap-1.5">
      <button onClick={(e) => { e.stopPropagation(); onConfirm(); }} className="flex-1 py-[5px] bg-status-error text-white text-[8px] font-black uppercase rounded-[8px] shadow-lg shadow-status-error/20 hover:bg-status-error/80 transition-colors">Remove</button>
      <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="flex-1 py-[5px] bg-white/5 text-white/40 text-[8px] font-black uppercase rounded-[8px] hover:bg-white/10 transition-colors">Cancel</button>
    </div>
  </div>
);

const Builder2: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, relatedWorkflows = [], rollbackPreview, runtimeConfig, onSave, onBack, onExit, onCreateRollbackDraft, onGovernanceAction, setIsDirty }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project, fitView, setCenter } = useReactFlow();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(410);
  const [layoutPrefs, setLayoutPrefs] = useState<BuilderLayoutPrefs>({
    inspectorCollapsed: false,
    showMiniMap: false,
  });
  const [definitionCompactMode, setDefinitionCompactMode] = useState(true);
  const [baseFontSize] = useState(13);
  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<'bezier' | 'smoothstep' | 'straight'>('smoothstep');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    inputs: false, outputs: false, manual_inputs: false, manual_outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [isOutputPickerOpen, setIsOutputPickerOpen] = useState(false);
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
  const [commentDraft, setCommentDraft] = useState<WorkflowComment>(createWorkflowComment());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [utilityPane, setUtilityPane] = useState<BuilderUtilityPane>(null);
  const [utilityPaneTaskId, setUtilityPaneTaskId] = useState<string | null>(null);
  const [utilityPaneSectionId, setUtilityPaneSectionId] = useState<string | null>(null);
  const [commentFilter, setCommentFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [historyCompareMode, setHistoryCompareMode] = useState<'saved' | 'approved' | 'selected'>('saved');
  const [historyCompareVersionId, setHistoryCompareVersionId] = useState<string>('');
  const [importDraft, setImportDraft] = useState('');
  const [definitionPrereqDraft, setDefinitionPrereqDraft] = useState('');
  const [taskPaneCompact, setTaskPaneCompact] = useState(true);
  const [taskCompletenessOpen, setTaskCompletenessOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [outputPickerSearch, setOutputPickerSearch] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [saveConflict, setSaveConflict] = useState<any>(null);
  const draftSaveTimer = useRef<number | null>(null);
  const draftRestoreAttempted = useRef(false);
  const initialSnapshotRef = useRef<any>(null);
  const taskPaneScrollRef = useRef<HTMLDivElement | null>(null);
  const taskSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveWorkflowRef = useRef<(() => void) | null>(null);
  const layoutPrefsKey = useMemo(() => getWorkflowBuilderLayoutKey(workflow?.id), [workflow?.id]);
  const panePrefsKey = useMemo(() => `pathos-workflow-builder2-pane-${workflow?.id ?? 'new'}`, [workflow?.id]);

  const toggleSection = (section: string) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const toggleItem = (itemId: string) => { setOpenItems(prev => ({ ...prev, [itemId]: !prev[itemId] })); };

  const workflowDefinitionProfile = useMemo(() => {
    const profile = workflow?.standards_profile;
    if (!profile || typeof profile !== 'object') return {};
    const definition = (profile as Record<string, any>).definition;
    return definition && typeof definition === 'object' ? definition : {};
  }, [workflow?.standards_profile]);

  const definitionSettings = useMemo(() => {
    const settings = runtimeConfig?.workflow_definition || runtimeConfig?.workflow_defaults?.definition || runtimeConfig?.features?.workflow_definition || {};
    const fieldVisibility = {
      purpose_statement: settings?.field_visibility?.purpose_statement ?? true,
      pre_requisites: settings?.field_visibility?.pre_requisites ?? true,
      prc: settings?.field_visibility?.prc ?? true,
      workflow_type: settings?.field_visibility?.workflow_type ?? true,
      cadence: settings?.field_visibility?.cadence ?? true,
      tool_family: settings?.field_visibility?.tool_family ?? true,
      applicable_tools: settings?.field_visibility?.applicable_tools ?? true,
      trigger_type: settings?.field_visibility?.trigger_type ?? true,
      trigger_description: settings?.field_visibility?.trigger_description ?? true,
      output_type: settings?.field_visibility?.output_type ?? true,
      output_description: settings?.field_visibility?.output_description ?? true,
      inline_examples: settings?.field_visibility?.inline_examples ?? true,
    };
    const fieldLabels = {
      purpose_statement: settings?.field_labels?.purpose_statement || 'Purpose Statement',
      pre_requisites: settings?.field_labels?.pre_requisites || 'Pre-Requisites',
      prc: settings?.field_labels?.prc || 'PRC',
      workflow_type: settings?.field_labels?.workflow_type || 'Workflow Type',
      cadence: settings?.field_labels?.cadence || 'Cadence',
      tool_family: settings?.field_labels?.tool_family || 'Tool Family',
      applicable_tools: settings?.field_labels?.applicable_tools || 'Applicable Tools',
      trigger_type: settings?.field_labels?.trigger_type || 'Trigger Type',
      trigger_description: settings?.field_labels?.trigger_description || 'Trigger Details',
      output_type: settings?.field_labels?.output_type || 'Output Type',
      output_description: settings?.field_labels?.output_description || 'Output Details',
    };
    const fieldExamples = {
      purpose_statement: settings?.field_examples?.purpose_statement || 'Example: Verify incoming material and record the result before release.',
      pre_requisites: settings?.field_examples?.pre_requisites || 'Example: Access to the source queue, owner approval, and the current SOP.',
      prc: settings?.field_examples?.prc || 'Example: PRC-2',
      workflow_type: settings?.field_examples?.workflow_type || 'Example: Inspection',
      cadence: settings?.field_examples?.cadence || 'Example: 3 checks per week',
      tool_family: settings?.field_examples?.tool_family || 'Example: MES, LIMS',
      applicable_tools: settings?.field_examples?.applicable_tools || 'Example: SAP QM, Spotfire',
      trigger_type: settings?.field_examples?.trigger_type || 'Example: Scheduled shift start',
      trigger_description: settings?.field_examples?.trigger_description || 'Example: The workflow begins at the start of the production shift.',
      output_type: settings?.field_examples?.output_type || 'Example: Inspection report',
      output_description: settings?.field_examples?.output_description || 'Example: A completed report ready for review or handoff.',
    };
    return { fieldVisibility, fieldLabels, fieldExamples };
  }, [runtimeConfig]);

  const currentMember = runtimeConfig?.current_member || null;
  const canReviewWorkflowState = canReviewWorkflow(currentMember, workflow);
  const canApproveWorkflowState = canApproveWorkflow(currentMember, workflow);
  const canCertifyWorkflowState = canPerformGovernanceAction(currentMember, workflow, 'certify');
  const canRequestRecertificationState = canPerformGovernanceAction(currentMember, workflow, 'request_recertification');
  const canRequestChangesState = canPerformGovernanceAction(currentMember, workflow, 'request_changes');

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow?.name || '',
    version: workflow?.version || 1,
    purpose_statement: (workflowDefinitionProfile as any).purpose_statement || workflow?.description || workflow?.forensic_description || '',
    pre_requisites: normalizeDefinitionList((workflowDefinitionProfile as any).pre_requisites || workflow?.quick_capture_notes || []),
    inline_examples: (workflowDefinitionProfile as any).inline_examples && typeof (workflowDefinitionProfile as any).inline_examples === 'object'
      ? { ...(workflowDefinitionProfile as any).inline_examples }
      : {},
    prc: workflow?.prc || '',
    workflow_type: workflow?.workflow_type || '',
    tool_family: normalizeDefinitionList(workflow?.tool_family),
    applicable_tools: normalizeDefinitionList(workflow?.tool_family).length > 0
      ? (Array.isArray(workflow?.applicable_tools) ? workflow.applicable_tools : normalizeDefinitionList(workflow?.tool_id))
      : [],
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

  const auditMetadata = useMemo(() => ({
    ...metadata,
    description: metadata.purpose_statement,
  }), [metadata]);

  const validationIssues = useMemo(() => auditWorkflowDraft({ metadata: auditMetadata, tasks, edges }), [auditMetadata, tasks, edges]);
  const validationErrorCount = useMemo(() => validationIssues.filter(issue => issue.severity === 'error').length, [validationIssues]);
  const validationWarningCount = useMemo(() => validationIssues.filter(issue => issue.severity === 'warning').length, [validationIssues]);
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
  const issuesForField = useCallback((fieldKey: string, taskId?: string | null) => (
    validationIssues.filter((issue) => issueMatchesField(issue, fieldKey) && (!taskId || issueForTask(issue, taskId)))
  ), [validationIssues]);
  const workflowBuilderDraftKey = useMemo(() => getWorkflowBuilderDraftKey(workflow?.id), [workflow?.id]);
  const workflowSourceStamp = useMemo(() => workflow?.updated_at || workflow?.updatedAt || workflow?.version || null, [workflow?.updated_at, workflow?.updatedAt, workflow?.version]);
  const relatedWorkflowList = useMemo(() => (Array.isArray(relatedWorkflows) ? relatedWorkflows : []), [relatedWorkflows]);
  const definitionToolPropagationSource = useMemo(
    () => [workflow, ...relatedWorkflowList].filter(Boolean),
    [relatedWorkflowList, workflow]
  );
  const definitionToolPropagation = useMemo(
    () => deriveToolPropagation(definitionToolPropagationSource, metadata.tool_family, metadata.applicable_tools),
    [definitionToolPropagationSource, metadata.tool_family, metadata.applicable_tools]
  );

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

  const clearSelection = useCallback(() => {
    setSelectedTaskId(null);
    setSelectedEdgeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(panePrefsKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (typeof parsed.taskPaneCompact === 'boolean') setTaskPaneCompact(parsed.taskPaneCompact);
      if (parsed.expandedSections && typeof parsed.expandedSections === 'object') setExpandedSections((prev) => ({ ...prev, ...parsed.expandedSections }));
      if (parsed.openItems && typeof parsed.openItems === 'object') setOpenItems((prev) => ({ ...prev, ...parsed.openItems }));
      if (typeof parsed.inspectorTab === 'string') setInspectorTab(parsed.inspectorTab);
      if (typeof parsed.ownerPositionsCollapsed === 'boolean') setOwnerPositionsCollapsed(parsed.ownerPositionsCollapsed);
    } catch (error) {
      console.warn('[Builder2] Failed to restore pane prefs:', error);
    }
  }, [panePrefsKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(panePrefsKey, JSON.stringify({
        taskPaneCompact,
        expandedSections,
        openItems,
        inspectorTab,
        ownerPositionsCollapsed,
      }));
    } catch (error) {
      console.warn('[Builder2] Failed to persist pane prefs:', error);
    }
  }, [expandedSections, inspectorTab, openItems, ownerPositionsCollapsed, panePrefsKey, taskPaneCompact]);

  function focusAuditIssue(issue: WorkflowAuditIssue) {
    if (issue.scope === 'workflow' || !issue.targetId) {
      setSelectedTaskId(null);
      setSelectedEdgeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setInspectorTab('overview');
      setIsMetadataEditMode(true);
      const workflowField = issueToFieldKey(issue);
      window.requestAnimationFrame(() => {
        focusTaskField(workflowField);
      });
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
      const taskField = issueToFieldKey(issue);
      window.requestAnimationFrame(() => {
        focusTaskField(taskField);
      });
      return;
    }
    if (targetEdge) {
      setSelectedEdgeId(targetEdge.id);
      setSelectedTaskId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([targetEdge.id]);
    }
  }

  const restoreDraft = useCallback((draft: any) => {
    if (!draft) return;
    const restoredMetadata = draft.metadata || {};
    const restoredToolFamilies = normalizeDefinitionList(restoredMetadata.tool_family);
    setMetadata({
      ...restoredMetadata,
      purpose_statement: restoredMetadata.purpose_statement || restoredMetadata.description || '',
      pre_requisites: normalizeDefinitionList(restoredMetadata.pre_requisites || []),
      inline_examples: restoredMetadata.inline_examples && typeof restoredMetadata.inline_examples === 'object'
        ? { ...restoredMetadata.inline_examples }
        : {},
      tool_family: restoredToolFamilies,
      applicable_tools: restoredToolFamilies.length === 0 ? [] : normalizeDefinitionList(restoredMetadata.applicable_tools || []),
    });
    setTasks(draft.tasks || []);
    setNodes(draft.nodes || []);
    setEdges(draft.edges || []);
    setIsMetadataEditMode(draft.isMetadataEditMode ?? false);
    setSelectedTaskId(draft.selectedTaskId || null);
    setSelectedEdgeId(draft.selectedEdgeId || null);
    setSelectedNodeIds(Array.isArray(draft.selectedNodeIds) ? draft.selectedNodeIds : []);
    setSelectedEdgeIds(Array.isArray(draft.selectedEdgeIds) ? draft.selectedEdgeIds : []);
      setWorkflowComments(Array.isArray(draft.workflowComments) ? draft.workflowComments.map(normalizeWorkflowComment) : []);
    setAccessControl(draft.accessControl || accessControl);
    setOwnership(draft.ownership || ownership);
    setRelatedWorkflowIds(Array.isArray(draft.relatedWorkflowIds) ? draft.relatedWorkflowIds : []);
    setDefinitionPrereqDraft('');
    if (draft.commentDraft) setCommentDraft(draft.commentDraft);
    if (typeof draft.importDraft === 'string') setImportDraft(draft.importDraft);
    setDraftRestored(true);
    setSaveStatus('saved');
    toast.success('Builder draft restored');
    window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 300 }));
  }, [accessControl, fitView, ownership]);

  const saveToHistory = useCallback(() => {
    // Optimization: Only save if state actually changed
    const currentState = JSON.stringify({ nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds });
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
    }]);
    setRedoStack([]);
  }, [nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, history]);

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
    }]);
    
    setNodes(lastState.nodes);
    setEdges(lastState.edges);
    setTasks(lastState.tasks);
    setMetadata(lastState.metadata);
    setWorkflowComments(lastState.workflowComments || []);
    setAccessControl(lastState.accessControl || accessControl);
    setOwnership(lastState.ownership || ownership);
    setRelatedWorkflowIds(lastState.relatedWorkflowIds || []);
    setHistory(prev => prev.slice(0, -1));
  }, [history, nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, setNodes, setEdges]);

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
    }]);
    
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setTasks(nextState.tasks);
    setMetadata(nextState.metadata);
    setWorkflowComments(nextState.workflowComments || []);
    setAccessControl(nextState.accessControl || accessControl);
    setOwnership(nextState.ownership || ownership);
    setRelatedWorkflowIds(nextState.relatedWorkflowIds || []);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, nodes, edges, tasks, metadata, workflowComments, accessControl, ownership, relatedWorkflowIds, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((current) => !current);
        return;
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
        setCommandPaletteQuery('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveWorkflowRef.current?.();
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        fitView({ padding: 0.12, duration: 250 });
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleLayout(nodes, edges);
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        onAddNode('TASK');
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onAddNode('CONDITION');
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openHistoryPane();
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap });
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        updateLayoutPrefs({ inspectorCollapsed: !layoutPrefs.inspectorCollapsed });
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setReviewMode((current) => !current);
        return;
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        setCommandPaletteIndex(0);
        return;
      }
      // Don't trigger structural shortcuts if typing in an input/textarea
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
        if (isReadOnlyMode) return;
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task && !task.interface) {
          setClipboard({ task: JSON.parse(JSON.stringify(task)), node: JSON.parse(JSON.stringify(nodes.find(n => n.id === selectedTaskId))) });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        if (isReadOnlyMode) return;
        saveToHistory();
        const id = `node-${Date.now()}`;
        const newNode = {
          ...JSON.parse(JSON.stringify(clipboard.node)),
          id,
          position: { x: (clipboard.node.position?.x || 0) + 40, y: (clipboard.node.position?.y || 0) + 40 },
          selected: true,
          data: {
            ...clipboard.node?.data,
            id,
            label: `${clipboard.task?.name || clipboard.node?.data?.label || 'Task'} Copy`,
            commentSummary: { total: 0, open: 0, resolved: 0 },
          },
        };
        const newTask = sanitizeTaskClone(clipboard.task, id, `${clipboard.task?.name || 'Task'} Copy`);
        setTasks(prev => [...prev, newTask]);
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNode));
        setSelectedTaskId(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, redo, selectedTaskId, tasks, nodes, clipboard, saveToHistory, undo]);

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
  const selectedTaskNode = useMemo(() => nodes.find((node) => node.id === selectedTaskId), [nodes, selectedTaskId]);
  const selectedTaskIncomingEdges = useMemo(
    () => (selectedTaskId ? edges.filter((edge) => String(edge.target) === String(selectedTaskId)) : []),
    [edges, selectedTaskId]
  );
  const selectedTaskOutgoingEdges = useMemo(
    () => (selectedTaskId ? edges.filter((edge) => String(edge.source) === String(selectedTaskId)) : []),
    [edges, selectedTaskId]
  );
  const selectedTaskIncomingTasks = useMemo(
    () => selectedTaskIncomingEdges.map((edge) => tasks.find((task) => String(task.id) === String(edge.source))).filter(Boolean) as TaskEntity[],
    [selectedTaskIncomingEdges, tasks]
  );
  const selectedTaskOutgoingTasks = useMemo(
    () => selectedTaskOutgoingEdges.map((edge) => tasks.find((task) => String(task.id) === String(edge.target))).filter(Boolean) as TaskEntity[],
    [selectedTaskOutgoingEdges, tasks]
  );
  const isReadOnlyMode = reviewMode;
  const selectedNeighborNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedTaskId) {
      ids.add(String(selectedTaskId));
      selectedTaskIncomingEdges.forEach((edge) => {
        ids.add(String(edge.source));
        ids.add(String(edge.target));
      });
      selectedTaskOutgoingEdges.forEach((edge) => {
        ids.add(String(edge.source));
        ids.add(String(edge.target));
      });
    }
    selectedEdgeIds.forEach((edgeId) => {
      const edge = edges.find((item) => String(item.id) === String(edgeId));
      if (edge) {
        ids.add(String(edge.source));
        ids.add(String(edge.target));
      }
    });
    return ids;
  }, [edges, selectedEdgeIds, selectedTaskId, selectedTaskIncomingEdges, selectedTaskOutgoingEdges]);
  const selectedTaskBaseline = useMemo(() => {
    if (!initialSnapshotRef.current?.tasks || !selectedTaskId) return null;
    return (initialSnapshotRef.current.tasks || []).find((task: any) => String(task.node_id || task.id) === String(selectedTaskId)) || null;
  }, [selectedTaskId]);
  const selectedTaskDiagnostics = useMemo(() => getTaskDiagnostics(selectedTask), [selectedTask]);
  const selectedTaskDiff = useMemo(() => {
    if (!selectedTask) {
      return { changedFields: [] as Array<{ key: string; before: any; after: any }>, addedConnections: 0, removedConnections: 0, changedConnections: 0 };
    }
    const baselineTask = selectedTaskBaseline || {};
    const fields = ['name', 'description', 'task_type', 'manual_time_minutes', 'automation_time_minutes', 'machine_wait_time_minutes', 'occurrence', 'owning_team', 'validation_needed', 'shadow_it_used', 'shadow_it_link', 'post_task_verification', 'phase_name', 'subflow_name', 'task_block_key', 'risks_yield_scrap'];
    const changedFields = fields
      .map((key) => ({
        key,
        before: (baselineTask as any)[key],
        after: (selectedTask as any)[key],
      }))
      .filter((entry) => JSON.stringify(entry.before ?? null) !== JSON.stringify(entry.after ?? null));
    const baselineInputCount = Array.isArray((baselineTask as any)?.source_data_list) ? (baselineTask as any).source_data_list.length : 0;
    const baselineOutputCount = Array.isArray((baselineTask as any)?.output_data_list) ? (baselineTask as any).output_data_list.length : 0;
    const currentInputCount = selectedTask.source_data_list.length;
    const currentOutputCount = selectedTask.output_data_list.length;
    const addedConnections = Math.max(0, currentInputCount + currentOutputCount - baselineInputCount - baselineOutputCount);
    const removedConnections = Math.max(0, baselineInputCount + baselineOutputCount - currentInputCount - currentOutputCount);
    return { changedFields, addedConnections, removedConnections, changedConnections: selectedTaskIncomingEdges.length + selectedTaskOutgoingEdges.length };
  }, [selectedTask, selectedTaskBaseline, selectedTaskIncomingEdges.length, selectedTaskOutgoingEdges.length]);
  const selectedTaskCompleteness = useMemo(() => {
    if (!selectedTask) return { score: 0, total: 0, missing: [] as string[] };
    const checks = [
      { label: 'Name', ok: Boolean(selectedTask.name.trim()) },
      { label: 'Description', ok: Boolean(selectedTask.description.trim()) },
      { label: 'Owner team', ok: Boolean(selectedTask.owning_team?.trim()) },
      { label: 'Owner roles', ok: Boolean((selectedTask.owner_positions || []).length > 0) },
      { label: 'Backup owner', ok: Boolean(selectedTaskDiagnostics.taskManagement?.backup_owner || (selectedTaskDiagnostics.taskManagement?.sme || '').trim()) },
      { label: 'Reviewer', ok: Boolean(selectedTaskDiagnostics.taskManagement?.reviewer || selectedTaskDiagnostics.taskManagement?.escalation_contact) },
      { label: 'Systems', ok: Boolean((selectedTask.involved_systems || []).length > 0) },
      { label: 'Inputs', ok: Boolean((selectedTask.source_data_list || []).length > 0) },
      { label: 'Outputs', ok: Boolean((selectedTask.output_data_list || []).length > 0) },
      { label: 'References', ok: Boolean((selectedTask.reference_links || []).length > 0) },
      { label: 'Dependencies', ok: Boolean(selectedTaskIncomingEdges.length > 0 || selectedTaskOutgoingEdges.length > 0 || (selectedTask.source_data_list || []).some((item) => !item.from_task_id) || (selectedTask.output_data_list || []).length > 0) },
      { label: 'Validation detail', ok: !selectedTask.validation_needed || Boolean((selectedTask.validation_procedure_steps || []).length > 0) },
      { label: 'Validation evidence', ok: !selectedTask.validation_needed || Boolean((selectedTask.validation_procedure_steps || []).some((step) => (step.figures || []).length > 0)) },
      { label: 'Risk / readiness', ok: Boolean(selectedTaskDiagnostics.taskProfile?.risk_level || selectedTaskDiagnostics.taskProfile?.automation_readiness || selectedTaskDiagnostics.taskProfile?.sla || selectedTaskDiagnostics.taskProfile?.cadence) },
      { label: 'Automation gap', ok: selectedTask.interface ? true : Boolean(Number(selectedTask.manual_time_minutes || 0) > 0 || Number(selectedTask.automation_time_minutes || 0) > 0) },
    ];
    const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
    return {
      score,
      total: checks.length,
      missing: checks.filter((check) => !check.ok).map((check) => check.label),
      done: checks.filter((check) => check.ok).map((check) => check.label),
    };
  }, [selectedTask, selectedTaskDiagnostics, selectedTaskIncomingEdges.length, selectedTaskOutgoingEdges.length]);

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

  const historyComparisonWorkflow = useMemo(() => {
    if (historyCompareMode === 'saved') return null;
    if (historyCompareMode === 'selected' && historyCompareVersionId) {
      return relatedWorkflowList.find((item: any) => String(item.id) === String(historyCompareVersionId)) || null;
    }
    if (historyCompareMode === 'approved') {
      return relatedWorkflowList.find((item: any) => {
        const state = String(item?.approval_state || item?.review_state || '').toLowerCase();
        return ['approved', 'certified'].includes(state) && String(item?.id) !== String(workflow?.id);
      }) || null;
    }
    return null;
  }, [historyCompareMode, historyCompareVersionId, relatedWorkflowList, workflow?.id]);

  const historyComparisonSnapshot = useMemo(() => {
    if (!historyComparisonWorkflow) return initialSnapshotRef.current || {};
    return {
      metadata: {
        name: historyComparisonWorkflow?.name || '',
        version: historyComparisonWorkflow?.version || 1,
        description: historyComparisonWorkflow?.description || historyComparisonWorkflow?.forensic_description || '',
        prc: historyComparisonWorkflow?.prc || '',
        workflow_type: historyComparisonWorkflow?.workflow_type || '',
        tool_family: normalizeDefinitionList(historyComparisonWorkflow?.tool_family),
        applicable_tools: normalizeDefinitionList(historyComparisonWorkflow?.tool_family).length > 0
          ? (Array.isArray(historyComparisonWorkflow?.applicable_tools) ? historyComparisonWorkflow.applicable_tools : normalizeDefinitionList(historyComparisonWorkflow?.tool_id))
          : [],
        trigger_type: historyComparisonWorkflow?.trigger_type || '',
        trigger_description: historyComparisonWorkflow?.trigger_description || '',
        output_type: historyComparisonWorkflow?.output_type || '',
        output_description: historyComparisonWorkflow?.output_description || '',
        cadence_count: historyComparisonWorkflow?.cadence_count || 1,
        cadence_unit: historyComparisonWorkflow?.cadence_unit || 'week',
        repeatability_check: historyComparisonWorkflow?.repeatability_check ?? true,
      },
      tasks: Array.isArray(historyComparisonWorkflow?.tasks) ? historyComparisonWorkflow.tasks : [],
      edges: Array.isArray(historyComparisonWorkflow?.edges) ? historyComparisonWorkflow.edges : [],
    };
  }, [historyComparisonWorkflow]);

  const workflowDiff = useMemo(() => {
    const baseline = historyComparisonSnapshot || initialSnapshotRef.current || {};
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
        const changedFields = comparisons
          .map((key) => ({
            key,
            before: (baselineTask as any)[key],
            after: (task as any)[key],
          }))
          .filter((entry) => JSON.stringify(entry.before ?? null) !== JSON.stringify(entry.after ?? null));
        if (changedFields.length === 0) return null;
        const renameOnly = changedFields.length === 1 && changedFields[0].key === 'name';
        return {
          id: String(task.node_id || task.id),
          name: task.name,
          baselineName: (baselineTask as any)?.name,
          renamed: renameOnly,
          changedFields,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; baselineName?: string; renamed?: boolean; changedFields: Array<{ key: string; before: any; after: any }> }>;
    const edgeKey = (edge: any) => String(edge.id || `${edge.source}::${edge.target}`);
    const baselineEdges = new Map((baseline.edges || []).map((edge: any) => [edgeKey(edge), edge]));
    const currentEdges = new Map(edges.map((edge) => [edgeKey(edge), edge]));
    const addedEdges = edges.filter((edge) => !baselineEdges.has(edgeKey(edge)));
    const removedEdges = (baseline.edges || []).filter((edge: any) => !currentEdges.has(edgeKey(edge)));
    const changedEdges = edges
      .map((edge) => {
        const baselineEdge = baselineEdges.get(edgeKey(edge));
        if (!baselineEdge) return null;
        const changedFields = ['source', 'target', 'label', 'edge_style', 'line_style', 'color'].map((key) => {
          const currentValue = key === 'label' ? edge.data?.label : key === 'edge_style' ? edge.data?.edgeStyle : key === 'line_style' ? edge.data?.lineStyle : key === 'color' ? edge.data?.color : (edge as any)[key];
          const baselineValue = (baselineEdge as any)[key];
          return { key, before: baselineValue, after: currentValue };
        }).filter((entry) => JSON.stringify(entry.before ?? null) !== JSON.stringify(entry.after ?? null));
        if (changedFields.length === 0) return null;
        const routeChanged = changedFields.some((field) => field.key === 'source' || field.key === 'target');
        return { id: String(edge.id), changedFields, source: edge.source, target: edge.target, label: edge.data?.label || '', routeChanged };
      })
      .filter(Boolean) as Array<{ id: string; changedFields: Array<{ key: string; before: any; after: any }>; source: string; target: string; label: string; routeChanged?: boolean }>;
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
  }, [edges, historyComparisonSnapshot, metadata, tasks]);

  const commentCountsByTaskId = useMemo(() => {
    const counts = new Map<string, { total: number; open: number; resolved: number }>();
    workflowComments.forEach((comment) => {
      if (comment.scope !== 'task' || !comment.scope_id) return;
      const key = String(comment.scope_id);
      const current = counts.get(key) || { total: 0, open: 0, resolved: 0 };
      current.total += 1;
      if (comment.status === 'resolved') current.resolved += 1;
      else current.open += 1;
      counts.set(key, current);
    });
    return counts;
  }, [workflowComments]);
  const selectedTaskComments = useMemo(
    () => workflowComments
      .filter((comment) => comment.scope === 'task' && String(comment.scope_id || '') === String(selectedTaskId))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [selectedTaskId, workflowComments]
  );

  const openCommentsForTask = useCallback((taskId?: string | null) => {
    const nextTaskId = taskId || selectedTaskId || null;
    setUtilityPane('comments');
    setUtilityPaneTaskId(nextTaskId);
    setUtilityPaneSectionId(null);
    setCommentFilter('all');
    setSelectedTaskId(nextTaskId);
    setSelectedEdgeId(null);
    if (nextTaskId) {
      setSelectedNodeIds([nextTaskId]);
      setSelectedEdgeIds([]);
    }
    setCommentDraft(createWorkflowComment('task', nextTaskId || ''));
  }, [selectedTaskId]);

  const openHistoryPane = useCallback(() => {
    setUtilityPane('history');
    setUtilityPaneTaskId(null);
    setUtilityPaneSectionId(null);
  }, []);

  const openReviewPane = useCallback(() => {
    setUtilityPane('review');
    setUtilityPaneTaskId(null);
    setUtilityPaneSectionId(null);
  }, []);

  const closeUtilityPane = useCallback(() => {
    setUtilityPane(null);
    setUtilityPaneTaskId(null);
    setUtilityPaneSectionId(null);
  }, []);

  const scrollToTaskSection = useCallback((sectionId: string) => {
    const target = taskSectionRefs.current[sectionId];
    if (target && taskPaneScrollRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const focusCompletenessSection = useCallback((label: string) => {
    const sectionId = getCompletenessSectionId(label);
    if (sectionId === 'validation') setInspectorTab('validation');
    else if (sectionId === 'appendix') setInspectorTab('appendix');
    else setInspectorTab('overview');
    window.requestAnimationFrame(() => scrollToTaskSection(sectionId));
  }, [scrollToTaskSection]);

  const inspectorSections = useMemo(() => ([
    { id: 'overview', label: 'Overview', tab: 'overview' as InspectorTab, keywords: ['name', 'description', 'purpose', 'definition', 'task nomenclature', 'task type', 'manual time', 'automation time'] },
    { id: 'dependencies', label: 'Dependencies', tab: 'overview' as InspectorTab, keywords: ['dependency', 'upstream', 'downstream', 'handoff', 'blocker', 'input', 'output', 'route'] },
    { id: 'ownership', label: 'Ownership & Risk', tab: 'overview' as InspectorTab, keywords: ['owner', 'backup', 'sme', 'reviewer', 'escalation', 'risk', 'readiness', 'sla', 'cadence'] },
    { id: 'systems', label: 'Systems & Integrations', tab: 'overview' as InspectorTab, keywords: ['system', 'integration', 'shadow it', 'link', 'usage'] },
    { id: 'comments', label: 'Comments', tab: 'overview' as InspectorTab, keywords: ['comment', 'discussion', 'note', 'review'] },
    { id: 'validation', label: 'Validation', tab: 'validation' as InspectorTab, keywords: ['validation', 'verify', 'evidence', 'check', 'post-task'] },
    { id: 'appendix', label: 'Appendix', tab: 'appendix' as InspectorTab, keywords: ['reference', 'asset', 'instruction', 'step', 'appendix'] },
  ]), []);

  const inspectorSearchTargets = useMemo(() => ([
    { id: 'overview', field: 'task.name', label: 'Task name', keywords: ['name', 'nomenclature', 'title'] },
    { id: 'overview', field: 'task.description', label: 'Task description', keywords: ['description', 'context'] },
    { id: 'overview', field: 'task.task_type', label: 'Task type', keywords: ['task type', 'logic'] },
    { id: 'overview', field: 'task.manual_time_minutes', label: 'Manual TAT', keywords: ['tat manual', 'manual time', 'manual tat'] },
    { id: 'overview', field: 'task.automation_time_minutes', label: 'Machine TAT', keywords: ['tat machine', 'automation time', 'machine tat'] },
    { id: 'ownership', field: 'task.owning_team', label: 'Owner team', keywords: ['owner team', 'team'] },
    { id: 'ownership', field: 'task.owner_positions', label: 'Owner positions', keywords: ['owner positions', 'positions', 'roles'] },
    { id: 'ownership', field: 'task.backup_owner', label: 'Backup owner', keywords: ['backup owner', 'backup'] },
    { id: 'ownership', field: 'task.reviewer', label: 'Reviewer', keywords: ['reviewer', 'review'] },
    { id: 'systems', field: 'task.involved_systems', label: 'Systems', keywords: ['systems', 'integration', 'system'] },
    { id: 'validation', field: 'task.validation_procedure_steps', label: 'Validation steps', keywords: ['validation', 'evidence', 'verify'] },
    { id: 'appendix', field: 'task.reference_links', label: 'References', keywords: ['reference', 'appendix', 'sop'] },
    { id: 'dependencies', field: 'task.source_data_list', label: 'Inputs', keywords: ['input', 'upstream'] },
    { id: 'dependencies', field: 'task.output_data_list', label: 'Outputs', keywords: ['output', 'downstream'] },
    { id: 'ownership', field: 'task.sla', label: 'SLA', keywords: ['sla', 'timing'] },
  ]), []);

  const focusBuilderField = useCallback((fieldKey: string) => {
    const selector = `[data-builder-field="${fieldKey}"]`;
    const root = taskPaneScrollRef.current || document;
    const target = root.querySelector(selector) as HTMLElement | null;
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.requestAnimationFrame(() => {
      if (typeof (target as HTMLInputElement | HTMLTextAreaElement).focus === 'function') {
        (target as HTMLInputElement | HTMLTextAreaElement).focus({ preventScroll: true });
      }
    });
    return true;
  }, []);

  const focusTaskField = useCallback((fieldKey: string) => {
    window.requestAnimationFrame(() => {
      if (focusBuilderField(fieldKey)) return;
    });
    if (fieldKey.startsWith('workflow.')) {
      setIsMetadataEditMode(true);
      window.requestAnimationFrame(() => {
        focusBuilderField(fieldKey);
      });
    }
  }, [focusBuilderField]);

  const issueToFieldKey = useCallback((issue: WorkflowAuditIssue) => {
    const fieldFromCode = issue.code.replace(/^task\./, '').replace(/^workflow\./, '');
    const taskFieldMap: Record<string, string> = {
      name: 'task.name',
      description: 'task.description',
      task_type: 'task.task_type',
      manual_time_minutes: 'task.manual_time_minutes',
      automation_time_minutes: 'task.automation_time_minutes',
      owning_team: 'task.owning_team',
      validation_step: 'task.validation_procedure_steps',
      validation_procedure_steps: 'task.validation_procedure_steps',
      reference_links: 'task.reference_links',
      source_data_list: 'task.source_data_list',
      output_data_list: 'task.output_data_list',
      involved_systems: 'task.involved_systems',
      blockers: 'task.blockers',
      errors: 'task.errors',
    };
    if (issue.scope === 'workflow') {
      const workflowFieldMap: Record<string, string> = {
        name: 'workflow.name',
        description: 'workflow.description',
        prc: 'workflow.prc',
        workflow_type: 'workflow.workflow_type',
        cadence: 'workflow.cadence',
        tool_family: 'workflow.tool_family',
        applicable_tools: 'workflow.applicable_tools',
        trigger_type: 'workflow.trigger_type',
        trigger_description: 'workflow.trigger_description',
        output_type: 'workflow.output_type',
        output_description: 'workflow.output_description',
        pre_requisites: 'workflow.pre_requisites',
      };
      return workflowFieldMap[fieldFromCode] || `workflow.${fieldFromCode}`;
    }
    return taskFieldMap[fieldFromCode] || `task.${fieldFromCode}`;
  }, []);

  useEffect(() => {
    if (!inspectorSearch.trim()) return;
    const query = inspectorSearch.toLowerCase().trim();
    const target = inspectorSearchTargets
      .map((item) => ({
        ...item,
        score: Math.max(
          ...[item.label, ...item.keywords].map((value) => scoreCommandMatch(query, value)),
          -1
        ),
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => a.score - b.score)[0];
    const match = target
      ? inspectorSections.find((section) => section.id === target.id)
      : inspectorSections.find((section) => [section.label, ...section.keywords].some((value) => value.toLowerCase().includes(query)));
    if (!match) return;
    setInspectorTab(match.tab);
    window.requestAnimationFrame(() => {
      scrollToTaskSection(match.id);
      if (target) focusBuilderField(target.field);
    });
  }, [focusBuilderField, inspectorSearch, inspectorSearchTargets, inspectorSections, scrollToTaskSection]);

  useEffect(() => {
    setNodes((prev) => prev.map((node) => ({
      ...node,
        data: {
          ...node.data,
        commentSummary: commentCountsByTaskId.get(node.id) || { total: 0, open: 0, resolved: 0 },
        onOpenComments: openCommentsForTask,
        },
      })));
  }, [commentCountsByTaskId, openCommentsForTask, setNodes]);

  useEffect(() => {
    if (historyCompareMode === 'selected') return;
    if (historyCompareMode === 'approved' && historyComparisonWorkflow) return;
    if (historyCompareMode === 'saved') return;
    if (versionHistory.length === 0) return;
    const fallbackVersion = versionHistory.find((version) => !version.isCurrent) || versionHistory[0];
    setHistoryCompareVersionId(String(fallbackVersion?.id || ''));
  }, [historyCompareMode, historyComparisonWorkflow, versionHistory]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    setCommandPaletteIndex(0);
  }, [commandPaletteOpen, commandPaletteQuery]);

  const addWorkflowComment = useCallback(() => {
    if (isReadOnlyMode) return;
    if (!commentDraft.message.trim()) {
      toast.error('Comment message is required.');
      return;
    }
    const commentScopeTaskId = utilityPaneTaskId || undefined;
    const commentScopeSectionId = utilityPaneSectionId || undefined;
    const nextComment = {
      ...commentDraft,
      id: commentDraft.id || `comment-${Date.now()}`,
      created_at: commentDraft.created_at || new Date().toISOString(),
      scope: commentDraft.scope || (commentScopeSectionId ? 'section' : commentScopeTaskId ? 'task' : 'workflow'),
      scope_id: commentDraft.scope_id || commentScopeSectionId || commentScopeTaskId || undefined,
      status: commentDraft.status || 'open',
    };
    saveToHistory();
    setWorkflowComments((prev) => [nextComment, ...prev]);
    setCommentDraft(createWorkflowComment(commentScopeSectionId ? 'section' : commentScopeTaskId ? 'task' : 'workflow', commentScopeSectionId || commentScopeTaskId || ''));
    setIsDirty?.(true);
    toast.success('Comment added');
  }, [commentDraft, saveToHistory, setIsDirty, utilityPaneSectionId, utilityPaneTaskId]);

  const updateWorkflowComment = useCallback((commentId: string, message: string) => {
    if (isReadOnlyMode) return;
    if (!message.trim()) {
      toast.error('Comment message is required.');
      return;
    }
    saveToHistory();
    setWorkflowComments((prev) => prev.map((comment) => comment.id === commentId ? { ...comment, message: message.trim(), updated_at: new Date().toISOString() } : comment));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const toggleWorkflowCommentStatus = useCallback((commentId: string) => {
    if (isReadOnlyMode) return;
    saveToHistory();
    setWorkflowComments((prev) => prev.map((comment) => (
      comment.id === commentId
        ? { ...comment, status: comment.status === 'resolved' ? 'open' : 'resolved', updated_at: new Date().toISOString() }
        : comment
    )));
    setIsDirty?.(true);
  }, [saveToHistory, setIsDirty]);

  const deleteWorkflowComment = useCallback((commentId: string) => {
    if (isReadOnlyMode) return;
    saveToHistory();
    setWorkflowComments((prev) => prev.filter((comment) => comment.id !== commentId));
    setIsDirty?.(true);
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setEditingCommentDraft('');
    }
  }, [editingCommentId, saveToHistory, setIsDirty]);

  const renderHistorySurface = () => {
    const renderHistoryGroup = (
      title: string,
      toneClass: string,
      items: any[],
      renderItem: (item: any) => React.ReactNode,
    ) => {
      if (items.length === 0) return null;
      return (
        <details className={cn("rounded-[8px] border p-1.5", toneClass)} open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-1.5 [&::-webkit-details-marker]:hidden">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/75">{title}</p>
            <span className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
              {items.length}
            </span>
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {items.map(renderItem)}
          </div>
        </details>
      );
    };

    return (
      <div className="space-y-1.5 animate-apple-in pb-8">
        <div className={cn(BUILDER_PANEL, "p-1.5 space-y-1.5 border-slate-500/15 bg-slate-500/5")}>
          <div className="flex items-center justify-between gap-1.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-200">Version History</p>
              <p className="mt-1 text-[11px] font-bold text-white/50">Compare this draft against a saved, approved, or selected version.</p>
            </div>
            <History size={16} className="text-slate-200" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['saved', 'approved', 'selected'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setHistoryCompareMode(mode)}
                className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] transition-all", historyCompareMode === mode ? "border-slate-300/20 bg-slate-300/10 text-white" : "border-white/10 bg-black/20 text-white/45 hover:text-white")}
              >
                {mode === 'saved' ? 'Saved' : mode === 'approved' ? 'Approved' : 'Selected'}
              </button>
            ))}
            {historyCompareMode === 'selected' && (
              <select
                className="rounded-[8px] border border-slate-300/15 bg-black/30 px-1.5 py-[3px] text-[8px] font-black uppercase text-white outline-none"
                value={historyCompareVersionId}
                onChange={(e) => setHistoryCompareVersionId(e.target.value)}
              >
                {versionHistory.filter((version) => !version.isCurrent).map((version) => (
                  <option key={`${version.id}-${version.version}`} value={version.id}>
                    v{version.version} {version.state}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {versionHistory.slice(0, 4).map((version) => (
              <button
                key={`${version.id}-${version.version}`}
                onClick={() => {
                  setHistoryCompareMode('selected');
                  setHistoryCompareVersionId(String(version.id));
                }}
                className={cn(
                  "rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] transition-colors",
                  String(historyCompareVersionId) === String(version.id) && historyCompareMode === 'selected'
                    ? "border-slate-300/20 bg-slate-300/10 text-white"
                    : "border-white/10 bg-black/20 text-white/45 hover:text-white",
                  version.isCurrent && "opacity-70"
                )}
              >
                v{version.version} {version.isCurrent ? 'Current' : version.state}
              </button>
            ))}
          </div>
          <div className="rounded-[8px] border border-slate-300/15 bg-slate-500/10 px-1.5 py-1 text-[9px] font-bold text-slate-100">
            Comparing against {historyCompareMode === 'saved' ? 'last saved draft' : historyCompareMode === 'approved' ? 'latest approved version' : `v${historyComparisonSnapshot?.metadata?.version || historyCompareVersionId || 'selected'}`}.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="rounded-[8px] border border-slate-300/15 bg-slate-500/10 p-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-200">Tasks changed</p>
              <p className="mt-1 text-[20px] font-black text-white">
                {workflowDiff.addedTasks.length + workflowDiff.changedTasks.length + workflowDiff.removedTasks.length}
              </p>
            </div>
            <div className="rounded-[8px] border border-cyan-500/15 bg-cyan-500/10 p-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-cyan-100">Routes changed</p>
              <p className="mt-1 text-[20px] font-black text-cyan-100">
                {workflowDiff.addedEdges.length + workflowDiff.removedEdges.length + workflowDiff.changedEdges.length}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5 max-h-[15rem] overflow-auto pr-1 custom-scrollbar">
          {workflowDiff.addedTasks.length === 0 && workflowDiff.removedTasks.length === 0 && workflowDiff.changedTasks.length === 0 && workflowDiff.addedEdges.length === 0 && workflowDiff.removedEdges.length === 0 && workflowDiff.changedEdges.length === 0 && workflowDiff.changedMetadata.length === 0 && (
            <div className="rounded-[8px] border border-slate-300/15 bg-slate-500/10 px-1.5 py-1.5 text-[10px] font-bold text-slate-100">
              No task or route changes were detected against the selected baseline. Switch baselines or make a draft edit to compare.
            </div>
          )}
          {renderHistoryGroup(
            'Added tasks',
            'border-emerald-500/15 bg-emerald-500/5',
            workflowDiff.addedTasks,
            (task: any) => (
              <div key={`added-${task.node_id || task.id}`} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-1.5 text-[10px] font-bold text-emerald-100">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-black text-white">{task.name || 'Untitled task'}</span>
                  <span className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">New</span>
                </div>
              </div>
            ),
          )}

          {renderHistoryGroup(
            'Updated tasks',
            'border-amber-500/15 bg-amber-500/5',
            workflowDiff.changedTasks,
            (task: any) => (
              <div key={`changed-${task.id}`} className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-1.5 text-[10px] font-bold text-amber-100">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-black text-white">{task.renamed ? `${task.baselineName || task.id} → ${task.name || task.id}` : (task.name || task.id)}</span>
                  <span className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-amber-300">{task.changedFields.length} fields</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {task.changedFields.map((field: any) => (
                    <div key={`${task.id}-${field.key}`} className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/40">{field.key.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-[10px] font-bold text-white/70 leading-relaxed">
                        {formatDiffValue(field.before)} <span className="text-white/25">→</span> {formatDiffValue(field.after)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}

          {renderHistoryGroup(
            'Removed tasks',
            'border-rose-500/15 bg-rose-500/5',
            workflowDiff.removedTasks,
            (task: any) => (
              <div key={`removed-${task.node_id || task.id}`} className="rounded-[8px] border border-rose-500/20 bg-rose-500/10 px-1.5 py-1.5 text-[10px] font-bold text-rose-100">
                Removed task: {task.name || task.id}
              </div>
            ),
          )}

          {renderHistoryGroup(
            'Route changes',
            'border-sky-500/15 bg-sky-500/5',
            [
              ...workflowDiff.addedEdges.map((edge: any) => ({ ...edge, _kind: 'added' })),
              ...workflowDiff.changedEdges.map((edge: any) => ({ ...edge, _kind: 'changed' })),
              ...workflowDiff.removedEdges.map((edge: any) => ({ ...edge, _kind: 'removed' })),
            ],
            (edge: any) => {
              if (edge._kind === 'added') {
                return (
                  <div key={`edge-added-${edge.id}`} className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-1.5 text-[10px] font-bold text-sky-100">
                    Added route: {edge.data?.label || `${edge.source} → ${edge.target}`}
                  </div>
                );
              }
              if (edge._kind === 'removed') {
                return (
                  <div key={`edge-removed-${edge.id}`} className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-1.5 text-[10px] font-bold text-sky-100">
                    Removed route: {edge.data?.label || `${edge.source} → ${edge.target}`}
                  </div>
                );
              }
              return (
                <div key={`edge-${edge.id}`} className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-1.5 text-[10px] font-bold text-sky-100">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-black text-white">{edge.label || `${edge.source} → ${edge.target}`}</span>
                    <div className="flex items-center gap-1.5">
                      {edge.routeChanged && <span className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-300">Route</span>}
                      <span className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-300">{edge.changedFields.length} changes</span>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {edge.changedFields.map((field: any) => (
                      <div key={`${edge.id}-${field.key}`} className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/40">{field.key.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-[10px] font-bold text-white/70">
                          {formatDiffValue(field.before)} <span className="text-white/25">→</span> {formatDiffValue(field.after)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            },
          )}

          {renderHistoryGroup(
            'Metadata changes',
            'border-white/10 bg-white/5',
            workflowDiff.changedMetadata,
            (field: string) => (
              <span key={field} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55">
                {field}
              </span>
            ),
          )}
        </div>
        {rollbackPreview?.available && onCreateRollbackDraft && (
          <button onClick={onCreateRollbackDraft} className="w-full rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
            Create Rollback Draft
          </button>
        )}
      </div>
    );
  };

  const renderCommentsSurface = () => {
    const activeTask = utilityPaneTaskId ? tasks.find((task) => String(task.id) === String(utilityPaneTaskId)) : selectedTask;
    const scopeTitle = utilityPaneSectionId
      ? `${utilityPaneSectionId} section`
      : activeTask?.name || workflow?.name || 'Workflow';
    const scopedComments = workflowComments
      .filter((comment) => {
        if (utilityPaneSectionId) return comment.scope === 'section' && String(comment.scope_id || '') === String(utilityPaneSectionId);
        if (utilityPaneTaskId) return comment.scope === 'task' && String(comment.scope_id || '') === String(utilityPaneTaskId);
        return comment.scope === 'workflow';
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const filteredComments = scopedComments.filter((comment) => {
      if (commentFilter === 'open') return comment.status !== 'resolved';
      if (commentFilter === 'resolved') return comment.status === 'resolved';
      return true;
    });
    const openCount = scopedComments.filter((comment) => comment.status !== 'resolved').length;
    const resolvedCount = scopedComments.filter((comment) => comment.status === 'resolved').length;
    const jumpToCommentScope = (comment: WorkflowComment) => {
      if (comment.scope === 'task' && comment.scope_id) {
        openCommentsForTask(String(comment.scope_id));
        return;
      }
      if (comment.scope === 'section' && comment.scope_id) {
        setUtilityPane('comments');
        setUtilityPaneTaskId(null);
        setUtilityPaneSectionId(String(comment.scope_id));
        setCommentFilter('all');
        setCommentDraft(createWorkflowComment('section', String(comment.scope_id)));
        return;
      }
      setUtilityPane('comments');
      setUtilityPaneTaskId(null);
      setUtilityPaneSectionId(null);
      setCommentFilter('all');
      setCommentDraft(createWorkflowComment('workflow', ''));
    };
    return (
      <div className="space-y-1.5 animate-apple-in pb-8">
        <div className={cn(BUILDER_PANEL, "p-1.5 space-y-1.5 border-sky-500/15 bg-sky-500/5")}>
          <div className="flex items-center justify-between gap-1.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-sky-100">Notes</p>
              <p className="mt-1 text-[11px] font-bold text-white/55">Short notes for {scopeTitle}. Keep the thread tied to the work.</p>
            </div>
            <MessageSquare size={16} className="text-sky-100" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-[8px] border border-sky-500/15 bg-sky-500/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-sky-100">{openCount} open</span>
            <span className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-emerald-100">{resolvedCount} resolved</span>
            <div className="ml-auto flex flex-wrap gap-1">
              {(['all', 'open', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCommentFilter(filter)}
                  className={cn(
                    "rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] transition-all",
                    commentFilter === filter ? "border-sky-500/20 bg-sky-500/10 text-sky-100" : "border-white/10 bg-black/20 text-white/45 hover:text-white"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="w-full rounded-[8px] border border-sky-500/15 bg-black/30 px-1.5 py-1.5 text-[11px] font-bold text-white/80 outline-none focus:border-sky-400 min-h-[5.5rem] resize-none"
            value={commentDraft.message}
            disabled={reviewMode}
            onChange={(e) => setCommentDraft((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Add a note..."
          />
          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={addWorkflowComment}
              disabled={reviewMode}
              className="rounded-[8px] border border-sky-500/15 bg-sky-500/10 px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-sky-100 hover:bg-sky-500/20 hover:text-white transition-all"
            >
              Save Note
            </button>
            <p className="text-[10px] font-bold text-white/35">{scopedComments.length} comments</p>
          </div>
        </div>
        <div className="space-y-1.5 max-h-[28rem] overflow-auto pr-1 custom-scrollbar">
          {filteredComments.map((comment) => {
            const isEditing = editingCommentId === comment.id;
            const scopeLabel = comment.scope === 'task' ? 'Task' : comment.scope === 'section' ? 'Section' : 'Workflow';
            return (
              <div key={comment.id} className="rounded-[8px] border border-sky-500/15 bg-sky-500/5 p-1.5 space-y-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{comment.author}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded-[8px] border border-sky-500/15 bg-sky-500/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-sky-100">{scopeLabel}</span>
                      <span className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {comment.updated_at ? 'Edited' : 'Created'} {String(comment.created_at || comment.updated_at || '').slice(0, 19).replace('T', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => jumpToCommentScope(comment)}
                      disabled={reviewMode}
                      className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white"
                    >
                      Jump
                    </button>
                  <button
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      setEditingCommentDraft(comment.message);
                    }}
                    disabled={reviewMode}
                    className="rounded-[8px] border border-sky-500/15 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-100 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleWorkflowCommentStatus(comment.id)}
                    disabled={reviewMode}
                    className={cn(
                      "rounded-[8px] border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em]",
                      comment.status === 'resolved'
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                        : "border-sky-500/15 bg-black/20 text-sky-100 hover:text-white"
                    )}
                  >
                    {comment.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    onClick={() => deleteWorkflowComment(comment.id)}
                    disabled={reviewMode}
                    className="rounded-[8px] border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-rose-300"
                  >
                    Remove
                  </button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      className="w-full rounded-[8px] border border-sky-500/15 bg-black/30 px-1.5 py-1.5 text-[11px] font-bold text-white/80 outline-none focus:border-sky-400 min-h-[5.5rem] resize-none"
                      value={editingCommentDraft}
                      disabled={reviewMode}
                      onChange={(e) => setEditingCommentDraft(e.target.value)}
                    />
                    <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            updateWorkflowComment(comment.id, editingCommentDraft);
                            setEditingCommentId(null);
                            setEditingCommentDraft('');
                          }}
                          disabled={reviewMode}
                          className="rounded-[8px] border border-sky-500/15 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-sky-100"
                        >
                        Save
                      </button>
                        <button
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingCommentDraft('');
                          }}
                          disabled={reviewMode}
                          className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55"
                        >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-white/70 leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                )}
              </div>
            );
          })}
          {filteredComments.length === 0 && (
            <div className="rounded-[8px] border border-sky-500/15 bg-sky-500/5 px-1.5 py-1.5 text-[10px] font-bold text-white/40">
              No notes match this filter. Add a note or switch back to all comments.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReviewSurface = () => {
    const reviewState = workflow?.review_state || 'Draft';
    const approvalState = workflow?.approval_state || 'Draft';
    const taskCommentTotal = Array.from(commentCountsByTaskId.values()).reduce((total, value) => total + (value.total || 0), 0);
    const openCommentTotal = Array.from(commentCountsByTaskId.values()).reduce((total, value) => total + (value.open || 0), 0);
    return (
      <div className="space-y-1.5 animate-apple-in pb-8">
        <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/5 p-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-100">Review</p>
              <p className="mt-1 text-[11px] font-bold text-white/55">Read the workflow, check the states, then act only through review permissions.</p>
            </div>
            <ShieldCheck size={16} className="text-emerald-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <div className="rounded-[8px] border border-white/10 bg-black/20 p-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Review state</p>
              <p className={cn("mt-1 text-[12px] font-black uppercase tracking-[0.18em]", reviewState === 'Approved' ? "text-emerald-100" : "text-amber-100")}>{reviewState}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/20 p-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Approval state</p>
              <p className={cn("mt-1 text-[12px] font-black uppercase tracking-[0.18em]", ['Approved', 'Certified'].includes(approvalState) ? "text-emerald-100" : "text-white/70")}>{approvalState}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/20 p-1.5">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Comment load</p>
              <p className="mt-1 text-[12px] font-black uppercase tracking-[0.18em] text-white">{taskCommentTotal} total / {openCommentTotal} open</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/5 p-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-100">Decision actions</p>
              <p className="mt-1 text-[11px] font-bold text-white/50">Only actions allowed by the active member are shown here.</p>
            </div>
            <BriefcaseBusiness size={16} className="text-emerald-100" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onGovernanceAction && canReviewWorkflowState && workflow?.review_state !== 'Approved' && (
              <button onClick={() => onGovernanceAction('approve_review')} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-500/20">
                Approve Review
              </button>
            )}
            {onGovernanceAction && canApproveWorkflowState && !['Approved', 'Certified'].includes(workflow?.approval_state) && (
              <button onClick={() => onGovernanceAction('approve_workflow')} className="rounded-[8px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-sky-100 hover:bg-sky-500/20">
                Approve Workflow
              </button>
            )}
            {onGovernanceAction && canCertifyWorkflowState && workflow?.approval_state !== 'Certified' && (
              <button onClick={() => onGovernanceAction('certify')} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-500/20">
                Certify
              </button>
            )}
            {onGovernanceAction && canRequestChangesState && workflow?.review_state !== 'Changes Requested' && (
              <button onClick={() => onGovernanceAction('request_changes')} className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-500/20">
                Request Changes
              </button>
            )}
            {onGovernanceAction && canRequestRecertificationState && (
              <button onClick={() => onGovernanceAction('request_recertification')} className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-500/20">
                Need Recertification
              </button>
            )}
          </div>
        </div>

        <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/5 p-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-100">What to check</p>
              <p className="mt-1 text-[11px] font-bold text-white/50">Use the graph for edits. Use this hub for decision and context checks.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1.5 text-[10px] font-bold text-white/65">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Scope</p>
              Confirm the approved workflow, the current draft changes, and any replaced tasks.
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1.5 text-[10px] font-bold text-white/65">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Evidence</p>
              Look for validation steps, comments, and route changes before approving.
            </div>
          </div>
        </div>
      </div>
    );
  };
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

  const commandActions = useMemo<BuilderCommandAction[]>(() => ([
    { id: 'save', group: 'File', label: 'Save workflow', hint: 'Cmd/Ctrl+S', keywords: ['save', 'commit'], run: () => saveWorkflowRef.current?.() },
    { id: 'fit', group: 'Canvas', label: 'Fit diagram', hint: 'View all nodes', keywords: ['fit', 'zoom', 'frame'], run: () => fitView({ padding: 0.12, duration: 250 }) },
    { id: 'layout', group: 'Canvas', label: 'Auto layout', hint: 'Reflow graph', keywords: ['layout', 'arrange', 'dagre'], run: () => handleLayout(nodes, edges) },
    { id: 'task', group: 'Create', label: 'Add task', hint: 'Create a node', keywords: ['task', 'node', 'add'], run: () => onAddNode('TASK') },
    { id: 'condition', group: 'Create', label: 'Add condition', hint: 'Create a diamond', keywords: ['condition', 'loop', 'decision'], run: () => onAddNode('CONDITION') },
    { id: 'comments', group: 'Review', label: 'Open comments', hint: 'Task or workflow', keywords: ['comment', 'discussion'], run: () => { setUtilityPane('comments'); setUtilityPaneTaskId(selectedTaskId || null); setUtilityPaneSectionId(null); } },
    { id: 'history', group: 'Review', label: 'Open history', hint: 'Compare versions', keywords: ['history', 'diff', 'versions'], run: openHistoryPane },
    { id: 'review', group: 'Mode', label: reviewMode ? 'Exit review mode' : 'Enter review mode', hint: 'Read only', keywords: ['review', 'read only'], run: () => setReviewMode((current) => !current) },
    { id: 'inspector', group: 'Layout', label: layoutPrefs.inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector', hint: 'Task pane', keywords: ['inspector', 'pane', 'collapse'], run: () => updateLayoutPrefs({ inspectorCollapsed: !layoutPrefs.inspectorCollapsed }) },
    { id: 'minimap', group: 'Layout', label: layoutPrefs.showMiniMap ? 'Hide minimap' : 'Show minimap', hint: 'Mini map', keywords: ['minimap', 'map'], run: () => updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap }) },
    { id: 'selection', group: 'Selection', label: 'Clear selection', hint: 'Esc', keywords: ['clear', 'selection'], run: clearSelection },
  ]), [clearSelection, edges, fitView, handleLayout, layoutPrefs.inspectorCollapsed, layoutPrefs.showMiniMap, nodes, openHistoryPane, reviewMode, selectedTaskId, updateLayoutPrefs]);
  const prioritizedCommandActions = useMemo(() => {
    const query = commandPaletteQuery.trim();
    const ranked = commandActions
      .map((action) => {
        const score = query ? Math.max(
          scoreCommandMatch(query, action.label),
          scoreCommandMatch(query, action.hint),
          ...action.keywords.map((keyword) => scoreCommandMatch(query, keyword))
        ) : 0;
        const recentIndex = recentCommandIds.indexOf(action.id);
        return { action, score, recentIndex };
      })
      .filter((item) => !query || item.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        const aRecent = a.recentIndex >= 0 ? a.recentIndex : Number.MAX_SAFE_INTEGER;
        const bRecent = b.recentIndex >= 0 ? b.recentIndex : Number.MAX_SAFE_INTEGER;
        if (aRecent !== bRecent) return aRecent - bRecent;
        if (a.action.group !== b.action.group) return String(a.action.group || '').localeCompare(String(b.action.group || ''));
        return a.action.label.localeCompare(b.action.label);
      });
    return ranked.map((item) => item.action);
  }, [commandActions, commandPaletteQuery, recentCommandIds]);
  const groupedCommandActions = useMemo(() => {
    const groups = new Map<string, BuilderCommandAction[]>();
    prioritizedCommandActions.forEach((action) => {
      const group = action.group || 'Other';
      const next = groups.get(group) || [];
      next.push(action);
      groups.set(group, next);
    });
    return Array.from(groups.entries()).map(([group, actions]) => ({ group, actions }));
  }, [prioritizedCommandActions]);

  useEffect(() => {
    if (commandPaletteIndex >= prioritizedCommandActions.length) {
      setCommandPaletteIndex(Math.max(0, prioritizedCommandActions.length - 1));
    }
  }, [commandPaletteIndex, prioritizedCommandActions.length]);

  const executeCommandAction = useCallback((action: BuilderCommandAction) => {
    action.run();
    setRecentCommandIds((prev) => {
      const next = [action.id, ...prev.filter((id) => id !== action.id)].slice(0, 6);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`pathos-workflow-builder2-command-recents-${workflow?.id ?? 'new'}`, JSON.stringify(next));
        } catch (error) {
          console.warn('[Builder2] Failed to persist command recents:', error);
        }
      }
      return next;
    });
    setCommandPaletteOpen(false);
    setCommandPaletteQuery('');
    setCommandPaletteIndex(0);
  }, [workflow?.id]);

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
          inspectorCollapsed: false,
          showMiniMap: true,
        });
        return;
      }
      const parsed = JSON.parse(raw);
      setLayoutPrefs({
        inspectorCollapsed: Boolean(parsed?.inspectorCollapsed),
        showMiniMap: parsed?.showMiniMap !== false,
      });
    } catch (error) {
      console.warn('[Builder2] Failed to restore layout prefs:', error);
    }
  }, [layoutPrefsKey, workflow?.id]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(layoutPrefsKey, JSON.stringify(layoutPrefs));
    } catch (error) {
      console.warn('[Builder2] Failed to persist layout prefs:', error);
    }
  }, [layoutPrefs, layoutPrefsKey, workflow?.id]);

  useEffect(() => {
    if (!workflow?.id || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(`pathos-workflow-builder2-command-recents-${workflow.id}`);
      if (!stored) {
        setRecentCommandIds([]);
        return;
      }
      const parsed = JSON.parse(stored);
      setRecentCommandIds(Array.isArray(parsed) ? parsed.map((value) => String(value)).filter(Boolean) : []);
    } catch (error) {
      console.warn('[Builder2] Failed to restore command recents:', error);
      setRecentCommandIds([]);
    }
  }, [workflow?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const responsiveMax = Math.max(300, Math.min(460, Math.round(window.innerWidth * 0.34)));
      setInspectorWidth((current) => Math.max(300, Math.min(current, responsiveMax)));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      console.warn('[Builder2] Failed to restore draft:', error);
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
          isMetadataEditMode,
          workflowComments,
          accessControl,
          ownership,
          relatedWorkflowIds,
          commentDraft,
          importDraft,
        }));
        setLastDraftSavedAt(new Date().toISOString());
        setSaveStatus((current) => current === 'saving' ? current : 'saved');
      } catch (error) {
        console.warn('[Builder2] Failed to persist draft:', error);
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
    isMetadataEditMode,
    workflowComments,
    accessControl,
    ownership,
    relatedWorkflowIds,
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
        purpose_statement: (workflowDefinitionProfile as any).purpose_statement || workflow?.description || workflow?.forensic_description || '',
        pre_requisites: normalizeDefinitionList((workflowDefinitionProfile as any).pre_requisites || workflow?.quick_capture_notes || []),
        inline_examples: (workflowDefinitionProfile as any).inline_examples && typeof (workflowDefinitionProfile as any).inline_examples === 'object'
          ? { ...(workflowDefinitionProfile as any).inline_examples }
          : {},
        prc: workflow?.prc || '',
        workflow_type: workflow?.workflow_type || '',
        tool_family: normalizeDefinitionList(workflow?.tool_family),
        applicable_tools: normalizeDefinitionList(workflow?.tool_family).length > 0
          ? (Array.isArray(workflow?.applicable_tools) ? workflow.applicable_tools : normalizeDefinitionList(workflow?.tool_id))
          : [],
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
      setWorkflowComments(Array.isArray(workflow?.comments) ? workflow.comments.map(normalizeWorkflowComment) : []);
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
      setCommentDraft(createWorkflowComment());
      setDefinitionPrereqDraft('');
      setImportDraft('');
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
        , commentSummary: { total: 0, open: 0, resolved: 0 }, onOpenComments: openCommentsForTask
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
      initialSnapshotRef.current = JSON.parse(JSON.stringify({
        metadata: initialMetadata,
        comments: Array.isArray(workflow?.comments) ? workflow.comments.map(normalizeWorkflowComment) : [],
        tasks: initializedTasks,
        edges: initialEdges,
        accessControl: workflow?.access_control || {},
        ownership: workflow?.ownership || {},
        relatedWorkflowIds: workflow?.related_workflow_ids || [],
        version: workflow?.version || 1,
        updated_at: workflow?.updated_at || workflow?.updatedAt || null,
      }));
      if (initializedTasks.every((t: any) => !t.position_x && !t.position_y)) {
        setTimeout(() => handleLayout(initialNodes, initialEdges), 100);
      }
    } catch (err) {
      console.error("[Builder2] Critical Initialization Failure:", err);
    }
  }, [workflow]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    if (isReadOnlyMode) return;
    saveToHistory();
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { 
          ...n.data, label: updated.name, task_type: updated.task_type, manual_time: updated.manual_time_minutes, automation_time: updated.automation_time_minutes, occurrence: updated.occurrence, involved_systems: updated.involved_systems, owningTeam: updated.owning_team, ownerPositions: updated.owner_positions, sourceCount: (updated.source_data_list || []).length, outputCount: (updated.output_data_list || []).length, validation_needed: updated.validation_needed, blockerCount: (updated.blockers || []).length, errorCount: (updated.errors || []).length, description: updated.description, diagnostics: updated.diagnostics 
        } } : n));
        return updated;
      }
      return t;
    }));
    setIsDirty?.(true);
  };

  const updateTaskDiagnostics = useCallback((id: string, updates: Parameters<typeof buildTaskDiagnostics>[1]) => {
    if (isReadOnlyMode) return;
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const diagnostics = buildTaskDiagnostics(task, updates);
    updateTask(id, { diagnostics });
  }, [tasks, updateTask]);

  const updateSelectedTasksDiagnostics = useCallback((updates: Parameters<typeof buildTaskDiagnostics>[1]) => {
    if (isReadOnlyMode) return;
    if (selectedNodeIds.length === 0) return;
    saveToHistory();
    setTasks((prev) => prev.map((task) => {
      if (!selectedNodeIds.includes(String(task.node_id || task.id)) || task.interface === 'TRIGGER' || task.interface === 'OUTCOME') return task;
      return { ...task, diagnostics: buildTaskDiagnostics(task, updates) };
    }));
    setNodes((prev) => prev.map((node) => {
      if (!selectedNodeIds.includes(node.id)) return node;
      const task = tasks.find((item) => String(item.node_id || item.id) === node.id);
      if (!task || task.interface === 'TRIGGER' || task.interface === 'OUTCOME') return node;
      return { ...node, data: { ...node.data, diagnostics: buildTaskDiagnostics(task, updates) } };
    }));
    setIsDirty?.(true);
  }, [isReadOnlyMode, selectedNodeIds, saveToHistory, setIsDirty, setNodes, setTasks, tasks]);

  const updateEdge = (id: string, updates: any) => {
    if (isReadOnlyMode) return;
    saveToHistory();
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates }, markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } } : e));
    setIsDirty?.(true);
  };

  const updateSelectedTasks = useCallback((updates: Partial<TaskEntity>) => {
    if (isReadOnlyMode) return;
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
    if (isReadOnlyMode) return;
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

  const clearBuilderDraft = useCallback(() => {
    if (typeof window === 'undefined' || !workflow?.id) return;
    window.localStorage.removeItem(workflowBuilderDraftKey);
    setDraftRestored(false);
    toast.success('Builder draft cleared');
  }, [workflow?.id, workflowBuilderDraftKey]);

  const onConnect = (params: Connection) => {
    if (isReadOnlyMode) return;
    if (!params.source || !params.target) return;
    saveToHistory();
    const newEdge: Edge = { ...params, id: `e-${params.source}-${params.target}-${Date.now()}`, type: 'custom', data: { label: '', edgeStyle: defaultEdgeStyle, color: '#ffffff', lineStyle: 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, source: params.source, target: params.target };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const deleteTask = useCallback((id: string) => {
    if (isReadOnlyMode) return;
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return;
    saveToHistory();
    setTasks(prev => prev.filter(t => t.id !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedTaskId(null);
    setSelectedNodeIds((prev) => prev.filter((nodeId) => nodeId !== id));
    setSelectedEdgeIds((prev) => prev.filter((edgeId) => edgeId !== id));
    setSelectedEdgeId((current) => current === id ? null : current);
    setConfirmingDelete(null);
    setIsDirty?.(true);
  }, [tasks, setNodes, setEdges, setIsDirty, saveToHistory]);

const onAddNode = (type: 'TASK' | 'CONDITION') => {
    if (isReadOnlyMode) return;
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
        description: metadata.purpose_statement,
        expected_updated_at: workflow?.updated_at || workflow?.updatedAt || null,
        comments: workflowComments,
        access_control: accessControl,
        ownership,
        related_workflow_ids: relatedWorkflowIds,
        standards_profile: {
          ...(workflow?.standards_profile || {}),
          definition: {
            purpose_statement: metadata.purpose_statement,
            pre_requisites: metadata.pre_requisites,
            inline_examples: metadata.inline_examples,
            field_settings: definitionSettings,
          },
        },
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
        initialSnapshotRef.current = JSON.parse(JSON.stringify({
          metadata,
          tasks: tasks.map((task) => ({ ...task })),
          edges: edges.map((edge) => ({ ...edge })),
        }));
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
      console.error("[Builder2] Failed to prepare save data:", err);
    }
  };

  useEffect(() => {
    saveWorkflowRef.current = handleSave;
  }, [handleSave]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX; const startWidth = inspectorWidth;
    const handleMouseMove = (mv: MouseEvent) => setInspectorWidth(Math.max(300, Math.min(800, startWidth - (mv.pageX - startX))));
    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  };

  const swapEdgeDirection = (id: string) => {
    if (isReadOnlyMode) return;
    saveToHistory();
    setEdges(eds => eds.map(e => {
      if (e.id === id) { const newSourceHandle = e.targetHandle?.replace('-target', '-source'); const newTargetHandle = e.sourceHandle?.replace('-source', '-target'); return { ...e, source: e.target, target: e.source, sourceHandle: newSourceHandle, targetHandle: newTargetHandle }; }
      return e;
    }));
    setIsDirty?.(true);
  };

  const centerOnEdgeRoute = useCallback((edgeId: string) => {
    const edge = edges.find((item) => item.id === edgeId);
    if (!edge) return;
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return;
    const x = ((sourceNode.position?.x || 0) + (targetNode.position?.x || 0)) / 2 + 180;
    const y = ((sourceNode.position?.y || 0) + (targetNode.position?.y || 0)) / 2 + 120;
    setCenter(x, y, { zoom: 1.1, duration: 250 });
  }, [edges, nodes, setCenter]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
    if (isReadOnlyMode) return;
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
      setSelectedEdgeIds(prev => prev.filter(id => !ids.includes(id)));
      setSelectedTaskId((current) => current && ids.includes(current) ? null : current);
      setSelectedEdgeId((current) => current && ids.includes(current) ? null : current);
      setIsDirty?.(true);
    } else {
      saveToHistory();
      const ids = deleted.map(n => n.id);
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      setNodes(nds => nds.filter(n => !ids.includes(n.id)));
      setEdges(eds => eds.filter(e => !ids.includes(e.source) && !ids.includes(e.target)));
      setSelectedNodeIds(prev => prev.filter(id => !ids.includes(id)));
      setSelectedEdgeIds(prev => prev.filter(id => !ids.includes(id)));
      setSelectedTaskId((current) => current && ids.includes(current) ? null : current);
      setSelectedEdgeId((current) => current && ids.includes(current) ? null : current);
      setIsDirty?.(true);
    }
  }, [saveToHistory, setTasks, setNodes, setEdges, setIsDirty]);

  return (
    <div className="flex h-full min-h-0 w-full bg-[#050914] overflow-hidden">
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/70 backdrop-blur-sm px-3 pt-[12vh]">
          <div className="w-[min(34rem,96vw)] rounded-[8px] border border-white/10 bg-[#0a1120] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-1.5 py-1.5">
              <Search size={14} className="text-theme-accent" />
              <input
                autoFocus
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                placeholder="Search actions..."
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCommandPaletteIndex((current) => Math.min(current + 1, prioritizedCommandActions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCommandPaletteIndex((current) => Math.max(current - 1, 0));
                  } else if (e.key === 'Enter' && prioritizedCommandActions[commandPaletteIndex]) {
                    e.preventDefault();
                    executeCommandAction(prioritizedCommandActions[commandPaletteIndex]);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-white/25"
              />
              <button
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setCommandPaletteQuery('');
                  setCommandPaletteIndex(0);
                }}
                className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="max-h-[24rem] overflow-auto custom-scrollbar p-1.5">
              {prioritizedCommandActions.length === 0 ? (
                <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1.5 text-[10px] font-bold text-white/35">
                      No matching actions. Try a shorter command or a different keyword.
                </div>
              ) : groupedCommandActions.map(({ group, actions }) => (
                <div key={group} className="space-y-1.5 pb-2">
                  <p className="px-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/25">{group}</p>
                  {actions.map((action) => {
                    const actionIndex = prioritizedCommandActions.findIndex((candidate) => candidate.id === action.id);
                    const isActive = actionIndex === commandPaletteIndex;
                    return (
                      <button
                        key={action.id}
                        onClick={() => executeCommandAction(action)}
                        className={cn(
                          "flex w-full items-center justify-between gap-1.5 rounded-[8px] border px-1.5 py-1 text-left transition-colors",
                          isActive
                            ? "border-theme-accent/30 bg-theme-accent/10"
                            : "border-white/5 bg-white/[0.03] hover:border-theme-accent/20 hover:bg-theme-accent/10"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{action.label}</p>
                          <p className="mt-0.5 text-[9px] font-bold text-white/35">{action.hint}</p>
                        </div>
                        <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-white/45">
                          {action.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Existing Output Picker Modal */}
      {isOutputPickerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-apple-in">
          <div className="w-[min(90vw,48rem)] bg-[#0f172a] border border-white/10 rounded-[8px] shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="p-1.5 sm:p-1.5 border-b border-white/10 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Database className="text-theme-accent" size={18} />
              <h3 className="text-[13px] font-black text-white uppercase tracking-tight">Choose an Output</h3>
              </div>
              <button onClick={() => setIsOutputPickerOpen(false)} className="p-1.5 hover:bg-white/5 rounded-[8px] transition-colors"><X size={15} className="text-white/40 hover:text-white" /></button>
            </div>
            <div className="flex items-center gap-1.5 border-b border-white/10 px-1.5 py-[3px]">
              <Search size={13} className="text-white/30" />
              <input
                value={outputPickerSearch}
                onChange={(e) => setOutputPickerSearch(e.target.value)}
                placeholder="Search outputs by task, name, or description..."
                className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-white/25"
              />
              {outputPickerSearch && (
                <button onClick={() => setOutputPickerSearch('')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0f172a] z-10 shadow-lg shadow-black/20">
                  <tr className="border-b border-white/10">
                    <th className="px-1.5 py-1.5 text-[8px] font-black text-white/40 uppercase tracking-widest">From task</th>
                    <th className="px-1.5 py-1.5 text-[8px] font-black text-white/40 uppercase tracking-widest">Output</th>
                    <th className="px-1.5 py-1.5 text-[8px] font-black text-white/40 uppercase tracking-widest">What it is</th>
                    <th className="px-1.5 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tasks
                    .filter(t => t.id !== selectedTaskId)
                    .flatMap(t => (t.output_data_list || []).map(o => ({ ...o, taskName: t.name, taskId: t.id })))
                    .filter((output) => {
                      const query = outputPickerSearch.trim().toLowerCase();
                      if (!query) return true;
                      return [output.taskName, output.name, output.description].some((value) => String(value || '').toLowerCase().includes(query));
                    })
                    .map((output, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-1.5 py-1.5 text-[9px] font-bold text-theme-accent uppercase">{output.taskName}</td>
                      <td className="px-1.5 py-1.5 text-[9px] font-bold text-white uppercase">{output.name}</td>
                      <td className="px-1.5 py-1.5 text-[8px] text-white/40 line-clamp-1">{output.description || 'No description'}</td>
                      <td className="px-1.5 py-1.5 text-right">
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
                          className="px-1.5 py-1 bg-theme-accent text-white text-[8px] font-black uppercase rounded-[8px] opacity-0 group-hover:opacity-100 hover:scale-105 transition-all"
                        >
                          Use Output
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.every(t => (t.output_data_list || []).length === 0) && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-white/20 italic text-[10px]">No outputs yet. Add one to any task, then come back here.</td></tr>
                  )}
                  {tasks.some(t => (t.output_data_list || []).length > 0) && tasks
                    .filter(t => t.id !== selectedTaskId)
                    .flatMap(t => (t.output_data_list || []).map(o => ({ ...o, taskName: t.name, taskId: t.id })))
                    .filter((output) => {
                      const query = outputPickerSearch.trim().toLowerCase();
                      if (!query) return true;
                      return [output.taskName, output.name, output.description].some((value) => String(value || '').toLowerCase().includes(query));
                    }).length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-white/20 italic text-[10px]">No outputs match this search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
        <div className={cn("min-h-10 border-b border-white/10 bg-[#0a1120]/92 backdrop-blur-xl flex flex-wrap items-center justify-between gap-1.5 px-3 sm:px-1.5 py-1 relative z-[100]")}>
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={() => onBack(metadata)} className="p-1.5 hover:bg-white/5 rounded-[8px] transition-colors text-white/40 hover:text-white"><ChevronLeft size={18} /></button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest mb-1">Workflow Builder</span>
              <h1 className="text-[14px] font-black text-white uppercase truncate max-w-[55vw] sm:max-w-[300px]">{workflow?.name}</h1>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent/80">Define the workflow</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-1.5 flex-wrap justify-end">
          <div className="flex bg-white/5 border border-white/10 rounded-[8px] p-0.5 mr-2 h-[24px] items-center">
            <button onClick={undo} disabled={history.length === 0 || isReadOnlyMode} className="px-1.5 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all border-r border-white/5"><RefreshCw size={13} className="-scale-x-100" /></button>
            <button onClick={redo} disabled={redoStack.length === 0 || isReadOnlyMode} className="px-1.5 h-full text-white/40 hover:text-white disabled:opacity-20 transition-all"><RefreshCw size={13} /></button>
          </div>
              <div className="flex bg-white/5 border border-white/10 rounded-[8px] p-0.5 mr-2 h-[24px] items-center">
                {(['bezier', 'smoothstep', 'straight'] as const).map(s => (
                  <button 
                    key={s} 
                    disabled={isReadOnlyMode}
                    onClick={() => {
                      if (isReadOnlyMode) return;
                      setDefaultEdgeStyle(s);
                      setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, edgeStyle: s } })));
                    }} 
                    className={cn("px-1.5 h-full text-[8px] font-black uppercase rounded-[0.85rem] transition-all", isReadOnlyMode ? "opacity-35 cursor-not-allowed" : defaultEdgeStyle === s ? "bg-theme-accent text-white" : "text-white/20 hover:text-white/40")}
                  >
                    {s === 'smoothstep' ? 'Angled' : s === 'bezier' ? 'Smooth' : 'Straight'}
                  </button>
                ))}
              </div>
          {!reviewMode && (
            <button disabled={isReadOnlyMode} onClick={() => { if (isReadOnlyMode) return; handleLayout(nodes, edges); }} className={cn(BUILDER_BUTTON, "flex items-center gap-1.5 px-1.5 h-[24px] bg-white/5 border border-white/10 text-white uppercase hover:bg-white/10 transition-all", isReadOnlyMode && "opacity-35 cursor-not-allowed")}><RefreshCw size={12} className="text-theme-accent" /> Auto Layout</button>
          )}
          {!reviewMode && (
            <button data-testid="builder-commit" disabled={isReadOnlyMode} onClick={handleSave} className={cn(BUILDER_BUTTON, "flex items-center gap-1.5 px-1.5 h-[24px] bg-theme-accent text-white shadow-xl shadow-theme-accent/20 hover:scale-[1.02] leading-none", isReadOnlyMode && "opacity-35 cursor-not-allowed")}><Save size={12} /> Commit Changes</button>
          )}
          <button onClick={onExit} className="p-1.5 text-white/20 hover:text-status-error"><X size={16} /></button>
        </div>
        </div>

        <div className="flex-1 relative min-h-0 flex flex-col">
          <div className="shrink-0 border-b border-white/10 bg-[#0a1120]/95 backdrop-blur-xl px-1.5 py-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setInspectorTab('validation')} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", validationErrorCount > 0 ? "border-status-error/30 bg-status-error/10 text-status-error" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {validationErrorCount} Errors · {validationWarningCount} Warnings
              </button>
              <div className={cn("flex items-center gap-1.5 rounded-[8px] border px-1.5 py-[4px]", saveStatus === 'conflict' ? "border-status-error/30 bg-status-error/10 text-status-error" : saveStatus === 'saving' ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : saveStatus === 'saved' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/45")}>
                <div className="leading-none">
                  <p className="text-[7px] font-black uppercase tracking-[0.18em]">Save</p>
                  <p className="text-[8px] font-bold leading-none">{saveStatus === 'conflict' ? 'Conflict' : saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Idle'}</p>
                </div>
                <div className="h-5 w-px bg-white/10" />
                <p className="text-[8px] font-mono leading-none text-white/35">{draftSavedAtLabel}</p>
                <p className="text-[8px] font-mono leading-none text-white/35">{savedAtLabel}</p>
              </div>
              {draftRestored && (
                <div className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[4px]">
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-theme-accent">Recovered</p>
                  <p className="text-[8px] font-bold leading-none text-white/70">Local draft</p>
                </div>
              )}
              <button onClick={openHistoryPane} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", utilityPane === 'history' ? "border-theme-accent/30 bg-theme-accent/10 text-theme-accent" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                History
              </button>
              <button onClick={openReviewPane} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", utilityPane === 'review' ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                Review
              </button>
              <button onClick={() => setReviewMode((current) => !current)} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", reviewMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {reviewMode ? 'Review Mode On' : 'Review Mode'}
              </button>
              <button onClick={() => { setCommandPaletteOpen(true); setCommandPaletteIndex(0); }} className="px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border border-white/10 bg-white/5 text-white/50 hover:text-white leading-none">
                Cmd/Ctrl+K
              </button>
              <button onClick={() => updateLayoutPrefs({ inspectorCollapsed: !layoutPrefs.inspectorCollapsed })} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", layoutPrefs.inspectorCollapsed ? "border-theme-accent/30 bg-theme-accent/10 text-theme-accent" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {layoutPrefs.inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
              </button>
              <button onClick={() => updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap })} className={cn("px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border leading-none", layoutPrefs.showMiniMap ? "border-theme-accent/30 bg-theme-accent/10 text-theme-accent" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
                {layoutPrefs.showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
              </button>
              <div className="flex items-center gap-1 rounded-[8px] border border-white/10 bg-white/5 p-0.5">
                <button onClick={() => fitView({ padding: 0.12, duration: 250 })} className="rounded-[8px] px-1.5 py-[4px] text-[8px] font-black uppercase text-white/45 hover:text-white leading-none">Fit</button>
              </div>
              {selectedItemCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[4px]">
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/55">
                    {selectedNodeIds.length} Nodes · {selectedEdgeIds.length} Edges Selected
                  </span>
                  <button onClick={clearSelection} className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1 text-[8px] font-black uppercase text-white/45 hover:text-white transition-colors leading-none">
                    Clear
                  </button>
                </div>
              )}
              {draftRestored && (
                <button onClick={clearBuilderDraft} className="px-[9px] py-[5px] text-[8px] font-black uppercase rounded-[8px] transition-all whitespace-nowrap border border-theme-accent/20 bg-theme-accent/10 text-theme-accent hover:bg-theme-accent hover:text-white leading-none">
                  Clear Draft
                </button>
              )}
              {!reviewMode && (
                <div className="ml-auto flex flex-wrap gap-1.5">
                <button data-testid="builder-add-task" disabled={isReadOnlyMode} onClick={() => { if (isReadOnlyMode) return; onAddNode('TASK'); }} className={cn("flex items-center gap-1.5 px-1.5 py-[5px] bg-theme-accent text-white rounded-[8px] text-[8px] font-black uppercase hover:scale-[1.03] transition-all whitespace-nowrap leading-none", isReadOnlyMode && "opacity-35 cursor-not-allowed")}><Plus size={12} /> Add Task</button>
                <button disabled={isReadOnlyMode} onClick={() => { if (isReadOnlyMode) return; onAddNode('CONDITION'); }} className={cn("flex items-center gap-1.5 px-1.5 py-[5px] bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-[8px] text-[8px] font-black uppercase hover:scale-[1.03] transition-all whitespace-nowrap leading-none", isReadOnlyMode && "opacity-35 cursor-not-allowed")}><Plus size={12} /> Add Condition</button>
              </div>
              )}
            </div>
          </div>
          {utilityPane && (
            <div className="shrink-0 border-b border-white/10 bg-[#09111d]/96 backdrop-blur-xl px-3 sm:px-1.5 py-0.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="min-w-0">
                  <p className={cn("text-[9px] font-black uppercase tracking-[0.22em]", utilityPane === 'comments' ? "text-sky-100" : utilityPane === 'review' ? "text-emerald-100" : "text-slate-100")}>{utilityPane === 'comments' ? 'Notes' : utilityPane === 'review' ? 'Review' : 'Version History'}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55 leading-relaxed">
                    {utilityPane === 'comments'
                      ? 'Short, anchored notes for the workflow, a task, or a section.'
                      : utilityPane === 'review'
                        ? 'Read the draft, compare the states, and act with review permissions only.'
                        : 'Compare the working draft against a saved, approved, or selected version.'}
                  </p>
                </div>
                <button onClick={closeUtilityPane} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white transition-all leading-none">
                  Close
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => openCommentsForTask()} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", utilityPane === 'comments' ? "border-sky-500/20 bg-sky-500/10 text-sky-100" : "border-white/10 bg-black/20 text-white/45 hover:text-white")}>Notes</button>
              <button onClick={openHistoryPane} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", utilityPane === 'history' ? "border-slate-300/20 bg-slate-300/10 text-white" : "border-white/10 bg-black/20 text-white/45 hover:text-white")}>Compare</button>
                <button onClick={openReviewPane} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", utilityPane === 'review' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-black/20 text-white/45 hover:text-white")}>Review</button>
              </div>
              <div className="mt-3">
                {utilityPane === 'comments' ? renderCommentsSurface() : utilityPane === 'review' ? renderReviewSurface() : renderHistorySurface()}
              </div>
            </div>
          )}
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
            deleteKeyCode={null}
            fitView 
            snapToGrid 
            snapGrid={[10, 10]} 
            connectionMode={ConnectionMode.Loose} 
            connectionLineType={defaultEdgeStyle === 'straight' ? ConnectionLineType.Straight : defaultEdgeStyle === 'smoothstep' ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier} 
            className="react-flow-industrial"
            >
              <Background color="#1e293b" gap={30} size={1} />
              {layoutPrefs.showMiniMap && (
                <div className="absolute bottom-4 right-4 z-20">
                  <button
                    onClick={() => updateLayoutPrefs({ showMiniMap: false })}
                    className="absolute -top-1.5 -right-2 z-30 flex h-5 w-5 items-center justify-center rounded-[8px] border border-white/10 bg-[#09111d] text-white/50 shadow-lg hover:text-white"
                    aria-label="Close minimap"
                  >
                    <X size={11} />
                  </button>
                  <MiniMap
                    nodeColor={(node) => {
                      if (selectedTaskId && String(node.id) === String(selectedTaskId)) return '#38bdf8';
                      if (selectedNeighborNodeIds.has(String(node.id))) return '#34d399';
                      if (node.data?.interface === 'TRIGGER') return '#22d3ee';
                      if (node.data?.interface === 'OUTCOME') return '#fb7185';
                      if (node.type === 'diamond') return '#f59e0b';
                      return '#60a5fa';
                    }}
                    nodeStrokeColor={(node) => {
                      if (selectedTaskId && String(node.id) === String(selectedTaskId)) return '#93c5fd';
                      if (selectedNeighborNodeIds.has(String(node.id))) return '#6ee7b7';
                      return '#1f2937';
                    }}
                    maskColor="rgba(3, 7, 18, 0.75)"
                    className="!bg-[#0a1120] !border !border-white/10 !rounded-[8px] overflow-hidden"
                    pannable
                    zoomable
                  />
                </div>
              )}
            </ReactFlow>
          </div>
          {saveStatus === 'conflict' && saveConflict && (
            <div className="absolute top-[86px] left-4 right-4 z-30 rounded-[8px] border border-status-error/30 bg-status-error/10 px-1.5 py-1.5 text-[10px] font-bold text-status-error shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span>{saveConflict.message || 'Save conflict detected. Reload the latest workflow before saving again.'}</span>
                <button onClick={() => window.location.reload()} className="rounded-[8px] border border-status-error/20 bg-black/20 px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-status-error">
                  Reload Latest
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        <div className={cn(
          "relative border-t xl:border-t-0 xl:border-l border-white/10 bg-[#09111d] flex flex-col z-[70] w-full xl:flex-none h-full min-h-0 overflow-hidden",
          layoutPrefs.inspectorCollapsed ? "xl:w-[92px]" : "xl:[width:var(--inspector-width)]",
        )} style={{ '--inspector-width': `${inspectorWidth}px` } as React.CSSProperties}>
        <div onMouseDown={handleMouseDown} className="hidden xl:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent z-50" />
        <div className="h-12 flex border-b border-white/10 bg-white/[0.02] overflow-x-auto">
          {[ 
            { id: 'overview', label: 'Overview', icon: <Activity size={12} /> }, 
            { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' },
          ].filter(t => !t.hidden && (selectedTaskId || t.id === 'overview')).map(t => (
            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 min-w-[84px] flex flex-col items-center justify-center gap-0.5 border-b-2 px-1.5", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/20 hover:text-white transition-all')}>{t.icon}<span className="text-[8px] font-black uppercase whitespace-nowrap">{t.label}</span></button>
          ))}
          {selectedEdgeId && (<div className="flex-1 min-w-[84px] flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white px-1.5"><Link2 size={12} /><span className="text-[8px] font-black uppercase whitespace-nowrap">Edge</span></div>)}
        </div>
        {layoutPrefs.inspectorCollapsed ? (
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-1.5">
            <div className="flex flex-col items-stretch gap-1.5 w-full">
              <button onClick={() => updateLayoutPrefs({ inspectorCollapsed: false })} className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white">
                Open Inspector
              </button>
              <button onClick={() => updateLayoutPrefs({ showMiniMap: !layoutPrefs.showMiniMap })} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white">
                {layoutPrefs.showMiniMap ? 'Hide' : 'Show'} MiniMap
              </button>
            </div>
          </div>
        ) : (
          <div ref={taskPaneScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 sm:p-4">
          {selectedTaskId && selectedTask ? (
            <div className={cn(taskPaneCompact ? "space-y-1.5" : "space-y-1.5", "animate-apple-in")}>
              <div className={cn(BUILDER_PANEL, "p-1.5 space-y-1.5")}>
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-theme-accent">Selected Task</p>
                    <h3 className="truncate text-[14px] font-black uppercase text-white">{selectedTask.name || 'Untitled Task'}</h3>
                    <div className="flex flex-wrap items-center gap-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                      <span className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px]">{selectedTask.task_type || 'GENERAL'}</span>
                      {selectedTask.interface && (
                        <span className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[3px] text-theme-accent">{selectedTask.interface}</span>
                      )}
                      {isProtected && (
                        <span className="rounded-[8px] border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-[3px] text-cyan-300">Locked</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => setTaskCompletenessOpen((current) => !current)}
                      title="Show done and missing fields"
                      className="min-w-[118px] rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-left transition-colors hover:border-theme-accent/30 hover:bg-black/30"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                          <Gauge size={10} /> Completeness
                        </span>
                        <span className="text-[9px] font-black text-white/70">{selectedTaskCompleteness.score}%</span>
                        <ChevronDown size={10} className={cn("text-white/25 transition-transform", taskCompletenessOpen && "rotate-180")} />
                      </div>
                      <div className="mt-1 h-1 rounded-[8px] bg-white/10 overflow-hidden">
                        <div className="h-full rounded-[8px] bg-theme-accent" style={{ width: `${selectedTaskCompleteness.score}%` }} />
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setUtilityPane('comments')} className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent">
                        Comments {commentCountsByTaskId.get(String(selectedTask.id))?.total ? `(${commentCountsByTaskId.get(String(selectedTask.id))?.open || 0}/${commentCountsByTaskId.get(String(selectedTask.id))?.resolved || 0})` : ''}
                      </button>
                      <button onClick={openHistoryPane} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                        History
                      </button>
                    </div>
                  </div>
                </div>
                {taskCompletenessOpen && (
                  <div className="rounded-[8px] border border-white/10 bg-black/20 p-1.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent">
                        {(selectedTaskCompleteness.done || []).length} done / {selectedTaskCompleteness.total} checks
                      </p>
                      <button
                        onClick={() => {
                          const nextMissing = selectedTaskCompleteness.missing[0];
                          if (nextMissing) focusCompletenessSection(nextMissing);
                        }}
                        className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white"
                      >
                        Jump to missing
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 p-1.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">Done</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(selectedTaskCompleteness.done || []).slice(0, 6).map((label) => (
                            <span key={label} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em] text-emerald-100">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 p-1.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-300">Missing</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedTaskCompleteness.missing.slice(0, 6).map((label) => (
                            <button
                              key={label}
                              onClick={() => focusCompletenessSection(label)}
                              className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-500/20"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => selectedTaskNode && setCenter((selectedTaskNode.position?.x || 0) + 160, (selectedTaskNode.position?.y || 0) + 120, { zoom: 1.05, duration: 250 })} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    Center
                  </button>
                  <button onClick={() => {
                    const nextId = selectedTaskOutgoingTasks[0]?.id || selectedTaskIncomingTasks[0]?.id;
                    if (nextId) {
                      setSelectedTaskId(nextId);
                      setSelectedNodeIds([nextId]);
                      setSelectedEdgeId(null);
                    }
                  }} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    Jump Connected
                  </button>
                  <button onClick={() => {
                    const duplicate = tasks.find((task) => task.id === selectedTask.id);
                    if (!duplicate || isProtected || isReadOnlyMode) return;
                    saveToHistory();
                    const newId = `node-${Date.now()}`;
                    const node = nodes.find((entry) => entry.id === selectedTask.id);
                    const duplicatedTask = sanitizeTaskClone(duplicate, newId, `${duplicate.name} Copy`);
                    const duplicatedNode = {
                      ...(JSON.parse(JSON.stringify(node || {}))),
                      id: newId,
                      position: { ...(node?.position || { x: 0, y: 0 }), x: (node?.position?.x || 0) + 40, y: (node?.position?.y || 0) + 40 },
                      data: { ...(node?.data || {}), id: newId, label: `${duplicate.name} Copy`, commentSummary: { total: 0, open: 0, resolved: 0 }, diagnostics: duplicatedTask.diagnostics },
                    };
                    setTasks((prev) => [...prev, duplicatedTask]);
                    setNodes((prev) => [...prev, duplicatedNode]);
                    setSelectedTaskId(newId);
                    setSelectedNodeIds([newId]);
                    setSelectedEdgeId(null);
                    setSelectedEdgeIds([]);
                    setIsDirty?.(true);
                  }} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    Duplicate
                  </button>
                  <button onClick={() => {
                    if (isReadOnlyMode) return;
                    if (isProtected) return;
                    updateTask(selectedTask.id, { task_type: 'LOOP' });
                    setNodes((prev) => prev.map((node) => node.id === selectedTask.id ? { ...node, type: 'diamond', data: { ...node.data, task_type: 'LOOP' } } : node));
                  }} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    <span className="inline-flex items-center gap-1"><ArrowRightLeft size={10} /> Convert Condition</span>
                  </button>
                  <button onClick={() => {
                    navigator.clipboard?.writeText(String(selectedTask.id)).catch(() => undefined);
                    toast.success('Task ID copied');
                  }} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    <span className="inline-flex items-center gap-1"><Copy size={10} /> Copy ID</span>
                  </button>
                </div>
                {reviewMode && (
                  <div className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    Review mode is read only. Use the command palette or toggle the button to return to editing.
                  </div>
                )}
                <div className="flex items-center gap-1.5 rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1">
                  <Search size={11} className="text-white/35" />
                  <input
                    value={inspectorSearch}
                    onChange={(e) => setInspectorSearch(e.target.value)}
                    placeholder="Search inspector sections..."
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-bold text-white/70 outline-none placeholder:text-white/25"
                  />
                  {inspectorSearch && (
                    <button
                      onClick={() => setInspectorSearch('')}
                      className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {selectedNodeIds.length > 1 && !selectedNodesAreProtected && (
                <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-1.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Bulk Edit</p>
                      <p className="mt-1 text-[12px] font-bold text-white/55">{selectedNodeIds.length} nodes selected. Apply shared changes or align them as a group.</p>
                    </div>
                    <button onClick={() => { setSelectedNodeIds([]); setSelectedTaskId(null); }} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/45">Clear</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
                    <input className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk owner team" value={selectedTask.owning_team || ''} onChange={e => updateSelectedTasks({ owning_team: e.target.value })} />
                    <select className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] font-black text-white outline-none focus:border-theme-accent" value={selectedTask.task_type} onChange={e => updateSelectedTasks({ task_type: e.target.value })}>
                      {taskTypes.map((type: any) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <button onClick={() => updateSelectedTasks({ validation_needed: !selectedTask.validation_needed })} className={cn("rounded-[8px] border px-1.5 py-1.5 text-[10px] font-black uppercase transition-all", selectedTask.validation_needed ? "border-orange-500/30 bg-orange-500/10 text-orange-400" : "border-white/10 bg-white/5 text-white/45 hover:text-white")}>
                      Toggle Validation
                    </button>
                    <input className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk backup owner" value={selectedTaskDiagnostics.taskManagement?.backup_owner || ''} onChange={e => updateSelectedTasksDiagnostics({ taskManagement: { backup_owner: e.target.value } })} />
                    <input className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk reviewer" value={selectedTaskDiagnostics.taskManagement?.reviewer || ''} onChange={e => updateSelectedTasksDiagnostics({ taskManagement: { reviewer: e.target.value } })} />
                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk manual minutes" value={selectedTask.manual_time_minutes || 0} onChange={e => updateSelectedTasks({ manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" placeholder="Bulk automation minutes" value={selectedTask.automation_time_minutes || 0} onChange={e => updateSelectedTasks({ automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => alignSelectedNodes('left')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/50 hover:text-white">Align Left</button>
                    <button onClick={() => alignSelectedNodes('top')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/50 hover:text-white">Align Top</button>
                    <button onClick={() => alignSelectedNodes('center')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/50 hover:text-white">Center X</button>
                    <button onClick={() => alignSelectedNodes('horizontal')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/50 hover:text-white">Line Up</button>
                    <button onClick={() => alignSelectedNodes('vertical')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-black uppercase text-white/50 hover:text-white">Stack</button>
                  </div>
                </div>
              )}
              {inspectorTab === 'overview' && (
                <div ref={(el) => { taskSectionRefs.current.overview = el; }} className={cn(taskPaneCompact ? "space-y-1.5" : "space-y-6", isReadOnlyMode && "pointer-events-none select-none opacity-80")} data-section="overview">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">
                      {selectedTask.interface ? (selectedTask.interface === 'TRIGGER' ? 'Start task' : 'End task') : (selectedTask.task_type === 'LOOP' ? 'Decision name' : 'Task name')}
                    </label>
                    <input 
                      data-builder-field="task.name"
                      className={cn("w-full bg-white/5 border rounded-[8px] px-1.5 py-1 text-[12px] font-bold text-white outline-none focus:border-theme-accent disabled:opacity-50 disabled:cursor-not-allowed", issuesForField('task.name', selectedTaskId).length > 0 ? "border-status-error/40 bg-status-error/10" : "border-white/10")} 
                      value={selectedTask.name} 
                      onChange={e => updateTask(selectedTaskId, { name: e.target.value })} 
                      disabled={isProtected}
                    />
                    {issuesForField('task.name', selectedTaskId).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {issuesForField('task.name', selectedTaskId).map((issue) => (
                          <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>
                            {issue.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">What it does</label>
                    <div className={getDefinitionIssueShell(issuesForField('task.description', selectedTaskId).length > 0)} data-builder-field="task.description">
                      <textarea 
                        className="w-full bg-transparent border-0 rounded-[inherit] px-1.5 py-1 text-[11px] font-medium text-white/60 outline-none focus:border-theme-accent h-24 resize-none disabled:opacity-50" 
                        value={selectedTask.description} 
                        onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                        disabled={isProtected}
                      />
                    </div>
                    {issuesForField('task.description', selectedTaskId).length > 0 && (
                      <div className="space-y-1.5">
                        {issuesForField('task.description', selectedTaskId).map((issue) => (
                          <div key={issueId(issue)} className="rounded-[8px] border border-status-error/30 bg-status-error/10 px-1.5 py-1.5 text-[10px] font-bold text-status-error">
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                      <div
                    ref={(el) => { taskSectionRefs.current.dependencies = el; }}
                    className={cn("rounded-[8px] border p-1.5 space-y-1.5", selectedTaskDiff.changedFields.length > 0 ? "border-cyan-500/15 bg-cyan-500/5" : "border-cyan-500/10 bg-cyan-500/5")}
                    data-section="dependencies"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-100">Dependencies</p>
                        <p className="mt-1 text-[11px] font-bold text-white/45">Where this task comes from, where it goes, and what slows it down.</p>
                      </div>
                      <MapPinned size={14} className="text-cyan-100" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <div className="rounded-[8px] border border-cyan-500/15 bg-cyan-500/5 p-1 space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Before this task</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTaskIncomingTasks.length > 0 ? selectedTaskIncomingTasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => { setSelectedTaskId(task.id); setSelectedNodeIds([task.id]); }}
                              className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[2px] text-[8px] font-black uppercase text-white/60 hover:text-white leading-none"
                            >
                              {task.name || 'Untitled'}
                            </button>
                          )) : <span className="text-[10px] font-bold text-white/25">No tasks before this one.</span>}
                        </div>
                      </div>
                      <div className="rounded-[8px] border border-cyan-500/15 bg-cyan-500/5 p-1 space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">After this task</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTaskOutgoingTasks.length > 0 ? selectedTaskOutgoingTasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => { setSelectedTaskId(task.id); setSelectedNodeIds([task.id]); }}
                              className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[2px] text-[8px] font-black uppercase text-white/60 hover:text-white leading-none"
                            >
                              {task.name || 'Untitled'}
                            </button>
                          )) : <span className="text-[10px] font-bold text-white/25">No tasks after this one.</span>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[2px]">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Inputs</p>
                        <p className="mt-0.5 text-[12px] font-black text-white">{selectedTask.source_data_list.length}</p>
                      </div>
                      <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[2px]">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Outputs</p>
                        <p className="mt-0.5 text-[12px] font-black text-white">{selectedTask.output_data_list.length}</p>
                      </div>
                      <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[2px]">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Handoffs</p>
                        <p className="mt-0.5 text-[12px] font-black text-white">{selectedTaskIncomingEdges.length + selectedTaskOutgoingEdges.length}</p>
                      </div>
                      <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[2px]">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Changes</p>
                        <p className="mt-0.5 text-[12px] font-black text-white">{selectedTaskDiff.changedFields.length}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {selectedTask.blockers.length} slowdowns
                      </span>
                      <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {selectedTask.reference_links.length} references
                      </span>
                      <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {selectedTask.involved_systems.length} systems
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-slate-500/15 bg-slate-500/5 p-1.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-100">What changed</p>
                        <p className="mt-1 text-[11px] font-bold text-white/45">Compare this task against the saved version.</p>
                      </div>
                      <Clock3 size={14} className="text-slate-100" />
                    </div>
                    {selectedTaskDiff.changedFields.length === 0 ? (
                      <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] font-bold text-white/35">
                        No task-level changes yet.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedTaskDiff.changedFields.slice(0, 4).map((field) => (
                          <span key={field.key} className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[2px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55">
                            {field.key.replace(/_/g, ' ')}: {formatDiffValue(field.before)} → {formatDiffValue(field.after)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {selectedTaskDiff.addedConnections} added links
                      </span>
                      <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                        {selectedTaskDiff.removedConnections} removed links
                      </span>
                    </div>
                  </div>

                  {!isProtected && selectedTask.task_type !== 'LOOP' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Task kind</label>
                        <div className={getDefinitionIssueShell(issuesForField('task.task_type', selectedTaskId).length > 0)}>
                          <select data-builder-field="task.task_type" className="w-full bg-transparent border-0 rounded-[inherit] px-3 h-10 text-[11px] font-black text-white outline-none" value={selectedTask.task_type} onChange={e => updateTask(selectedTaskId, { task_type: e.target.value })}>{taskTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        {issuesForField('task.task_type', selectedTaskId).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {issuesForField('task.task_type', selectedTaskId).map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>
                                {issue.message}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 p-1 bg-blue-500/5 border border-blue-500/15 rounded-[8px]">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-blue-300 uppercase tracking-widest px-1 text-center block leading-none">Manual time (m)</label>
                          <div className={getDefinitionIssueShell(issuesForField('task.manual_time_minutes', selectedTaskId).length > 0)} data-builder-field="task.manual_time_minutes">
                            <input type="number" className="w-full bg-black/40 border-0 rounded-[inherit] px-1.5 py-[2px] text-[12px] font-black text-white outline-none focus:border-blue-400 text-center" value={selectedTask.manual_time_minutes} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                          </div>
                          {issuesForField('task.manual_time_minutes', selectedTaskId).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {issuesForField('task.manual_time_minutes', selectedTaskId).map((issue) => (
                                <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-purple-300 uppercase tracking-widest px-1 text-center block leading-none">Machine time (m)</label>
                          <div className={getDefinitionIssueShell(issuesForField('task.automation_time_minutes', selectedTaskId).length > 0)} data-builder-field="task.automation_time_minutes">
                            <input type="number" className="w-full bg-black/40 border-0 rounded-[inherit] px-1.5 py-[2px] text-[12px] font-black text-white outline-none focus:border-purple-400 text-center" value={selectedTask.automation_time_minutes} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                          </div>
                          {issuesForField('task.automation_time_minutes', selectedTaskId).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {issuesForField('task.automation_time_minutes', selectedTaskId).map((issue) => (
                                <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 items-end">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-white/40 uppercase tracking-widest px-1 leading-none">Owner Team</label>
                          <input data-builder-field="task.owning_team" className={BUILDER_FIELD.replace('py-1.5', 'py-1').replace('text-[10px]', 'text-[9px]')} value={selectedTask.owning_team} onChange={e => updateTask(selectedTaskId, { owning_team: e.target.value })} placeholder="Team Name" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-white/40 uppercase tracking-widest px-1 leading-none">Owner Positions</label>
                          <div className="rounded-[8px] border border-violet-500/15 bg-violet-500/5 p-1">
                            <button
                              onClick={() => setOwnerPositionsCollapsed(!ownerPositionsCollapsed)}
                              className="w-full rounded-[8px] border border-violet-500/15 bg-black/20 px-1.5 h-8 flex items-center justify-between hover:bg-violet-500/10 transition-colors"
                            >
                              <span className="text-[10px] font-bold text-white truncate">
                                {selectedTask.owner_positions?.length || 0} Positions
                              </span>
                              {ownerPositionsCollapsed ? <ChevronDown size={12} className="text-white/20" /> : <ChevronUp size={12} className="text-white/20" />}
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
                            onMoveItem={(index, direction) => {
                              const nextIndex = index + direction;
                              updateTask(selectedTaskId, { owner_positions: moveArrayItem(selectedTask.owner_positions || [], index, nextIndex) });
                            }}
                            placeholder="Add a role title, responsibility, or backup assignment..."
                            icon={<Users size={12} className="text-theme-accent" />}
                            isOpen={!ownerPositionsCollapsed}
                            toggle={() => setOwnerPositionsCollapsed((prev) => !prev)}
                          />
                        </div>
                      )}

                      <div
                        ref={(el) => { taskSectionRefs.current.ownership = el; }}
                        className="rounded-[8px] border border-violet-500/15 bg-violet-500/5 p-1 space-y-1"
                        data-section="ownership"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-100">Ownership & risk</p>
                          </div>
                          <ShieldAlert size={14} className="text-violet-100" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          <input data-builder-field="task.backup_owner" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskManagement?.backup_owner || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskManagement: { backup_owner: e.target.value } })} placeholder="Backup owner" />
                          <input data-builder-field="task.escalation_contact" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskManagement?.escalation_contact || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskManagement: { escalation_contact: e.target.value } })} placeholder="Escalation contact" />
                          <input data-builder-field="task.sme" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskManagement?.sme || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskManagement: { sme: e.target.value } })} placeholder="Subject matter expert" />
                          <input data-builder-field="task.reviewer" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskManagement?.reviewer || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskManagement: { reviewer: e.target.value } })} placeholder="Reviewer" />
                          <input data-builder-field="task.due_date" type="date" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskManagement?.due_date || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskManagement: { due_date: e.target.value } })} />
                          <input data-builder-field="task.automation_readiness" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.automation_readiness || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { automation_readiness: e.target.value } })} placeholder="Automation readiness" />
                          <input data-builder-field="task.risk_level" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.risk_level || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { risk_level: e.target.value } })} placeholder="Risk level" />
                          <input data-builder-field="task.sensitivity" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.sensitivity || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { sensitivity: e.target.value } })} placeholder="Sensitivity" />
                          <input data-builder-field="task.exception_burden" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.exception_burden || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { exception_burden: e.target.value } })} placeholder="Exception burden" />
                          <input data-builder-field="task.cadence" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.cadence || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { cadence: e.target.value } })} placeholder="Cadence" />
                          <input data-builder-field="task.sla" className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.sla || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { sla: e.target.value } })} placeholder="SLA / timing target" />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                            Manual {selectedTask.manual_time_minutes}m
                          </span>
                          <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                            Automation {selectedTask.automation_time_minutes}m
                          </span>
                          <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                            Gap {Math.max(selectedTask.manual_time_minutes - selectedTask.automation_time_minutes, 0)}m
                          </span>
                          <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                            Wait {selectedTask.machine_wait_time_minutes}m
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1 px-1" ref={(el) => { taskSectionRefs.current.systems = el; }} data-section="systems">
                        <div>
                          <label className="text-[9px] font-black text-cyan-100 uppercase tracking-widest">Systems & integrations</label>
                        </div>
                          <button
                            onClick={() => updateTaskDiagnostics(selectedTaskId, { taskProfile: { shadow_it_used: !selectedTaskDiagnostics.taskProfile?.shadow_it_used } })}
                            className={cn("rounded-[8px] border px-1.5 py-[2px] text-[8px] font-black uppercase tracking-[0.18em] leading-none", selectedTaskDiagnostics.taskProfile?.shadow_it_used ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-cyan-500/15 bg-cyan-500/10 text-cyan-100 hover:text-white")}
                        >
                          Shadow IT {selectedTaskDiagnostics.taskProfile?.shadow_it_used ? 'On' : 'Off'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 px-1">
                        <span className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                          {selectedTask.involved_systems.filter((sys) => Boolean(sys.link)).length} linked
                        </span>
                        <span className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-white/45">
                          {selectedTask.involved_systems.filter((sys) => Boolean(sys.usage)).length} described
                        </span>
                      </div>
                      {selectedTaskDiagnostics.taskProfile?.shadow_it_used && (
                          <input className={cn(BUILDER_FIELD, "h-8")} value={selectedTaskDiagnostics.taskProfile?.shadow_it_link || ''} onChange={e => updateTaskDiagnostics(selectedTaskId, { taskProfile: { shadow_it_link: e.target.value } })} placeholder="Shadow IT / workaround link" />
                      )}
                        <div className="space-y-1">
                          {(selectedTask.involved_systems || []).map((sys, idx) => (
                            <NestedCollapsible
                              key={sys.id}
                              title={sys.name || "New System Entry"}
                              isOpen={openItems[sys.id]}
                              toggle={() => toggleItem(sys.id)}
                              onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { involved_systems: moveArrayItem(selectedTask.involved_systems || [], idx, idx - 1) }) : undefined}
                              onMoveDown={idx < (selectedTask.involved_systems || []).length - 1 ? () => updateTask(selectedTaskId, { involved_systems: moveArrayItem(selectedTask.involved_systems || [], idx, idx + 1) }) : undefined}
                              onDelete={() => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.filter(x => x.id !== sys.id) })}
                            >
                              <div className="space-y-1">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-white/20 uppercase tracking-widest">System Name</label>
                                  <input data-builder-field="task.involved_systems" className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1 text-[10px] text-white outline-none focus:border-theme-accent" value={sys.name} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., SAP, Salesforce, Internal Tool" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-white/20 uppercase tracking-widest">Usage Context</label>
                                  <textarea className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1 text-[10px] text-white/60 h-[3.75rem] resize-none outline-none focus:border-theme-accent" value={sys.usage} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, usage: e.target.value } : x) })} placeholder="Describe how the system is used in this task..." />
                                </div>
                                <ImagePasteField figures={sys.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, figures: figs } : x) })} label="System Screenshots (Ctrl+V)" />
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-white/20 uppercase tracking-widest">Documentation Link</label>
                                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-[2px]">
                                    <Link2 size={12} className="text-theme-accent" />
                                    <input className="flex-1 bg-transparent border-none p-0 text-[10px] text-theme-accent underline outline-none" value={sys.link} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, link: e.target.value } : x) })} placeholder="URL to SOP or Wiki" />
                                  </div>
                                </div>
                              </div>
                            </NestedCollapsible>
                          ))}
                          {(selectedTask.involved_systems || []).length === 0 && (
                        <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1.5 text-[10px] font-bold text-white/35">
                              No systems linked yet. Add only the systems this task truly touches.
                            </div>
                          )}
                          <button onClick={() => updateTask(selectedTaskId, { involved_systems: [...(selectedTask.involved_systems || []), { id: Date.now().toString(), name: '', usage: '', figures: [], link: '' }] })} className="w-full py-1.5 bg-white/5 border border-dashed border-white/10 rounded-[8px] text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all">+ Add System Dependency</button>
                        </div>
                      </div>

                      <div
                        ref={(el) => { taskSectionRefs.current.comments = el; }}
                        className="rounded-[8px] border border-white/5 bg-white/[0.02] p-1.5 space-y-1.5"
                        data-section="comments"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Notes</p>
                            <p className="mt-1 text-[11px] font-bold text-white/45">Simple notes only. Open and resolved states are tracked on the task node.</p>
                          </div>
                          <MessageSquare size={14} className="text-theme-accent" />
                        </div>
                        <textarea
                          className="w-full rounded-[8px] border border-white/10 bg-black/30 px-1.5 py-1.5 text-[11px] font-bold text-white/80 outline-none focus:border-theme-accent min-h-[5.5rem] resize-none"
                          value={commentDraft.scope === 'task' && String(commentDraft.scope_id || '') === String(selectedTask.id) ? commentDraft.message : ''}
                          disabled={reviewMode}
                          onChange={(e) => setCommentDraft({ ...createWorkflowComment('task', String(selectedTask.id)), message: e.target.value })}
                          placeholder="Write a note for this task..."
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => {
                              setUtilityPaneTaskId(String(selectedTask.id));
                              addWorkflowComment();
                            }}
                            disabled={reviewMode}
                            className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent"
                          >
                            Add Note
                          </button>
                          <button
                            onClick={() => {
                              setUtilityPane('comments');
                              setUtilityPaneTaskId(String(selectedTask.id));
                              setCommentDraft(createWorkflowComment('task', String(selectedTask.id)));
                            }}
                            disabled={reviewMode}
                            className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55"
                          >
                            Open Notes
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-auto pr-1 custom-scrollbar">
                          {selectedTaskComments.slice(0, 3).map((comment) => (
                            <div key={comment.id} className="rounded-[8px] border border-white/10 bg-black/20 p-1.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white">{comment.author}</p>
                                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">{comment.status === 'resolved' ? 'Resolved' : 'Open'}</p>
                                </div>
                                <button onClick={() => toggleWorkflowCommentStatus(comment.id)} disabled={reviewMode} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/50">
                                  {comment.status === 'resolved' ? 'Reopen' : 'Resolve'}
                                </button>
                              </div>
                              <p className="text-[11px] font-bold text-white/70 leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                            </div>
                          ))}
                          {selectedTaskComments.length === 0 && (
                            <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] font-bold text-white/35">
                            No notes for this task yet. Keep notes attached to the actual task so review stays contextual.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {!isProtected && (
                    <div className="pt-4 border-t border-white/5 space-y-1.5">
                      {confirmingDelete === selectedTaskId ? (
                        <ConfirmDeleteOverlay 
                          label={`Remove ${selectedTask.task_type === 'LOOP' ? 'Condition' : 'Task'}?`}
                          onConfirm={() => deleteTask(selectedTaskId)}
                          onCancel={() => setConfirmingDelete(null)}
                        />
                      ) : (
                        <button 
                          onClick={() => setConfirmingDelete(selectedTaskId)} 
                          className="w-full py-1.5 bg-status-error/10 border border-status-error/20 text-status-error rounded-[8px] text-[10px] font-black uppercase hover:bg-status-error hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <Trash size={12} /> Permanent Deletion
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {inspectorTab === 'data' && (
                <div className={cn("space-y-1.5 animate-apple-in", isReadOnlyMode && "pointer-events-none select-none opacity-80")}>
                  <CollapsibleSection title="Task Inputs" isOpen={expandedSections.inputs} toggle={() => toggleSection('inputs')} count={selectedTask.source_data_list.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.source_data_list.map((sd, idx) => (
                        <NestedCollapsible
                          key={sd.id}
                          title={sd.name || "New Input"}
                          isOpen={openItems[sd.id]}
                          toggle={() => toggleItem(sd.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { source_data_list: moveArrayItem(selectedTask.source_data_list || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.source_data_list || []).length - 1 ? () => updateTask(selectedTaskId, { source_data_list: moveArrayItem(selectedTask.source_data_list || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })}
                          isLocked={!!sd.from_task_id}
                        >
                          <div className="space-y-1.5">
                            {sd.from_task_name && (
                              <div className="px-1.5 py-[3px] bg-theme-accent/20 border border-theme-accent/30 rounded text-[9px] font-black text-theme-accent uppercase flex items-center gap-1.5">
                                <Link2 size={10} /> Referenced from: {sd.from_task_name}
                              </div>
                            )}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Input Name *</label>
                              <input data-builder-field="task.source_data_list" className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white outline-none focus:border-theme-accent disabled:opacity-50" value={sd.name} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., FDC Log, SPC Chart" disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 h-[4.5rem] resize-none outline-none focus:border-theme-accent disabled:opacity-50" value={sd.description} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the input..." disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 outline-none focus:border-theme-accent disabled:opacity-50" value={sd.data_example} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" disabled={!!sd.from_task_id} />
                            </div>
                            <ImagePasteField figures={sd.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, figures: figs } : x) })} label="Proof images (Ctrl+V)" isLocked={!!sd.from_task_id} />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-theme-accent outline-none disabled:opacity-50" value={sd.link} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" disabled={!!sd.from_task_id} />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.source_data_list.length === 0 && (
                        <div className="rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1.5 text-[11px] font-bold text-white/35">
                          No inputs yet. Add manual inputs or pull from the registry when the task depends on another task&apos;s output.
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="py-1.5 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-[8px] flex items-center justify-center gap-1.5"><Plus size={12} /> Add Manual Input</button>
                        <button onClick={() => setIsOutputPickerOpen(true)} className="py-1.5 bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-[8px] flex items-center justify-center gap-1.5"><Search size={12} /> Registry Search</button>
                      </div>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Task Outputs" isOpen={expandedSections.outputs} toggle={() => toggleSection('outputs')} count={selectedTask.output_data_list.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.output_data_list.map((od, idx) => (
                        <NestedCollapsible
                          key={od.id}
                          title={od.name || "New Output"}
                          isOpen={openItems[od.id]}
                          toggle={() => toggleItem(od.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { output_data_list: moveArrayItem(selectedTask.output_data_list || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.output_data_list || []).length - 1 ? () => updateTask(selectedTaskId, { output_data_list: moveArrayItem(selectedTask.output_data_list || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })}
                        >
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Output Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white outline-none focus:border-theme-accent" value={od.name} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., Final Report, Updated DB Entry" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 h-[4.5rem] resize-none outline-none focus:border-theme-accent" value={od.description} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the output artifact..." />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 outline-none focus:border-theme-accent" value={od.data_example} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" />
                            </div>
                            <ImagePasteField figures={od.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, figures: figs } : x) })} label="Proof images (Ctrl+V)" />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-theme-accent outline-none" value={od.link} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.output_data_list.length === 0 && (
                        <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/5 px-1.5 py-1.5 text-[11px] font-bold text-emerald-100">
                          No outputs yet. Define the artifact this task leaves behind.
                        </div>
                      )}
                      <button onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-black uppercase text-emerald-100 hover:bg-emerald-500/20 transition-all rounded-[8px] flex items-center justify-center gap-1.5"><Plus size={12} /> Add Output Artifact</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
              {inspectorTab === 'exceptions' && (
                <div className={cn("space-y-1.5", isReadOnlyMode && "pointer-events-none select-none opacity-80")}>
                  <CollapsibleSection title="Slowdowns" isOpen={expandedSections.blockers} toggle={() => toggleSection('blockers')} count={selectedTask.blockers.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.blockers.map((b, idx) => (
                        <NestedCollapsible
                          key={b.id}
                          title={b.blocking_entity || "New Slowdown"}
                          isOpen={openItems[b.id]}
                          toggle={() => toggleItem(b.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { blockers: moveArrayItem(selectedTask.blockers || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.blockers || []).length - 1 ? () => updateTask(selectedTaskId, { blockers: moveArrayItem(selectedTask.blockers || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })}
                        >
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">What slows it down *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white outline-none focus:border-amber-500" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} placeholder="What gets in the way?" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Delay (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[12px] text-white" value={b.average_delay_minutes || 0} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">How often ({b.frequency || 1} / 10)</label>
                              </div>
                              <input type="range" min="1" max="10" step="1" className="w-full accent-amber-500" value={b.frequency || 1} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, frequency: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">How to reduce it</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 h-[4.5rem] resize-none outline-none focus:border-amber-500" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} placeholder="What would reduce the delay?" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.blockers.length === 0 && (
                        <div className="rounded-[8px] border border-amber-500/15 bg-amber-500/5 px-1.5 py-1.5 text-[11px] font-bold text-amber-100">
                          No slowdowns logged yet. Capture only the delays that materially affect the task.
                        </div>
                      )}
                      <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', average_delay_minutes: 0, frequency: 1 }] })} className="w-full py-1.5 bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase text-amber-500 hover:bg-amber-500/20 transition-all rounded-[8px] flex items-center justify-center gap-1.5"><Plus size={12} /> Add Slowdown</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Mistakes" isOpen={expandedSections.errors} toggle={() => toggleSection('errors')} count={selectedTask.errors.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.errors.map((er, idx) => (
                        <NestedCollapsible
                          key={er.id}
                          title={er.error_type || "New Mistake"}
                          isOpen={openItems[er.id]}
                          toggle={() => toggleItem(er.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { errors: moveArrayItem(selectedTask.errors || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.errors || []).length - 1 ? () => updateTask(selectedTaskId, { errors: moveArrayItem(selectedTask.errors || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== er.id) })}
                        >
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">What happened *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white outline-none focus:border-status-error" value={er.error_type} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, error_type: e.target.value } : x) })} placeholder="Describe the common mistake" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Recovery time (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[12px] text-white" value={er.recovery_time_minutes || 0} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">How often ({er.frequency || 1} / 10)</label>
                              </div>
                              <input type="range" min="1" max="10" step="1" className="w-full accent-status-error" value={er.frequency || 1} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, frequency: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">How to fix it</label>
                              <textarea 
                                className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/60 h-[5.5rem] resize-none outline-none focus:border-status-error" 
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
                                placeholder="Steps to correct this mistake (auto-numbered if multiple lines)..." 
                              />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.errors.length === 0 && (
                        <div className="rounded-[8px] border border-rose-500/15 bg-rose-500/5 px-1.5 py-1.5 text-[11px] font-bold text-rose-100">
                          No mistakes captured yet. Add only repeatable issues that need explicit recovery steps.
                        </div>
                      )}
                      <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', recovery_time_minutes: 0, frequency: 1 }] })} className="w-full py-1.5 bg-status-error/10 border border-status-error/20 text-[10px] font-black uppercase text-status-error hover:bg-status-error/20 transition-all rounded-[8px] flex items-center justify-center gap-1.5"><Plus size={12} /> Add Mistake</button>
                    </div>
                  </CollapsibleSection>

                  <ManagedListSection 
                    title="Tips and Tricks" 
                    items={selectedTask.tribal_knowledge || []} 
                    onUpdate={(items) => updateTask(selectedTaskId, { tribal_knowledge: items })}
                    isOpen={expandedSections.tribal}
                    toggle={() => toggleSection('tribal')}
                    placeholder="Capture unwritten tips or shortcuts..."
                  />
                </div>
              )}

              {inspectorTab === 'validation' && (
                <div ref={(el) => { taskSectionRefs.current.validation = el; }} className={cn("space-y-1.5 animate-apple-in", isReadOnlyMode && "pointer-events-none select-none opacity-80")} data-section="validation">
                  <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded-[8px] space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="space-y-1">
                        <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Verification</h3>
                        <p className="text-[10px] text-white/40 font-bold uppercase">Validation stays on the fields it affects.</p>
                      </div>
                      <button 
                        onClick={() => updateTask(selectedTaskId, { validation_needed: !selectedTask.validation_needed })} 
                        className={cn("relative w-12 h-6 rounded-[8px] transition-all duration-300", selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-[8px] transition-all duration-300", selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1")} />
                      </button>
                    </div>

                    {selectedTask.validation_needed && (
                      <div className="space-y-1.5 animate-apple-in pt-3 border-t border-white/5">
                        {(selectedTask.validation_procedure_steps || []).map((step, idx) => (
                        <NestedCollapsible
                          key={step.id}
                          title={`Check ${idx + 1}`}
                          isOpen={openItems[step.id]}
                          toggle={() => toggleItem(step.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { validation_procedure_steps: moveArrayItem(selectedTask.validation_procedure_steps || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.validation_procedure_steps || []).length - 1 ? () => updateTask(selectedTaskId, { validation_procedure_steps: moveArrayItem(selectedTask.validation_procedure_steps || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.filter(x => x.id !== step.id) })}
                        >
                            <div className="space-y-1.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">What to check *</label>
                                <textarea 
                                data-builder-field="task.validation_procedure_steps"
                                className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/80 h-24 resize-none outline-none focus:border-orange-500" 
                                  value={step.description} 
                                  onChange={e => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                  placeholder="Describe the check..."
                                />
                                {!step.description && issuesForField('task.validation_step', selectedTaskId).length > 0 && (
                                  <p className={cn("mt-2 rounded-[8px] border px-1.5 py-1 text-[10px] font-bold leading-relaxed", compactIssueTone('error'))}>
                                    Check description is required.
                                  </p>
                                )}
                              </div>
                              <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Proof images (Ctrl+V)" />
                            </div>
                          </NestedCollapsible>
                        ))}
                        <button onClick={() => updateTask(selectedTaskId, { validation_procedure_steps: [...(selectedTask.validation_procedure_steps || []), { id: Date.now().toString(), description: '', figures: [] }] })} className="w-full py-1.5 bg-white/5 border border-dashed border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white hover:border-orange-500 transition-all rounded-[8px] leading-none">+ Add Check</button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-[8px] border border-amber-500/15 bg-amber-500/5 p-1.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-100">What needs fixing</p>
                      <button onClick={() => blockingValidationIssues[0] && focusAuditIssue(blockingValidationIssues[0])} className="rounded-[8px] border border-amber-500/15 bg-black/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-amber-100 hover:text-white leading-none">
                        Jump to first fix
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-white/55 leading-relaxed">
                      Each issue stays attached to the exact field or section that needs attention.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-[8px] border border-rose-500/20 bg-rose-500/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-rose-200">{validationErrorCount} errors</span>
                      <span className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em] text-amber-100">{validationWarningCount} warnings</span>
                    </div>
                  </div>
                </div>
              )}
              {inspectorTab === 'appendix' && (
                <div className={cn("space-y-1.5 pb-16", isReadOnlyMode && "pointer-events-none select-none opacity-80")}>
                  <CollapsibleSection title="References" isOpen={expandedSections.references} toggle={() => toggleSection('references')} count={selectedTask.reference_links.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.reference_links.map((l, idx) => (
                        <NestedCollapsible
                          key={l.id}
                          title={l.label || "New Link"}
                          isOpen={openItems[l.id]}
                          toggle={() => toggleItem(l.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { reference_links: moveArrayItem(selectedTask.reference_links || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.reference_links || []).length - 1 ? () => updateTask(selectedTaskId, { reference_links: moveArrayItem(selectedTask.reference_links || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== l.id) })}
                        >
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Link label *</label>
                              <input data-builder-field="task.reference_links" className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white outline-none focus:border-theme-accent" value={l.label} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) })} placeholder="e.g., SOP v1.2" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Where it points</label>
                              <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-[8px] px-1.5 py-1">
                                <Link2 size={12} className="text-theme-accent" />
                                <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={l.url} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x) })} placeholder="https://..." />
                              </div>
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.reference_links.length === 0 && (
                        <div className="rounded-[8px] border border-emerald-500/15 bg-emerald-500/5 px-1.5 py-1.5 text-[11px] font-bold text-emerald-100">
                          No links yet. Add the SOP, wiki, or evidence link that supports the task.
                        </div>
                      )}
                      <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/15 text-[9px] font-black uppercase text-emerald-100 hover:bg-emerald-500/20 transition-all rounded-[8px] mt-2">+ Add Link</button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Visual Notes" isOpen={expandedSections.assets} toggle={() => toggleSection('assets')} count={selectedTask.media.length}>
                    <div className="pt-4">
                      <ImagePasteField figures={selectedTask.media.map(m => m.url)} onPaste={(figs) => updateTask(selectedTaskId, { media: figs.map(f => ({ id: Date.now().toString(), type: 'image', url: f, label: 'Pasted Note' })) })} label="Visual Notes (Ctrl+V)" />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Instructions" isOpen={expandedSections.instructions} toggle={() => toggleSection('instructions')} count={selectedTask.instructions.length}>
                    <div className="space-y-1.5 pt-4">
                      {selectedTask.instructions.map((step, idx) => (
                        <NestedCollapsible
                          key={step.id}
                          title={`Step ${idx + 1}`}
                          isOpen={openItems[step.id]}
                          toggle={() => toggleItem(step.id)}
                          onMoveUp={idx > 0 ? () => updateTask(selectedTaskId, { instructions: moveArrayItem(selectedTask.instructions || [], idx, idx - 1) }) : undefined}
                          onMoveDown={idx < (selectedTask.instructions || []).length - 1 ? () => updateTask(selectedTaskId, { instructions: moveArrayItem(selectedTask.instructions || [], idx, idx + 1) }) : undefined}
                          onDelete={() => updateTask(selectedTaskId, { instructions: selectedTask.instructions.filter(x => x.id !== step.id) })}
                        >
                          <div className="space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">What to do *</label>
                              <textarea 
                                data-builder-field="task.instructions"
                                className="w-full bg-black/40 border border-white/10 rounded-[8px] p-1.5 text-[11px] text-white/80 h-28 resize-none outline-none focus:border-theme-accent transition-all" 
                                value={step.description} 
                                onChange={e => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                placeholder="Describe the action..."
                              />
                            </div>
                            <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Step notes (Ctrl+V)" />
                          </div>
                        </NestedCollapsible>
                      ))}
                      {selectedTask.instructions.length === 0 && (
                        <div className="rounded-[8px] border border-cyan-500/15 bg-cyan-500/5 px-1.5 py-1.5 text-[11px] font-bold text-cyan-100">
                          No steps yet. Add only steps that help someone perform the task reliably.
                        </div>
                      )}
                      <button onClick={() => updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id: Date.now().toString(), description: '', figures: [], links: [] }] })} className="w-full py-1.5 bg-cyan-500/10 border border-cyan-500/15 text-[9px] font-black uppercase text-cyan-100 hover:bg-cyan-500/20 transition-all rounded-[8px]">+ Add Step</button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
                <div className={cn("p-1.5 space-y-1.5 animate-apple-in", isReadOnlyMode && "pointer-events-none select-none opacity-80")}>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-1.5"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Route details</span></div>
                <div className="flex gap-1.5">
                  <button onClick={() => centerOnEdgeRoute(selectedEdgeId)} title="Center route" className="text-white/40 hover:text-white p-1.5 bg-white/5 border border-white/10 rounded-[8px] transition-all leading-none"><MapPinned size={16} /></button>
                  <button onClick={() => swapEdgeDirection(selectedEdgeId)} title="Swap direction" className="text-white/40 hover:text-white p-1.5 bg-white/5 border border-white/10 rounded-[8px] transition-all leading-none"><LucideWorkflow size={16} className="rotate-90" /></button>
                  <button onClick={() => { if (isReadOnlyMode) return; setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-1.5 border border-status-error/20 rounded-[8px] transition-all leading-none"><Trash size={16} /></button>
                </div>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.03] p-1.5 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Route summary</p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-white/65">
                  <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-1">From: {nodes.find((node) => node.id === selectedEdge.source)?.data?.label || selectedEdge.source}</span>
                  <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-1">To: {nodes.find((node) => node.id === selectedEdge.target)?.data?.label || selectedEdge.target}</span>
                  <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-1">Style: {selectedEdge.data?.edgeStyle || 'bezier'}</span>
                  <span className="rounded-[8px] border border-white/10 bg-black/25 px-1.5 py-1">Line: {selectedEdge.data?.lineStyle || 'solid'}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
                  <input data-builder-field="edge.label" className="w-full bg-white/5 border border-white/10 rounded-[8px] px-1.5 py-1 text-[11px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Route style</label>
                  <div className="flex bg-white/5 p-1 rounded-[8px] border border-white/10">
                    {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                      <button key={s} disabled={isReadOnlyMode} onClick={() => { if (isReadOnlyMode) return; updateEdge(selectedEdgeId, { edgeStyle: s }); }} className={cn("flex-1 py-1.5 text-[9px] font-black uppercase rounded-[8px] transition-all leading-none", isReadOnlyMode ? "opacity-35 cursor-not-allowed" : (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Line style</label>
                  <div className="flex bg-white/5 p-1 rounded-[8px] border border-white/10">
                    {(['solid', 'dashed'] as const).map((s) => (
                      <button key={s} disabled={isReadOnlyMode} onClick={() => { if (isReadOnlyMode) return; updateEdge(selectedEdgeId, { lineStyle: s }); }} className={cn("flex-1 py-1.5 text-[9px] font-black uppercase rounded-[8px] transition-all leading-none", isReadOnlyMode ? "opacity-35 cursor-not-allowed" : (selectedEdge.data?.lineStyle || 'solid') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => (
                      <button key={c} onClick={() => updateEdge(selectedEdgeId, { color: c })} className={cn("w-6 h-6 rounded-[8px] border transition-all", (selectedEdge.data?.color || '#ffffff') === c ? "border-white scale-125" : "border-transparent hover:scale-110")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn("space-y-1.5 animate-apple-in pb-14", isReadOnlyMode && "pointer-events-none select-none opacity-80")}>
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <LucideWorkflow className="text-theme-accent" size={16} />
                  <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Workflow Definition</h2>
                </div>
              <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-white/20 font-black uppercase tracking-widest">v{metadata.version}</span>
                  <button
                    onClick={() => setDefinitionCompactMode((current) => !current)}
                    className={cn("px-1.5 py-[3px] rounded-[8px] text-[8px] font-black uppercase transition-all leading-none", definitionCompactMode ? "bg-theme-accent/10 text-theme-accent border border-theme-accent/20" : "bg-white/5 text-white/40 border border-white/10 hover:text-white")}
                  >
                    {definitionCompactMode ? 'Compact' : 'Dense'}
                  </button>
                  <button 
                    onClick={() => !reviewMode && setIsMetadataEditMode(!isMetadataEditMode)}
                    disabled={reviewMode}
                    className={cn("px-1.5 py-[3px] rounded-[8px] text-[8px] font-black uppercase transition-all leading-none", reviewMode ? "hidden bg-white/5 text-white/25 cursor-not-allowed" : isMetadataEditMode ? "bg-theme-accent text-white" : "bg-white/5 text-white/40 hover:text-white")}
                  >
                    {reviewMode ? "Review Mode" : isMetadataEditMode ? "Finish Editing" : "Edit Definition"}
                  </button>
                </div>
              </div>

              {onGovernanceAction && (canReviewWorkflowState || canApproveWorkflowState || canCertifyWorkflowState || canRequestRecertificationState || canRequestChangesState) && (
                <div className={cn("mt-2 rounded-[8px] border border-white/5 bg-white/[0.03] p-1.5", definitionCompactMode && "p-1.5")}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-theme-accent">Workflow Approval</p>
                      <p className="mt-0.5 text-[10px] font-bold text-white/45">
                        {formatGovernanceActor(currentMember)} can act only within assigned review permissions.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", workflow?.review_state === 'Approved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300')}>
                        Review {workflow?.review_state || 'Draft'}
                      </span>
                      <span className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", workflow?.approval_state === 'Approved' || workflow?.approval_state === 'Certified' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/55')}>
                        Approval {workflow?.approval_state || 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {canReviewWorkflowState && workflow?.review_state !== 'Approved' && (
                      <button onClick={() => onGovernanceAction('approve_review')} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">
                        Approve Review
                      </button>
                    )}
                    {canApproveWorkflowState && !['Approved', 'Certified'].includes(workflow?.approval_state) && (
                      <button onClick={() => onGovernanceAction('approve_workflow')} className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                        Approve Workflow
                      </button>
                    )}
                    {canCertifyWorkflowState && workflow?.approval_state !== 'Certified' && (
                      <button onClick={() => onGovernanceAction('certify')} className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">
                        Certify
                      </button>
                    )}
                    {canRequestRecertificationState && (
                      <button onClick={() => onGovernanceAction('request_recertification')} className="rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white transition-all">
                        Need Recertification
                      </button>
                    )}
                    {canRequestChangesState && workflow?.review_state !== 'Changes Requested' && (
                      <button onClick={() => onGovernanceAction('request_changes')} className="rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-[4px] text-[8px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white transition-all">
                        Request Changes
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              <div className={cn(definitionCompactMode ? "space-y-1.5" : "space-y-1.5", "transition-all", (!isMetadataEditMode || reviewMode) && "opacity-80 pointer-events-none")}>
                <div className={definitionCompactMode ? "space-y-1.5" : "space-y-1.5"}>
                  <div className="flex items-center gap-1.5 text-theme-accent font-black px-1">
                    <Cpu size={13} />
                    <span className="text-[9px] tracking-[0.2em] uppercase">Overview</span>
                  </div>
                <div className={cn(BUILDER_PANEL, definitionCompactMode ? "space-y-1.5 !bg-white/[0.02] border-white/5 p-1.5" : "space-y-1.5 !bg-white/[0.02] border-white/5 p-1.5")}>
                    <div className="flex flex-wrap gap-1.5 rounded-[8px] border border-white/10 bg-black/20 px-1.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/40">
                      <span className="text-white/35">Definition</span>
                      <span className="truncate max-w-[12rem]">{metadata.purpose_statement || 'No purpose set'}</span>
                      <span className="border-l border-white/10 pl-2">{metadata.pre_requisites.length} prereqs</span>
                      <span className="border-l border-white/10 pl-2">{metadata.tool_family.length} families</span>
                      <span className="border-l border-white/10 pl-2">{metadata.applicable_tools.length} tools</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">Workflow Name</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.name.length} / 60</span>
                      </div>
                      <input 
                        data-testid="builder-workflow-name"
                        className={cn(BUILDER_FIELD, "text-[13px] font-black uppercase h-9")} 
                        value={metadata.name} 
                        onChange={e => { saveToHistory(); setMetadata({...metadata, name: e.target.value}); }} 
                      />
                      {issuesForField('workflow.name').length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {issuesForField('workflow.name').map((issue) => (
                            <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {definitionSettings.fieldVisibility.purpose_statement && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">{definitionSettings.fieldLabels.purpose_statement}</label>
                          <span className="text-[8px] text-white/10 font-mono">{metadata.purpose_statement.length} / 500</span>
                        </div>
                        <div className={getDefinitionIssueShell(issuesForField('workflow.description').length > 0)}>
                          <textarea 
                            data-testid="builder-workflow-description"
                            className={cn("w-full bg-transparent border-0 rounded-[inherit] px-1.5 py-1.5 text-[10px] font-bold text-white/80 h-[4.5rem] resize-none leading-relaxed outline-none", definitionCompactMode && "h-16") } 
                            value={metadata.purpose_statement} 
                            onChange={e => { saveToHistory(); setMetadata({...metadata, purpose_statement: e.target.value}); }} 
                          />
                        </div>
                        {definitionSettings.fieldVisibility.inline_examples && (
                          <p className="px-1 text-[9px] font-bold leading-relaxed text-white/35">
                            {definitionSettings.fieldExamples.purpose_statement}
                          </p>
                        )}
                        {issuesForField('workflow.description').length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {issuesForField('workflow.description').map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[8px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {definitionSettings.fieldVisibility.pre_requisites && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">{definitionSettings.fieldLabels.pre_requisites}</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.pre_requisites.length}</span>
                      </div>
                      <div className="space-y-1.5 rounded-[8px] border border-white/5 bg-black/20 p-1.5">
                        {metadata.pre_requisites.length === 0 ? (
                          <p className="px-1 py-0.5 text-[9px] font-bold text-white/30 leading-relaxed">
                            {definitionSettings.fieldExamples.pre_requisites}
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {metadata.pre_requisites.map((item, index) => (
                              <div key={`${item}-${index}`} className="flex items-center gap-1.5">
                                <input
                                  className={cn(BUILDER_FIELD, "h-8 text-[10px]")}
                                  value={item}
                                  onChange={e => {
                                    const next = [...metadata.pre_requisites];
                                    next[index] = e.target.value;
                                    setMetadata({ ...metadata, pre_requisites: next });
                                  }}
                                  placeholder={`Prerequisite ${index + 1}`}
                                />
                                <button
                                  onClick={() => setMetadata({ ...metadata, pre_requisites: metadata.pre_requisites.filter((_, idx) => idx !== index) })}
                                  className="h-8 shrink-0 rounded-[8px] border border-white/10 bg-white/5 px-1.5 text-[8px] font-black uppercase text-white/40 hover:text-white"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <input
                            className={cn(BUILDER_FIELD, "h-8 text-[10px]")}
                            placeholder="Add prerequisite..."
                            value={definitionPrereqDraft}
                            onChange={e => setDefinitionPrereqDraft(e.target.value)}
                          />
                          <button
                            onClick={() => {
                              const next = definitionPrereqDraft.trim();
                              if (!next) return;
                              setMetadata({
                                ...metadata,
                                pre_requisites: [...metadata.pre_requisites, next],
                              });
                              setDefinitionPrereqDraft('');
                            }}
                            className="h-8 shrink-0 rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 text-[8px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                    )}

                    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-1.5", definitionCompactMode && "gap-1.5")}>
                      {definitionSettings.fieldVisibility.prc && (
                        <SearchableSelect 
                          label={definitionSettings.fieldLabels.prc}
                          options={(taxonomy.find(t => t.category === 'PRC') as any)?.cached_values || []}
                          value={metadata.prc}
                          onChange={val => { saveToHistory(); setMetadata({...metadata, prc: val}); }}
                          placeholder="SELECT PRC..."
                          error={issuesForField('workflow.prc').length > 0}
                          compact
                        />
                      )}
                      {definitionSettings.fieldVisibility.workflow_type && (
                        <SearchableSelect 
                          label={definitionSettings.fieldLabels.workflow_type}
                          options={(taxonomy.find(t => t.category === 'WORKFLOW_TYPE') as any)?.cached_values || []}
                          value={metadata.workflow_type}
                          onChange={val => { saveToHistory(); setMetadata({...metadata, workflow_type: val}); }}
                          placeholder="SELECT TYPE..."
                          error={issuesForField('workflow.workflow_type').length > 0}
                          compact
                        />
                      )}
                      {definitionSettings.fieldVisibility.cadence && (
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-white/40 uppercase tracking-widest px-1">{definitionSettings.fieldLabels.cadence}</label>
                          <div className={cn("flex items-center gap-1 bg-black/40 rounded-[8px] p-0.5 h-[38px]", issuesForField('workflow.cadence').length > 0 ? "border border-status-error/40 bg-status-error/10" : "border border-white/10")}>
                            <input 
                              type="number" 
                              step="0.1"
                              className="w-11 bg-black/40 font-black text-[10px] text-white text-center py-1.5 rounded-[0.85rem] outline-none" 
                              value={metadata.cadence_count} 
                              onChange={e => { saveToHistory(); setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 1}); }} 
                            />
                            <select 
                              className="flex-1 bg-transparent text-white font-black text-[8px] uppercase outline-none cursor-pointer"
                              value={metadata.cadence_unit}
                              onChange={e => { saveToHistory(); setMetadata({...metadata, cadence_unit: e.target.value}); }}
                            >
                              <option value="day">DAILY</option>
                              <option value="week">WEEKLY</option>
                              <option value="month">MONTHLY</option>
                              <option value="year">YEARLY</option>
                            </select>
                          </div>
                          {definitionSettings.fieldVisibility.inline_examples && (
                            <p className="px-1 text-[8px] font-bold text-white/30 leading-relaxed">{definitionSettings.fieldExamples.cadence}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {(definitionSettings.fieldVisibility.tool_family || definitionSettings.fieldVisibility.applicable_tools) && (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 rounded-[8px] border border-white/5 bg-black/20 px-1.5 py-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Tool families and tools</span>
                          {definitionToolPropagation.familyChips.length > 0 ? (
                            definitionToolPropagation.familyChips.map((chip) => (
                              <span key={chip.family} className="rounded-[8px] border border-theme-accent/20 bg-theme-accent/10 px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em] text-theme-accent">
                                {chip.family} <span className="text-white/35">({chip.toolCount})</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[8px] font-bold text-white/35">Select a tool family to reveal applicable tools.</span>
                          )}
                          {definitionToolPropagation.availableTools.length > 0 && (
                            <span className="ml-auto text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">
                              {definitionToolPropagation.availableTools.length} tools available
                            </span>
                          )}
                          {metadata.tool_family.length > 0 && (
                            <button
                              onClick={() => {
                                saveToHistory();
                                setMetadata({ ...metadata, tool_family: [], applicable_tools: [] });
                              }}
                              className="ml-auto rounded-[8px] border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/50 hover:text-white"
                            >
                              Clear selection
                            </button>
                          )}
                        </div>
                        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-1.5", definitionCompactMode && "gap-1.5")}>
                        {definitionSettings.fieldVisibility.tool_family && (
                        <SearchableSelect 
                            label={definitionSettings.fieldLabels.tool_family}
                            options={(taxonomy.find(t => t.category === 'ToolType') as any)?.cached_values || []}
                            value={metadata.tool_family}
                          onChange={vals => {
                              saveToHistory();
                              const nextFamilies = Array.isArray(vals) ? vals : [];
                              const nextPropagation = deriveToolPropagation(definitionToolPropagationSource, nextFamilies, metadata.applicable_tools);
                              setMetadata({
                                ...metadata,
                                tool_family: nextFamilies,
                                applicable_tools: nextFamilies.length === 0 ? [] : nextPropagation.selectedTools,
                              });
                            }}
                            placeholder="Choose tool families..."
                            isMulti
                            error={issuesForField('workflow.tool_family').length > 0}
                            compact
                          />
                        )}
                        {definitionSettings.fieldVisibility.applicable_tools && (
                          <SearchableSelect 
                            label={definitionSettings.fieldLabels.applicable_tools}
                            options={definitionToolPropagation.availableTools}
                            value={metadata.tool_family.length === 0 ? [] : definitionToolPropagation.selectedTools}
                            onChange={vals => {
                              saveToHistory();
                              const nextTools = Array.isArray(vals) ? vals : [];
                              setMetadata({
                                ...metadata,
                                applicable_tools: nextTools.filter((tool) => definitionToolPropagation.availableTools.includes(tool)),
                              });
                            }}
                            placeholder={metadata.tool_family.length === 0 ? "Pick a tool family first..." : "Choose applicable tools..."}
                            isMulti
                            disabled={metadata.tool_family.length === 0}
                            error={issuesForField('workflow.applicable_tools').length > 0}
                            compact
                          />
                        )}
                        </div>
                        {issuesForField('workflow.tool_family').length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-1">
                            {issuesForField('workflow.tool_family').map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                            ))}
                          </div>
                        )}
                        {issuesForField('workflow.applicable_tools').length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-1">
                            {issuesForField('workflow.applicable_tools').map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                            ))}
                          </div>
                        )}
                        {definitionSettings.fieldVisibility.inline_examples && (
                          <p className="px-1 text-[8px] font-bold text-white/30 leading-relaxed">{definitionSettings.fieldExamples.tool_family}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-theme-accent font-black px-1">
                    <Zap size={13} />
                    <span className="text-[9px] tracking-[0.2em] uppercase">Start & Finish</span>
                  </div>
                  <div className={cn(BUILDER_PANEL, definitionCompactMode ? "space-y-1.5 !bg-white/[0.02] border-white/5 p-1.5" : "space-y-1.5 !bg-white/[0.02] border-white/5 p-1.5")}>
                    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-1.5", definitionCompactMode && "gap-1.5")}>
                        {definitionSettings.fieldVisibility.trigger_type && (
                        <SearchableSelect 
                          label={definitionSettings.fieldLabels.trigger_type}
                          options={(taxonomy.find(t => t.category === 'TriggerType') as any)?.cached_values || []}
                          value={metadata.trigger_type}
                          onChange={val => { saveToHistory(); setMetadata({...metadata, trigger_type: val}); }}
                          placeholder="SELECT TRIGGER..."
                          error={issuesForField('workflow.trigger_type').length > 0}
                          compact
                        />
                        )}
                        {definitionSettings.fieldVisibility.output_type && (
                        <SearchableSelect 
                          label={definitionSettings.fieldLabels.output_type}
                          options={(taxonomy.find(t => t.category === 'OutputType') as any)?.cached_values || []}
                          value={metadata.output_type}
                          onChange={val => { saveToHistory(); setMetadata({...metadata, output_type: val}); }}
                          placeholder="SELECT OUTPUT..."
                          error={issuesForField('workflow.output_type').length > 0}
                          compact
                        />
                        )}
                    </div>
                      <div className={cn("grid grid-cols-1 gap-1.5 border-t border-white/5 pt-4", definitionCompactMode && "gap-1.5 pt-3")}>
                      <div className="space-y-1.5">
                        {definitionSettings.fieldVisibility.trigger_description && (
                          <>
                            <label className="text-[8px] font-black text-white/40 uppercase tracking-widest px-1">{definitionSettings.fieldLabels.trigger_description}</label>
                            <div className={getDefinitionIssueShell(issuesForField('workflow.trigger_description').length > 0)}>
                              <textarea 
                                className="w-full bg-transparent border-0 rounded-[inherit] px-1.5 py-1.5 text-[10px] font-bold text-white/80 h-[4.5rem] resize-none leading-relaxed outline-none" 
                                value={metadata.trigger_description} 
                                onChange={e => { saveToHistory(); setMetadata({...metadata, trigger_description: e.target.value}); }} 
                              />
                            </div>
                            {definitionSettings.fieldVisibility.inline_examples && (
                              <p className="px-1 text-[8px] font-bold text-white/30 leading-relaxed">{definitionSettings.fieldExamples.trigger_description}</p>
                            )}
                          </>
                        )}
                        {issuesForField('workflow.trigger_description').length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {issuesForField('workflow.trigger_description').map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {definitionSettings.fieldVisibility.output_description && (
                          <>
                            <label className="text-[8px] font-black text-white/40 uppercase tracking-widest px-1">{definitionSettings.fieldLabels.output_description}</label>
                            <div className={getDefinitionIssueShell(issuesForField('workflow.output_description').length > 0)}>
                              <textarea 
                                className="w-full bg-transparent border-0 rounded-[inherit] px-1.5 py-1.5 text-[10px] font-bold text-white/80 h-[4.5rem] resize-none leading-relaxed outline-none" 
                                value={metadata.output_description} 
                                onChange={e => { saveToHistory(); setMetadata({...metadata, output_description: e.target.value}); }} 
                              />
                            </div>
                            {definitionSettings.fieldVisibility.inline_examples && (
                              <p className="px-1 text-[8px] font-bold text-white/30 leading-relaxed">{definitionSettings.fieldExamples.output_description}</p>
                            )}
                          </>
                        )}
                        {issuesForField('workflow.output_description').length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {issuesForField('workflow.output_description').map((issue) => (
                              <span key={issueId(issue)} className={cn("rounded-[8px] border px-1.5 py-[3px] text-[7px] font-black uppercase tracking-[0.18em]", compactIssueTone(issue.severity))}>{issue.message}</span>
                            ))}
                          </div>
                        )}
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
    </div>
  );
};

const WrappedBuilder2: React.FC<WorkflowBuilderProps> = (p) => (<ReactFlowProvider><Builder2 {...p} /></ReactFlowProvider>);
export default WrappedBuilder2;
