import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  useViewport,
  ReactFlowProvider,
  EdgeLabelRenderer,
  ConnectionLineType,
  getSmoothStepPath,
  getStraightPath,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange
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
  Bug,
  ShieldAlert,
  Trash2,
  Hash,
  Clock,
  Diamond,
  Box
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchableSelect } from './IntakeGatekeeper';
import { mediaApi, settingsApi } from '../api/client';
import { useBuganizer } from './ErrorFortress';
import { auditWorkflowDraft, hasAuditErrors, summarizeAuditIssues } from '../testing/workflowQuality';
import { validateBuilderRuntimeState } from '../testing/workflowRuntime';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ValidationMessage: React.FC<{ message: string; onClear: () => void; actions?: React.ReactNode }> = ({ message, onClear, actions }) => (
  <div className="fixed top-24 right-8 z-[2000] w-[28rem] apple-glass border-status-error/30 bg-[linear-gradient(180deg,rgba(239,68,68,0.12),rgba(15,23,42,0.92))] p-4 rounded-2xl shadow-2xl animate-apple-in">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-2xl bg-status-error/20 flex items-center justify-center flex-shrink-0 border border-status-error/40 shadow-[0_0_18px_rgba(239,68,68,0.18)]">
        <ShieldAlert size={20} className="text-status-error" />
      </div>
      <div className="flex-1 space-y-1">
        <h4 className="text-[10px] font-black text-status-error uppercase tracking-[0.24em]">Validation Block</h4>
        <p className="text-[12px] font-bold text-white/80 leading-relaxed">{message}</p>
        {actions && <div className="pt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <button onClick={onClear} className="p-1 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </div>
  </div>
);

const estimateNodeWidth = (data: any) => {
  const labelLength = String(data.label || '').length;
  const descriptionLength = String(data.description || '').length;
  const systemCount = (data.target_systems || []).length;
  const densityMode = data.densityMode || 'standard';
  const densityOffset = densityMode === 'compact' ? -32 : densityMode === 'expanded' ? 42 : 0;
  const complexity = Math.min(
    Math.max(Math.round(labelLength / 14) * 22 + Math.round(descriptionLength / 60) * 10 + systemCount * 8, 0),
    120
  );
  return Math.min(Math.max(360 + complexity + densityOffset, 340), 560);
};

const getNodeDimensions = (node: Node | { type?: string; data?: any }) => {
  const densityMode = node.data?.densityMode || 'standard';
  const isDiamond = node.type === 'diamond';
  const isTemplate = node.data?.interface === 'TRIGGER' || node.data?.interface === 'OUTCOME';
  if (isDiamond) {
    const size = densityMode === 'compact' ? 250 : densityMode === 'expanded' ? 320 : 280;
    return { width: size, height: size };
  }
  if (isTemplate) {
    return {
      width: Math.max(240, Math.min(estimateNodeWidth(node.data || {}) - 120, 360)),
      height: densityMode === 'compact' ? 136 : densityMode === 'expanded' ? 184 : 160,
    };
  }
  return {
    width: estimateNodeWidth(node.data || {}),
    height: densityMode === 'compact' ? 320 : densityMode === 'expanded' ? 468 : 404,
  };
};

const SaveStateChip: React.FC<{
  saveState: 'clean' | 'dirty' | 'saving' | 'blocked';
  issueCount: number;
}> = ({ saveState, issueCount }) => {
  const config = {
    clean: {
      label: 'Synced',
      tone: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      dot: 'bg-emerald-400'
    },
    dirty: {
      label: 'Unsaved',
      tone: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
      dot: 'bg-amber-400'
    },
    saving: {
      label: 'Saving',
      tone: 'text-theme-accent border-theme-accent/20 bg-theme-accent/10',
      dot: 'bg-theme-accent'
    },
    blocked: {
      label: 'Blocked',
      tone: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
      dot: 'bg-rose-400'
    }
  } as const;
  const active = config[saveState];
  return (
    <div className={cn("flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", active.tone)}>
      <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]", active.dot, saveState === 'saving' && 'animate-pulse')} />
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-[0.18em]">{active.label}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-white/50">{issueCount} active issues</span>
      </div>
    </div>
  );
};

const SectionEyebrow: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div className="flex items-start justify-between gap-3 px-1">
    <div className="flex items-center gap-2 text-theme-accent">
      <div className="w-7 h-7 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center">
        {icon || <Activity size={13} />}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent">{title}</p>
        {hint && <p className="text-[11px] font-bold text-white/45 mt-1">{hint}</p>}
      </div>
    </div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: React.ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }> = ({
  label,
  value,
  tone = 'neutral',
}) => {
  const tones = {
    neutral: 'text-white border-white/8 bg-white/[0.03]',
    accent: 'text-theme-accent border-theme-accent/15 bg-theme-accent/[0.08]',
    success: 'text-emerald-400 border-emerald-500/15 bg-emerald-500/[0.08]',
    warning: 'text-amber-400 border-amber-500/15 bg-amber-500/[0.08]',
    danger: 'text-rose-400 border-rose-500/15 bg-rose-500/[0.08]',
  } as const;
  return (
    <div className={cn("rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", tones[tone])}>
      <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <div className="mt-2 text-[22px] font-black leading-none">{value}</div>
    </div>
  );
};

const SemanticBadge: React.FC<{ label: string; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'decision' }> = ({
  label,
  tone = 'neutral',
}) => {
  const tones = {
    neutral: 'text-white/70 border-white/12 bg-white/[0.05]',
    accent: 'text-theme-accent border-theme-accent/20 bg-theme-accent/10',
    success: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    warning: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
    danger: 'text-rose-300 border-rose-500/20 bg-rose-500/10',
    decision: 'text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10',
  } as const;
  return <span className={cn("px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.18em]", tones[tone])}>{label}</span>;
};

const FlowStageRail: React.FC<{ active: 'intake' | 'builder' | 'validate' | 'commit' }> = ({ active }) => {
  const stages: Array<{ id: 'intake' | 'builder' | 'validate' | 'commit'; label: string }> = [
    { id: 'intake', label: 'Intake' },
    { id: 'builder', label: 'Builder' },
    { id: 'validate', label: 'Validate' },
    { id: 'commit', label: 'Commit' },
  ];
  const activeIndex = stages.findIndex(stage => stage.id === active);
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.id}>
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all",
            index === activeIndex
              ? "bg-theme-accent/15 text-white border border-theme-accent/25"
              : index < activeIndex
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "text-white/35 border border-transparent"
          )}>
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black",
              index === activeIndex ? "bg-theme-accent text-white" : index < activeIndex ? "bg-emerald-500 text-white" : "bg-white/10 text-white/45"
            )}>
              {index + 1}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em]">{stage.label}</span>
          </div>
          {index < stages.length - 1 && <div className="h-px w-4 bg-white/10" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const TaskTemplateRail: React.FC<{
  taskType?: string;
  interfaceType?: string | null;
  inspectorTab: 'overview' | 'data' | 'exceptions' | 'validation' | 'appendix';
}> = ({ taskType, interfaceType, inspectorTab }) => {
  const templates = interfaceType === 'TRIGGER'
    ? ['Overview', 'Trigger Contract', 'Inputs']
    : interfaceType === 'OUTCOME'
      ? ['Overview', 'Output Contract', 'Verification']
      : taskType === 'LOOP'
        ? ['Decision Logic', 'Routing', 'Risk']
        : ['Overview', 'Data', 'Exceptions'];
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 flex flex-wrap items-center gap-2">
      <span className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Template</span>
      {templates.map((item) => (
        <SemanticBadge
          key={item}
          label={item}
          tone={item.toLowerCase().includes(inspectorTab === 'overview' ? 'overview' : inspectorTab) ? 'accent' : item === 'Decision Logic' ? 'decision' : 'neutral'}
        />
      ))}
    </div>
  );
};

const IssueRail: React.FC<{
  issues: Array<{ id: string; label: string; detail: string; severity: 'error' | 'warning'; target?: string | null; kind: 'metadata' | 'task' }>;
  onSelect: (issue: { target?: string | null; kind: 'metadata' | 'task' }) => void;
}> = ({ issues, onSelect }) => (
  <div className="absolute top-6 left-6 z-20 w-[20rem] apple-glass bg-[#0a1120]/88 border-white/10 rounded-3xl shadow-2xl overflow-hidden">
    <div className="px-5 py-4 border-b border-white/8 bg-white/[0.02]">
      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent">Workflow Readiness</p>
      <div className="flex items-end justify-between mt-2">
        <h3 className="text-[16px] font-black text-white uppercase tracking-tight">Issue Rail</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{issues.length} signals</span>
      </div>
      <div className="flex gap-2 mt-3">
        <SemanticBadge label={`${issues.filter(issue => issue.severity === 'error').length} Errors`} tone="danger" />
        <SemanticBadge label={`${issues.filter(issue => issue.severity === 'warning').length} Warnings`} tone="warning" />
      </div>
    </div>
    <div className="max-h-[26rem] overflow-auto custom-scrollbar p-3 space-y-2">
      {issues.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">No Active Issues</p>
          <p className="text-[11px] font-bold text-white/55 mt-2">Current graph and metadata pass the local builder checks.</p>
        </div>
      )}
      {issues.map(issue => (
        <button
          key={issue.id}
          onClick={() => onSelect(issue)}
          className={cn(
            "w-full text-left rounded-2xl border px-4 py-3 transition-all hover:translate-x-0.5",
            issue.severity === 'error'
              ? "border-rose-500/18 bg-rose-500/[0.08] hover:bg-rose-500/[0.12]"
              : "border-amber-500/18 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em]",
              issue.severity === 'error' ? "text-rose-400" : "text-amber-400"
            )}>{issue.label}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/25">{issue.kind}</span>
          </div>
          <p className="text-[11px] font-bold text-white/70 leading-relaxed mt-2">{issue.detail}</p>
        </button>
      ))}
    </div>
  </div>
);

interface TaskMedia {
  id: string;
  type: 'image' | 'video' | 'doc';
  url: string;
  label: string;
  file_name?: string;
  mime_type?: string;
  uploaded_at?: string;
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
  orphaned_input?: boolean;
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
  target_systems: TaskSystem[];
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
  phase_name?: string;
  subflow_name?: string;
  task_block_key?: string;
  decision_details?: Record<string, any>;
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
  review_state?: string;
  created_at: string;
  resolved: boolean;
}

interface AccessControlConfig {
  visibility: string;
  viewers: string[];
  editors: string[];
  mention_groups: string[];
  owner: string;
}

interface WorkflowOwnershipConfig {
  owner: string;
  smes: string[];
  backup_owners: string[];
  automation_owner?: string;
  reviewers: string[];
}

interface WorkflowGovernanceConfig {
  lifecycle_stage: string;
  review_state: string;
  approval_state: string;
  required_reviewer_roles: string[];
  standards_flags: string[];
  stale_after_days: number;
  review_due_at?: string;
  last_reviewed_at?: string;
}

interface ReviewRequestConfig {
  id: string;
  role: string;
  requested_from?: string;
  requested_by: string;
  status: string;
  due_at?: string;
  note?: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  actor: string;
  created_at: string;
}

interface NotificationEntry {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  read: boolean;
  created_at: string;
}

interface WorkflowSimulation {
  best_case_minutes: number;
  worst_case_minutes: number;
  critical_path_minutes: number;
  critical_path_nodes: string[];
  path_count: number;
}

interface WorkflowAnalysis {
  has_cycle: boolean;
  cycle_nodes: string[];
  disconnected_nodes: string[];
  unreachable_nodes: string[];
  malformed_logic_nodes: string[];
  orphaned_inputs: string[];
  critical_path_minutes: number;
  critical_path_hours: number;
  critical_path_nodes: string[];
  shift_handoff_risk: boolean;
  diff_summary: {
    added_nodes: string[];
    removed_nodes: string[];
    modified_nodes: string[];
    has_changes: boolean;
  };
  diagnostics: Record<string, any>;
}

interface WorkflowMetadata {
  name: string;
  version: number;
  workspace: string;
  parent_workflow_id: number | null;
  version_group?: string;
  version_notes: string;
  version_base_snapshot?: any;
  description: string;
  prc: string;
  workflow_type: string;
  org?: string;
  team?: string;
  tool_family: string[];
  applicable_tools: string[];
  trigger_type: string;
  trigger_description: string;
  output_type: string;
  output_description: string;
  cadence_count: number;
  cadence_unit: string;
  repeatability_check: boolean;
  equipment_required: boolean;
  equipment_state: string;
  cleanroom_required: boolean;
  access_control: AccessControlConfig;
  ownership: WorkflowOwnershipConfig;
  governance: WorkflowGovernanceConfig;
  review_requests: ReviewRequestConfig[];
  activity_timeline: ActivityEntry[];
  notification_feed: NotificationEntry[];
  quick_capture_notes?: string;
  template_key?: string;
  related_workflow_ids?: number[];
  standards_profile?: Record<string, any>;
  comments: WorkflowComment[];
  analysis?: WorkflowAnalysis;
  simulation?: WorkflowSimulation;
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
  onSave: (data: any) => any | Promise<any>;
  onBack: (currentData?: any) => void;
  onExit: () => void;
  onCreateRollbackDraft?: () => void;
  setIsDirty: (value: boolean) => void;
}

const createLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneTaskEntity = (task: TaskEntity, nodeId: string): TaskEntity => ({
  ...task,
  id: nodeId,
  node_id: nodeId,
  blockers: (task.blockers || []).map((blocker: any) => ({ ...blocker, id: createLocalId('blocker') })),
  errors: (task.errors || []).map((error: any) => ({ ...error, id: createLocalId('error') })),
  target_systems: (task.target_systems || []).map((system) => ({ ...system, id: createLocalId('system') })),
  source_data_list: (task.source_data_list || []).map((item) => ({ ...item, id: createLocalId('input') })),
  output_data_list: (task.output_data_list || []).map((item) => ({ ...item, id: createLocalId('output') })),
  media: (task.media || []).map((media) => ({ ...media, id: createLocalId('media') })),
  reference_links: (task.reference_links || []).map((link) => ({ ...link, id: createLocalId('ref') })),
  instructions: (task.instructions || []).map((instruction) => ({ ...instruction, id: createLocalId('instruction') })),
  validation_procedure_steps: (task.validation_procedure_steps || []).map((step) => ({ ...step, id: createLocalId('validation') })),
  phase_name: task.phase_name,
  subflow_name: task.subflow_name,
  task_block_key: task.task_block_key,
  decision_details: task.decision_details ? { ...task.decision_details } : undefined,
});

const buildLocalAnalysis = (tasks: TaskEntity[], edges: Edge[], metadata: WorkflowMetadata): { analysis: WorkflowAnalysis, simulation: WorkflowSimulation } => {
  const taskMap = new Map(tasks.map(task => [String(task.node_id || task.id), task]));
  const validEdges = edges.filter(edge => taskMap.has(String(edge.source)) && taskMap.has(String(edge.target)));
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const edgeLabelMap = new Map<string, string>();

  for (const nodeId of taskMap.keys()) {
    adjacency.set(nodeId, []);
    reverseAdjacency.set(nodeId, []);
    indegree.set(nodeId, 0);
  }

  for (const edge of validEdges) {
    const source = String(edge.source);
    const target = String(edge.target);
    adjacency.get(source)?.push(target);
    reverseAdjacency.get(target)?.push(source);
    indegree.set(target, (indegree.get(target) || 0) + 1);
    edgeLabelMap.set(edge.id, String(edge.data?.label || '').trim().toLowerCase());
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycleNodes = new Set<string>();
  const dfsCycle = (nodeId: string) => {
    if (stack.has(nodeId)) {
      cycleNodes.add(nodeId);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) || []) {
      if (stack.has(neighbor)) {
        cycleNodes.add(nodeId);
        cycleNodes.add(neighbor);
      } else {
        dfsCycle(neighbor);
      }
    }
    stack.delete(nodeId);
  };
  for (const nodeId of taskMap.keys()) dfsCycle(nodeId);

  const triggerNodes = [...taskMap.entries()]
    .filter(([id, task]) => {
      const taskInterface = String(task.interface || task.interface_type || task.task_type || '').toUpperCase();
      return taskInterface === 'TRIGGER' || String(id) === 'node-trigger';
    })
    .map(([id]) => id);
  const outcomeNodes = [...taskMap.entries()]
    .filter(([id, task]) => {
      const taskInterface = String(task.interface || task.interface_type || task.task_type || '').toUpperCase();
      return taskInterface === 'OUTCOME' || String(id) === 'node-outcome';
    })
    .map(([id]) => id);
  const roots = triggerNodes.length > 0 ? triggerNodes : [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const reachable = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    queue.push(...(adjacency.get(nodeId) || []));
  }
  const sinks = outcomeNodes.length > 0 ? outcomeNodes : [...taskMap.keys()].filter(nodeId => (adjacency.get(nodeId) || []).length === 0);
  const backReachable = new Set<string>();
  const reverseQueue = [...sinks];
  while (reverseQueue.length > 0) {
    const nodeId = reverseQueue.shift()!;
    if (backReachable.has(nodeId)) continue;
    backReachable.add(nodeId);
    reverseQueue.push(...(reverseAdjacency.get(nodeId) || []));
  }

  const disconnectedNodes = [...taskMap.keys()].filter(nodeId => !reachable.has(nodeId) || !backReachable.has(nodeId));
  const unreachableNodes = [...taskMap.keys()].filter(nodeId => !reachable.has(nodeId));

  const malformedLogicNodes = [...taskMap.entries()].filter(([, task]) => task.task_type === 'LOOP').map(([nodeId]) => {
    const outgoing = validEdges.filter(edge => String(edge.source) === nodeId);
    const labels = outgoing.map(edge => edgeLabelMap.get(edge.id) || '');
    return outgoing.length === 2 && labels.includes('true') && labels.includes('false') ? null : nodeId;
  }).filter(Boolean) as string[];

  const outputIds = new Set(tasks.flatMap(task => (task.output_data_list || []).map(output => String(output.id))));
  const orphanedInputs = tasks.filter(task => (task.source_data_list || []).some(input => input.from_task_id && !outputIds.has(String(input.from_task_id)))).map(task => String(task.id));

  const topo = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: string[] = [];
  const indegreeClone = new Map(indegree);
  while (topo.length > 0) {
    const nodeId = topo.shift()!;
    order.push(nodeId);
    for (const neighbor of adjacency.get(nodeId) || []) {
      indegreeClone.set(neighbor, (indegreeClone.get(neighbor) || 1) - 1);
      if ((indegreeClone.get(neighbor) || 0) === 0) topo.push(neighbor);
    }
  }

  const taskWeight = (task: TaskEntity, includeRisk = false) => {
    const base = ((task.manual_time_minutes || 0) + Math.max(task.machine_wait_time_minutes || 0, task.automation_time_minutes || 0)) * (task.occurrence || 1);
    if (!includeRisk) return base;
    const errorPenalty = (task.errors || []).reduce((sum: number, error: any) => sum + ((error.probability_percent || 0) / 100) * (error.recovery_time_minutes || 0), 0);
    const blockerPenalty = (task.blockers || []).reduce((sum: number, blocker: any) => sum + ((blocker.probability_percent || 0) / 100) * (blocker.average_delay_minutes || 0), 0);
    return base + errorPenalty + blockerPenalty;
  };

  const computePathMetric = (includeRisk = false, mode: 'max' | 'min' = 'max') => {
    const initial = mode === 'max' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    const distance = new Map<string, number>([...taskMap.keys()].map(nodeId => [nodeId, initial]));
    const prev = new Map<string, string | null>([...taskMap.keys()].map(nodeId => [nodeId, null]));
    for (const root of roots) {
      distance.set(root, taskWeight(taskMap.get(root)!, includeRisk));
    }
    for (const nodeId of order) {
      for (const neighbor of adjacency.get(nodeId) || []) {
        const candidate = (distance.get(nodeId) ?? 0) + taskWeight(taskMap.get(neighbor)!, includeRisk);
        const current = distance.get(neighbor) ?? initial;
        const isBetter = mode === 'max' ? candidate > current : candidate < current;
        if (isBetter) {
          distance.set(neighbor, candidate);
          prev.set(neighbor, nodeId);
        }
      }
    }
    const evaluatedSinks = sinks.length > 0 ? sinks : [...taskMap.keys()];
    const chosenSink = evaluatedSinks.reduce((best, nodeId) => {
      const bestVal = distance.get(best) ?? initial;
      const nextVal = distance.get(nodeId) ?? initial;
      return mode === 'max' ? (nextVal > bestVal ? nodeId : best) : (nextVal < bestVal ? nodeId : best);
    }, evaluatedSinks[0] || [...taskMap.keys()][0] || '');
    const path: string[] = [];
    let cursor: string | null = chosenSink || null;
    while (cursor) {
      path.unshift(cursor);
      cursor = prev.get(cursor) || null;
    }
    return { minutes: Math.max(distance.get(chosenSink) || 0, 0), path };
  };

  const critical = computePathMetric(false, 'max');
  const best = computePathMetric(false, 'min');
  const worst = computePathMetric(true, 'max');
  const baseSnapshot = metadata.version_base_snapshot || {};
  const baseTasks = new Map(((baseSnapshot.tasks || []) as any[]).map(task => [String(task.node_id || task.id), task]));
  const diffSummary = {
    added_nodes: [...taskMap.keys()].filter(nodeId => !baseTasks.has(nodeId)),
    removed_nodes: [...baseTasks.keys()].filter(nodeId => !taskMap.has(nodeId)),
    modified_nodes: [...taskMap.keys()].filter(nodeId => {
      if (!baseTasks.has(nodeId)) return false;
      const baseTask = baseTasks.get(nodeId);
      const currentTask = taskMap.get(nodeId);
      return JSON.stringify({
        name: baseTask?.name,
        description: baseTask?.description,
        task_type: baseTask?.task_type,
        occurrence: baseTask?.occurrence,
        outputs: baseTask?.output_data_list,
        inputs: baseTask?.source_data_list,
      }) !== JSON.stringify({
        name: currentTask?.name,
        description: currentTask?.description,
        task_type: currentTask?.task_type,
        occurrence: currentTask?.occurrence,
        outputs: currentTask?.output_data_list,
        inputs: currentTask?.source_data_list,
      });
    }),
    has_changes: false,
  };
  diffSummary.has_changes = diffSummary.added_nodes.length > 0 || diffSummary.removed_nodes.length > 0 || diffSummary.modified_nodes.length > 0;

  const diagnostics = Object.fromEntries([...taskMap.entries()].map(([nodeId, task]) => [nodeId, {
    is_decision: task.task_type === 'LOOP',
    blocker_count: task.blockers.length,
    error_count: task.errors.length,
    orphaned_input: orphanedInputs.includes(nodeId),
    unreachable: unreachableNodes.includes(nodeId),
    disconnected: disconnectedNodes.includes(nodeId),
    logic_warning: malformedLogicNodes.includes(nodeId),
    diff: diffSummary.added_nodes.includes(nodeId) ? 'added' : diffSummary.modified_nodes.includes(nodeId) ? 'modified' : 'unchanged',
  }]));

  return {
    analysis: {
      has_cycle: cycleNodes.size > 0,
      cycle_nodes: [...cycleNodes],
      disconnected_nodes: disconnectedNodes,
      unreachable_nodes: unreachableNodes,
      malformed_logic_nodes: malformedLogicNodes,
      orphaned_inputs: orphanedInputs,
      critical_path_minutes: critical.minutes,
      critical_path_hours: Number((critical.minutes / 60).toFixed(2)),
      critical_path_nodes: critical.path,
      shift_handoff_risk: critical.minutes >= 600 || worst.minutes >= 600,
      diff_summary: diffSummary,
      diagnostics,
    },
    simulation: {
      best_case_minutes: best.minutes,
      worst_case_minutes: worst.minutes,
      critical_path_minutes: critical.minutes,
      critical_path_nodes: critical.path,
      path_count: Math.max(sinks.length, 1),
    }
  };
};

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
  const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null);

  return (
    <CollapsibleSection title={title} count={items.length} isOpen={isOpen} toggle={toggle} icon={icon}>
      <div className="space-y-3 pt-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 group relative overflow-hidden animate-apple-in transition-all hover:bg-white/[0.03]">
            {editingIdx === idx ? (
              <div className="space-y-3 animate-apple-in p-1">
                <textarea 
                  autoFocus
                  className="w-full bg-black/40 border border-theme-accent rounded-xl p-4 text-[13px] text-white outline-none min-h-[100px] leading-relaxed transition-all shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => { if (editVal.trim()) { const newItems = [...items]; newItems[idx] = editVal.trim(); onUpdate(newItems); setEditingIdx(null); } }}
                    className="flex-1 py-2 bg-theme-accent text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-theme-accent/20 hover:scale-[1.02] transition-all"
                  >
                    Apply Update
                  </button>
                  <button onClick={() => setEditingIdx(null)} className="px-5 py-2 bg-white/5 text-white/40 text-[10px] font-black uppercase rounded-lg hover:bg-white/10 transition-all">Dismiss</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-6 px-1">
                <p className="text-[12px] text-white/80 font-medium leading-relaxed flex-1 italic selection:bg-theme-accent/30">{item}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                  {confirmingIdx === idx ? (
                    <div className="flex items-center gap-1.5 animate-apple-in bg-status-error/20 rounded-lg p-1.5 border border-status-error/30 shadow-xl">
                      <button onClick={() => { onUpdate(items.filter((_, i) => i !== idx)); setConfirmingIdx(null); }} className="px-3 py-1.5 bg-status-error text-white text-[8px] font-black uppercase rounded-md shadow-lg shadow-status-error/30 hover:scale-105 transition-all">Confirm</button>
                      <button onClick={() => setConfirmingIdx(null)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-all"><X size={12} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                      <button onClick={() => { setEditingIdx(idx); setEditVal(item); }} className="p-2 hover:bg-theme-accent/20 text-white/20 hover:text-theme-accent rounded-xl transition-all border border-transparent hover:border-theme-accent/30"><Edit3 size={14} /></button>
                      <button onClick={() => setConfirmingIdx(idx)} className="p-2 hover:bg-status-error/20 text-white/20 hover:text-status-error rounded-xl transition-all border border-transparent hover:border-status-error/30"><Trash size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {editingIdx === -1 ? (
          <div className="bg-white/[0.02] border border-theme-accent rounded-2xl p-4 space-y-3 animate-apple-in shadow-2xl shadow-theme-accent/5 border-dashed">
            <textarea autoFocus className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[13px] text-white outline-none min-h-[100px] focus:border-theme-accent transition-all placeholder:text-white/10" value={editVal} onChange={e => setEditVal(e.target.value)} placeholder={placeholder || "Enter entry details..."} />
            <div className="flex gap-2">
              <button onClick={() => { if (editVal.trim()) { onUpdate([...items, editVal.trim()]); setEditingIdx(null); setEditVal(''); } }} className="flex-1 py-2.5 bg-theme-accent text-white text-[10px] font-black uppercase rounded-xl shadow-xl shadow-theme-accent/20 hover:scale-[1.02] transition-all">Save Entry</button>
              <button onClick={() => { setEditingIdx(null); setEditVal(''); }} className="px-6 py-2.5 bg-white/5 text-white/40 text-[10px] font-black uppercase rounded-xl hover:bg-white/10 transition-all">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setEditingIdx(-1); setEditVal(''); }} className="w-full py-2.5 bg-theme-accent/10 border border-theme-accent/30 rounded-xl text-[10px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2 flex items-center justify-center gap-3 shadow-lg shadow-theme-accent/5"><Plus size={14} strokeWidth={3} /> Add {title.replace(/Entries$/, '').replace(/s$/, '')}</button>
        )}
      </div>
    </CollapsibleSection>
  );
};

const CollapsibleSection: React.FC<{ 
  title: string; 
  count?: number; 
  isOpen: boolean; 
  toggle: () => void; 
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, isOpen, toggle, icon, children }) => (
  <div className={cn("rounded-3xl border px-4 pb-4 transition-all", isOpen ? "border-white/10 bg-white/[0.025] shadow-[0_20px_50px_rgba(0,0,0,0.18)]" : "border-white/6 bg-black/10")}>
    <div className="w-full flex items-center justify-between py-3 group">
      <button onClick={toggle} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center transition-all border", isOpen ? "bg-theme-accent/10 text-theme-accent border-theme-accent/20" : "bg-white/5 text-white/30 border-white/5 group-hover:bg-theme-accent/10 group-hover:text-theme-accent group-hover:border-theme-accent/20")}>
          {icon || <Database size={14} />}
        </div>
        <div className="flex flex-col">
          <span className={cn("text-[11px] font-black uppercase tracking-[0.18em] transition-colors truncate", isOpen ? "text-white" : "text-white/55 group-hover:text-white")}>{title}</span>
          {count !== undefined && (
            <span className="text-[9px] font-bold text-white/25 group-hover:text-theme-accent/60 uppercase tracking-widest">{count} {count === 1 ? 'Entry' : 'Entries'} Loaded</span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2">
        <button onClick={toggle} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all border", isOpen ? "border-theme-accent/20 bg-theme-accent/10 text-theme-accent" : "text-white/25 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10")}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
    </div>
    {isOpen && <div className="animate-apple-in pl-1 pt-1 border-t border-white/6">{children}</div>}
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
  onEdit?: () => void;
  isEditing?: boolean;
}> = ({ title, isOpen, toggle, children, onDelete, badge, isLocked, onEdit, isEditing }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <div className={cn("bg-white/[0.015] border rounded-2xl overflow-hidden group/item animate-apple-in mt-3 transition-all duration-300", isOpen ? "border-white/10 bg-white/[0.03] shadow-2xl" : "border-white/5 hover:border-white/10 hover:bg-white/[0.02]")}>
      <div className={cn("flex items-center justify-between p-4 cursor-pointer", isOpen && "bg-white/[0.02]")} onClick={toggle}>
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500", isOpen ? "bg-theme-accent text-white rotate-180 shadow-lg shadow-theme-accent/20" : "bg-white/5 text-white/20 group-hover/item:text-white/60 group-hover/item:bg-white/10")}>
            {isOpen ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn("text-[11px] font-black uppercase tracking-[0.1em] truncate transition-colors", isOpen ? "text-white" : "text-white/40 group-hover/item:text-white/80")}>
              {title || "Untitled Record"}
            </span>
            {isLocked && <div className="flex items-center gap-1.5 mt-0.5"><Link2 size={10} className="text-theme-accent animate-pulse" /><span className="text-[8px] font-black text-theme-accent/60 uppercase tracking-widest">Locked Dependency</span></div>}
          </div>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && onEdit && isOpen && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="px-4 py-2 bg-theme-accent/10 border border-theme-accent/20 rounded-xl text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all shadow-xl shadow-theme-accent/5 animate-apple-in flex items-center gap-2"
            >
              <Edit3 size={12} /> Edit Details
            </button>
          )}
          {isEditing && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              className="px-5 py-2 bg-theme-accent text-white rounded-xl text-[9px] font-black uppercase shadow-2xl shadow-theme-accent/30 animate-apple-in border border-theme-accent/50 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Save size={12} /> Save Changes
            </button>
          )}
          {onDelete && (
            <div className="flex items-center gap-2">
              {isConfirming ? (
                <div className="flex items-center gap-2 bg-status-error/15 rounded-2xl p-2 animate-apple-in border border-status-error/25 shadow-2xl">
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-status-error/80">Delete item?</span>
                  <button onClick={(e) => { e.stopPropagation(); setIsConfirming(false); onDelete(); }} className="px-4 py-1.5 bg-status-error text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-status-error/40 hover:scale-105 transition-all">Confirm Delete</button>
                  <button onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} className="opacity-0 group-hover/item:opacity-100 p-2.5 hover:bg-status-error/20 text-white/20 hover:text-status-error transition-all duration-300 rounded-xl border border-transparent hover:border-status-error/20"><Trash size={16} /></button>
              )}
            </div>
          )}
        </div>
      </div>
      {isOpen && (
        <div className={cn("p-6 border-t border-white/5 bg-black/40 transition-all duration-500", !isEditing && !isLocked && "pointer-events-none opacity-60 grayscale-[0.3] scale-[0.99] origin-top")}>
          {children}
        </div>
      )}
    </div>
  );
};

const ImagePasteField: React.FC<{
  figures: string[];
  onPaste: (figures: string[]) => void;
  label?: string;
  isLocked?: boolean;
}> = ({ figures, onPaste, label, isLocked }) => {
  const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFigure = async (file: File) => {
    try {
      const uploaded = await mediaApi.upload(file);
      onPaste([...figures, uploaded.url]);
    } catch {
      const reader = new FileReader();
      reader.onload = (evt) => {
        onPaste([...figures, evt.target?.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isLocked) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          void uploadFigure(file);
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
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all p-1">
                {confirmingIdx === idx ? (
                  <div className="flex flex-col gap-1 w-full animate-apple-in">
                    <button 
                      onClick={() => { onPaste(figures.filter((_, i) => i !== idx)); setConfirmingIdx(null); }}
                      className="py-1 bg-status-error text-white text-[7px] font-black uppercase rounded"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={() => setConfirmingIdx(null)}
                      className="py-1 bg-white/10 text-white/60 text-[7px] font-black uppercase rounded"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmingIdx(idx)}
                    className="w-8 h-8 bg-status-error/80 text-white rounded-lg flex items-center justify-center hover:bg-status-error transition-colors shadow-lg"
                  >
                    <Trash size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {!isLocked && (
          <div 
            onPaste={handlePaste}
            onClick={() => fileInputRef.current?.click()}
            tabIndex={0}
            className="flex-shrink-0 w-24 h-full border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-white/20 hover:text-white hover:border-theme-accent transition-all cursor-pointer outline-none focus:border-theme-accent bg-black/20"
          >
            <Plus size={14} />
            <span className="text-[7px] font-black uppercase mt-1">Paste</span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { void uploadFigure(file); e.currentTarget.value = ''; } }} />
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
    'Admin': 'text-sky-300 border-sky-500/25 bg-sky-500/10',
    'Technical': 'text-violet-300 border-violet-500/25 bg-violet-500/10',
    'Physical': 'text-amber-300 border-amber-500/25 bg-amber-500/10',
    'Validation': 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10',
    'System Interaction': 'text-blue-300 border-blue-500/25 bg-blue-500/10',
    'Documentation': 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10',
    'Communication': 'text-pink-300 border-pink-500/25 bg-pink-500/10',
    'Hands-on': 'text-orange-300 border-orange-500/25 bg-orange-500/10',
    'TRIGGER': 'text-cyan-400 border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]',
    'OUTCOME': 'text-rose-400 border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    'LOOP': 'text-fuchsia-300 border-fuchsia-500/25 bg-fuchsia-500/10',
  };

  const typeColor = typeColors[data.task_type] || 'text-white/40 border-white/10 bg-white/5';
  const isTrigger = data.interface === 'TRIGGER';
  const isOutcome = data.interface === 'OUTCOME';
  const isTemplate = isTrigger || isOutcome;
  const baseFontSize = data.baseFontSize || 14;
  const densityMode = data.densityMode || 'standard';
  const titleFontSize = Math.max(24, baseFontSize + 10);
  const descFontSize = Math.max(12, titleFontSize - 6);
  const nodeWidth = estimateNodeWidth(data);
  const bodyMinHeight = densityMode === 'compact' ? 300 : densityMode === 'expanded' ? 392 : 356;

  if (isTemplate) {
    return (
      <div className={cn(
        "apple-glass !bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,14,26,0.96))] !rounded-[1.5rem] px-8 py-6 shadow-2xl transition-all duration-300 group relative border-2 flex flex-col items-center justify-center min-w-[220px] h-auto hover:z-[1000]",
        selected ? 'border-theme-accent shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_38px_rgba(59,130,246,0.28)] scale-[1.02]' : (isTrigger ? "border-cyan-500/40" : "border-rose-500/40"),
        data.focusMuted && "!opacity-35 saturate-[0.7]",
      )} style={{ width: Math.max(240, Math.min(nodeWidth - 120, 340)) }}>
        {selected && <div className="absolute inset-0 rounded-[1.4rem] border border-white/12 pointer-events-none" />}
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

  const targetSystems: TaskSystem[] = data.target_systems || [];
  const visibleSystems = targetSystems.slice(0, 3);
  const hiddenSystemsCount = targetSystems.length - visibleSystems.length;

  return (
    <div className={cn(
      "apple-glass !bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(9,14,26,0.97))] !rounded-[1.7rem] px-7 py-6 shadow-2xl transition-all duration-300 relative border-2 h-auto hover:z-[1000]",
      selected ? 'border-theme-accent shadow-[0_0_0_1px_rgba(59,130,246,0.55),0_0_38px_rgba(59,130,246,0.24)] scale-[1.02]' : 'border-white/10 hover:border-white/18 hover:shadow-[0_20px_40px_rgba(0,0,0,0.32)]',
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      data.diffState === 'added' && "border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
      data.diffState === 'modified' && "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      data.diagnostics?.logic_warning && "border-fuchsia-500/60 shadow-[0_0_20px_rgba(217,70,239,0.2)]",
      data.diagnostics?.orphaned_input && "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      data.focusMuted && "!opacity-30 saturate-[0.72]"
    )} style={{ width: nodeWidth, minHeight: bodyMinHeight }}>
      {selected && <div className="absolute inset-[6px] rounded-[1.35rem] border border-white/10 pointer-events-none" />}
      <div className="absolute inset-x-0 top-0 h-16 rounded-t-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))] pointer-events-none" />
      {data.validation_needed && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] bg-orange-500 border border-orange-400 text-white z-20 shadow-lg animate-pulse">
          VALIDATION REQUIRED
        </div>
      )}
      {data.diffState === 'added' && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-500 border border-emerald-400 text-white z-20 shadow-lg">
          ADDED
        </div>
      )}
      {data.diffState === 'modified' && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] bg-amber-500 border border-amber-400 text-white z-20 shadow-lg">
          MODIFIED
        </div>
      )}
      <div className="flex flex-col gap-5 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("px-3 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.18em] border shadow-sm", typeColor)}>
            {data.task_type || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {data.occurrence > 1 && (
              <div className="flex items-center gap-1.5 bg-blue-500/85 text-white px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-lg shadow-blue-500/20">
                <RefreshCw size={13} /> {data.occurrence}
              </div>
            )}
            {data.blockerCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/85 text-white px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-lg shadow-amber-500/20">
                <AlertCircle size={13} /> {data.blockerCount}
              </div>
            )}
            {data.errorCount > 0 && (
              <div className="flex items-center gap-1.5 bg-status-error/85 text-white px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-lg shadow-status-error/20">
                <X size={13} /> {data.errorCount}
              </div>
            )}
            {data.diagnostics?.logic_warning && (
              <div className="flex items-center gap-1.5 bg-fuchsia-500/85 text-white px-3 py-1.5 rounded-2xl text-[10px] font-black shadow-lg shadow-fuchsia-500/20">
                TF Branch
              </div>
            )}
            {data.diagnostics?.orphaned_input && (
              <div className="flex items-center gap-1.5 bg-red-600/85 text-white px-3 py-1.5 rounded-2xl text-[10px] font-black shadow-lg shadow-red-500/20">
                Orphan Input
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2 relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/42">
              <span>{data.owningTeam || 'Unassigned Team'}</span>
              <span className="w-1 h-1 rounded-full bg-white/18" />
              <span>{(data.ownerPositions || [])[0] || 'No Role'}</span>
            </div>
            {data.validation_needed && <span className="text-[8px] font-black uppercase tracking-[0.22em] text-amber-400">validated path</span>}
          </div>
          <h4 
            className="font-black text-white tracking-tight leading-tight hover:text-theme-accent transition-colors line-clamp-3 cursor-help overflow-hidden group/title min-h-[3.1em]"
            style={{ fontSize: `${titleFontSize}px` }}
          >
            {data.label || "Untitled Task"}
            {!dragging && (
              <div className="absolute top-full left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-theme-accent/50 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 overflow-hidden text-left">
                 <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight text-left" style={{ fontSize: `${titleFontSize + 2}px` }}>{data.label}</p>
                 <p className="text-white/78 font-medium leading-relaxed italic text-left" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
              </div>
            )}
          </h4>
          <p className="text-[11px] font-bold text-white/60 leading-relaxed line-clamp-3 min-h-[3.9em]">{data.description || 'No description provided.'}</p>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 rounded-2xl p-4 border border-white/6 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-blue-400/40 tracking-[0.2em] mb-1">Manual</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.manual_time || 0).toFixed(0)}m</span>
            </div>
            <div className="bg-black/30 rounded-2xl p-4 border border-white/6 flex flex-col items-center justify-center">
               <span className="text-[11px] font-black uppercase text-purple-400/40 tracking-[0.2em] mb-1">Machine</span>
               <span className="text-[32px] font-black text-white leading-none">{(data.automation_time || 0).toFixed(0)}m</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-white/6">
             <div className="flex items-center gap-6 flex-1 justify-center">
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/24 uppercase tracking-[0.2em]">Input</span>
                 <span className="text-[20px] font-black text-white leading-none">{data.sourceCount || 0}</span>
               </div>
               <div className="w-px h-8 bg-white/5" />
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/24 uppercase tracking-[0.2em]">Output</span>
                 <span className="text-[20px] font-black text-white leading-none">{data.outputCount || 0}</span>
               </div>
             </div>
             <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                 <span className="text-[12px] font-black text-white/72 uppercase truncate max-w-[140px]">{(data.ownerPositions || [])[0] || 'Unassigned'}</span>
                   {(data.ownerPositions || []).length > 1 && (
                     <span className="text-[10px] font-black text-theme-accent">+{(data.ownerPositions || []).length - 1}</span>
                   )}
                </div>
                {data.owningTeam && (
                  <span className="text-[10px] font-black text-theme-accent/60 uppercase tracking-[0.18em] leading-none mt-1">{data.owningTeam}</span>
                )}
             </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-white/6 min-h-[42px]">
             {visibleSystems.map((s: TaskSystem, i: number) => (
               <span key={i} className="px-3 py-1 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] font-bold text-white/48 uppercase">{s.name}</span>
             ))}
             {hiddenSystemsCount > 0 && (
               <span className="px-3 py-1 bg-white/[0.04] border border-white/10 rounded-xl text-[11px] font-bold text-white/28 uppercase">+{hiddenSystemsCount}</span>
             )}
             {targetSystems.length === 0 && (
               <span className="text-[10px] font-black text-white/14 uppercase tracking-[0.2em]">No Systems</span>
             )}
          </div>
        </div>
      </div>

      
      <Handle type="target" position={Position.Left} id="left-target" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-left-2 !top-1/2 -translate-y-1/2 shadow-xl transition-all z-10", selected ? "!w-5 !h-5 shadow-[0_0_18px_rgba(59,130,246,0.38)]" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="source" position={Position.Left} id="left-source" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-left-2 !top-1/2 -translate-y-1/2 shadow-xl transition-all opacity-0 z-20", selected ? "!w-5 !h-5" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="target" position={Position.Right} id="right-target" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-right-2 !top-1/2 -translate-y-1/2 shadow-xl transition-all z-10", selected ? "!w-5 !h-5 shadow-[0_0_18px_rgba(59,130,246,0.38)]" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="source" position={Position.Right} id="right-source" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-right-2 !top-1/2 -translate-y-1/2 shadow-xl transition-all opacity-0 z-20", selected ? "!w-5 !h-5" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="target" position={Position.Top} id="top-target" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-top-2 !left-1/2 -translate-x-1/2 shadow-xl transition-all z-10", selected ? "!w-5 !h-5 shadow-[0_0_18px_rgba(59,130,246,0.38)]" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="source" position={Position.Top} id="top-source" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-top-2 !left-1/2 -translate-x-1/2 shadow-xl transition-all opacity-0 z-20", selected ? "!w-5 !h-5" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-bottom-2 !left-1/2 -translate-x-1/2 shadow-xl transition-all z-10", selected ? "!w-5 !h-5 shadow-[0_0_18px_rgba(59,130,246,0.38)]" : "!w-4 !h-4 hover:scale-150")} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={cn("!bg-theme-accent !border-[2px] !border-[#0f172a] !-bottom-2 !left-1/2 -translate-x-1/2 shadow-xl transition-all opacity-0 z-20", selected ? "!w-5 !h-5" : "!w-4 !h-4 hover:scale-150")} />
    </div>
  );
};

const DiamondNode = ({ data, selected, dragging }: { data: any, selected: boolean, dragging?: boolean }) => {
  const baseFontSize = data.baseFontSize || 14;
  const titleFontSize = Math.max(24, baseFontSize + 10);
  const descFontSize = Math.max(12, titleFontSize - 3);
  const branchLabels = Array.isArray(data?.decisionLabels) ? data.decisionLabels : [];
  const densityMode = data.densityMode || 'standard';
  const diamondSize = densityMode === 'compact' ? 250 : densityMode === 'expanded' ? 320 : 280;
  const innerSize = densityMode === 'compact' ? 176 : densityMode === 'expanded' ? 226 : 198;
  return (
    <div className={cn("relative flex items-center justify-center transition-all duration-300 hover:z-[1000]", selected ? 'scale-105 z-50' : 'z-10', data.focusMuted && "!opacity-30 saturate-[0.72]")} style={{ width: diamondSize, height: diamondSize }}>
      <div className={cn("absolute rotate-45 border-2 transition-all duration-300 bg-[linear-gradient(180deg,rgba(23,14,40,0.96),rgba(15,23,42,0.96))] rounded-2xl", selected ? 'border-fuchsia-400 shadow-[0_0_30px_rgba(217,70,239,0.35)]' : 'border-fuchsia-300/25', data.validation_needed ? 'shadow-[0_0_20px_rgba(249,115,22,0.28)]' : '')} style={{ width: innerSize, height: innerSize }} />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <SemanticBadge label="Decision Node" tone="decision" />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        <SemanticBadge label={branchLabels[0] || 'True'} tone="success" />
        <SemanticBadge label={branchLabels[1] || 'False'} tone="danger" />
      </div>
      
      {/* Handles at lower z-index than tooltip container */}
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !left-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !right-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !top-0 shadow-lg z-20 opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-10" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-fuchsia-400 !w-4 !h-4 !border-[2px] !border-[#0f172a] !bottom-0 shadow-lg z-20 opacity-0" />

      <div className="relative z-40 flex flex-col items-center justify-center p-8 w-full h-full pointer-events-none">
        <span 
          className="font-black text-white text-center leading-tight break-words max-w-[186px] line-clamp-3 overflow-visible cursor-help hover:text-fuchsia-300 transition-colors group/title pointer-events-auto relative tracking-tight"
          style={{ fontSize: `${titleFontSize}px` }}
        >
          {data.label || "Condition"}
          {!dragging && (
            <div className="absolute top-[85%] left-0 w-[800px] bg-[#0f172a]/95 border-t-2 border-amber-400/50 p-6 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 z-[1000] backdrop-blur-3xl pointer-events-none translate-y-4 group-hover/title:translate-y-2 border-x border-b border-white/10 text-left">
               <p className="font-black text-white uppercase mb-4 border-b border-white/10 pb-3 leading-tight tracking-tight" style={{ fontSize: `${titleFontSize - 4}px` }}>{data.label || 'Condition'}</p>
               <p className="text-white/85 font-medium leading-relaxed italic" style={{ fontSize: `${descFontSize}px` }}>{data.description || 'No description provided.'}</p>
            </div>
          )}
        </span>
      </div>
    {data.validation_needed && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120px] px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-[0.18em] bg-orange-500 border border-orange-400 text-white z-30 shadow-lg">Validation</div>
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
          stroke: data?.label === 'True' ? '#34d399' : data?.label === 'False' ? '#fb7185' : (data?.color || '#dbe4ff'),
          strokeWidth: selected ? '10px' : '6px', 
          strokeDasharray: data?.lineStyle === 'dashed' ? '15,15' : undefined, 
          filter: selected ? 'drop-shadow(0 0 10px rgba(59,130,246,0.35))' : 'drop-shadow(0 0 8px rgba(15,23,42,0.28))',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'none'
        }} 
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: 100 }} className={cn(
            "px-3 py-1.5 rounded-2xl border shadow-2xl pointer-events-none backdrop-blur-xl",
            data?.label === 'True'
              ? "bg-emerald-500/12 border-emerald-500/20"
              : data?.label === 'False'
                ? "bg-rose-500/12 border-rose-500/20"
                : "bg-[#0f172a]/95 border-white/12"
          )}>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.18em]",
              data?.label === 'True'
                ? "text-emerald-200"
                : data?.label === 'False'
                  ? "text-rose-200"
                  : "text-white/90"
            )}>{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes = { matrix: MatrixNode, diamond: DiamondNode };
const edgeTypes = { custom: CustomEdge };

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, templates = [], relatedWorkflows = [], insights, policyOverlay, rollbackPreview, runtimeConfig, onSave, onBack, onExit, onCreateRollbackDraft, setIsDirty }) => {
  const { reportBug, setIsOpen: setBuganizerOpen, reports: bugReports } = useBuganizer();
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const { project, fitView, setCenter } = useReactFlow();
  const viewport = useViewport();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'data' | 'exceptions' | 'validation' | 'appendix'>('overview');
  const [inspectorWidth, setInspectorWidth] = useState(450);
  const [baseFontSize] = useState(14);
  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<'bezier' | 'smoothstep' | 'straight'>('smoothstep');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return { inputs: false, outputs: false, manual_inputs: false, manual_outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false };
    }
    const stored = window.localStorage.getItem('pathos-builder-expanded-sections');
    return stored
      ? JSON.parse(stored)
      : { inputs: false, outputs: false, manual_inputs: false, manual_outputs: false, blockers: false, errors: false, tribal: false, references: false, assets: false, instructions: false };
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [isOutputPickerOpen, setIsOutputPickerOpen] = useState(false);
  const [isMetadataEditMode, setIsMetadataEditMode] = useState(false);
  const [ownerPositionsCollapsed, setOwnerPositionsCollapsed] = useState(true);
  const [densityMode, setDensityMode] = useState<'compact' | 'standard' | 'expanded'>(() => {
    if (typeof window === 'undefined') return 'standard';
    return (window.localStorage.getItem('pathos-builder-density') as 'compact' | 'standard' | 'expanded' | null) || 'standard';
  });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showBuilderGuide, setShowBuilderGuide] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('pathos-builder-guide-dismissed') !== 'true';
  });
  const [workspaceMode, setWorkspaceMode] = useState<'split' | 'canvas' | 'definition'>(() => {
    if (typeof window === 'undefined') return 'split';
    return (window.localStorage.getItem('pathos-builder-workspace-mode') as 'split' | 'canvas' | 'definition' | null) || 'split';
  });
  const [focusLens, setFocusLens] = useState<'all' | 'issues' | 'decisions' | 'heavy'>('all');
  const [laneMode, setLaneMode] = useState<'none' | 'taskType' | 'owner'>('taskType');
  const [alignmentGuides, setAlignmentGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [itemEditModes, setItemEditModes] = useState<Record<string, boolean>>({});
  const [tasks, setTasks] = useState<TaskEntity[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<{ nodes: Node[], edges: Edge[], tasks: TaskEntity[] }>({ nodes: [], edges: [], tasks: [] });
  const [isDeletedHistoryOpen, setIsDeletedHistoryOpen] = useState(false);
  const [clipboard, setClipboard] = useState<any>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentReplyDrafts, setCommentReplyDrafts] = useState<Record<string, string>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [tableModeOpen, setTableModeOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditDraft, setBulkEditDraft] = useState<{ owning_team: string; phase_name: string; subflow_name: string; task_type: string }>({ owning_team: '', phase_name: '', subflow_name: '', task_type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [peerSessions, setPeerSessions] = useState<Array<{ sessionId: string; label: string; updatedAt: number }>>([]);
  const [saveConflictDraft, setSaveConflictDraft] = useState<any | null>(null);
  const workspaceOptions = runtimeConfig?.organization?.workspace_options || ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'];
  const mentionOptions = runtimeConfig?.organization?.mention_directory || ['Primary Owner', 'Automation Team', 'Process SME'];
  const reviewerRoleOptions = runtimeConfig?.organization?.reviewer_role_options || ['Process SME', 'Automation Team', 'Process Owner'];
  const workflowDefaults = runtimeConfig?.workflow_defaults || {};
  const parameterKeys = runtimeConfig?.parameters?.keys || {};
  const defaultOwner = workflow?.access_control?.owner || workflow?.ownership?.owner || runtimeConfig?.current_member?.full_name || workflowDefaults?.ownership?.owner || 'system_user';
  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow?.name || '',
    version: workflow?.version || 1,
    workspace: workflow?.workspace || runtimeConfig?.organization?.default_workspace || 'Submitted Requests',
    parent_workflow_id: workflow?.parent_workflow_id || null,
    version_group: workflow?.version_group || undefined,
    version_notes: workflow?.version_notes || '',
    version_base_snapshot: workflow?.version_base_snapshot || undefined,
    description: workflow?.description || workflow?.forensic_description || '',
    prc: workflow?.prc || '',
    workflow_type: workflow?.workflow_type || '',
    org: workflow?.org || '',
    team: workflow?.team || '',
    tool_family: Array.isArray(workflow?.tool_family) ? workflow.tool_family : (workflow?.tool_family ? workflow.tool_family.split(', ') : []),
    applicable_tools: Array.isArray(workflow?.applicable_tools) ? workflow.applicable_tools : (workflow?.tool_id ? (typeof workflow.tool_id === 'string' ? workflow.tool_id.split(', ') : [workflow.tool_id]) : []),
    trigger_type: workflow?.trigger_type || '',
    trigger_description: workflow?.trigger_description || '',
    output_type: workflow?.output_type || '',
    output_description: workflow?.output_description || '',
    cadence_count: workflow?.cadence_count || 1,
    cadence_unit: workflow?.cadence_unit || 'week',
    repeatability_check: workflow?.repeatability_check ?? true,
    equipment_required: workflow?.equipment_required || false,
    equipment_state: workflow?.equipment_state || '',
    cleanroom_required: workflow?.cleanroom_required || false,
    access_control: workflow?.access_control || { ...(workflowDefaults?.access_control || { visibility: 'private', viewers: [], editors: [], mention_groups: [] }), owner: defaultOwner },
    ownership: workflow?.ownership || { ...(workflowDefaults?.ownership || { smes: [], backup_owners: [], automation_owner: '', reviewers: [] }), owner: defaultOwner },
    governance: workflow?.governance || {
      ...(workflowDefaults?.governance || { lifecycle_stage: 'Draft', review_state: workflow?.review_state || 'Draft', approval_state: workflow?.approval_state || 'Draft', required_reviewer_roles: workflow?.required_reviewer_roles || [], standards_flags: [], stale_after_days: 90, review_due_at: '', last_reviewed_at: '' }),
      review_state: workflow?.review_state || workflowDefaults?.governance?.review_state || 'Draft',
      approval_state: workflow?.approval_state || workflowDefaults?.governance?.approval_state || 'Draft',
      required_reviewer_roles: workflow?.required_reviewer_roles || workflowDefaults?.governance?.required_reviewer_roles || [],
    },
    review_requests: workflow?.review_requests || [],
    activity_timeline: workflow?.activity_timeline || [],
    notification_feed: workflow?.notification_feed || [],
    quick_capture_notes: workflow?.quick_capture_notes || '',
    template_key: workflow?.template_key || '',
    related_workflow_ids: workflow?.related_workflow_ids || [],
    standards_profile: workflow?.standards_profile || {},
    comments: workflow?.comments || [],
    analysis: workflow?.analysis,
    simulation: workflow?.simulation,
  });
  const committedSnapshotRef = useRef<any>({ current: '', current_id: '' });
  const surfacedRuntimeIssueCodes = useRef<Set<string>>(new Set());
  const activeDragNodeIdRef = useRef<string | null>(null);
  const builderSessionIdRef = useRef(`builder-${Math.random().toString(36).slice(2, 10)}`);

  const toggleItemEdit = (itemId: string) => {
    setItemEditModes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Standardize error messages - disappear after 1 second for "structural" warnings
  useEffect(() => {
    if (validationError && (validationError.includes("structural constants") || validationError.includes("Dependency Conflict"))) {
      const timer = setTimeout(() => setValidationError(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

  useEffect(() => {
    if (typeof window === 'undefined' || !workflow?.id) return;
    const storageKey = `pathos-builder-presence-${workflow.id}`;
    const sessionId = builderSessionIdRef.current;
    const label = metadata.access_control?.owner || workflow?.access_control?.owner || 'Current Editor';
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`pathos-builder-${workflow.id}`) : null;

    const syncPresence = () => {
      try {
        const now = Date.now();
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const active = (Array.isArray(parsed) ? parsed : [])
          .filter((entry: any) => entry?.updatedAt && now - Number(entry.updatedAt) < 20000)
          .filter((entry: any) => entry.sessionId !== sessionId);
        setPeerSessions(active);
      } catch {
        setPeerSessions([]);
      }
    };

    const heartbeat = () => {
      try {
        const now = Date.now();
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const active = (Array.isArray(parsed) ? parsed : []).filter((entry: any) => entry?.updatedAt && now - Number(entry.updatedAt) < 20000 && entry.sessionId !== sessionId);
        const next = [...active, { sessionId, label, updatedAt: now }];
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        channel?.postMessage({ type: 'presence-sync' });
        setPeerSessions(active);
      } catch {
        // no-op
      }
    };

    const cleanup = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        const next = (Array.isArray(parsed) ? parsed : []).filter((entry: any) => entry.sessionId !== sessionId);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        channel?.postMessage({ type: 'presence-sync' });
      } catch {
        // no-op
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) syncPresence();
    };
    const handleVisibility = () => {
      if (!document.hidden) heartbeat();
    };
    const handleMessage = () => syncPresence();

    heartbeat();
    const interval = window.setInterval(heartbeat, 7000);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    channel?.addEventListener('message', handleMessage);

    return () => {
      cleanup();
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
    };
  }, [workflow?.id, metadata.access_control?.owner, workflow?.access_control?.owner]);

  const checkOutputDependency = useCallback((outputId: string) => {
    const dependents = tasks.filter(t =>
      t.source_data_list.some(sd => sd.from_task_id === outputId)
    );
    if (dependents.length > 0) {
      const taskNames = dependents.map(t => `"${t.name || 'Untitled'}"`).join(', ');
      setValidationError(`Dependency Conflict: This output is used as an input by ${taskNames}. Remove those references first.`);
      reportBug(`Deletion Blocked: Output ${outputId} has dependents`, 'frontend', 'warning', { type: 'DEPENDENCY_LOCK' });
      return true;
    }
    return false;
  }, [tasks, reportBug]);

  const checkTaskDependencies = useCallback((taskId: string) => {
    // Find any task that uses an output from this task as an input
    const taskOutputs = tasks.find(t => t.id === taskId)?.output_data_list.map(o => o.id) || [];
    const dependents = tasks.filter(t =>
      t.source_data_list.some(sd => taskOutputs.includes(sd.from_task_id || ''))
    );

    if (dependents.length > 0) {
      const taskNames = dependents.map(t => `"${t.name || 'Untitled'}"`).join(', ');
      setValidationError(`Critical Dependency: Other tasks (${taskNames}) depend on this task's data. Clear those inputs first.`);
      reportBug(`Task Deletion Blocked: ${taskId} is a data source`, 'frontend', 'warning', { type: 'TASK_DEPENDENCY' });
      return true;
    }
    return false;
  }, [tasks, reportBug]);

  useEffect(() => {
    settingsApi.listParameters().then(setSystemParams).catch(() => {});
  }, []);

  const toggleSection = (section: string) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const toggleItem = (itemId: string) => { setOpenItems(prev => ({ ...prev, [itemId]: !prev[itemId] })); };

  const lastHistorySnapshot = useRef<string>('');
  const currentSnapshot = useMemo(() => JSON.stringify({ nodes, edges, tasks, metadata }), [nodes, edges, tasks, metadata]);

  const saveToHistory = useCallback(() => {
    const currentState = { 
      nodes: nodes, 
      edges: edges, 
      tasks: tasks, 
      metadata: metadata 
    };
    
    const stateString = JSON.stringify(currentState);
    if (stateString === lastHistorySnapshot.current) return;
    
    lastHistorySnapshot.current = stateString;
    setHistory(prev => {
      return [...prev.slice(-49), JSON.parse(stateString)];
    });
    setRedoStack([]);
  }, [nodes, edges, tasks, metadata]);

  const syncDirtyState = useCallback((nextSnapshot: string) => {
    setIsDirty?.(nextSnapshot !== committedSnapshotRef.current.current);
  }, [setIsDirty]);
  const calculateAlignmentGuide = useCallback((movingNode: Node) => {
    const threshold = 24;
    let nearestX: number | null = null;
    let nearestY: number | null = null;
    let deltaX = Number.POSITIVE_INFINITY;
    let deltaY = Number.POSITIVE_INFINITY;
    nodes.forEach(node => {
      if (node.id === movingNode.id) return;
      const xDiff = Math.abs(node.position.x - movingNode.position.x);
      const yDiff = Math.abs(node.position.y - movingNode.position.y);
      if (xDiff < threshold && xDiff < deltaX) {
        nearestX = node.position.x;
        deltaX = xDiff;
      }
      if (yDiff < threshold && yDiff < deltaY) {
        nearestY = node.position.y;
        deltaY = yDiff;
      }
    });
    return { x: nearestX, y: nearestY };
  }, [nodes]);
  const snapNodePosition = useCallback((movingNode: Node) => {
    const guide = calculateAlignmentGuide(movingNode);
    return {
      x: guide.x ?? movingNode.position.x,
      y: guide.y ?? movingNode.position.y,
    };
  }, [calculateAlignmentGuide]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const structuralRemovals = changes.filter(c => {
        if (c.type !== 'remove') return false;
        const node = nodes.find(n => n.id === c.id);
        return node?.data?.interface === 'TRIGGER' || node?.data?.interface === 'OUTCOME';
      });

      if (structuralRemovals.length > 0) {
        setValidationError("Trigger and Outcome entities are structural constants and cannot be deleted.");
        // If structural nodes are selected for removal, block all removals in this turn to ensure edge consistency
        return;
      }

      const mutatingChanges = changes.filter(c => c.type !== 'select');
      const hasNonPositionMutation = mutatingChanges.some(c => c.type !== 'position');
      if (hasNonPositionMutation) {
        saveToHistory();
      }

      const filteredChanges = changes.filter(c => {
        if (c.type === 'remove') {
          if (checkTaskDependencies(c.id)) {
            return false;
          }
        }
        return true;
      });

      const removedIds = filteredChanges.filter(c => c.type === 'remove').map(c => c.id);
      if (removedIds.length > 0 && selectedTaskId && removedIds.includes(selectedTaskId)) {
        setSelectedTaskId(null);
      }

      setNodes((nds) => applyNodeChanges(filteredChanges, nds));
      if (mutatingChanges.length > 0) {
        setIsDirty?.(true);
      }
    },
    [setNodes, nodes, tasks, checkTaskDependencies, saveToHistory, selectedTaskId, setIsDirty]
  );

  const onEdgesChange = useCallback(
    (changes: any[]) => {
      const mutatingChanges = changes.filter(c => c.type !== 'select');      if (mutatingChanges.length > 0) {
        saveToHistory();
      }

      const filteredChanges = changes.filter(c => {
        if (c.type === 'remove') {
          const edge = edges.find(e => e.id === c.id);
          if (edge) {
            setDeletedHistory(prev => ({ ...prev, edges: [...prev.edges, edge] }));
          }
        }
        return true;
      });

      const removedIds = filteredChanges.filter(c => c.type === 'remove').map(c => c.id);
      if (removedIds.length > 0 && selectedEdgeId && removedIds.includes(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }

      setEdges((eds) => applyEdgeChanges(filteredChanges, eds));
      if (mutatingChanges.length > 0) {
        setIsDirty?.(true);
      }
    },
    [saveToHistory, selectedEdgeId, setEdges, setIsDirty, edges]
  );

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
      const target = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(current => !current);
        return;
      }
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedTaskId) {
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task && !task.interface) {
          setClipboard({ 
            task: JSON.parse(JSON.stringify(task)), 
            node: JSON.parse(JSON.stringify(nodes.find(n => n.id === selectedTaskId))) 
          });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard) {
        e.preventDefault();
        saveToHistory();
        const id = `node-${Date.now()}`;
        const newNode = { 
          ...clipboard.node, 
          id, 
          position: { x: (clipboard.node.position?.x || 0) + 40, y: (clipboard.node.position?.y || 0) + 40 }, 
          selected: true,
          data: { ...clipboard.node.data, id, node_id: id }
        };
        const newTask = cloneTaskEntity(clipboard.task, id);
        setTasks(prev => [...prev, newTask]);
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNode));
        setSelectedTaskId(id);
        setIsDirty?.(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedTaskId, tasks, nodes, clipboard, saveToHistory, setIsDirty]);

  useEffect(() => {
    // Wrap in setTimeout to avoid synchronous setState during effect which triggers lint error
    const timer = setTimeout(() => {
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
    }, 0);
    return () => clearTimeout(timer);
  }, [metadata.trigger_type, metadata.trigger_description, metadata.output_type, metadata.output_description, setTasks, setNodes]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = useMemo(() => {
    if (!selectedTask) return false;
    const nodeId = String(selectedTask.id);
    const rawInterface = selectedTask.interface || selectedTask.interface_type || selectedTask.task_type || '';
    const taskInterface = String(rawInterface).toUpperCase();
    return taskInterface === 'TRIGGER' || taskInterface === 'OUTCOME' || nodeId === 'node-trigger' || nodeId === 'node-outcome' || nodeId.toLowerCase().includes('trigger') || nodeId.toLowerCase().includes('outcome');
  }, [selectedTask]);
  useEffect(() => {
    if (!selectedTask) return;
    if (selectedTask.task_type === 'LOOP') {
      setInspectorTab('overview');
      setExpandedSections(prev => ({ ...prev, errors: true, blockers: true }));
      return;
    }
    if (selectedTask.interface === 'TRIGGER') {
      setInspectorTab('overview');
      setExpandedSections(prev => ({ ...prev, inputs: true }));
      return;
    }
    if (selectedTask.interface === 'OUTCOME') {
      setInspectorTab('overview');
      setExpandedSections(prev => ({ ...prev, outputs: true, validation: true }));
      return;
    }
    if (selectedTask.source_data_list?.length || selectedTask.output_data_list?.length) {
      setExpandedSections(prev => ({ ...prev, inputs: true, outputs: true }));
    }
  }, [selectedTask]);
  const localWorkflowState = useMemo(() => buildLocalAnalysis(tasks, edges, metadata), [tasks, edges, metadata]);
  const workflowAnalysis = localWorkflowState.analysis;
  const workflowSimulation = localWorkflowState.simulation;
  const runtimeAudit = useMemo(
    () => validateBuilderRuntimeState({ nodes, edges, tasks, selectedTaskId, selectedEdgeId }),
    [nodes, edges, tasks, selectedTaskId, selectedEdgeId]
  );
  const issueItems = useMemo(() => {
    const items: Array<{ id: string; label: string; detail: string; severity: 'error' | 'warning'; target?: string | null; kind: 'metadata' | 'task' }> = [];
    if (tasks.length === 0 || nodes.length === 0 || isSaving) return items;
    const seenTaskIssues = new Set<string>();
    const pushTaskIssue = (nodeId: string, label: string, detail: string, severity: 'error' | 'warning') => {
      const key = `${nodeId}:${label}`;
      if (seenTaskIssues.has(key)) return;
      seenTaskIssues.add(key);
      items.push({ id: key, label, detail, severity, target: nodeId, kind: 'task' });
    };
    if (!metadata.name || metadata.name.length < 2) items.push({ id: 'meta-name', label: 'Workflow Name', detail: 'Workflow definition needs a longer name.', severity: 'error', kind: 'metadata' });
    if (!metadata.description) items.push({ id: 'meta-description', label: 'Workflow Description', detail: 'Add a concise workflow description for repository clarity.', severity: 'error', kind: 'metadata' });
    if (!metadata.prc) items.push({ id: 'meta-prc', label: 'PRC Missing', detail: 'Assign a PRC so the workflow is traceable and sortable.', severity: 'warning', kind: 'metadata' });
    if (!metadata.workflow_type) items.push({ id: 'meta-type', label: 'Type Missing', detail: 'Select a workflow type to keep repository taxonomy consistent.', severity: 'warning', kind: 'metadata' });
    if (workflowAnalysis.has_cycle) items.push({ id: 'cycle', label: 'Routing Cycle', detail: 'The graph contains a cycle that blocks save.', severity: 'error', target: workflowAnalysis.cycle_nodes[0] || null, kind: 'task' });
    workflowAnalysis.malformed_logic_nodes.forEach(nodeId => pushTaskIssue(nodeId, 'Decision Logic', 'Decision node must expose exactly two True / False branches.', 'error'));
    workflowAnalysis.unreachable_nodes.forEach(nodeId => pushTaskIssue(nodeId, 'Unreachable Task', 'This task is not reachable from the workflow trigger.', 'error'));
    workflowAnalysis.disconnected_nodes.forEach(nodeId => pushTaskIssue(nodeId, 'Disconnected Task', 'This task is not fully connected between trigger and outcome.', 'error'));
    workflowAnalysis.orphaned_inputs.forEach(nodeId => pushTaskIssue(nodeId, 'Orphaned Input', 'This task references removed upstream data.', 'warning'));
    tasks.forEach(task => {
      if (!task.name?.trim()) pushTaskIssue(task.id, 'Task Title', 'A task is missing its operational title.', 'error');
      if (!task.description?.trim()) pushTaskIssue(task.id, 'Task Description', 'A task is missing contextual description.', 'error');
    });
    runtimeAudit.issues.forEach(issue => {
      const key = `runtime:${issue.code}:${issue.targetId || ''}`;
      if (seenTaskIssues.has(key)) return;
      seenTaskIssues.add(key);
      items.push({
        id: key,
        label: issue.code.replace('runtime.', '').replaceAll('_', ' '),
        detail: issue.message,
        severity: issue.severity,
        target: issue.targetId || null,
        kind: issue.targetId ? 'task' : 'metadata',
      });
    });
    return items;
  }, [metadata, tasks, workflowAnalysis, runtimeAudit]);
  const saveState = useMemo<'clean' | 'dirty' | 'saving' | 'blocked'>(() => {
    if (isSaving) return 'saving';
    if (issueItems.some(issue => issue.severity === 'error')) return 'blocked';
    return currentSnapshot === committedSnapshotRef.current.current ? 'clean' : 'dirty';
  }, [isSaving, issueItems, currentSnapshot]);
  const focusLensStats = useMemo(() => ({
    issues: issueItems.filter(issue => issue.kind === 'task').length,
    decisions: tasks.filter(task => task.task_type === 'LOOP').length,
    heavy: tasks.filter(task => ((task.manual_time_minutes || 0) + (task.automation_time_minutes || 0)) >= 20).length,
  }), [issueItems, tasks]);
  const isLargeWorkflow = useMemo(() => nodes.length >= 28 || edges.length >= 42, [nodes.length, edges.length]);
  const laneGroups = useMemo(() => {
    if (laneMode === 'none') return [] as Array<{ key: string; label: string; nodes: Node[]; bounds: { x: number; y: number; width: number; height: number } }>;
    const buckets = new Map<string, Node[]>();
    nodes.forEach(node => {
      const rawLabel = node.data?.interface || node.data?.task_type || 'General';
      const nodeId = String(node.id);
      const isTrigger = String(rawLabel).toUpperCase() === 'TRIGGER' || nodeId === 'node-trigger';
      const isOutcome = String(rawLabel).toUpperCase() === 'OUTCOME' || nodeId === 'node-outcome';
      const label = laneMode === 'owner'
        ? String(node.data?.owningTeam || 'Unassigned')
        : (isTrigger ? 'TRIGGER' : (isOutcome ? 'OUTCOME' : String(rawLabel)));
      const bucket = buckets.get(label) || [];
      bucket.push(node);
      buckets.set(label, bucket);
    });
    return Array.from(buckets.entries()).map(([key, bucket]) => {
      const positions = bucket.map(node => {
        const dims = getNodeDimensions(node);
        return {
          x: node.position.x,
          y: node.position.y,
          width: dims.width,
          height: dims.height,
        };
      });
      const minX = Math.min(...positions.map(pos => pos.x));
      const minY = Math.min(...positions.map(pos => pos.y));
      const maxX = Math.max(...positions.map(pos => pos.x + pos.width));
      const maxY = Math.max(...positions.map(pos => pos.y + pos.height));
      return {
        key,
        label: key,
        nodes: bucket,
        bounds: {
          x: minX - 32,
          y: minY - 40,
          width: maxX - minX + 64,
          height: maxY - minY + 80,
        }
      };
    });
  }, [laneMode, nodes]);

  useEffect(() => {
    syncDirtyState(currentSnapshot);
  }, [currentSnapshot, syncDirtyState]);

  useEffect(() => {
    if (tasks.length === 0 || nodes.length === 0) return;

    if (runtimeAudit.repairs.clearSelectedTask) {
      setSelectedTaskId(null);
    }
    if (runtimeAudit.repairs.clearSelectedEdge) {
      setSelectedEdgeId(null);
    }

    const activeCodes = new Set(runtimeAudit.issues.map(issue => `${issue.code}:${issue.targetId || ''}`));
    surfacedRuntimeIssueCodes.current.forEach(code => {
      if (!activeCodes.has(code)) surfacedRuntimeIssueCodes.current.delete(code);
    });

    runtimeAudit.issues
      .filter(issue => issue.severity === 'error')
      .forEach(issue => {
        const issueKey = `${issue.code}:${issue.targetId || ''}`;
        if (surfacedRuntimeIssueCodes.current.has(issueKey)) return;
        surfacedRuntimeIssueCodes.current.add(issueKey);
        reportBug(issue.message, 'frontend', 'error', {
          type: issue.code,
          payload: { targetId: issue.targetId || null },
        });
      });

    const hasRuntimeErrors = runtimeAudit.issues.some(issue => issue.severity === 'error');
    if (hasRuntimeErrors && !validationError?.includes('Runtime Integrity')) {
      setValidationError('Runtime Integrity Warning: Builder state is inconsistent. Review the issue rail before continuing.');
    } else if (!hasRuntimeErrors && validationError?.includes('Runtime Integrity')) {
      setValidationError(null);
    }
  }, [runtimeAudit, reportBug, validationError, tasks.length, nodes.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pathos-builder-expanded-sections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pathos-builder-density', densityMode);
  }, [densityMode]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pathos-builder-workspace-mode', workspaceMode);
  }, [workspaceMode]);
  useEffect(() => {
    if (workspaceMode === 'canvas') {
      setInspectorWidth(380);
    } else if (workspaceMode === 'definition') {
      setInspectorWidth(560);
      setSelectedTaskId(null);
      setSelectedEdgeId(null);
      setIsMetadataEditMode(true);
    }
  }, [workspaceMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pathos-builder-guide-dismissed', showBuilderGuide ? 'false' : 'true');
  }, [showBuilderGuide]);
  const scopedComments = useMemo(
    () => metadata.comments.filter(comment => (selectedTaskId ? comment.scope === 'task' && comment.scope_id === selectedTaskId : comment.scope === 'workflow')),
    [metadata.comments, selectedTaskId]
  );
  const decisionEdges = useMemo(
    () => selectedTaskId ? edges.filter(edge => String(edge.source) === String(selectedTaskId)) : [],
    [edges, selectedTaskId]
  );
  const selectedTaskDiagnostics = useMemo(
    () => (selectedTaskId ? (workflowAnalysis.diagnostics?.[String(selectedTaskId)] || {}) : {}),
    [selectedTaskId, workflowAnalysis.diagnostics]
  );

  const taskTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === 'TASK_TYPE');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];
  }, [systemParams]);

  const hardwareFamilies = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.hardware_family || 'HARDWARE_FAMILY'));
    if (param) {
      return ((param.is_dynamic ? param.cached_values : param.manual_values) || []).map((f: any) => typeof f === 'string' ? f : f.label);
    }
    return taxonomy.filter((t: any) => t.category === 'ToolType').map((t: any) => t.label);
  }, [systemParams, taxonomy]);

  const toolIds = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.tool_id || 'TOOL_ID'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const prcValues = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.prc || 'PRC'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const workflowTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.workflow_type || 'WORKFLOW_TYPE'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const triggerTypes = taxonomy.filter((t: any) => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter((t: any) => t.category === 'OutputType');

  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const diagnostics = workflowAnalysis.diagnostics?.[node.id] || {};
      const decisionLabels = edges
        .filter(edge => String(edge.source) === String(node.id))
        .map(edge => String(edge.data?.label || '').trim())
        .filter(Boolean);
      const diffState =
        workflowAnalysis.diff_summary.added_nodes.includes(node.id) ? 'added' :
        workflowAnalysis.diff_summary.modified_nodes.includes(node.id) ? 'modified' :
        workflowAnalysis.diff_summary.removed_nodes.includes(node.id) ? 'removed' :
        'unchanged';
      return {
        ...node,
        data: {
          ...node.data,
          diagnostics,
          decisionLabels,
          diffState,
        }
      };
    }));
  }, [workflowAnalysis, edges, setNodes]);

  useEffect(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        densityMode,
      }
    })));
  }, [densityMode, setNodes]);
  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const diagnostics = workflowAnalysis.diagnostics?.[node.id] || {};
      const totalDuration = Number(node.data?.manual_time || 0) + Number(node.data?.automation_time || 0);
      const isDecision = node.data?.task_type === 'LOOP';
      const hasIssue = diagnostics.unreachable || diagnostics.disconnected || diagnostics.logic_warning || diagnostics.orphaned_input;
      const keepVisible =
        focusLens === 'all' ||
        (focusLens === 'issues' && hasIssue) ||
        (focusLens === 'decisions' && isDecision) ||
        (focusLens === 'heavy' && totalDuration >= 20);
      return {
        ...node,
        data: {
          ...node.data,
          focusMuted: !keepVisible,
        }
      };
    }));
  }, [focusLens, setNodes, workflowAnalysis]);

  const handleLayout = useCallback((
    nodesToLayout?: Node[],
    edgesToLayout?: Edge[],
    options?: {
      markDirty?: boolean;
      commitLayout?: boolean;
      snapshotTasks?: TaskEntity[];
      snapshotMetadata?: WorkflowMetadata;
    }
  ) => {
    try {
      const nds = nodesToLayout || nodes;
      const eds = edgesToLayout || edges;
      const markDirty = options?.markDirty ?? true;
      const commitLayout = options?.commitLayout ?? false;
      const snapshotTasks = options?.snapshotTasks || tasks;
      const snapshotMetadata = options?.snapshotMetadata || metadata;
      if (!nds || nds.length === 0) return;

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'LR', ranker: 'network-simplex', ranksep: 200, nodesep: 100, edgesep: 50 });

      nds.forEach((n) => {
        const { width, height } = getNodeDimensions(n);
        dagreGraph.setNode(n.id, { width, height });
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
        const { width, height } = getNodeDimensions(n);
        
        return {
          ...n,
          position: {
            x: Math.round((nodeWithPos.x - width / 2) / 10) * 10,
            y: Math.round((nodeWithPos.y - height / 2) / 10) * 10
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
      if (commitLayout) {
        committedSnapshotRef.current.current = JSON.stringify({
          nodes: layoutedNodes,
          edges: layoutedEdges,
          tasks: snapshotTasks,
          metadata: snapshotMetadata,
        });
      }
      if (markDirty) {
        setIsDirty?.(true);
      } else {
        syncDirtyState(JSON.stringify({ nodes: layoutedNodes, edges: layoutedEdges, tasks: snapshotTasks, metadata: snapshotMetadata }));
      }
      window.requestAnimationFrame(() => fitView({ padding: 0.1, duration: 800 }));
    } catch (error) {
      console.error("Dagre Layout Error:", error);
    }
  }, [fitView, setNodes, setEdges, setIsDirty, defaultEdgeStyle, nodes, edges, tasks, metadata, syncDirtyState]);

  // Ensure fitView on initial load
  const initialFitPerformed = useRef(false);
  const lastInitializedWorkflowSignature = useRef<string | null>(null);

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
    const workflowSignature = `${workflow.id}:${workflow.updated_at || ''}:${workflow.version || ''}`;
    if (lastInitializedWorkflowSignature.current === workflowSignature) return;
    let hydrationTimer: ReturnType<typeof setTimeout> | null = null;
    let layoutTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      lastInitializedWorkflowSignature.current = workflowSignature;
      const seenNodeIds = new Set<string>();
      
      // Update metadata state when workflow changes
      const initialMetadata = {
        name: workflow?.name || '',
        version: workflow?.version || 1,
        workspace: workflow?.workspace || runtimeConfig?.organization?.default_workspace || 'Submitted Requests',
        parent_workflow_id: workflow?.parent_workflow_id || null,
        version_group: workflow?.version_group || undefined,
        version_notes: workflow?.version_notes || '',
        version_base_snapshot: workflow?.version_base_snapshot || undefined,
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
        repeatability_check: workflow?.repeatability_check ?? true,
        equipment_required: workflow?.equipment_required || false,
        equipment_state: workflow?.equipment_state || '',
        cleanroom_required: workflow?.cleanroom_required || false,
        access_control: workflow?.access_control || { ...(workflowDefaults?.access_control || { visibility: 'private', viewers: [], editors: [], mention_groups: [] }), owner: defaultOwner },
        ownership: workflow?.ownership || { ...(workflowDefaults?.ownership || { smes: [], backup_owners: [], automation_owner: '', reviewers: [] }), owner: defaultOwner },
        governance: workflow?.governance || {
          ...(workflowDefaults?.governance || { lifecycle_stage: 'Draft', review_state: workflow?.review_state || 'Draft', approval_state: workflow?.approval_state || 'Draft', required_reviewer_roles: workflow?.required_reviewer_roles || [], standards_flags: [], stale_after_days: 90, review_due_at: '', last_reviewed_at: '' }),
          review_state: workflow?.review_state || workflowDefaults?.governance?.review_state || 'Draft',
          approval_state: workflow?.approval_state || workflowDefaults?.governance?.approval_state || 'Draft',
          required_reviewer_roles: workflow?.required_reviewer_roles || workflowDefaults?.governance?.required_reviewer_roles || [],
        },
        review_requests: workflow?.review_requests || [],
        notification_feed: workflow?.notification_feed || [],
        activity_timeline: workflow?.activity_timeline || [],
        quick_capture_notes: workflow?.quick_capture_notes || '',
        template_key: workflow?.template_key || '',
        related_workflow_ids: workflow?.related_workflow_ids || [],
        standards_profile: workflow?.standards_profile || {},
        comments: workflow?.comments || [],
        analysis: workflow?.analysis,
        simulation: workflow?.simulation,
      };

      const initializedTasks = (workflow?.tasks || []).map((t: any) => {
        let stableId = t.node_id ? String(t.node_id) : String(t.id);
        if (!stableId || stableId === 'undefined' || stableId === 'null') {
          stableId = `node-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Robust interface detection
        const rawInterface = t.interface || t.interface_type || t.task_type || '';
        const stableId = t.node_id ? String(t.node_id) : String(t.id);
        const taskInterface = String(rawInterface).toUpperCase();
        const isTrigger = taskInterface === 'TRIGGER' || stableId === 'node-trigger' || stableId.toLowerCase().includes('trigger');
        const isOutcome = taskInterface === 'OUTCOME' || stableId === 'node-outcome' || stableId.toLowerCase().includes('outcome');

        let finalStableId = stableId;
        if (isTrigger) finalStableId = 'node-trigger';
        if (isOutcome) finalStableId = 'node-outcome';
        
        if (seenNodeIds.has(finalStableId)) {
          finalStableId = `${finalStableId}-dup-${Math.random().toString(36).substr(2, 5)}`;
        }
        seenNodeIds.add(finalStableId);
        
        return {
          ...t,
          id: finalStableId,
          node_id: finalStableId,
          interface: isTrigger ? 'TRIGGER' : (isOutcome ? 'OUTCOME' : t.interface),
          task_type: isTrigger ? 'TRIGGER' : (isOutcome ? 'OUTCOME' : (t.task_type || 'System Interaction')),
          target_systems: Array.isArray(t.target_systems) ? t.target_systems : [],
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
          phase_name: t.phase_name || '',
          subflow_name: t.subflow_name || '',
          task_block_key: t.task_block_key || '',
          decision_details: t.decision_details || {},
        };
      });

      const trigger = initializedTasks.find((t: any) => t.interface === 'TRIGGER' || t.id === 'node-trigger');
      if (!trigger) {
        initializedTasks.unshift({
          id: 'node-trigger', node_id: 'node-trigger', name: initialMetadata.trigger_type || 'START', description: initialMetadata.trigger_description || '', task_type: 'TRIGGER', interface: 'TRIGGER', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: [], manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, validation_procedure_steps: []
        });
      }

      const outcome = initializedTasks.find((t: any) => t.interface === 'OUTCOME' || t.id === 'node-outcome');
      if (!outcome) {
        initializedTasks.push({
          id: 'node-outcome', node_id: 'node-outcome', name: initialMetadata.output_type || 'END', description: initialMetadata.output_description || '', task_type: 'OUTCOME', interface: 'OUTCOME', occurrence: 1, blockers: [], errors: [], media: [], reference_links: [], instructions: [], source_data_list: [], output_data_list: [], tribal_knowledge: [], manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, validation_procedure_steps: []
        });
      }

      const initialNodes: Node[] = initializedTasks.map((t: any) => ({
        id: String(t.node_id),
        type: t.task_type === 'LOOP' ? 'diamond' : 'matrix',
        position: { x: t.position_x ?? 0, y: t.position_y ?? 0 },
        data: {
          ...t, label: t.name, task_type: t.task_type || 'GENERAL', manual_time: t.manual_time_minutes || 0, automation_time: t.automation_time_minutes || 0, occurrence: t.occurrence || 1, target_systems: t.target_systems, owningTeam: t.owning_team, ownerPositions: t.owner_positions, sourceCount: (t.source_data_list || []).length, outputCount: (t.output_data_list || []).length, interface: t.interface, validation_needed: t.validation_needed, blockerCount: (t.blockers || []).length, errorCount: (t.errors || []).length, description: t.description || '', id: String(t.node_id), baseFontSize: 14
        },
      }));

      // Create a mapping from old IDs to new stable IDs for edges
      const taskIdMap = new Map<string, string>();
      (workflow?.tasks || []).forEach((t: any) => {
        const oldId = String(t.node_id || t.id);
        const taskInterface = String(t.interface || t.interface_type || t.task_type || '').toUpperCase();
        if (taskInterface === 'TRIGGER') taskIdMap.set(oldId, 'node-trigger');
        else if (taskInterface === 'OUTCOME') taskIdMap.set(oldId, 'node-outcome');
        else taskIdMap.set(oldId, oldId);
      });

      const initialEdges: Edge[] = (workflow?.edges || []).map((e: any, idx: number) => {
        const originalSourceId = String(e.source || '');
        const originalTargetId = String(e.target || '');
        
        const sourceId = taskIdMap.get(originalSourceId) || originalSourceId;
        const targetId = taskIdMap.get(originalTargetId) || originalTargetId;
        
        if (!sourceId || !targetId) return null;
        const sourceExists = initializedTasks.some((t: any) => String(t.node_id) === sourceId);
        const targetExists = initializedTasks.some((t: any) => String(t.node_id) === targetId);
        
        if (!sourceExists || !targetExists) return null;
        return {
          id: String(e.id || `e-${sourceId}-${targetId}-${idx}`), source: sourceId, target: targetId, sourceHandle: e.source_handle || e.sourceHandle || 'right-source', targetHandle: e.target_handle || e.targetHandle || 'left-target', type: 'custom', data: { label: e.label || '', edgeStyle: e.edge_style || e.edgeStyle || defaultEdgeStyle, color: e.color || '#ffffff', lineStyle: e.line_style || e.style || 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: e.color || '#ffffff' },
        };
      }).filter(Boolean) as Edge[];

      // Wrap in setTimeout to avoid synchronous setState during effect which triggers lint error
      hydrationTimer = setTimeout(() => {
        if (tasks.length > 0 && String(workflow?.id) === committedSnapshotRef.current.current_id) {
          return;
        }

        // If this is an existing workflow (has id) but no base snapshot, create one from current state
        // to ensure it doesn't show 'added' flags for existing data.
        if (workflow.id && !initialMetadata.version_base_snapshot) {
          initialMetadata.version_base_snapshot = {
            tasks: initializedTasks.map((t: any) => ({
              id: t.id,
              node_id: t.node_id,
              name: t.name,
              description: t.description,
              task_type: t.task_type,
              occurrence: t.occurrence,
              output_data_list: t.output_data_list,
              source_data_list: t.source_data_list,
            })),
            edges: initialEdges.map(e => ({
              source: e.source,
              target: e.target,
              label: e.data?.label,
            }))
          };
        }
        
        setMetadata(initialMetadata);
        setTasks(initializedTasks);
        setNodes(initialNodes);
        setEdges(initialEdges);
        committedSnapshotRef.current = {
          current_id: String(workflow?.id),
          current: JSON.stringify({ nodes: initialNodes, edges: initialEdges, tasks: initializedTasks, metadata: initialMetadata })
        };
      }, 0);
      
      if (initializedTasks.every((t: any) => !t.position_x && !t.position_y)) {
        layoutTimer = setTimeout(() => handleLayout(initialNodes, initialEdges, {
          markDirty: false,
          commitLayout: true,
          snapshotTasks: initializedTasks,
          snapshotMetadata: initialMetadata,
        }), 100);
      }
    } catch (err) {
      console.error("[WorkflowBuilder] Critical Initialization Failure:", err);
    }
    return () => {
      if (hydrationTimer) clearTimeout(hydrationTimer);
      if (layoutTimer) clearTimeout(layoutTimer);
    };
  }, [workflow, defaultEdgeStyle, handleLayout, setNodes, setEdges]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      return newTasks;
    });

    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        return {
          ...n,
          data: {
            ...n.data,
            ...(updates.name !== undefined && { label: updates.name }),
            ...(updates.task_type !== undefined && { task_type: updates.task_type }),
            ...(updates.manual_time_minutes !== undefined && { manual_time: updates.manual_time_minutes }),
            ...(updates.automation_time_minutes !== undefined && { automation_time: updates.automation_time_minutes }),
            ...(updates.occurrence !== undefined && { occurrence: updates.occurrence }),
            ...(updates.target_systems !== undefined && { target_systems: updates.target_systems }),
            ...(updates.owning_team !== undefined && { owningTeam: updates.owning_team }),
            ...(updates.owner_positions !== undefined && { ownerPositions: updates.owner_positions }),
            ...(updates.source_data_list !== undefined && { sourceCount: (updates.source_data_list || []).length }),
            ...(updates.output_data_list !== undefined && { outputCount: (updates.output_data_list || []).length }),
            ...(updates.validation_needed !== undefined && { validation_needed: updates.validation_needed }),
            ...(updates.blockers !== undefined && { blockerCount: (updates.blockers || []).length }),
            ...(updates.errors !== undefined && { errorCount: (updates.errors || []).length }),
            ...(updates.description !== undefined && { description: updates.description })
          }
        };
      }
      return n;
    }));
    setIsDirty?.(true);
  };

  const updateEdge = (id: string, updates: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates }, markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } } : e));
    setIsDirty?.(true);
  };

  const attachMediaAsset = useCallback(async (taskId: string, file: File) => {
    try {
      saveToHistory();
      const uploaded = await mediaApi.upload(file);
      const asset: TaskMedia = {
        id: uploaded.id || createLocalId('media'),
        type: uploaded.type === 'document' ? 'doc' : (uploaded.type || (file.type.startsWith('image/') ? 'image' : 'doc')),
        url: uploaded.url,
        label: uploaded.label || file.name,
        file_name: uploaded.file_name || file.name,
        mime_type: uploaded.mime_type || file.type,
        uploaded_at: uploaded.uploaded_at || new Date().toISOString(),
      };
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, media: [...(task.media || []), asset] } : task));
      setNodes(prev => prev.map(node => node.id === taskId ? { ...node, data: { ...node.data, media: [...(node.data?.media || []), asset] } } : node));
      setIsDirty?.(true);
    } catch (error) {
      reportBug('Media upload failed during asset attach.', 'frontend', 'warning', {
        type: 'MEDIA_UPLOAD_FAILURE',
        payload: { message: error instanceof Error ? error.message : 'Unknown upload failure' },
      });
      setValidationError('Media upload failed. Retry with a smaller image or supported document.');
    }
  }, [reportBug, saveToHistory, setNodes, setIsDirty]);

  const dedupeEdges = useCallback((edgeList: Edge[]) => {
    const seen = new Set<string>();
    return edgeList.filter(edge => {
      const key = [edge.source, edge.target, edge.sourceHandle || '', edge.targetHandle || ''].join('|');
      if (edge.source === edge.target || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, []);

  const removeTaskIds = useCallback((ids: string[]) => {
    const removableIds = ids.filter(id => {
      const task = tasks.find(t => t.id === id);
      if (!task || task.interface) return false;
      return !checkTaskDependencies(id);
    });

    if (removableIds.length === 0) {
      setConfirmingDelete(null);
      return;
    }

    saveToHistory();

    const deletedTasks = tasks.filter(task => removableIds.includes(task.id));
    const deletedNodes = nodes.filter(node => removableIds.includes(node.id));
    const deletedEdges = edges.filter(edge =>
      removableIds.includes(String(edge.source)) || removableIds.includes(String(edge.target))
    );
    if (deletedTasks.length > 0 || deletedNodes.length > 0 || deletedEdges.length > 0) {
      setDeletedHistory(prev => ({
        ...prev,
        tasks: [...prev.tasks, ...deletedTasks],
        nodes: [...prev.nodes, ...deletedNodes],
        edges: [...prev.edges, ...deletedEdges]
      }));
    }

    const removedOutputIds = new Set(
      deletedTasks.flatMap(task => (task.output_data_list || []).map(output => String(output.id)))
    );

    setTasks(prev => prev
      .filter(task => !removableIds.includes(task.id))
      .map(task => ({
        ...task,
        source_data_list: (task.source_data_list || []).map(source =>
          source.from_task_id && removedOutputIds.has(String(source.from_task_id))
            ? {
                ...source,
                orphaned_input: true,
                from_task_name: `${source.from_task_name || 'Source'} (Removed)`
              }
            : source
        )
      })));

    setNodes(prev => prev.filter(node => !removableIds.includes(node.id)));
    let nextEdgesAfterRemoval: Edge[] = edges;
    setEdges(prev => {
      let nextEdges = [...prev];
      for (const id of removableIds) {
        const incoming = nextEdges.filter(edge => edge.target === id);
        const outgoing = nextEdges.filter(edge => edge.source === id);
        const survivors = nextEdges.filter(edge => edge.source !== id && edge.target !== id);
        const healed = incoming.flatMap(inEdge => outgoing.map(outEdge => ({
          ...outEdge,
          id: `e-${inEdge.source}-${outEdge.target}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          source: inEdge.source,
          sourceHandle: inEdge.sourceHandle || 'right-source',
          target: outEdge.target,
          targetHandle: outEdge.targetHandle || 'left-target',
          data: {
            ...outEdge.data,
            label: outEdge.data?.label || inEdge.data?.label || '',
          }
        })));
        nextEdges = dedupeEdges([...survivors, ...healed]);
      }
      nextEdgesAfterRemoval = nextEdges;
      return nextEdges;
    });

    if (selectedTaskId && removableIds.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }
    if (selectedEdgeId) {
      setSelectedEdgeId(currentId => {
        if (!currentId) return null;
        const edgeStillExists = nextEdgesAfterRemoval.some(edge => edge.id === currentId);
        return edgeStillExists ? currentId : null;
      });
    }
    setConfirmingDelete(null);
    setIsDirty?.(true);
  }, [tasks, nodes, edges, checkTaskDependencies, dedupeEdges, saveToHistory, selectedTaskId, selectedEdgeId, setNodes, setEdges, setIsDirty]);

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) {
      setValidationError("A task cannot connect to itself.");
      return;
    }

    const sourceTask = tasks.find(task => String(task.node_id || task.id) === String(params.source));
    const targetTask = tasks.find(task => String(task.node_id || task.id) === String(params.target));
    if (targetTask?.interface === 'TRIGGER') {
      setValidationError("Trigger nodes cannot receive incoming connections.");
      return;
    }
    if (sourceTask?.interface === 'OUTCOME') {
      setValidationError("Outcome nodes cannot create outgoing connections.");
      return;
    }
    if (sourceTask?.task_type === 'LOOP') {
      const existingDecisionEdges = edges.filter(edge => String(edge.source) === String(params.source));
      if (existingDecisionEdges.length >= 2) {
        setValidationError("Decision nodes can only have two outgoing routes.");
        return;
      }
    }

    const isDuplicate = edges.some(edge =>
      edge.source === params.source &&
      edge.target === params.target &&
      (edge.sourceHandle || null) === (params.sourceHandle || null) &&
      (edge.targetHandle || null) === (params.targetHandle || null)
    );
    if (isDuplicate) {
      setValidationError("That connection already exists.");
      return;
    }
    saveToHistory();
    const decisionEdgeCount = sourceTask?.task_type === 'LOOP' ? edges.filter(edge => String(edge.source) === String(params.source)).length : 0;
    const defaultLabel = sourceTask?.task_type === 'LOOP' ? (decisionEdgeCount === 0 ? 'True' : decisionEdgeCount === 1 ? 'False' : '') : '';
    const newEdge: Edge = { ...params, id: `e-${params.source}-${params.target}-${Date.now()}`, type: 'custom', data: { label: defaultLabel, edgeStyle: defaultEdgeStyle, color: '#ffffff', lineStyle: 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, source: params.source, target: params.target };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const deleteTask = useCallback((id: string) => {
    removeTaskIds([id]);
  }, [removeTaskIds]);

  const onAddNode = (type: 'TASK' | 'CONDITION') => {
    saveToHistory();
    const id = `node-${Date.now()}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    const newNode: Node = { id, type: type === 'CONDITION' ? 'diamond' : 'matrix', position: { x: Math.round((center.x - 160) / 10) * 10, y: Math.round((center.y - 140) / 10) * 10 }, data: { label: type === 'TASK' ? 'New Operational Task' : 'New Process Condition', task_type: type === 'TASK' ? 'System Interaction' : 'LOOP', manual_time: 0, automation_time: 0, occurrence: 1, target_systems: [], validation_needed: false, blockerCount: 0, errorCount: 0, baseFontSize, densityMode } };
    const newTask: TaskEntity = { 
      id, 
      node_id: id, 
      name: newNode.data.label, 
      description: type === 'TASK' ? 'Describe the operational steps and purpose of this task.' : 'Define the condition being evaluated (e.g., Is value > limit?).', 
      task_type: newNode.data.task_type, 
      target_systems: [], 
      manual_time_minutes: 0, 
      automation_time_minutes: 0, 
      machine_wait_time_minutes: 0, 
      occurrence: 1, 
      occurrence_explanation: 'Standard process execution frequency.', 
      source_data_list: [], 
      output_data_list: [], 
      manual_inputs: [], 
      manual_outputs: [], 
      verification_steps: [], 
      blockers: [], 
      errors: [], 
      tribal_knowledge: [], 
      validation_needed: false, 
      validation_procedure_steps: [], 
      media: [], 
      reference_links: [], 
      instructions: [],
      phase_name: '',
      subflow_name: '',
      task_block_key: '',
      decision_details: {},
    };
    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };
  const addTaskBlock = useCallback((block: any) => {
    saveToHistory();
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    const taskType = block.task_type === 'LOOP' ? 'LOOP' : (block.task_type || 'System Interaction');
    const newNode: Node = {
      id,
      type: taskType === 'LOOP' ? 'diamond' : 'matrix',
      position: { x: Math.round((center.x - 160) / 10) * 10, y: Math.round((center.y - 140) / 10) * 10 },
      data: { label: block.label || 'Template Task', task_type: taskType, manual_time: 0, automation_time: 0, occurrence: 1, target_systems: [], validation_needed: false, blockerCount: 0, errorCount: 0, baseFontSize, densityMode, phase_name: block.phase_name || '', subflow_name: block.subflow_name || '' }
    };
    const newTask: TaskEntity = {
      id,
      node_id: id,
      name: block.label || 'Template Task',
      description: block.description || `Template-derived task from ${block.label || 'task block'}.`,
      task_type: taskType,
      target_systems: [],
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrence: 1,
      occurrence_explanation: 'Template default.',
      source_data_list: [],
      output_data_list: [],
      manual_inputs: [],
      manual_outputs: [],
      verification_steps: [],
      blockers: [],
      errors: [],
      tribal_knowledge: [],
      validation_needed: false,
      validation_procedure_steps: [],
      media: [],
      reference_links: [],
      instructions: [],
      phase_name: block.phase_name || '',
      subflow_name: block.subflow_name || '',
      task_block_key: block.label || '',
      decision_details: {},
    };
    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  }, [baseFontSize, densityMode, inspectorWidth, project, saveToHistory, setNodes, setIsDirty]);

  const applyBulkEdit = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    saveToHistory();
    selectedTaskIds.forEach(taskId => {
      const updates: Partial<TaskEntity> = {};
      if (bulkEditDraft.owning_team) updates.owning_team = bulkEditDraft.owning_team;
      if (bulkEditDraft.phase_name) updates.phase_name = bulkEditDraft.phase_name;
      if (bulkEditDraft.subflow_name) updates.subflow_name = bulkEditDraft.subflow_name;
      if (bulkEditDraft.task_type) updates.task_type = bulkEditDraft.task_type;
      updateTask(taskId, updates);
    });
    setBulkEditOpen(false);
    setSelectedTaskIds([]);
  }, [bulkEditDraft, saveToHistory, selectedTaskIds]);
  const handleNodeDragStart = useCallback(() => {
    if (activeDragNodeIdRef.current) return;
    activeDragNodeIdRef.current = 'active';
    saveToHistory();
  }, [saveToHistory]);
  const handleNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    setAlignmentGuides(calculateAlignmentGuide(node));
  }, [calculateAlignmentGuide]);
  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    activeDragNodeIdRef.current = null;
    const snappedPosition = snapNodePosition(node);
    setAlignmentGuides({ x: null, y: null });
    if (snappedPosition.x === node.position.x && snappedPosition.y === node.position.y) return;
    setNodes(nds => nds.map(existing => existing.id === node.id ? { ...existing, position: snappedPosition } : existing));
    setIsDirty?.(true);
  }, [setNodes, setIsDirty, snapNodePosition]);

  useEffect(() => {
    console.log("DEBUG: WorkflowBuilder metadata updated", metadata);
  }, [metadata]);

  const handleSave = async () => {
    console.log("DEBUG: handleSave started", { tasksLength: tasks.length });
    if (tasks.length === 0) return;

    console.log("DEBUG: handleSave starting audit", { metadata, tasks: tasks.length });
    const auditIssues = auditWorkflowDraft({ metadata, tasks, edges });
    console.log("DEBUG: auditIssues", auditIssues);
    const firstTaskIssue = auditIssues.find(issue => issue.scope === 'task' && issue.targetId);
    const firstEdgeIssue = auditIssues.find(issue => issue.scope === 'edge' && issue.targetId);
    
    // Check Workflow Definition first
    const isWorkflowInvalid = 
      !metadata.name || metadata.name.length < 2 || 
      !metadata.description ||
      !metadata.prc ||
      !metadata.workflow_type ||
      !metadata.org ||
      !metadata.team ||
      !metadata.trigger_type ||      !metadata.trigger_description || 
      !metadata.output_type || 
      !metadata.output_description || 
      metadata.tool_family.length === 0 || 
      metadata.applicable_tools.length === 0;

    if (isWorkflowInvalid) {
      console.log("DEBUG: handleSave blocked by isWorkflowInvalid", { metadata });
      setValidationError("Workflow Definition is incomplete. Please ensure all mandatory fields (*) are filled.");
      setShowErrors(true);
      setSelectedTaskId(null); // Show metadata panel
      return;
    }

    console.log("DEBUG: handleSave passed workflow validation, checking tasks", { tasksCount: tasks.length });

    // Validation
    const invalidTasks = tasks.filter(t => {
      // Basic task validation - Name and Description are REQUIRED by Pydantic
      const isTaskInvalid = !t.name || t.name.trim().length === 0 || !t.description || t.description.trim().length === 0;
      if (isTaskInvalid) console.log("DEBUG: Task is invalid (name/desc)", t);
      
      // Blocker validation - entity, reason, and mitigation are REQUIRED
      const hasInvalidBlockers = t.blockers.some(b => 
        !b.blocking_entity || b.blocking_entity.trim().length === 0 || 
        !b.reason || b.reason.trim().length === 0 || 
        !b.standard_mitigation || b.standard_mitigation.trim().length === 0
      );
      if (hasInvalidBlockers) {
        console.log("DEBUG: Task is invalid (blockers)", t);
        return true;
      }
      
      // Error validation - type and description are REQUIRED
      const hasInvalidErrors = t.errors.some(e => 
        !e.error_type || e.error_type.trim().length === 0 || 
        !e.description || e.description.trim().length === 0
      );
      if (hasInvalidErrors) {
        console.log("DEBUG: Task is invalid (errors)", t);
        return true;
      }
      
      // Validation steps - description is REQUIRED if validation is enabled
      if (t.validation_needed && t.validation_procedure_steps.length > 0) {
        const hasInvalidSteps = t.validation_procedure_steps.some(s => !s.description || s.description.trim().length === 0);
        if (hasInvalidSteps) {
          console.log("DEBUG: Task is invalid (validation steps)", t);
          return true;
        }
      }
      
      return isTaskInvalid;
    });

    if (invalidTasks.length > 0) {
      console.log("DEBUG: handleSave blocked by invalidTasks", { count: invalidTasks.length });
      setValidationError(`Validation Failed: ${invalidTasks.length} task(s) have missing required fields. Highlighted in red.`);
      setShowErrors(true);
      // Select the first invalid task to help the user
      setSelectedTaskId(invalidTasks[0].id);
      return;
    }

    if (runtimeAudit.issues.some(issue => issue.severity === 'error')) {
      console.log("DEBUG: handleSave blocked by runtimeAudit", { issues: runtimeAudit.issues });
      setValidationError('Validation Failed: Builder runtime integrity checks found broken node/task/edge state. Resolve the issue rail items before saving.');
      setShowErrors(true);
      const targetIssue = runtimeAudit.issues.find(issue => issue.targetId);
      setSelectedTaskId(targetIssue?.targetId || null);
      return;
    }

    if (hasAuditErrors(auditIssues)) {
      console.log("DEBUG: handleSave blocked by auditIssues", { auditIssues });
      setValidationError(`Validation Failed: ${summarizeAuditIssues(auditIssues)}`);
      setShowErrors(true);
      if (firstTaskIssue?.targetId) {
        setSelectedTaskId(firstTaskIssue.targetId);
      } else if (firstEdgeIssue?.targetId) {
        setSelectedTaskId(firstEdgeIssue.targetId);
      } else {
        setSelectedTaskId(null);
      }
      reportBug(summarizeAuditIssues(auditIssues), 'frontend', 'error', {
        type: 'BUILDER_AUDIT_FAILURE',
        payload: { auditIssues },
      });
      return;
    }

    if (workflowAnalysis.has_cycle) {
      console.log("DEBUG: handleSave blocked by has_cycle", { workflowAnalysis });
      setValidationError("Validation Failed: The workflow contains a routing cycle. Remove the infinite loop before saving.");
      return;
    }
    if (workflowAnalysis.malformed_logic_nodes.length > 0) {
      console.log("DEBUG: handleSave blocked by malformed_logic_nodes", { malformed: workflowAnalysis.malformed_logic_nodes });
      setValidationError("Validation Failed: Decision nodes must expose exactly two outgoing routes labeled True and False.");
      setSelectedTaskId(workflowAnalysis.malformed_logic_nodes[0]);
      return;
    }
    if (workflowAnalysis.unreachable_nodes.length > 0 || workflowAnalysis.disconnected_nodes.length > 0) {
      console.log("DEBUG: handleSave blocked by connectivity issues", { unreachable: workflowAnalysis.unreachable_nodes, disconnected: workflowAnalysis.disconnected_nodes });
      setValidationError("Validation Failed: All nodes must remain connected from Trigger to Outcome. Review disconnected or unreachable tasks.");
      setSelectedTaskId((workflowAnalysis.unreachable_nodes[0] || workflowAnalysis.disconnected_nodes[0]) || null);
      return;
    }

    console.log("DEBUG: handleSave all validations passed, preparing finalData");
    try {
      setIsSaving(true);
      const { applicable_tools, ...metaRest } = metadata;
      const finalData = {
        ...metaRest,
        expected_updated_at: workflow?.updated_at,
        analysis: workflowAnalysis,
        simulation: workflowSimulation,
        tool_family: Array.isArray(metadata.tool_family) ? metadata.tool_family.join(', ') : metadata.tool_family,
        tool_id: Array.isArray(applicable_tools) ? applicable_tools.join(', ') : applicable_tools,
        tasks: tasks.map(t => {
          const node = nodes.find(n => String(n.id) === String(t.node_id));
          return { 
            ...t, 
            id: undefined, 
            node_id: String(t.node_id || t.id), 
            diagnostics: workflowAnalysis.diagnostics?.[String(t.node_id || t.id)] || {},
            position_x: node?.position.x ?? t.position_x ?? 0, 
            position_y: node?.position.y ?? t.position_y ?? 0 
          };
        }),
        edges: edges.map(e => ({ 
          source: String(e.source), target: String(e.target), source_handle: String(e.sourceHandle || 'right-source'), target_handle: String(e.targetHandle || 'left-target'), label: String(e.data?.label || ''), edge_style: String(e.data?.edgeStyle || 'bezier'), color: String(e.data?.color || '#ffffff'), line_style: String(e.data?.lineStyle || 'solid') 
        }))
      };
      const savedWorkflow: any = await onSave(finalData);
      if (savedWorkflow?.tasks && savedWorkflow?.edges) {
        hydratePersistedWorkflow(savedWorkflow);
      } else {
        committedSnapshotRef.current.current = currentSnapshot;
      }
      setSaveConflictDraft(null);
      setValidationError(null);
      setShowErrors(false);
    } catch (err) {
      console.error("[WorkflowBuilder] Failed to prepare save data:", err);
      const responseData =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as any).response?.data
          : null;
      const responseMessage =
        typeof responseData?.detail === 'string'
          ? responseData.detail
          : (responseData?.message || (typeof responseData?.detail?.message === 'string' ? responseData.detail.message : null));
      const message = responseMessage || (err instanceof Error ? err.message : "Builder save failed. Review configuration or retry.");
      setValidationError(message);
      if ((err as any)?.response?.status === 409) {
        setSelectedTaskId(null);
        setSelectedEdgeId(null);
        setIsMetadataEditMode(true);
        setSaveConflictDraft(responseData?.current_workflow || null);
      }
      reportBug(message, 'frontend', 'error', { type: 'BUILDER_SAVE_FAILURE' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.pageX; const startWidth = inspectorWidth;
    const handleMouseMove = (mv: MouseEvent) => setInspectorWidth(Math.max(300, Math.min(800, startWidth - (mv.pageX - startX))));
    const handleMouseUp = () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
  };

  const jumpToIssue = useCallback((issue: { target?: string | null; kind: 'metadata' | 'task' }) => {
    if (issue.kind === 'metadata' || !issue.target) {
      setSelectedTaskId(null);
      setSelectedEdgeId(null);
      setIsMetadataEditMode(true);
      return;
    }
    setSelectedTaskId(issue.target);
    setSelectedEdgeId(null);
    setInspectorTab('overview');
    const targetNode = nodes.find(node => node.id === issue.target);
    if (targetNode) {
      window.requestAnimationFrame(() => {
        setCenter(targetNode.position.x + 180, targetNode.position.y + 120, { zoom: 1.05, duration: 450 });
      });
    }
  }, [nodes, setCenter]);

  const swapEdgeDirection = (id: string) => {
    saveToHistory();
    setEdges(eds => eds.map(e => {
      if (e.id === id) { const newSourceHandle = e.targetHandle?.replace('-target', '-source'); const newTargetHandle = e.sourceHandle?.replace('-source', '-target'); return { ...e, source: e.target, target: e.source, sourceHandle: newSourceHandle, targetHandle: newTargetHandle }; }
      return e;
    }));
    setIsDirty?.(true);
  };

  const onNodesDelete = useCallback((deleted: Node[]) => {
    const ids = deleted
      .filter(node => {
        const nodeId = String(node.id);
        const taskInterface = String(node.data?.interface || node.data?.interface_type || node.data?.task_type || '').toUpperCase();
        const isProtected = taskInterface === 'TRIGGER' || taskInterface === 'OUTCOME' || nodeId === 'node-trigger' || nodeId === 'node-outcome';
        return !isProtected;
      })
      .map(node => node.id);

    if (ids.length === 0) return;
    removeTaskIds(ids);
  }, [removeTaskIds]);

  const restoreDeletedEntities = useCallback((taskIds?: string[]) => {
    const targetIds = taskIds && taskIds.length > 0 ? new Set(taskIds) : new Set(deletedHistory.tasks.map(task => task.id));
    const tasksToRestore = deletedHistory.tasks.filter(task => targetIds.has(task.id));
    const nodesToRestore = deletedHistory.nodes.filter(node => targetIds.has(String(node.id)));
    const restoredEdges = dedupeEdges(
      deletedHistory.edges.filter(edge => {
        const edgeTouchesRestored = targetIds.has(String(edge.source)) || targetIds.has(String(edge.target));
        if (!edgeTouchesRestored) return false;
        const sourceExists = targetIds.has(String(edge.source)) || tasks.some(existingTask => String(existingTask.id) === String(edge.source));
        const targetExists = targetIds.has(String(edge.target)) || tasks.some(existingTask => String(existingTask.id) === String(edge.target));
        return sourceExists && targetExists;
      })
    );
    if (tasksToRestore.length === 0 || nodesToRestore.length === 0) return;
    saveToHistory();
    setTasks(prev => [...prev, ...tasksToRestore]);
    setNodes(prev => [...prev, ...nodesToRestore]);
    if (restoredEdges.length > 0) {
      setEdges(prev => dedupeEdges([...prev, ...restoredEdges]));
    }
    setDeletedHistory(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => !targetIds.has(task.id)),
      nodes: prev.nodes.filter(node => !targetIds.has(String(node.id))),
      edges: prev.edges.filter(edge => !restoredEdges.some(restored => restored.id === edge.id)),
    }));
    setIsDirty?.(true);
  }, [deletedHistory, tasks, dedupeEdges, saveToHistory, setNodes, setEdges, setIsDirty]);

  const hydratePersistedWorkflow = useCallback((persistedWorkflow: any) => {
    if (!persistedWorkflow) return;
    
    // Create a mapping from old IDs to new stable IDs for this specific hydration
    const taskIdMap = new Map<string, string>();
    (persistedWorkflow.tasks || []).forEach((t: any) => {
      const oldId = String(t.node_id || t.id);
      const taskInterface = String(t.interface || t.interface_type || t.task_type || '').toUpperCase();
      if (taskInterface === 'TRIGGER' || oldId === 'node-trigger') taskIdMap.set(oldId, 'node-trigger');
      else if (taskInterface === 'OUTCOME' || oldId === 'node-outcome') taskIdMap.set(oldId, 'node-outcome');
      else taskIdMap.set(oldId, oldId);
    });

    const persistedTasks = (persistedWorkflow.tasks || []).map((task: any) => {
      const oldId = String(task.node_id || task.id);
      const stableId = taskIdMap.get(oldId) || oldId;
      const taskInterface = String(task.interface || task.interface_type || task.task_type || '').toUpperCase();
      const isTrigger = taskInterface === 'TRIGGER' || stableId === 'node-trigger';
      const isOutcome = taskInterface === 'OUTCOME' || stableId === 'node-outcome';

      return {
        ...task,
        id: stableId,
        node_id: stableId,
        interface: isTrigger ? 'TRIGGER' : (isOutcome ? 'OUTCOME' : task.interface),
      };
    });
    const persistedNodes: Node[] = persistedTasks.map((task: any) => ({
      id: String(task.node_id || task.id),
      type: task.task_type === 'LOOP' ? 'diamond' : 'matrix',
      position: { x: task.position_x ?? 0, y: task.position_y ?? 0 },
      data: {
        ...task,
        label: task.name,
        task_type: task.task_type || 'GENERAL',
        manual_time: task.manual_time_minutes || 0,
        automation_time: task.automation_time_minutes || 0,
        occurrence: task.occurrence || 1,
        target_systems: task.target_systems,
        owningTeam: task.owning_team,
        ownerPositions: task.owner_positions,
        sourceCount: (task.source_data_list || []).length,
        outputCount: (task.output_data_list || []).length,
        interface: task.interface,
        validation_needed: task.validation_needed,
        blockerCount: (task.blockers || []).length,
        errorCount: (task.errors || []).length,
        description: task.description || '',
        id: String(task.node_id || task.id),
        baseFontSize: 14,
      },
    }));

    const persistedEdges: Edge[] = (persistedWorkflow.edges || []).map((edge: any, idx: number) => {
      const originalSourceId = String(edge.source || '');
      const originalTargetId = String(edge.target || '');
      const sourceId = taskIdMap.get(originalSourceId) || originalSourceId;
      const targetId = taskIdMap.get(originalTargetId) || originalTargetId;

      return {
        id: String(edge.id || `e-${sourceId}-${targetId}-${idx}`),
        source: sourceId,
        target: targetId,
        sourceHandle: edge.source_handle || edge.sourceHandle || 'right-source',
        targetHandle: edge.target_handle || edge.targetHandle || 'left-target',
        type: 'custom',
        data: {
          label: edge.label || '',
          edgeStyle: edge.edge_style || edge.edgeStyle || defaultEdgeStyle,
          color: edge.color || '#ffffff',
          lineStyle: edge.line_style || edge.lineStyle || 'solid',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: edge.color || '#ffffff' },
      };
    });
    const persistedMetadata: WorkflowMetadata = {
      ...metadata,
      name: persistedWorkflow.name || metadata.name,
      version: persistedWorkflow.version || metadata.version,
      workspace: persistedWorkflow.workspace || metadata.workspace,
      parent_workflow_id: persistedWorkflow.parent_workflow_id || metadata.parent_workflow_id,
      version_group: persistedWorkflow.version_group || metadata.version_group,
      version_notes: persistedWorkflow.version_notes || metadata.version_notes,
      version_base_snapshot: persistedWorkflow.version_base_snapshot || metadata.version_base_snapshot,
      description: persistedWorkflow.description || persistedWorkflow.forensic_description || metadata.description,
      prc: persistedWorkflow.prc || metadata.prc,
      workflow_type: persistedWorkflow.workflow_type || metadata.workflow_type,
      tool_family: Array.isArray(persistedWorkflow.tool_family) ? persistedWorkflow.tool_family : (persistedWorkflow.tool_family ? persistedWorkflow.tool_family.split(', ') : metadata.tool_family),
      applicable_tools: Array.isArray(persistedWorkflow.applicable_tools) ? persistedWorkflow.applicable_tools : (persistedWorkflow.tool_id ? (typeof persistedWorkflow.tool_id === 'string' ? persistedWorkflow.tool_id.split(', ') : [persistedWorkflow.tool_id]) : metadata.applicable_tools),
      trigger_type: persistedWorkflow.trigger_type || metadata.trigger_type,
      trigger_description: persistedWorkflow.trigger_description || metadata.trigger_description,
      output_type: persistedWorkflow.output_type || metadata.output_type,
      output_description: persistedWorkflow.output_description || metadata.output_description,
      cadence_count: persistedWorkflow.cadence_count ?? metadata.cadence_count,
      cadence_unit: persistedWorkflow.cadence_unit || metadata.cadence_unit,
      repeatability_check: persistedWorkflow.repeatability_check ?? metadata.repeatability_check,
      equipment_required: persistedWorkflow.equipment_required ?? metadata.equipment_required,
      equipment_state: persistedWorkflow.equipment_state || metadata.equipment_state,
      cleanroom_required: persistedWorkflow.cleanroom_required ?? metadata.cleanroom_required,
      access_control: persistedWorkflow.access_control || metadata.access_control,
      ownership: persistedWorkflow.ownership || metadata.ownership,
      governance: persistedWorkflow.governance || metadata.governance,
      review_requests: persistedWorkflow.review_requests || metadata.review_requests,
      activity_timeline: persistedWorkflow.activity_timeline || metadata.activity_timeline,
      notification_feed: persistedWorkflow.notification_feed || metadata.notification_feed,
      quick_capture_notes: persistedWorkflow.quick_capture_notes || metadata.quick_capture_notes,
      template_key: persistedWorkflow.template_key || metadata.template_key,
      related_workflow_ids: persistedWorkflow.related_workflow_ids || metadata.related_workflow_ids,
      standards_profile: persistedWorkflow.standards_profile || metadata.standards_profile,
      comments: persistedWorkflow.comments || metadata.comments,
      analysis: persistedWorkflow.analysis || metadata.analysis,
      simulation: persistedWorkflow.simulation || metadata.simulation,
    };
    setMetadata(persistedMetadata);
    setTasks(persistedTasks);
    setNodes(persistedNodes);
    setEdges(persistedEdges);
    committedSnapshotRef.current = {
      current_id: String(workflow?.id),
      current: JSON.stringify({ nodes: persistedNodes, edges: persistedEdges, tasks: persistedTasks, metadata: persistedMetadata })
    };
    setSelectedTaskId(null);
    setSelectedEdgeId(null);
    setValidationError(null);
    setShowErrors(false);
    setSaveConflictDraft(null);
    setIsDirty?.(false);
  }, [defaultEdgeStyle, metadata, setEdges, setIsDirty, setNodes]);

  const buildWorkflowDraft = useCallback(() => ({
    ...workflow,
    ...metadata,
    expected_updated_at: workflow?.updated_at,
    tool_family: Array.isArray(metadata.tool_family) ? metadata.tool_family.join(', ') : metadata.tool_family,
    tool_id: Array.isArray(metadata.applicable_tools) ? metadata.applicable_tools.join(', ') : metadata.applicable_tools,
    applicable_tools: metadata.applicable_tools,
    tasks: tasks.map(task => {
      const node = nodes.find(item => String(item.id) === String(task.node_id || task.id));
      return {
        ...task,
        position_x: node?.position.x ?? task.position_x ?? 0,
        position_y: node?.position.y ?? task.position_y ?? 0,
      };
    }),
    edges: edges.map(edge => ({
      id: edge.id,
      source: String(edge.source),
      target: String(edge.target),
      source_handle: String(edge.sourceHandle || 'right-source'),
      target_handle: String(edge.targetHandle || 'left-target'),
      label: String(edge.data?.label || ''),
      edge_style: String(edge.data?.edgeStyle || 'bezier'),
      color: String(edge.data?.color || '#ffffff'),
      line_style: String(edge.data?.lineStyle || 'solid'),
    })),
  }), [workflow, metadata, tasks, nodes, edges]);

  return (
    <div className="flex h-full w-full bg-[#050914] overflow-hidden font-sans">
      {validationError && (
        <ValidationMessage 
          message={validationError} 
          onClear={() => setValidationError(null)} 
          actions={saveConflictDraft ? (
            <>
              <button
                onClick={() => hydratePersistedWorkflow(saveConflictDraft)}
                className="rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent transition-all hover:bg-theme-accent hover:text-white"
              >
                Load Latest Server Copy
              </button>
              <button
                onClick={() => setSaveConflictDraft(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white"
              >
                Keep Current Draft
              </button>
            </>
          ) : undefined}
        />
      )}
      {showCommandPalette && (
        <div className="fixed inset-0 z-[2100] flex items-start justify-center bg-black/45 backdrop-blur-sm pt-28">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0b1323]/96 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-theme-accent">Command Palette</p>
                <h3 className="text-[20px] font-black text-white tracking-tight">Builder Shortcuts</h3>
              </div>
              <button onClick={() => setShowCommandPalette(false)} className="w-10 h-10 rounded-xl border border-white/10 text-white/35 hover:text-white hover:bg-white/5 transition-all"><X size={16} className="mx-auto" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-6">
              {[
                { label: 'Add Task', hint: 'Create a new operational task', action: () => onAddNode('TASK') },
                { label: 'Add Condition', hint: 'Create a new decision node', action: () => onAddNode('CONDITION') },
                { label: 'Open Simulation', hint: 'Review execution envelope', action: () => setIsSimulationOpen(true) },
                { label: 'Open Metadata', hint: 'Return to workflow definition', action: () => { setSelectedTaskId(null); setSelectedEdgeId(null); setIsMetadataEditMode(true); } },
                { label: 'Auto Layout', hint: 'Realign the full canvas', action: () => handleLayout(nodes, edges) },
                { label: 'Deleted History', hint: 'Recover removed entities', action: () => setIsDeletedHistoryOpen(true) },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setShowCommandPalette(false); }}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left hover:border-theme-accent/25 hover:bg-theme-accent/[0.06] transition-all"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">{item.label}</p>
                  <p className="text-[11px] font-bold text-white/45 mt-2">{item.hint}</p>
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-white/8 bg-white/[0.02] flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Shortcut</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Cmd/Ctrl + K</span>
            </div>
          </div>
        </div>
      )}
	      {isDeletedHistoryOpen && (
	        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-md p-8 animate-apple-in">
	          <div className="w-full max-w-4xl apple-glass !bg-[#0f172a]/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-theme-accent mb-1">Entity Recovery Console</p>
                <h3 className="text-[24px] font-black text-white uppercase tracking-tight">Deleted History</h3>
              </div>
              <div className="flex items-center gap-3">
                {deletedHistory.tasks.length > 0 && (
                  <button onClick={() => restoreDeletedEntities()} className="px-4 py-2 rounded-xl border border-theme-accent/30 bg-theme-accent/10 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                    Restore All
                  </button>
                )}
                <button onClick={() => setIsDeletedHistoryOpen(false)} className="p-4 text-white/30 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><X size={24} /></button>
              </div>
	            </div>
	            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <MetricTile label="Deleted Tasks" value={deletedHistory.tasks.length} tone="danger" />
                  <MetricTile label="Recoverable Routes" value={deletedHistory.edges.length} tone="warning" />
                  <MetricTile label="Session State" value={deletedHistory.tasks.length > 0 ? 'Recoverable' : 'Stable'} tone={deletedHistory.tasks.length > 0 ? 'accent' : 'success'} />
                </div>
	              <div className="space-y-6">
                {deletedHistory.tasks.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <Trash2 size={48} className="mx-auto text-white/5" />
                    <p className="text-[14px] font-bold text-white/20 uppercase tracking-widest italic">No deleted entities in current session.</p>
                  </div>
                )}
                {deletedHistory.tasks.map((task) => (
                  <div key={task.id} className="group p-6 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-theme-accent/30 hover:bg-theme-accent/[0.02] transition-all flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-theme-accent/20 group-hover:text-theme-accent transition-all border border-white/5">
                        {task.task_type === 'LOOP' ? <Diamond size={20} /> : <Box size={20} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-black text-white uppercase tracking-tight group-hover:text-theme-accent transition-colors">{task.name || 'Untitled Entity'}</span>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                          {task.task_type} • {task.id} • {deletedHistory.edges.filter(edge => String(edge.source) === String(task.id) || String(edge.target) === String(task.id)).length} recoverable routes
                        </span>
                      </div>
                    </div>
	                    <button 
	                      onClick={() => restoreDeletedEntities([task.id])}
                      className="px-6 py-3 bg-theme-accent/10 border border-theme-accent/30 text-theme-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-theme-accent hover:text-white transition-all shadow-lg shadow-theme-accent/5"
                    >
                      Restore Entity
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
	      {isSimulationOpen && (
	        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 backdrop-blur-md p-8 animate-apple-in">
	          <div className="w-full max-w-3xl apple-glass !bg-[#0f172a]/95 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-theme-accent">Dry Run Simulator</p>
                <h3 className="text-[22px] font-black text-white uppercase tracking-tight">Execution Envelope</h3>
              </div>
              <button onClick={() => setIsSimulationOpen(false)} className="p-3 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all"><X size={18} /></button>
            </div>
	            <div className="grid grid-cols-3 gap-4">
              <div className="apple-card !bg-white/[0.03] border-white/10 p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Best Case</p>
                <p className="text-[28px] font-black text-emerald-400 mt-2">{workflowSimulation.best_case_minutes.toFixed(1)}m</p>
              </div>
              <div className="apple-card !bg-white/[0.03] border-white/10 p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Critical Path</p>
                <p className="text-[28px] font-black text-theme-accent mt-2">{workflowSimulation.critical_path_minutes.toFixed(1)}m</p>
              </div>
              <div className="apple-card !bg-white/[0.03] border-white/10 p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Worst Case</p>
                <p className="text-[28px] font-black text-amber-400 mt-2">{workflowSimulation.worst_case_minutes.toFixed(1)}m</p>
              </div>
	            </div>
              <div className="grid grid-cols-3 gap-4">
                <MetricTile label="Delta Range" value={`${Math.max(workflowSimulation.worst_case_minutes - workflowSimulation.best_case_minutes, 0).toFixed(1)}m`} tone="warning" />
                <MetricTile label="Critical Nodes" value={workflowSimulation.critical_path_nodes.length} tone="accent" />
                <MetricTile label="Shift Risk" value={workflowAnalysis.shift_handoff_risk ? 'High' : 'Contained'} tone={workflowAnalysis.shift_handoff_risk ? 'warning' : 'success'} />
              </div>
	            <div className="space-y-3">
	              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Critical Path Nodes</p>
	              <div className="flex flex-wrap gap-2">
	                {workflowSimulation.critical_path_nodes.map(nodeId => {
	                  const task = tasks.find(item => String(item.node_id || item.id) === nodeId);
	                  return <span key={nodeId} className="px-3 py-2 rounded-xl bg-theme-accent/10 border border-theme-accent/20 text-[10px] font-black uppercase tracking-widest text-theme-accent">{task?.name || nodeId}</span>;
	                })}
	              </div>
	            </div>
              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Readout</p>
                <p className="text-[12px] font-bold text-white/62 leading-relaxed mt-3">The simulator highlights the current execution envelope from best-case to worst-case runtime using the present routing graph, task timing, and branching semantics. Use this panel to spot unstable decisions before commit.</p>
              </div>
	          </div>
	        </div>
	      )}
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
	                            saveToHistory();
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

      <div className="flex-1 flex flex-col min-w-0 relative" style={{ flex: workspaceMode === 'definition' ? '0 0 44%' : '1 1 0%' }}>
          {showBuilderGuide && (
            <div className="mx-8 mt-4 rounded-[1.75rem] border border-theme-accent/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(10,17,32,0.04))] px-5 py-4 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent">Builder Primer</p>
                <p className="text-[12px] font-bold text-white/78 leading-relaxed max-w-[52rem]">Use `Add Task` for operational steps, `Add Condition` for decision checkpoints, connect decision routes as `True / False`, and use `Cmd/Ctrl + K` for quick builder actions.</p>
              </div>
              <button data-testid="builder-guide-dismiss" onClick={() => setShowBuilderGuide(false)} className="px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white hover:bg-white/5 transition-all">Dismiss</button>
            </div>
          )}
	        {/* REDESIGNED HEADER - TWO LINES */}
	        <div className="border-b border-white/10 bg-[#0a1120]/95 backdrop-blur-2xl z-20 flex flex-col">
          {/* LINE 1: IDENTITY & STATUS */}
          <div className="min-h-16 flex items-center justify-between px-8 py-3 border-b border-white/5 gap-6">
            <div className="flex items-center gap-6 min-w-0">
              <button onClick={() => onBack(buildWorkflowDraft())} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-xl transition-all text-white/40 hover:text-white border border-transparent hover:border-white/10">
                <ChevronLeft size={22} />
              </button>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent/90">Intake to Builder Continuum</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-[18px] font-black text-white uppercase tracking-tight truncate max-w-[460px]">
                    {metadata.name || 'UNTITLED WORKFLOW'}
                  </h1>
                  <span className="px-3 py-1 bg-theme-accent/10 border border-theme-accent/20 rounded-full text-[9px] font-black uppercase tracking-widest text-theme-accent">
                    v{metadata.version}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Hash size={10} className="text-white/20" />
                    <span className="text-[10px] font-black text-white/55 uppercase tracking-widest">{metadata.prc || 'NO PRC ASSIGNED'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-white/20" />
                    <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">
                      Last Updated: {workflow?.updated_at ? new Date(workflow.updated_at).toLocaleString() : 'Just Now'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <FlowStageRail active={saveState === 'blocked' ? 'validate' : saveState === 'dirty' || saveState === 'saving' ? 'builder' : 'commit'} />
              <SaveStateChip saveState={saveState} issueCount={issueItems.length} />
              {peerSessions.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]" />
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">{peerSessions.length} parallel session{peerSessions.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-2xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{workflow?.status || 'DRAFT'}</span>
              </div>
              <button 
                onClick={() => setBuganizerOpen(true)} 
                className={cn(
                  "flex items-center gap-3 h-10 px-4 rounded-xl transition-all border",
                  bugReports.some(r => !r.acknowledged) 
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" 
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                )}
              >
                <Bug size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Buganizer Console</span>
                {bugReports.filter(r => !r.acknowledged).length > 0 && (
                  <span className="w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-lg flex items-center justify-center">
                    {bugReports.filter(r => !r.acknowledged).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* LINE 2: INTERACTIONS */}
          <div className="min-h-16 flex items-center justify-between px-8 py-3 bg-white/[0.01] gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2 px-4 h-11 bg-white/[0.03] border border-white/10 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Canvas</span>
                <span className="text-[10px] font-black text-white/70">{nodes.length} nodes</span>
                <span className="w-1 h-1 rounded-full bg-white/15" />
                <span className="text-[10px] font-black text-white/70">{edges.length} routes</span>
                {isLargeWorkflow && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/15" />
                    <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">Large Workflow Mode</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                <div className="relative group/layout">
                  <button className="flex items-center gap-2 px-4 h-9 bg-theme-accent text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-theme-accent/20 transition-all hover:scale-[1.02]">
                    <RefreshCw size={14} /> Auto Layout <ChevronDown size={12} />
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-48 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/layout:opacity-100 group-hover/layout:visible transition-all z-[100] p-2">
                    {(['bezier', 'smoothstep', 'straight'] as const).map(s => (
                      <button 
                        key={s} 
                        onClick={() => {
                          saveToHistory();
                          setDefaultEdgeStyle(s);
                          setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, edgeStyle: s } })));
                          handleLayout(nodes, edges);
                        }} 
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-all",
                          defaultEdgeStyle === s ? "bg-theme-accent text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        {s === 'smoothstep' ? 'Angled Connectors' : s === 'bezier' ? 'Smooth Curves' : 'Straight Lines'}
                        {defaultEdgeStyle === s && <Zap size={10} fill="currentColor" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-[1px] h-6 bg-white/10 mx-1" />
                <button onClick={() => setIsSimulationOpen(true)} className="flex items-center gap-2 px-4 h-9 hover:bg-white/5 rounded-lg text-[10px] font-black text-white/60 uppercase transition-all hover:text-white">
                  <Activity size={14} className="text-emerald-400" /> Dry Run Simulation
                </button>
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {(['compact', 'standard', 'expanded'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setDensityMode(mode)}
                    className={cn(
                      "px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-[0.18em] transition-all",
                      densityMode === mode ? "bg-theme-accent text-white" : "text-white/45 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {([
                  { id: 'split', label: 'Split' },
                  { id: 'canvas', label: 'Canvas' },
                  { id: 'definition', label: 'Definition' },
                ] as const).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setWorkspaceMode(mode.id)}
                    className={cn(
                      "px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-[0.18em] transition-all",
                      workspaceMode === mode.id ? "bg-theme-accent text-white" : "text-white/45 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {([
                  { id: 'all', label: 'All', count: nodes.length },
                  { id: 'issues', label: 'Issues', count: focusLensStats.issues },
                  { id: 'decisions', label: 'Decision', count: focusLensStats.decisions },
                  { id: 'heavy', label: 'Heavy', count: focusLensStats.heavy },
                ] as const).map(lens => (
                  <button
                    key={lens.id}
                    onClick={() => setFocusLens(lens.id)}
                    className={cn(
                      "px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-[0.18em] transition-all flex items-center gap-2",
                      focusLens === lens.id ? "bg-theme-accent text-white" : "text-white/45 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {lens.label}
                    <span className="text-[8px] opacity-70">{lens.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                {([
                  { id: 'none', label: 'No Lanes' },
                  { id: 'taskType', label: 'By Type' },
                  { id: 'owner', label: 'By Owner' },
                ] as const).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setLaneMode(mode.id)}
                    className={cn(
                      "px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-[0.18em] transition-all",
                      laneMode === mode.id ? "bg-theme-accent text-white" : "text-white/45 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCommandPalette(true)} className="flex items-center gap-2 px-4 h-11 bg-white/[0.03] border border-white/10 rounded-2xl text-[10px] font-black text-white/60 uppercase hover:bg-white/10 hover:text-white transition-all">
                <Search size={14} className="text-theme-accent" /> Command Palette
              </button>
              <button onClick={() => setTableModeOpen(current => !current)} className={cn("flex items-center gap-2 px-4 h-11 border rounded-2xl text-[10px] font-black uppercase transition-all", tableModeOpen ? "bg-theme-accent/12 border-theme-accent/30 text-white" : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10 hover:text-white")}>
                <Database size={14} className="text-theme-accent" /> Task Table
              </button>
              <button onClick={() => setBulkEditOpen(current => !current)} className={cn("flex items-center gap-2 px-4 h-11 border rounded-2xl text-[10px] font-black uppercase transition-all", bulkEditOpen ? "bg-theme-accent/12 border-theme-accent/30 text-white" : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10 hover:text-white")}>
                <Edit3 size={14} className="text-theme-accent" /> Bulk Edit
              </button>
              <div className="flex items-center gap-2 px-4 h-11 bg-white/[0.03] border border-white/10 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Route Rules</span>
                <SemanticBadge label="True" tone="success" />
                <SemanticBadge label="False" tone="danger" />
              </div>

              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                <button 
                  onClick={undo} 
                  disabled={history.length === 0} 
                  className="w-10 h-9 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-10 transition-all"
                  title="Revert Backward (Undo)"
                >
                  <RefreshCw size={14} className="-scale-x-100" />
                </button>
                <button 
                  onClick={redo} 
                  disabled={redoStack.length === 0} 
                  className="w-10 h-9 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-10 transition-all"
                  title="Revert Forward (Redo)"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <button 
                onClick={() => setIsDeletedHistoryOpen(true)}
                className="flex items-center gap-2 px-4 h-11 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white/60 uppercase hover:bg-white/10 hover:text-white transition-all"
              >
                <Trash2 size={14} className="text-rose-400" /> Deleted History ({deletedHistory.tasks.length})
              </button>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {nodes.length >= 12 && (
                <div className="flex items-center gap-2 px-4 h-11 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <Box size={14} className="text-amber-400" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Large Workflow Mode</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 h-11 bg-white/[0.03] border border-white/10 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Validation</span>
                <span className={cn("text-[11px] font-black", issueItems.some(issue => issue.severity === 'error') ? "text-rose-400" : "text-emerald-400")}>
                  {issueItems.some(issue => issue.severity === 'error') ? 'Action Needed' : 'Ready'}
                </span>
              </div>
                <button 
                  data-testid="builder-commit"
                  onClick={handleSave} 
                disabled={isSaving}
                className="flex items-center gap-2 px-8 h-11 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <Save size={16} /> {isSaving ? 'Saving...' : 'Commit Changes'}
              </button>
              <button onClick={onExit} className="w-11 h-11 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          {workspaceMode !== 'canvas' && <IssueRail issues={issueItems} onSelect={jumpToIssue} />}
          {tableModeOpen && (
            <div className="absolute inset-x-6 top-24 z-20 max-h-[22rem] overflow-auto rounded-[1.6rem] border border-white/10 bg-[#08101d]/95 p-4 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-4 pb-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Structured Task Grid</p>
                  <p className="mt-1 text-[11px] font-bold text-white/52">Edit core workflow structure in a tabular format without leaving the graph authoring surface.</p>
                </div>
                <button onClick={() => setTableModeOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white hover:bg-white/10 transition-all">Close</button>
              </div>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/35">
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Select</th>
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Task</th>
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Type</th>
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Phase</th>
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Subflow</th>
                    <th className="px-3 py-2 font-black uppercase tracking-[0.18em]">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.filter(task => !task.interface).map(task => (
                    <tr key={task.id} className="border-b border-white/[0.04]">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => setSelectedTaskIds(prev => prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id])} />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => { setSelectedTaskId(task.id); setTableModeOpen(false); }} className="font-black text-white hover:text-theme-accent transition-colors">{task.name || 'Untitled Task'}</button>
                      </td>
                      <td className="px-3 py-2 text-white/60">{task.task_type}</td>
                      <td className="px-3 py-2 text-white/60">{task.phase_name || 'None'}</td>
                      <td className="px-3 py-2 text-white/60">{task.subflow_name || 'None'}</td>
                      <td className="px-3 py-2 text-white/60">{task.owning_team || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bulkEditOpen && (
            <div className="absolute inset-x-10 bottom-8 z-20 rounded-[1.6rem] border border-white/10 bg-[#08101d]/95 p-5 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Bulk Edit Selection</p>
                  <p className="mt-1 text-[11px] font-bold text-white/52">Apply team, phase, subflow, or task type updates across the selected workflow rows.</p>
                </div>
                <div className="flex items-center gap-2">
                  <SemanticBadge label={`${selectedTaskIds.length} Selected`} tone="accent" />
                  <button onClick={() => setBulkEditOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white hover:bg-white/10 transition-all">Close</button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                <input className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" placeholder="Owner Team" value={bulkEditDraft.owning_team} onChange={e => setBulkEditDraft(prev => ({ ...prev, owning_team: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" placeholder="Phase" value={bulkEditDraft.phase_name} onChange={e => setBulkEditDraft(prev => ({ ...prev, phase_name: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" placeholder="Subflow" value={bulkEditDraft.subflow_name} onChange={e => setBulkEditDraft(prev => ({ ...prev, subflow_name: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" placeholder="Task Type" value={bulkEditDraft.task_type} onChange={e => setBulkEditDraft(prev => ({ ...prev, task_type: e.target.value }))} />
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={applyBulkEdit} className="rounded-xl border border-theme-accent/30 bg-theme-accent/12 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                  Apply Bulk Edit
                </button>
              </div>
            </div>
          )}
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onConnect={onConnect} 
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
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
            onlyRenderVisibleElements={isLargeWorkflow}
            className="react-flow-industrial"
          >
            <Background color="#1e293b" gap={30} size={1} />
            <Controls className="!bg-[#0a1120] !border-white/10 !rounded-xl overflow-hidden" />
            {!isLargeWorkflow && (
              <MiniMap
                pannable
                zoomable
                className="!bg-[#0a1120]/92 !border !border-white/10 !rounded-2xl overflow-hidden"
                nodeColor={(node) => {
                  if (node.data?.focusMuted) return '#334155';
                  if (node.data?.task_type === 'LOOP') return '#d946ef';
                  if (node.data?.interface === 'TRIGGER') return '#06b6d4';
                  if (node.data?.interface === 'OUTCOME') return '#f43f5e';
                  if (node.data?.diagnostics?.logic_warning || node.data?.diagnostics?.disconnected || node.data?.diagnostics?.unreachable) return '#f59e0b';
                  return '#3b82f6';
                }}
              />
            )}
          </ReactFlow>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {laneMode !== 'none' && laneGroups.map((group, index) => (
              <div
                key={group.key}
                className={cn(
                  "absolute rounded-[2rem] border backdrop-blur-[1px]",
                  index % 3 === 0 ? "border-cyan-500/20 bg-cyan-500/[0.035]" : index % 3 === 1 ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-fuchsia-500/20 bg-fuchsia-500/[0.03]"
                )}
                style={{
                  transform: `translate(${group.bounds.x * viewport.zoom + viewport.x}px, ${group.bounds.y * viewport.zoom + viewport.y}px)`,
                  width: group.bounds.width * viewport.zoom,
                  height: group.bounds.height * viewport.zoom,
                }}
              >
                <div className="absolute -top-7 left-3 px-3 py-1 rounded-full border border-white/10 bg-[#0a1120]/90 text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
                  {group.label} <span className="text-theme-accent">({group.nodes.length})</span>
                </div>
              </div>
            ))}
            {alignmentGuides.x !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-theme-accent/60 shadow-[0_0_12px_rgba(59,130,246,0.55)]"
                style={{ left: alignmentGuides.x * viewport.zoom + viewport.x }}
              />
            )}
            {alignmentGuides.y !== null && (
              <div
                className="absolute left-0 right-0 h-px bg-theme-accent/60 shadow-[0_0_12px_rgba(59,130,246,0.55)]"
                style={{ top: alignmentGuides.y * viewport.zoom + viewport.y }}
              />
            )}
          </div>
          <div className="absolute right-6 top-6 z-20 pointer-events-none">
            <div className="rounded-2xl border border-white/10 bg-[#0a1120]/90 backdrop-blur-2xl px-4 py-3 space-y-2 max-w-[220px]">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-theme-accent">Overview Lens</p>
              <div className="flex flex-wrap gap-2">
                <SemanticBadge label={`${nodes.length} Nodes`} tone="neutral" />
                <SemanticBadge label={`${laneGroups.length} Groups`} tone={laneGroups.length > 0 ? "accent" : "neutral"} />
                <SemanticBadge label={workspaceMode === 'canvas' ? 'Canvas Priority' : workspaceMode === 'definition' ? 'Definition Priority' : 'Balanced'} tone="accent" />
              </div>
              <p className="text-[10px] font-bold text-white/45 leading-relaxed">Use workspace presets, focus lenses, and lanes to keep dense workflow maps legible without losing information.</p>
            </div>
          </div>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1.5 bg-[#0a1120]/92 backdrop-blur-2xl border border-white/10 rounded-[1.2rem] shadow-2xl">
            <button data-testid="builder-add-task" onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-4 py-2.5 bg-theme-accent text-white rounded-xl text-[9px] font-black uppercase tracking-[0.16em] hover:scale-[1.05] transition-all"><Plus size={12} /> Add Task</button>
            <button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase tracking-[0.16em] hover:scale-[1.05] transition-all"><Plus size={12} /> Add Condition</button>
          </div>
        </div>
      </div>

      <div className="relative border-l border-white/10 bg-[#0a1120] flex flex-col z-[70] shadow-[-18px_0_40px_rgba(0,0,0,0.24)]" style={{ width: `${inspectorWidth}px`, flex: workspaceMode === 'definition' ? '0 0 56%' : '0 0 auto' }}>
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent z-50" />
	        <div className="h-14 flex border-b border-white/10 bg-white/[0.02]">
          {[ 
            { id: 'overview', label: 'Overview', icon: <Activity size={12} /> }, 
            { id: 'data', label: 'Data', icon: <Database size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'validation', label: 'Validation', icon: <Zap size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' }, 
            { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} />, hidden: isProtected || selectedTask?.task_type === 'LOOP' } 
          ].filter(t => !t.hidden && (selectedTaskId || t.id === 'overview')).map(t => (
	            <button key={t.id} onClick={() => setInspectorTab(t.id as any)} className={cn("flex-1 flex flex-col items-center justify-center gap-1 border-b-2 transition-all", inspectorTab === t.id ? 'border-theme-accent bg-theme-accent/10 text-white' : 'border-transparent text-white/45 hover:text-white hover:bg-white/[0.03]')}>{t.icon}<span className="text-[8px] font-black uppercase tracking-[0.18em]">{t.label}</span></button>
          ))}
          {selectedEdgeId && (<div className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-theme-accent bg-theme-accent/10 text-white"><Link2 size={12} /><span className="text-[8px] font-black uppercase">Edge</span></div>)}
        </div>
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/6 bg-black/20">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/28">Inspector Width</span>
          <div className="flex items-center gap-2">
            {[380, 450, 560].map(width => (
              <button
                key={width}
                onClick={() => setInspectorWidth(width)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                  inspectorWidth === width ? "bg-theme-accent/12 border-theme-accent/30 text-theme-accent" : "bg-white/5 border-white/10 text-white/35 hover:text-white"
                )}
              >
                {width === 380 ? 'Compact' : width === 450 ? 'Standard' : 'Wide'}
              </button>
            ))}
          </div>
        </div>

        {selectedTaskId && selectedTask && (
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.015] flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={cn(
                "w-3 h-3 rounded-full shadow-2xl",
                selectedTask.interface === 'TRIGGER' ? "bg-cyan-500 shadow-cyan-500/40" :
                selectedTask.interface === 'OUTCOME' ? "bg-rose-500 shadow-rose-500/40" :
                "bg-theme-accent shadow-theme-accent/40"
              )} />
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-black text-white uppercase tracking-[0.1em] truncate leading-none mb-1">
                  {selectedTask.name || 'Untitled Segment'}
                </span>
	                <span className="text-[8px] font-bold text-white/35 uppercase tracking-[0.2em]">{selectedTask.task_type}</span>
              </div>
            </div>
            {!isProtected && (
              <div className="flex items-center gap-2">
                {confirmingDelete === selectedTaskId ? (
                  <div className="flex items-center gap-2 bg-status-error/15 border border-status-error/25 rounded-2xl p-2 animate-apple-in">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-status-error/85">Delete {selectedTask.task_type === 'LOOP' ? 'decision' : 'task'}?</span>
                    <button 
                      onClick={() => { if (!checkTaskDependencies(selectedTaskId)) deleteTask(selectedTaskId); }}
                      className="px-3 py-1.5 bg-status-error text-white text-[8px] font-black uppercase rounded-lg shadow-lg shadow-status-error/30 hover:scale-105 transition-all"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setConfirmingDelete(null)} className="p-1.5 text-white/40 hover:text-white transition-all"><X size={14} /></button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmingDelete(selectedTaskId)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:bg-status-error/20 hover:border-status-error/40 hover:text-status-error transition-all flex items-center justify-center shadow-lg"
                    title="Remove Task"
                  >
                    <Trash size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar p-6">
          {selectedTaskId && selectedTask ? (
            <div className="space-y-8 animate-apple-in">
              <TaskTemplateRail
                taskType={selectedTask.task_type}
                interfaceType={selectedTask.interface || null}
                inspectorTab={inspectorTab}
              />
              {inspectorTab === 'overview' && (
                <div className="space-y-6">
                  <SectionEyebrow
                    icon={selectedTask.task_type === 'LOOP' ? <Diamond size={13} /> : <Activity size={13} />}
                    title={selectedTask.task_type === 'LOOP' ? 'Decision Overview' : 'Task Overview'}
                    hint={selectedTask.task_type === 'LOOP'
                      ? 'Define the conditional checkpoint, then verify two clean True / False routes.'
                      : 'Shape the operational record first, then complete systems, data, and exception detail.'}
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <MetricTile label="Manual" value={`${(selectedTask.manual_time_minutes ?? 0).toFixed(0)}m`} tone="accent" />
                    <MetricTile label="Machine" value={`${(selectedTask.automation_time_minutes ?? 0).toFixed(0)}m`} tone="neutral" />
                    <MetricTile label="Inputs" value={selectedTask.source_data_list.length} tone={selectedTask.source_data_list.length > 0 ? "success" : "neutral"} />
                    <MetricTile label="Outputs" value={selectedTask.output_data_list.length} tone={selectedTask.output_data_list.length > 0 ? "accent" : "neutral"} />
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 flex flex-wrap items-center gap-2">
                    <SemanticBadge label={selectedTask.task_type || 'General'} tone={selectedTask.task_type === 'LOOP' ? 'decision' : 'accent'} />
                    {selectedTask.validation_needed && <SemanticBadge label="Validation Required" tone="warning" />}
                    {selectedTask.blockers.length > 0 && <SemanticBadge label={`${selectedTask.blockers.length} Blockers`} tone="warning" />}
                    {selectedTask.errors.length > 0 && <SemanticBadge label={`${selectedTask.errors.length} Errors`} tone="danger" />}
                    {selectedTask.owning_team && <SemanticBadge label={selectedTask.owning_team} tone="neutral" />}
                  </div>
                  <div className="grid grid-cols-4 gap-3 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                    <MetricTile label="Warnings" value={[selectedTaskDiagnostics.logic_warning, selectedTaskDiagnostics.orphaned_input].filter(Boolean).length} tone={(selectedTaskDiagnostics.logic_warning || selectedTaskDiagnostics.orphaned_input) ? "warning" : "neutral"} />
                    <MetricTile label="Errors" value={[selectedTaskDiagnostics.unreachable, selectedTaskDiagnostics.disconnected].filter(Boolean).length} tone={(selectedTaskDiagnostics.unreachable || selectedTaskDiagnostics.disconnected) ? "danger" : "neutral"} />
                    <MetricTile label="Recovery" value={`${(selectedTaskDiagnostics.risk_penalty_minutes || 0).toFixed(1)}m`} tone={(selectedTaskDiagnostics.risk_penalty_minutes || 0) > 0 ? "warning" : "neutral"} />
                    <MetricTile label="Automation" value={`${(selectedTaskDiagnostics.automation_minutes || 0).toFixed(1)}m`} tone={(selectedTaskDiagnostics.automation_minutes || 0) > 0 ? "success" : "neutral"} />
                  </div>
                  {(selectedTaskDiagnostics.logic_warning || selectedTaskDiagnostics.orphaned_input || selectedTaskDiagnostics.unreachable || selectedTaskDiagnostics.disconnected) && (
                    <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300">Task Diagnostic Focus</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTaskDiagnostics.logic_warning && <SemanticBadge label="Decision Logic Needs Repair" tone="warning" />}
                        {selectedTaskDiagnostics.orphaned_input && <SemanticBadge label="Orphaned Lineage" tone="danger" />}
                        {selectedTaskDiagnostics.unreachable && <SemanticBadge label="Unreachable from Trigger" tone="danger" />}
                        {selectedTaskDiagnostics.disconnected && <SemanticBadge label="Disconnected from Outcome" tone="danger" />}
                      </div>
                      <p className="text-[11px] font-bold leading-relaxed text-white/70">
                        Use the issue rail and route controls to stabilize this task before treating the workflow as certification-ready or automation-ready.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !selectedTask.name) ? "text-status-error" : "text-white/40")}>
                      {selectedTask.interface ? (selectedTask.interface === 'TRIGGER' ? 'Trigger Origin *' : 'Outcome Result *') : (selectedTask.task_type === 'LOOP' ? 'Condition Nomenclature *' : 'Operational Title *')}
                    </label>
                    <input 
                      className={cn(
                        "w-full bg-black/40 border rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase focus:border-theme-accent outline-none transition-all",
                        (showErrors && !selectedTask.name) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                      )} 
                      value={selectedTask.name || ''} 
                      onFocus={saveToHistory}
                      onChange={e => updateTask(selectedTaskId, { name: e.target.value })} 
                      disabled={isProtected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !selectedTask.description) ? "text-status-error" : "text-white/40")}>Contextual Description *</label>
                    <textarea 
                      className={cn(
                        "w-full bg-black/40 border rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-32 resize-none focus:border-theme-accent outline-none leading-relaxed transition-all",
                        (showErrors && !selectedTask.description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                      )} 
                      value={selectedTask.description || ''} 
                      onFocus={saveToHistory}
                      onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                      disabled={isProtected}
                    />
                  </div>

                  {!isProtected && (
                    <>
                      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 space-y-2">
                        <SearchableSelect 
                          label="Task Logic Type"
                          options={taskTypes}
                          value={selectedTask.task_type}
                          onChange={val => updateTask(selectedTaskId, { task_type: val })}
                          placeholder="SELECT TYPE..."
                        />
                      </div>

                      {selectedTask.task_type === 'LOOP' && (
                        <div className="space-y-3 p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-fuchsia-400">Decision Routing</p>
                              <p className="text-[11px] font-bold text-white/60 mt-1">Decision nodes require exactly two outgoing branches labeled `True` and `False`.</p>
                            </div>
                            <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", decisionEdges.length === 2 ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10" : "border-fuchsia-500/20 text-fuchsia-400 bg-fuchsia-500/10")}>
                              {decisionEdges.length} branches
                            </span>
                          </div>
                          <div className="space-y-2">
                            {decisionEdges.length > 0 ? decisionEdges.map(edge => (
                              <div key={edge.id} className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl p-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 min-w-[88px]">Branch</span>
                                <input className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-black text-white uppercase outline-none focus:border-theme-accent" value={edge.data?.label || ''} onFocus={saveToHistory} onChange={e => updateEdge(edge.id, { label: e.target.value })} placeholder="TRUE or FALSE" />
                                <button onClick={() => { saveToHistory(); updateEdge(edge.id, { label: 'True' }); }} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">True</button>
                                <button onClick={() => { saveToHistory(); updateEdge(edge.id, { label: 'False' }); }} className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest text-rose-400">False</button>
                              </div>
                            )) : (
                              <div className="rounded-xl border border-dashed border-fuchsia-500/20 p-4 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-400/70">
                                Create two outgoing edges from this decision node to unlock branch labeling.
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" value={selectedTask.decision_details?.question || ''} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { decision_details: { ...(selectedTask.decision_details || {}), question: e.target.value } })} placeholder="Decision question" />
                            <input className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" value={selectedTask.decision_details?.expected_distribution || ''} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { decision_details: { ...(selectedTask.decision_details || {}), expected_distribution: e.target.value } })} placeholder="Expected branch split" />
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Decision Ergonomics</p>
                            <div className="mt-3 grid grid-cols-3 gap-3">
                              <MetricTile label="Question" value={selectedTask.decision_details?.question?.trim() ? 'Ready' : 'Missing'} tone={selectedTask.decision_details?.question?.trim() ? 'success' : 'warning'} />
                              <MetricTile label="Branch Split" value={selectedTask.decision_details?.expected_distribution?.trim() ? 'Ready' : 'Missing'} tone={selectedTask.decision_details?.expected_distribution?.trim() ? 'success' : 'warning'} />
                              <MetricTile label="Routes" value={decisionEdges.length} tone={decisionEdges.length === 2 ? 'success' : 'warning'} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => { saveToHistory(); decisionEdges.slice(0, 1).forEach(edge => { updateEdge(edge.id, { label: 'True' }); }); decisionEdges.slice(1, 2).forEach(edge => { updateEdge(edge.id, { label: 'False' }); }); }} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                                Normalize True/False
                              </button>
                              <button onClick={() => { saveToHistory(); updateTask(selectedTaskId, { decision_details: { ...(selectedTask.decision_details || {}), expected_distribution: selectedTask.decision_details?.expected_distribution || '50 / 50', question: selectedTask.decision_details?.question || `Should ${selectedTask.name || 'this path'} continue?` } }); }} className="rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">
                                Autofill Decision Framing
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.03] border border-white/8 rounded-3xl">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1 text-center block">TAT Manual (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-blue-400 text-center" value={selectedTask.manual_time_minutes ?? 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1 text-center block">TAT Machine (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-purple-400 text-center" value={selectedTask.automation_time_minutes ?? 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-end rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                        <SearchableSelect
                          label="Owner Team"
                          options={runtimeConfig?.organization?.team_options || []}
                          value={selectedTask.owning_team || ''}
                          onChange={val => updateTask(selectedTaskId, { owning_team: val })}
                          placeholder="Team Name"
                        />
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Positions</label>
                          <button 
                            onClick={() => setOwnerPositionsCollapsed(!ownerPositionsCollapsed)}
                            className={cn("w-full border rounded-xl px-4 h-11 flex items-center justify-between transition-all", ownerPositionsCollapsed ? "bg-white/5 border-white/10 text-white/40" : "bg-theme-accent/10 border-theme-accent/30 text-white")}
                          >
                            <span className="text-[11px] font-black uppercase truncate">
                              {selectedTask.owner_positions?.length || 0} Entities
                            </span>
                            {ownerPositionsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Phase</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-[12px] font-bold text-white outline-none focus:border-theme-accent placeholder:text-white/10 transition-all" value={selectedTask.phase_name || ''} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { phase_name: e.target.value })} placeholder="e.g. Verification" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Subflow</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-[12px] font-bold text-white outline-none focus:border-theme-accent placeholder:text-white/10 transition-all" value={selectedTask.subflow_name || ''} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { subflow_name: e.target.value })} placeholder="e.g. Exception Handling" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Task Block</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-[12px] font-bold text-white outline-none focus:border-theme-accent placeholder:text-white/10 transition-all" value={selectedTask.task_block_key || ''} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { task_block_key: e.target.value })} placeholder="Reusable block label" />
                        </div>
                      </div>
                      {!ownerPositionsCollapsed && (
                        <div className="p-4 space-y-3 border border-white/10 bg-black/40 rounded-2xl animate-apple-in -mt-2 shadow-2xl">
                          {(selectedTask.owner_positions || []).map((pos, idx) => (
                            <div key={idx} className="flex gap-2 group/pos animate-apple-in items-center">
                              {itemEditModes[`pos-${idx}`] ? (
                                <div className="flex-1 flex gap-2 animate-apple-in">
                                  <input 
                                    autoFocus
                                    className="flex-1 bg-black/60 border border-theme-accent rounded-lg px-3 py-2 text-[11px] font-bold text-white outline-none"
                                    value={pos}
                                    onFocus={saveToHistory}
                                    onChange={(e) => updateTask(selectedTaskId, { owner_positions: selectedTask.owner_positions?.map((p, i) => i === idx ? e.target.value : p) })}
                                  />
                                  <button onClick={() => toggleItemEdit(`pos-${idx}`)} className="p-2 bg-theme-accent text-white rounded-lg shadow-lg shadow-theme-accent/20 hover:scale-105 transition-all"><Save size={14} /></button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-[11px] font-black text-white/80 uppercase tracking-tight flex items-center justify-between group-hover/pos:bg-white/10 transition-all italic">
                                    {pos || 'Untitled Entry'}
                                    <div className="flex items-center gap-1 opacity-0 group-hover/pos:opacity-100 transition-all">
                                      <button onClick={() => toggleItemEdit(`pos-${idx}`)} className="p-1.5 hover:bg-theme-accent/20 text-white/20 hover:text-theme-accent rounded-md transition-all"><Edit3 size={12} /></button>
                                      {confirmingDelete === `pos-${idx}` ? (
                                        <div className="flex items-center gap-1 animate-apple-in bg-status-error/20 rounded-md p-1 border border-status-error/30">
                                          <button onClick={() => { saveToHistory(); updateTask(selectedTaskId, { owner_positions: selectedTask.owner_positions?.filter((_, i) => i !== idx) }); setConfirmingDelete(null); }} className="px-2 py-1 bg-status-error text-[7px] font-black uppercase text-white rounded-sm">Conf</button>
                                          <button onClick={() => setConfirmingDelete(null)} className="text-white/20 hover:text-white"><X size={10} /></button>
                                        </div>
                                      ) : (
                                        <button onClick={() => setConfirmingDelete(`pos-${idx}`)} className="p-1.5 hover:bg-status-error/20 text-white/20 hover:text-status-error rounded-md transition-all"><Trash size={12} /></button>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newList = [...(selectedTask.owner_positions || []), ''];
                              saveToHistory();
                              updateTask(selectedTaskId, { owner_positions: newList });
                              toggleItemEdit(`pos-${newList.length - 1}`);
                            }} 
                            className="w-full py-2.5 bg-theme-accent/10 border border-theme-accent/30 rounded-xl text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-theme-accent/5"
                          >
                            <Plus size={14} strokeWidth={3} /> Add Operation Role
                          </button>
                        </div>
                      )}

                      {templates.length > 0 && (
                        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Reusable Task Blocks</p>
                              <p className="mt-1 text-[11px] font-bold text-white/52">Drop in standardized task blocks and subflow starters directly from the builder.</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {templates.flatMap((template: any) => template.task_blocks || []).slice(0, 8).map((block: any, index: number) => (
                              <button key={`${block.label}-${index}`} onClick={() => addTaskBlock(block)} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                                {block.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <CollapsibleSection 
                        title="Involved IT Systems" 
                        isOpen={expandedSections.target_systems || false} 
                        toggle={() => toggleSection('target_systems')} 
                        count={selectedTask.target_systems.length}
                        icon={<Database size={14} />}
                      >
                        <div className="space-y-3 pt-4">
                          {(selectedTask.target_systems || []).map(sys => (
                            <NestedCollapsible 
                              key={sys.id} 
                              title={sys.name || "New System Entry"} 
                              isOpen={openItems[sys.id]} 
                              toggle={() => toggleItem(sys.id)} 
                              onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.filter(x => x.id !== sys.id) }); }}
                              onEdit={() => toggleItemEdit(sys.id)}
                              isEditing={itemEditModes[sys.id]}
                            >
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">System Name</label>
                                  <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={sys.name} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(x => x.id === sys.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., SAP, Salesforce, Internal Tool" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Usage Context</label>
                                  <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent" value={sys.usage} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(x => x.id === sys.id ? { ...x, usage: e.target.value } : x) })} placeholder="Describe how the system is used in this task..." />
                                </div>
                                <ImagePasteField figures={sys.figures || []} onPaste={(figs) => { saveToHistory(); updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(x => x.id === sys.id ? { ...x, figures: figs } : x) }); }} label="System Screenshots (Ctrl+V)" />
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Documentation Link</label>
                                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    <Link2 size={12} className="text-theme-accent" />
                                    <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={sys.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(x => x.id === sys.id ? { ...x, link: e.target.value } : x) })} placeholder="URL to SOP or Wiki" />
                                  </div>
                                </div>
                              </div>
                            </NestedCollapsible>
                          ))}
                          <button 
                            onClick={() => {
                              const id = Date.now().toString();
                              saveToHistory();
                              updateTask(selectedTaskId, { target_systems: [...(selectedTask.target_systems || []), { id, name: '', usage: '', figures: [], link: '' }] });
                              toggleItem(id);
                              toggleItemEdit(id);
                            }} 
                            className="w-full py-2.5 bg-theme-accent/10 border border-theme-accent/30 rounded-xl text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-theme-accent/5"
                          >
                            <Plus size={14} strokeWidth={3} /> Add System Dependency
                          </button>
                        </div>
                      </CollapsibleSection>
                    </>
                  )}
                </div>
              )}
              {inspectorTab === 'data' && (
                <div className="space-y-8 animate-apple-in">
                  <CollapsibleSection 
                    title="Task Inputs" 
                    isOpen={expandedSections.inputs} 
                    toggle={() => toggleSection('inputs')} 
                    count={selectedTask.source_data_list.length}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.source_data_list.map((sd) => (
                        <NestedCollapsible 
                          key={sd.id} 
                          title={sd.name || "New Input"} 
                          isOpen={openItems[sd.id]} 
                          toggle={() => toggleItem(sd.id)} 
                          onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) }); }} 
                          isLocked={!!sd.from_task_id}
                          onEdit={() => toggleItemEdit(sd.id)}
                          isEditing={itemEditModes[sd.id]}
                        >
                          <div className="space-y-4">
                            {sd.from_task_name && (
                              <div className="px-3 py-1 bg-theme-accent/20 border border-theme-accent/30 rounded text-[9px] font-black text-theme-accent uppercase flex items-center gap-2">
                                <Link2 size={10} /> Referenced from: {sd.from_task_name}
                              </div>
                            )}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Input Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent disabled:opacity-50" value={sd.name} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., FDC Log, SPC Chart" disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent disabled:opacity-50" value={sd.description} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the input..." disabled={!!sd.from_task_id} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 outline-none focus:border-theme-accent disabled:opacity-50" value={sd.data_example} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" disabled={!!sd.from_task_id} />
                            </div>
                            <ImagePasteField figures={sd.figures || []} onPaste={(figs) => { saveToHistory(); updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, figures: figs } : x) }); }} label="Evidence Figures (Ctrl+V)" isLocked={!!sd.from_task_id} />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none disabled:opacity-50" value={sd.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" disabled={!!sd.from_task_id} />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id, name: '', description: '', figures: [], link: '', data_example: '' }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} className="py-2 bg-theme-accent/10 border border-theme-accent/30 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-lg flex items-center justify-center gap-2"><Plus size={12} /> Add Manual Input</button>
                        <button onClick={() => setIsOutputPickerOpen(true)} className="py-2 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-lg flex items-center justify-center gap-2"><Search size={12} /> Registry Search</button>
                      </div>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Task Outputs" 
                    isOpen={expandedSections.outputs} 
                    toggle={() => toggleSection('outputs')} 
                    count={selectedTask.output_data_list.length}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.output_data_list.map((od) => (
                        <NestedCollapsible 
                          key={od.id} 
                          title={od.name || "New Output"} 
                          isOpen={openItems[od.id]} 
                          toggle={() => toggleItem(od.id)} 
                          onDelete={() => {
                            if (!checkOutputDependency(od.id)) {
                              saveToHistory();
                              updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) });
                            }
                          }}
                          onEdit={() => toggleItemEdit(od.id)}
                          isEditing={itemEditModes[od.id]}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Output Name *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={od.name} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., Final Report, Updated DB Entry" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description</label>
                              <textarea className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent" value={od.description} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, description: e.target.value } : x) })} placeholder="Define the output artifact..." />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Format / Example</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 outline-none focus:border-theme-accent" value={od.data_example} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, data_example: e.target.value } : x) })} placeholder="Example value or format" />
                            </div>
                            <ImagePasteField figures={od.figures || []} onPaste={(figs) => { saveToHistory(); updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, figures: figs } : x) }); }} label="Evidence Figures (Ctrl+V)" />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none" value={od.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id, name: '', description: '', figures: [], link: '', data_example: '' }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} 
                        className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-lg flex items-center justify-center gap-2 mt-2"
                      >
                        <Plus size={12} /> Add Output Artifact
                      </button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
              {inspectorTab === 'exceptions' && (
                <div className="space-y-8">
                  <CollapsibleSection 
                    title="Operational Roadblocks" 
                    isOpen={expandedSections.blockers} 
                    toggle={() => toggleSection('blockers')} 
                    count={selectedTask.blockers.length}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.blockers.map((b) => (
                        <NestedCollapsible 
                          key={b.id} 
                          title={b.blocking_entity || "New Roadblock"} 
                          isOpen={openItems[b.id]} 
                          toggle={() => toggleItem(b.id)} 
                          onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) }); }}
                          onEdit={() => toggleItemEdit(b.id)}
                          isEditing={itemEditModes[b.id]}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !b.blocking_entity) ? "text-status-error" : "text-white/20")}>Roadblock Entity *</label>
                              <input 
                                className={cn(
                                  "w-full bg-black/40 border rounded-lg p-3 text-[12px] text-white outline-none transition-all",
                                  (showErrors && !b.blocking_entity) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-amber-500"
                                )} 
                                value={b.blocking_entity} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} 
                                placeholder="What stops the process?" 
                              />
                            </div>
                            <div className="space-y-1">
                              <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !b.reason) ? "text-status-error" : "text-white/20")}>Root Cause / Reason *</label>
                              <textarea 
                                className={cn(
                                  "w-full bg-black/40 border rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none transition-all",
                                  (showErrors && !b.reason) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-amber-500"
                                )} 
                                value={b.reason || ''} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} 
                                placeholder="Why does this happen?" 
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Average Delay (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={b.average_delay_minutes ?? 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Probability ({b.probability_percent || 0}%)</label>
                              </div>
                              <input type="range" min="0" max="100" step="5" className="w-full accent-amber-500" value={b.probability_percent || 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, probability_percent: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !b.standard_mitigation) ? "text-status-error" : "text-white/20")}>Standard Mitigation *</label>
                              <textarea 
                                className={cn(
                                  "w-full bg-black/40 border rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none transition-all",
                                  (showErrors && !b.standard_mitigation) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-amber-500"
                                )} 
                                value={b.standard_mitigation || ''} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, standard_mitigation: e.target.value } : x) })} 
                                placeholder="Action to reduce delay..." 
                              />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id, blocking_entity: '', reason: '', standard_mitigation: '', average_delay_minutes: 0, probability_percent: 10 }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} 
                        className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        <Plus size={12} /> Add Roadblock
                      </button>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Human Errors & Recoveries" 
                    isOpen={expandedSections.errors} 
                    toggle={() => toggleSection('errors')} 
                    count={selectedTask.errors.length}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.errors.map((er) => (
                        <NestedCollapsible 
                          key={er.id} 
                          title={er.error_type || "New Error"} 
                          isOpen={openItems[er.id]} 
                          toggle={() => toggleItem(er.id)} 
                          onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== er.id) }); }}
                          onEdit={() => toggleItemEdit(er.id)}
                          isEditing={itemEditModes[er.id]}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !er.error_type) ? "text-status-error" : "text-white/20")}>Error Type *</label>
                              <input 
                                className={cn(
                                  "w-full bg-black/40 border rounded-lg p-3 text-[12px] text-white outline-none transition-all",
                                  (showErrors && !er.error_type) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-status-error"
                                )} 
                                value={er.error_type} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, error_type: e.target.value } : x) })} 
                                placeholder="e.g. Data Entry Mistake" 
                              />
                            </div>
                            <div className="space-y-1">
                              <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !er.description) ? "text-status-error" : "text-white/20")}>Error Description *</label>
                              <textarea 
                                className={cn(
                                  "w-full bg-black/40 border rounded-lg p-3 text-[11px] text-white/60 h-20 resize-none outline-none transition-all",
                                  (showErrors && !er.description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-status-error"
                                )} 
                                value={er.description || ''} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, description: e.target.value } : x) })} 
                                placeholder="What exactly goes wrong?" 
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Recovery Time (Minutes)</label>
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={er.recovery_time_minutes ?? 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) || 0 } : x) })} />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Probability ({er.probability_percent || 0}%)</label>
                              </div>
                              <input type="range" min="0" max="100" step="5" className="w-full accent-status-error" value={er.probability_percent || 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, probability_percent: parseInt(e.target.value) } : x) })} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Correction Method</label>
                              <textarea 
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/60 h-32 resize-none outline-none focus:border-status-error" 
                                value={er.correction_method || ''} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, correction_method: e.target.value } : x) })}
                                placeholder="Steps to correct this error..." 
                              />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id, error_type: '', description: '', recovery_time_minutes: 0, probability_percent: 5, correction_method: '' }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} 
                        className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 mt-2"
                      >
                        <Plus size={12} /> Add Human Error
                      </button>
                    </div>
                  </CollapsibleSection>

                  <ManagedListSection 
                    title="Tribal Knowledge Entries" 
                    isOpen={expandedSections.tribal} 
                    toggle={() => toggleSection('tribal')} 
                    items={selectedTask.tribal_knowledge}
                    onUpdate={(items) => updateTask(selectedTaskId, { tribal_knowledge: items })}
                    placeholder="Enter undocumented process knowledge..."
                    icon={<LucideWorkflow size={14} />}
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
                        onClick={() => { saveToHistory(); updateTask(selectedTaskId, { validation_needed: !selectedTask.validation_needed }); }} 
                        className={cn("relative w-12 h-6 rounded-full transition-all duration-300", selectedTask.validation_needed ? "bg-orange-500" : "bg-white/10")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", selectedTask.validation_needed ? "left-7 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "left-1")} />
                      </button>
                    </div>

                    {selectedTask.validation_needed && (
                      <div className="space-y-6 animate-apple-in pt-6 border-t border-white/5">
                        <CollapsibleSection 
                          title="Verification Procedure" 
                          isOpen={true} 
                          toggle={() => {}} 
                          count={selectedTask.validation_procedure_steps.length}
                        >
                          <div className="space-y-4 pt-4">
                            {(selectedTask.validation_procedure_steps || []).map((step, idx) => (
                              <NestedCollapsible 
                                key={step.id} 
                                title={`Verification Step ${idx + 1}`} 
                                isOpen={openItems[step.id]} 
                                toggle={() => toggleItem(step.id)} 
                                onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.filter(x => x.id !== step.id) }); }}
                                onEdit={() => toggleItemEdit(step.id)}
                                isEditing={itemEditModes[step.id]}
                              >
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !step.description) ? "text-status-error" : "text-white/20")}>Description *</label>
                                    <textarea 
                                      className={cn(
                                        "w-full bg-black/40 border rounded-xl p-3 text-[12px] text-white/80 h-24 resize-none outline-none transition-all",
                                        (showErrors && !step.description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10 focus:border-orange-500"
                                      )} 
                                      value={step.description} 
                                      onFocus={saveToHistory}
                                      onChange={e => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                      placeholder="Describe the verification action..."
                                    />
                                  </div>
                                  <ImagePasteField figures={step.figures || []} onPaste={(figs) => { saveToHistory(); updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, figures: figs } : x) }); }} label="Evidence Figures (Ctrl+V)" />
                                </div>
                              </NestedCollapsible>
                            ))}
                            <button 
                              onClick={() => {
                                const id = Date.now().toString();
                                saveToHistory();
                                updateTask(selectedTaskId, { validation_procedure_steps: [...(selectedTask.validation_procedure_steps || []), { id, description: '', figures: [] }] });
                                toggleItem(id);
                                toggleItemEdit(id);
                              }} 
                              className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                            >
                              + Add Verification Step
                            </button>
                          </div>
                        </CollapsibleSection>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {inspectorTab === 'appendix' && (
                <div className="space-y-12 pb-20">
                  <CollapsibleSection
                    title="Node Discussion"
                    isOpen={true}
                    toggle={() => {}}
                    count={scopedComments.length}
                  >
                    <div className="space-y-4 pt-4">
	                      <div className="space-y-3">
	                        {scopedComments.filter(comment => !comment.parent_id).map(comment => (
	                          <div key={comment.id} className={cn("border rounded-2xl p-4 transition-all", comment.resolved ? "bg-emerald-500/[0.06] border-emerald-500/12" : "bg-white/[0.03] border-white/5")}>
	                            <div className="flex items-center justify-between mb-2 gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
	                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">{comment.author}</span>
                                  <SemanticBadge label={comment.resolved ? 'Resolved' : 'Open'} tone={comment.resolved ? 'success' : 'accent'} />
                                  {comment.assignee && <SemanticBadge label={`Assigned ${comment.assignee}`} tone="warning" />}
                                  {comment.review_state && comment.review_state !== 'open' && <SemanticBadge label={comment.review_state} tone="neutral" />}
                                </div>
	                              <div className="flex items-center gap-2">
                                  <span className="text-[8px] text-white/20 font-black uppercase">{new Date(comment.created_at).toLocaleString()}</span>
                                  <button
                                    onClick={() => {
                                      saveToHistory();
                                      setMetadata({
                                        ...metadata,
                                        comments: metadata.comments.map(entry => entry.id === comment.id ? { ...entry, resolved: !entry.resolved } : entry)
                                      });
                                      setIsDirty?.(true);
                                    }}
                                    className="px-3 py-1 rounded-xl border border-white/10 text-[8px] font-black uppercase tracking-[0.16em] text-white/55 hover:text-white hover:bg-white/5 transition-all"
                                  >
                                    {comment.resolved ? 'Reopen' : 'Resolve'}
                                  </button>
                                </div>
	                            </div>
	                            <p className={cn("text-[12px] font-bold leading-relaxed whitespace-pre-wrap", comment.resolved ? "text-white/55" : "text-white/80")}>{comment.message}</p>
	                            {comment.mentions.length > 0 && (
	                              <div className="flex flex-wrap gap-2 mt-3">
	                                {comment.mentions.map(mention => <span key={mention} className="px-2 py-1 rounded-lg bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase tracking-widest text-theme-accent">@{mention}</span>)}
	                              </div>
	                            )}
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <SearchableSelect label="Assign" options={mentionOptions} value={comment.assignee || ''} onChange={val => { saveToHistory(); setMetadata({ ...metadata, comments: metadata.comments.map(entry => entry.id === comment.id ? { ...entry, assignee: val } : entry) }); setIsDirty?.(true); }} />
                                <SearchableSelect label="Review State" options={['open', 'changes-requested', 'approved']} value={comment.review_state || 'open'} onChange={val => { saveToHistory(); setMetadata({ ...metadata, comments: metadata.comments.map(entry => entry.id === comment.id ? { ...entry, review_state: val } : entry) }); setIsDirty?.(true); }} />
                              </div>
                              <div className="mt-3 space-y-2 pl-4 border-l border-white/10">
                                {scopedComments.filter(reply => reply.parent_id === comment.id).map(reply => (
                                  <div key={reply.id} className="rounded-xl border border-white/8 bg-black/20 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">{reply.author}</span>
                                      <span className="text-[8px] text-white/20 font-black uppercase">{new Date(reply.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/75 whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <textarea className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white/80 h-20 resize-none outline-none focus:border-theme-accent transition-all" value={commentReplyDrafts[comment.id] || ''} onChange={e => setCommentReplyDrafts(prev => ({ ...prev, [comment.id]: e.target.value }))} placeholder="Reply to this thread..." />
                                  <button onClick={() => {
                                    const reply = (commentReplyDrafts[comment.id] || '').trim();
                                    if (!reply) return;
                                    saveToHistory();
                                    const mentions = mentionOptions.filter((option: any) => reply.toLowerCase().includes(`@${option.toLowerCase()}`));
                                    setMetadata({
                                      ...metadata,
                                      comments: [
                                        ...metadata.comments,
                                        { id: createLocalId('comment'), parent_id: comment.id, scope: comment.scope, scope_id: comment.scope_id, author: metadata.access_control.owner || defaultOwner, message: reply, mentions, created_at: new Date().toISOString(), resolved: false }
                                      ]
                                    });
                                    setCommentReplyDrafts(prev => ({ ...prev, [comment.id]: '' }));
                                    setIsDirty?.(true);
                                  }} className="px-4 py-2 self-end bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Reply</button>
                                </div>
                              </div>
	                          </div>
	                        ))}
                      </div>
                      <div className="space-y-3">
                        <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/80 h-28 resize-none outline-none focus:border-theme-accent transition-all" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder={`Leave a node-specific note. Use @${mentionOptions[0] || 'Process SME'} to mention groups.`} />
                        <div className="flex gap-3">
                          <button onClick={() => {
                            if (!commentDraft.trim()) return;
                            saveToHistory();
                            const mentions = mentionOptions.filter((option: any) => commentDraft.toLowerCase().includes(`@${option.toLowerCase()}`));
                            setMetadata({
                              ...metadata,
                              comments: [
                                ...metadata.comments,
                                { id: createLocalId('comment'), scope: 'task', scope_id: selectedTaskId || undefined, author: metadata.access_control.owner || defaultOwner, message: commentDraft.trim(), mentions, created_at: new Date().toISOString(), resolved: false, assignee: '', review_state: 'open' }
                              ]
                            });
                            setCommentDraft('');
                            setIsDirty?.(true);
                          }} className="px-5 py-2.5 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Add Comment</button>
                          <div className="flex-1">
                            <SearchableSelect label="Mentions" options={mentionOptions} value={[]} onChange={() => {}} placeholder="@MENTION DIRECTORY" isMulti />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Operational References" 
                    isOpen={expandedSections.references} 
                    toggle={() => toggleSection('references')} 
                    count={selectedTask.reference_links.length}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.reference_links.map(l => (
                        <NestedCollapsible 
                          key={l.id} 
                          title={l.label || "New Reference"} 
                          isOpen={openItems[l.id]} 
                          toggle={() => toggleItem(l.id)} 
                          onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== l.id) }); }}
                          onEdit={() => toggleItemEdit(l.id)}
                          isEditing={itemEditModes[l.id]}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Reference Label *</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={l.label} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) })} placeholder="e.g., SOP v1.2" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Target URL / Path</label>
                              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                <Link2 size={12} className="text-theme-accent" />
                                <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={l.url} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === l.id ? { ...x, url: e.target.value } : x) })} placeholder="https://..." />
                              </div>
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id, label: '', url: '' }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} 
                        className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                      >
                        + Add Reference Link
                      </button>
                    </div>
                  </CollapsibleSection>

	                  <CollapsibleSection 
	                    title="Task Visual Assets" 
                    isOpen={expandedSections.assets} 
                    toggle={() => toggleSection('assets')} 
                    count={selectedTask.media.length}
                  >
	                    <div className="pt-4">
                        {selectedTask.media.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {selectedTask.media.map((asset, idx) => (
                              <div key={asset.id || idx} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                                {asset.type === 'image' ? (
                                  <div className="aspect-[4/3] bg-black/30">
                                    <img src={asset.url} alt={asset.label || `Asset ${idx + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="aspect-[4/3] bg-black/30 flex items-center justify-center">
                                    <Paperclip size={26} className="text-theme-accent" />
                                  </div>
                                )}
                                <div className="p-3 space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/38">{asset.type === 'image' ? `Asset ${idx + 1}` : 'Document Asset'}</p>
                                  <input
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-theme-accent"
                                    value={asset.label || ''}
                                    onFocus={saveToHistory}
                                    onChange={e => updateTask(selectedTaskId, { media: selectedTask.media.map((entry: any) => entry.id === asset.id ? { ...entry, label: e.target.value } : entry) })}
                                    placeholder="Asset label"
                                  />
                                  <p className="text-[10px] font-bold text-white/55 truncate">{asset.file_name || asset.mime_type || asset.url}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      <ImagePasteField figures={selectedTask.media.filter(m => m.type !== 'doc').map(m => m.url)} onPaste={(figs) => {
                          saveToHistory();
                          const documents = selectedTask.media.filter(m => m.type === 'doc');
                          updateTask(selectedTaskId, {
                            media: [
                              ...documents,
                              ...figs.map((f, index) => ({
                                id: `${Date.now()}-${index}`,
                                type: 'image' as const,
                                url: f,
                                label: 'Pasted Asset',
                              })),
                            ],
                          });
                        }} label="Visual Assets (Ctrl+V)" />
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">Document Attachments</p>
                              <p className="mt-1 text-[11px] font-bold text-white/55">Attach PDFs or working docs so the workflow stays evidence-backed and review-ready.</p>
                            </div>
                            <label className="rounded-xl border border-theme-accent/30 bg-theme-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all cursor-pointer">
                              Upload File
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.md,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    saveToHistory();
                                    void attachMediaAsset(selectedTaskId, file);
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
	                    </div>
	                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Step-by-Step Instructions" 
                    isOpen={expandedSections.instructions} 
                    toggle={() => toggleSection('instructions')} 
                    count={selectedTask.instructions.length}
                  >
                    <div className="space-y-4 pt-4">
                      {selectedTask.instructions.map((step, idx) => (
                        <NestedCollapsible 
                          key={step.id} 
                          title={`Instruction Step ${idx + 1}`} 
                          isOpen={openItems[step.id]} 
                          toggle={() => toggleItem(step.id)} 
                          onDelete={() => { saveToHistory(); updateTask(selectedTaskId, { instructions: selectedTask.instructions.filter(x => x.id !== step.id) }); }}
                          onEdit={() => toggleItemEdit(step.id)}
                          isEditing={itemEditModes[step.id]}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Description *</label>
                              <textarea 
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/80 h-32 resize-none outline-none focus:border-theme-accent transition-all" 
                                value={step.description} 
                                onFocus={saveToHistory}
                                onChange={e => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, description: e.target.value } : x) })} 
                                placeholder="Describe the action..."
                              />
                            </div>
                            <ImagePasteField figures={step.figures || []} onPaste={(figs) => { saveToHistory(); updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, figures: figs } : x) }); }} label="Step Figures (Ctrl+V)" />
                          </div>
                        </NestedCollapsible>
                      ))}
                      <button 
                        onClick={() => {
                          const id = Date.now().toString();
                          saveToHistory();
                          updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id, description: '', figures: [], links: [] }] });
                          toggleItem(id);
                          toggleItemEdit(id);
                        }} 
                        className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                      >
                        + Add Instruction Step
                      </button>
                    </div>
                  </CollapsibleSection>
                </div>
              )}
            </div>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="p-6 space-y-10 animate-apple-in">
              <SectionEyebrow icon={<Link2 size={13} />} title="Route Configuration" hint="Clarify branch semantics and keep connector behavior readable at a glance." />
              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 flex flex-wrap gap-2">
                <SemanticBadge label={selectedEdge.data?.label || 'Unlabeled'} tone={selectedEdge.data?.label === 'True' ? 'success' : selectedEdge.data?.label === 'False' ? 'danger' : 'neutral'} />
                <SemanticBadge label={(selectedEdge.data?.edgeStyle || 'bezier').toUpperCase()} tone="accent" />
                <SemanticBadge label={(selectedEdge.data?.lineStyle || 'solid').toUpperCase()} tone="neutral" />
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3"><Link2 size={16} className="text-theme-accent" /><span className="text-[14px] font-black text-white uppercase tracking-widest">Edge Configuration</span></div>
                <div className="flex gap-2">
                  <button onClick={() => swapEdgeDirection(selectedEdgeId)} title="Swap Direction" className="text-white/40 hover:text-white p-2 bg-white/5 border border-white/10 rounded-md transition-all"><LucideWorkflow size={16} className="rotate-90" /></button>
	                  <button onClick={() => { saveToHistory(); setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-xl transition-all"><Trash size={16} /></button>
                </div>
              </div>
	              <div className="space-y-6">
	                <div className="space-y-2">
	                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
	                  <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onFocus={saveToHistory} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} />
	                </div>
                  {selectedTaskId === null && tasks.find(task => String(task.node_id || task.id) === String(selectedEdge.source))?.task_type === 'LOOP' && (
                    <div className="flex gap-2">
                      <button onClick={() => { saveToHistory(); updateEdge(selectedEdgeId, { label: 'True' }); }} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">Set True</button>
                      <button onClick={() => { saveToHistory(); updateEdge(selectedEdgeId, { label: 'False' }); }} className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-400">Set False</button>
                    </div>
                  )}
	                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Style</label>
                  <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                    {(['smoothstep', 'bezier', 'straight'] as const).map((s) => (
                      <button key={s} onClick={() => { saveToHistory(); updateEdge(selectedEdgeId, { edgeStyle: s }); }} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.edgeStyle || 'bezier') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Line Style</label>
                  <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                    {(['solid', 'dashed'] as const).map((s) => (
                      <button key={s} onClick={() => { saveToHistory(); updateEdge(selectedEdgeId, { lineStyle: s }); }} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all", (selectedEdge.data?.lineStyle || 'solid') === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Color Palette</label>
                  <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => (
                      <button key={c} onClick={() => { saveToHistory(); updateEdge(selectedEdgeId, { color: c }); }} className={cn("w-6 h-6 rounded-full border transition-all", (selectedEdge.data?.color || '#ffffff') === c ? "border-white scale-125" : "border-transparent hover:scale-110")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-apple-in pb-20">
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

              <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(10,17,32,0.02))] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent">No Node Selected</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight">Repository Definition Surface</h3>
                    <p className="max-w-[34rem] text-[12px] font-bold text-white/58 leading-relaxed">Use this panel to carry the workflow from intake context into a build-ready, reviewable definition with routing, governance, and operational signal quality.</p>
                  </div>
                  <FlowStageRail active={saveState === 'blocked' ? 'validate' : saveState === 'dirty' || saveState === 'saving' ? 'builder' : 'commit'} />
                </div>
                <div className="grid grid-cols-4 gap-4 mt-5">
                  <MetricTile label="Readiness Signals" value={issueItems.length} tone={issueItems.some(issue => issue.severity === 'error') ? "danger" : "accent"} />
                  <MetricTile label="Nodes" value={nodes.length} tone="neutral" />
                  <MetricTile label="Routes" value={edges.length} tone="neutral" />
                  <MetricTile label="State" value={saveState === 'clean' ? 'Clean' : saveState === 'dirty' ? 'Unsaved' : saveState === 'saving' ? 'Saving' : 'Blocked'} tone={saveState === 'blocked' ? "danger" : saveState === 'dirty' ? "warning" : saveState === 'saving' ? "accent" : "success"} />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <SemanticBadge label={`Workspace: ${metadata.workspace}`} tone="accent" />
                  <SemanticBadge label={`Version v${metadata.version}`} tone="neutral" />
                  <SemanticBadge label={metadata.workflow_type || 'Workflow Type Pending'} tone={metadata.workflow_type ? "neutral" : "warning"} />
                </div>
              </div>

              <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Metadata Navigator</p>
                  <div className="flex flex-wrap gap-2">
                    {['Overview', 'Trigger / Outcome', 'Governance', 'Review', 'Reuse'].map(label => (
                      <span key={label} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">{label}</span>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold leading-relaxed text-white/52">
                    This definition panel now supports governance, rollback, policy, reuse, and review context without leaving the builder.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Policy and Recovery Guardrails</p>
                      <p className="mt-2 text-[11px] font-bold text-white/52">Department, site, and version controls that should stay visible before save or rollback.</p>
                    </div>
                    {rollbackPreview?.available && onCreateRollbackDraft && (
                      <button onClick={onCreateRollbackDraft} className="rounded-xl border border-theme-accent/30 bg-theme-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                        Create Rollback Draft
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(policyOverlay?.rules || []).slice(0, 4).map((rule: any) => (
                      <SemanticBadge key={rule.title} label={rule.title} tone={rule.severity === 'danger' ? 'danger' : rule.severity === 'warning' ? 'warning' : 'accent'} />
                    ))}
                    {rollbackPreview?.available && <SemanticBadge label={`Rollback to v${rollbackPreview.target_version}`} tone="warning" />}
                    {peerSessions.length > 0 && <SemanticBadge label={`${peerSessions.length} parallel sessions`} tone="warning" />}
                  </div>
                </div>
              </div>
              
              <div className={cn("space-y-8 transition-all", !isMetadataEditMode && "opacity-80 pointer-events-none")}>
                <div className="space-y-4">
                  <SectionEyebrow icon={<Cpu size={13} />} title="Workflow Overview" hint="Repository-facing identity, cadence, scope, and applicability." />
                  <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest", (showErrors && metadata.name.length < 2) ? "text-status-error" : "text-white/40")}>Workflow Name *</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.name.length} / 60</span>
                      </div>
                      <input 
                        data-testid="builder-workflow-name"
                        className={cn(
                          "w-full bg-black/40 border rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase focus:border-theme-accent outline-none transition-all",
                          (showErrors && metadata.name.length < 2) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                        )} 
                        value={metadata.name} 
                        onFocus={saveToHistory}
                        onChange={e => setMetadata({...metadata, name: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest", (showErrors && !metadata.description) ? "text-status-error" : "text-white/40")}>Description *</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.description.length} / 500</span>
                      </div>
                      <textarea 
                        data-testid="builder-workflow-description"
                        className={cn(
                          "w-full bg-black/40 border rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-32 resize-none focus:border-theme-accent outline-none leading-relaxed transition-all",
                          (showErrors && !metadata.description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                        )} 
                        value={metadata.description} 
                        onFocus={saveToHistory}
                        onChange={e => setMetadata({...metadata, description: e.target.value})}
                        />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect 
                          label="Org"
                          options={runtimeConfig?.organization?.org_options || []}
                          value={metadata.org}
                          onChange={val => { saveToHistory(); setMetadata({...metadata, org: val}); }}
                          placeholder="SELECT ORG..."
                        />                        <SearchableSelect
                        label="Team"
                        options={runtimeConfig?.organization?.team_options || []}
                        value={metadata.team}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, team: val}); }}
                        placeholder="SELECT TEAM..."
                        />
                        </div>

                        <div className="grid grid-cols-3 gap-4">                      <SearchableSelect 
                        label="PRC *"
                        testId="builder-prc"
                        options={prcValues}
                        value={metadata.prc}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, prc: val}); }}
                        placeholder="SELECT PRC..."
                        error={showErrors && !metadata.prc}
                      />
                      <SearchableSelect 
                        label="Type *"
                        testId="builder-workflow-type"
                        options={workflowTypes}
                        value={metadata.workflow_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, workflow_type: val}); }}
                        placeholder="SELECT TYPE..."
                        error={showErrors && !metadata.workflow_type}
                      />
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Occurrence</label>
                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 h-[48px]">
                          <input 
                            type="number" 
                            step="0.1"
                            className="w-12 bg-black/40 font-black text-[11px] text-white text-center py-2 rounded-lg outline-none" 
                            value={metadata.cadence_count ?? 0} 
                            onFocus={saveToHistory}
                            onChange={e => setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 0})} 
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
                        label="Tool Family *"
                        options={hardwareFamilies}
                        value={metadata.tool_family}
                        onChange={vals => { saveToHistory(); setMetadata({...metadata, tool_family: vals}); }}
                        placeholder="SELECT FAMILIES..."
                        isMulti
                        error={showErrors && metadata.tool_family.length === 0}
                      />
                      <SearchableSelect 
                        label="Applicable Tools *"
                        options={toolIds}
                        value={metadata.applicable_tools}
                        onChange={vals => { saveToHistory(); setMetadata({...metadata, applicable_tools: vals}); }}
                        placeholder="SELECT TOOLS..."
                        isMulti
                        error={showErrors && metadata.applicable_tools.length === 0}
                      />
                    </div>
                  </div>
                </div>

		                <div className="space-y-4">
		                  <SectionEyebrow icon={<Zap size={13} />} title="Trigger and Outcome" hint="Carry the intake story into a precise activation and completion contract." />
	                  <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect 
                        label="Trigger Type *"
                        options={triggerTypes}
                        value={metadata.trigger_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, trigger_type: val}); }}
                        placeholder="SELECT TRIGGER..."
                        error={showErrors && !metadata.trigger_type}
                      />
                      <SearchableSelect 
                        label="Output Type *"
                        options={outputTypes}
                        value={metadata.output_type}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, output_type: val}); }}
                        placeholder="SELECT OUTPUT..."
                        error={showErrors && !metadata.output_type}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-6 border-t border-white/5 pt-6">
                      <div className="space-y-2">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !metadata.trigger_description) ? "text-status-error" : "text-white/40")}>Trigger Description *</label>
                        <textarea 
                          className={cn(
                            "w-full bg-black/40 border rounded-xl px-4 py-3 text-[11px] font-bold text-white/80 h-24 resize-none focus:border-theme-accent outline-none leading-relaxed transition-all",
                            (showErrors && !metadata.trigger_description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                          )} 
                          value={metadata.trigger_description} 
                          onFocus={saveToHistory}
                          onChange={e => setMetadata({...metadata, trigger_description: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !metadata.output_description) ? "text-status-error" : "text-white/40")}>Output Description *</label>
                        <textarea 
                          className={cn(
                            "w-full bg-black/40 border rounded-xl px-4 py-3 text-[11px] font-bold text-white/80 h-24 resize-none focus:border-theme-accent outline-none leading-relaxed transition-all",
                            (showErrors && !metadata.output_description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                          )} 
                          value={metadata.output_description} 
                          onFocus={saveToHistory}
                          onChange={e => setMetadata({...metadata, output_description: e.target.value})} 
                        />
	                    </div>
	                  </div>
	                </div>
	                  <div className="space-y-4">
	                    <SectionEyebrow icon={<ShieldAlert size={13} />} title="Governance and Collaboration" hint="Finalize access, version rationale, comments, and operating signals before commit." />
                    <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                      <div className="grid grid-cols-3 gap-4">
                        <SearchableSelect label="Workspace" options={workspaceOptions} value={metadata.workspace} onChange={val => { saveToHistory(); setMetadata({...metadata, workspace: val}); }} />
                        <SearchableSelect label="Visibility" options={['private', 'workspace', 'org']} value={metadata.access_control.visibility} onChange={val => { saveToHistory(); setMetadata({...metadata, access_control: { ...metadata.access_control, visibility: val }}); }} />
                        <SearchableSelect label="Editors" options={mentionOptions} value={metadata.access_control.editors} onChange={vals => { saveToHistory(); setMetadata({...metadata, access_control: { ...metadata.access_control, editors: vals }}); }} isMulti />
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <input className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" value={metadata.ownership.owner} onFocus={saveToHistory} onChange={e => setMetadata({...metadata, ownership: { ...metadata.ownership, owner: e.target.value }, access_control: { ...metadata.access_control, owner: e.target.value }})} placeholder="Workflow Owner" />
                        <input className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" value={metadata.ownership.automation_owner || ''} onFocus={saveToHistory} onChange={e => setMetadata({...metadata, ownership: { ...metadata.ownership, automation_owner: e.target.value }})} placeholder="Automation Owner" />
                        <SearchableSelect label="Reviewer Roles" options={reviewerRoleOptions} value={metadata.governance.required_reviewer_roles} onChange={vals => { saveToHistory(); setMetadata({...metadata, governance: { ...metadata.governance, required_reviewer_roles: vals }}); }} isMulti />
                        <SearchableSelect label="Lifecycle" options={runtimeConfig?.organization?.lifecycle_options || ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Active']} value={metadata.governance.lifecycle_stage} onChange={val => { saveToHistory(); setMetadata({...metadata, governance: { ...metadata.governance, lifecycle_stage: val, review_state: val === 'Approved' ? 'Approved' : metadata.governance.review_state }}); }} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <SearchableSelect label="Review State" options={runtimeConfig?.governance?.review_states || ['Draft', 'Requested', 'In Review', 'Approved']} value={metadata.governance.review_state} onChange={val => { saveToHistory(); setMetadata({...metadata, governance: { ...metadata.governance, review_state: val }}); }} />
                        <SearchableSelect label="Approval State" options={runtimeConfig?.governance?.approval_states || ['Draft', 'Pending', 'Approved', 'Superseded']} value={metadata.governance.approval_state} onChange={val => { saveToHistory(); setMetadata({...metadata, governance: { ...metadata.governance, approval_state: val }}); }} />
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-theme-accent" value={metadata.governance.stale_after_days} onFocus={saveToHistory} onChange={e => setMetadata({...metadata, governance: { ...metadata.governance, stale_after_days: parseInt(e.target.value || '90', 10) || 90 }})} placeholder="Stale after days" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest px-1 text-white/40">Version Notes</label>
                          <textarea className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-24 resize-none outline-none focus:border-theme-accent transition-all" value={metadata.version_notes} onFocus={saveToHistory} onChange={e => setMetadata({...metadata, version_notes: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest px-1 text-white/40">Workflow Comments</label>
                          <textarea className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-24 resize-none outline-none focus:border-theme-accent transition-all" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Document decisions, callouts, and @mentions here..." />
                          <button onClick={() => {
                            if (!commentDraft.trim()) return;
                            saveToHistory();
                            const mentions = mentionOptions.filter((option: any) => commentDraft.toLowerCase().includes(`@${option.toLowerCase()}`));
                            setMetadata({
                              ...metadata,
                              comments: [
                                ...metadata.comments,
                                { id: createLocalId('comment'), scope: 'workflow', author: metadata.access_control.owner || defaultOwner, message: commentDraft.trim(), mentions, created_at: new Date().toISOString(), resolved: false, assignee: '', review_state: 'open' }
                              ]
                            });
                            setCommentDraft('');
                          }} className="px-4 py-2 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Add Workflow Comment</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">Review Requests</p>
                            <button onClick={() => { saveToHistory(); setMetadata({...metadata, review_requests: [...metadata.review_requests, { id: createLocalId('review'), role: metadata.governance.required_reviewer_roles[0] || reviewerRoleOptions[0] || 'Reviewer', requested_by: metadata.ownership.owner || metadata.access_control.owner, status: 'open', due_at: metadata.governance.review_due_at || '', note: 'Review requested from builder.' }]}); }} className="px-3 py-1.5 rounded-lg border border-theme-accent/30 bg-theme-accent/10 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">Add Review</button>
                          </div>
                          <div className="space-y-2">
                            {metadata.review_requests.length === 0 && <p className="text-[11px] font-bold text-white/45">No review requests yet.</p>}
                            {metadata.review_requests.map(request => (
                              <div key={request.id} className="rounded-xl border border-white/8 bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{request.role}</span>
                                  <SemanticBadge label={request.status} tone={request.status === 'approved' ? 'success' : 'warning'} />
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-theme-accent" value={request.requested_from || ''} onChange={e => { saveToHistory(); setMetadata({...metadata, review_requests: metadata.review_requests.map(item => item.id === request.id ? { ...item, requested_from: e.target.value } : item)}); }} placeholder="Requested From" />
                                  <input type="date" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-theme-accent" value={request.due_at || ''} onChange={e => { saveToHistory(); setMetadata({...metadata, review_requests: metadata.review_requests.map(item => item.id === request.id ? { ...item, due_at: e.target.value } : item)}); }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">Workflow Inbox and Timeline</p>
                          <div className="flex flex-wrap gap-2">
                            <SemanticBadge label={`${metadata.notification_feed.length} Notifications`} tone="warning" />
                            <SemanticBadge label={`${metadata.activity_timeline.length} Activity Items`} tone="accent" />
                            {insights?.stale_workflow_ids?.includes?.(workflow?.id) && <SemanticBadge label="Stale Review Candidate" tone="warning" />}
                          </div>
                          <div className="space-y-2 max-h-48 overflow-auto custom-scrollbar">
                            {[...(metadata.notification_feed || []), ...(metadata.activity_timeline || [])].slice(0, 6).map((item: any) => (
                              <div key={item.id} className="rounded-xl border border-white/8 bg-black/20 p-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.title || item.type}</p>
                                <p className="mt-1 text-[11px] font-bold text-white/55">{item.detail || item.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
	                      <div className="grid grid-cols-4 gap-4">
	                        <div className="apple-card !bg-white/[0.03] border-white/10 p-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Critical Path</p>
                          <p className="text-[24px] font-black text-theme-accent mt-2">{workflowAnalysis.critical_path_hours.toFixed(1)}h</p>
                        </div>
                        <div className="apple-card !bg-white/[0.03] border-white/10 p-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Disconnected</p>
                          <p className="text-[24px] font-black text-white mt-2">{workflowAnalysis.disconnected_nodes.length}</p>
                        </div>
                        <div className="apple-card !bg-white/[0.03] border-white/10 p-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Diff Nodes</p>
                          <p className="text-[24px] font-black text-emerald-400 mt-2">{workflowAnalysis.diff_summary.added_nodes.length + workflowAnalysis.diff_summary.modified_nodes.length}</p>
                        </div>
                        <div className="apple-card !bg-white/[0.03] border-white/10 p-4">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Shift Risk</p>
	                          <p className={cn("text-[24px] font-black mt-2", workflowAnalysis.shift_handoff_risk ? "text-amber-400" : "text-emerald-400")}>{workflowAnalysis.shift_handoff_risk ? 'Yes' : 'No'}</p>
	                        </div>
	                      </div>
                        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Version Diff Surface</p>
                              <p className="text-[12px] font-bold text-white/56 mt-2">The builder now keeps version deltas visible while authoring, so changes feel reviewable rather than hidden.</p>
                            </div>
                            <div className="flex gap-2">
                              <SemanticBadge label={`+${workflowAnalysis.diff_summary.added_nodes.length} Added`} tone="success" />
                              <SemanticBadge label={`~${workflowAnalysis.diff_summary.modified_nodes.length} Modified`} tone="warning" />
                              <SemanticBadge label={`-${workflowAnalysis.diff_summary.removed_nodes.length} Removed`} tone="danger" />
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">Related Workflows</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {relatedWorkflows.slice(0, 4).map((item: any) => <SemanticBadge key={item.id} label={item.name} tone="neutral" />)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">Template Library</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {Array.isArray(templates) && templates.slice(0, 3).map((template: any) => (
                                  <button key={template.key} onClick={() => { saveToHistory(); setMetadata({...metadata, template_key: template.key, governance: { ...metadata.governance, required_reviewer_roles: template.required_reviewer_roles || metadata.governance.required_reviewer_roles, standards_flags: template.standards_flags || metadata.governance.standards_flags }}); }} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">{template.label}</button>
                                ))}
                              </div>                            </div>
                          </div>
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
