import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Terminal,
  MousePointer2,
  Copy,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SearchableSelect } from './IntakeGatekeeper';
import { mediaApi, settingsApi } from '../api/client';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ValidationMessage: React.FC<{ message: string; onClear: () => void }> = ({ message, onClear }) => (
  <div className="fixed top-20 right-8 z-[2000] w-96 apple-glass border-status-error/30 bg-status-error/5 p-4 rounded-2xl shadow-2xl animate-apple-in">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-status-error/20 flex items-center justify-center flex-shrink-0 border border-status-error/40">
        <ShieldAlert size={20} className="text-status-error" />
      </div>
      <div className="flex-1 space-y-1">
        <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Configuration Warning</h4>
        <p className="text-[12px] font-bold text-white/60 leading-relaxed uppercase">{message}</p>
      </div>
      <button onClick={onClear} className="p-1 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </div>
  </div>
);

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
}

interface WorkflowComment {
  id: string;
  scope: 'workflow' | 'task' | 'section';
  scope_id?: string;
  author: string;
  message: string;
  mentions: string[];
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
  comments: WorkflowComment[];
  analysis?: WorkflowAnalysis;
  simulation?: WorkflowSimulation;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  onSave: (data: any) => void | Promise<void>;
  onBack: (currentData?: any) => void;
  onExit: () => void;
  setIsDirty: (value: boolean) => void;
}

const createLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const WORKSPACE_OPTIONS = ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'];
const MENTION_OPTIONS = ['Haewon Kim', 'Automation Team', 'Metrology SME', 'Yield Engineering'];

const cloneTaskEntity = (task: TaskEntity, nodeId: string): TaskEntity => ({
  ...task,
  id: nodeId,
  node_id: nodeId,
  blockers: (task.blockers || []).map((blocker: any) => ({ ...blocker, id: createLocalId('blocker') })),
  errors: (task.errors || []).map((error: any) => ({ ...error, id: createLocalId('error') })),
  involved_systems: (task.involved_systems || []).map((system) => ({ ...system, id: createLocalId('system') })),
  source_data_list: (task.source_data_list || []).map((item) => ({ ...item, id: createLocalId('input') })),
  output_data_list: (task.output_data_list || []).map((item) => ({ ...item, id: createLocalId('output') })),
  media: (task.media || []).map((media) => ({ ...media, id: createLocalId('media') })),
  reference_links: (task.reference_links || []).map((link) => ({ ...link, id: createLocalId('ref') })),
  instructions: (task.instructions || []).map((instruction) => ({ ...instruction, id: createLocalId('instruction') })),
  validation_procedure_steps: (task.validation_procedure_steps || []).map((step) => ({ ...step, id: createLocalId('validation') })),
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

  const triggerNodes = [...taskMap.entries()].filter(([, task]) => task.interface === 'TRIGGER').map(([id]) => id);
  const outcomeNodes = [...taskMap.entries()].filter(([, task]) => task.interface === 'OUTCOME').map(([id]) => id);
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

interface BugReport {
  id: string;
  title: string;
  timestamp: string;
  view: string;
  category: 'frontend' | 'backend';
  status: 'error' | 'warning';
  acknowledged: boolean;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  type?: string;
  platform: string;
  userAgent: string;
  traceback?: string;
  payload?: any;
}

const BuganizerConsole: React.FC<{
  reports: BugReport[];
  onAcknowledge: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}> = ({ reports, onAcknowledge, onDelete, onClear, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'frontend' | 'backend'>('all');
  const filtered = reports.filter(r => filter === 'all' || r.category === filter);

  return (
    <div className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-3xl flex flex-col animate-apple-in font-sans">
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a1120]/80">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <Bug size={24} className="text-rose-500" />
          </div>
          <div>
            <h2 className="text-[22px] font-black text-white uppercase tracking-tighter">Buganizer 2.0</h2>
            <div className="flex gap-4 mt-1">
              {(['all', 'frontend', 'backend'] as const).map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)}
                  className={cn("text-[10px] font-black uppercase tracking-widest transition-all", filter === f ? "text-rose-500 scale-110" : "text-white/20 hover:text-white")}
                >
                  {f} ({reports.filter(r => f === 'all' || r.category === f).length})
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="px-6 py-2.5 bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase transition-all border border-white/10">Purge Session</button>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white border border-white/10"><X size={24} /></button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar p-8 bg-[#050914]">
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-60 opacity-20">
              <div className="w-32 h-32 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center mb-6">
                <Terminal size={48} />
              </div>
              <span className="text-[16px] font-black uppercase tracking-[0.3em]">Operational Readiness Confirmed</span>
              <p className="text-[10px] mt-2 font-bold opacity-50 uppercase tracking-widest text-emerald-400">Zero active exceptions detected</p>
            </div>
          ) : filtered.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(report => (
            <div key={report.id} className={cn("apple-glass border rounded-3xl overflow-hidden transition-all duration-500", report.acknowledged ? "opacity-40 grayscale blur-[0.5px] border-white/5" : "border-rose-500/30 bg-rose-500/[0.03] shadow-2xl shadow-rose-500/5 hover:border-rose-500/50 hover:bg-rose-500/[0.05]")}>
              <div className="p-8 flex items-start justify-between gap-10">
                <div className="flex-1 space-y-6 min-w-0">
                  <div className="flex items-center gap-4">
                    <div className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-lg", report.status === 'error' ? "bg-rose-500 border-rose-400 text-white" : "bg-amber-500 border-amber-400 text-black")}>{report.status}</div>
                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">{report.category}</div>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="text-[11px] text-white/30 font-mono tracking-tight">{report.timestamp}</div>
                    <div className="flex items-center gap-2 text-[11px] text-theme-accent font-black uppercase tracking-[0.2em] bg-theme-accent/10 px-3 py-1 rounded-lg border border-theme-accent/20">
                      <MousePointer2 size={12} /> {report.view}
                    </div>
                  </div>
                  
                  <h3 className="text-[22px] font-black text-white uppercase tracking-tight leading-none truncate selection:bg-rose-500 selection:text-white">{report.title}</h3>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-6 border-y border-white/5 bg-black/20 rounded-2xl px-6">
                    {report.endpoint && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Network Context</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black font-mono">{report.method}</span>
                          <span className="text-[12px] font-bold text-white font-mono truncate">{report.endpoint}</span>
                        </div>
                      </div>
                    )}
                    {report.statusCode && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">HTTP Response</span>
                        <span className={cn("text-[16px] font-black font-mono", report.statusCode >= 500 ? "text-rose-500" : "text-amber-500")}>{report.statusCode}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Architecture</span>
                      <span className="text-[12px] font-bold text-white/80 truncate block uppercase tracking-tight">{report.platform}</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Agent Payload</span>
                      <span className="text-[12px] font-bold text-white/40 truncate block italic">{report.userAgent}</span>
                    </div>
                  </div>

                  {report.traceback && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2 text-rose-500">
                          <Terminal size={14} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Full Diagnostic Traceback</span>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(report.traceback!); }} className="text-[10px] font-black text-white/20 hover:text-white flex items-center gap-2 uppercase transition-colors group">
                          <Copy size={12} className="group-hover:scale-110 transition-transform" /> Copy to Clipboard
                        </button>
                      </div>
                      <div className="p-6 bg-black/60 rounded-3xl border border-white/5 text-[12px] text-rose-400/90 font-mono overflow-auto max-h-[400px] custom-scrollbar leading-relaxed selection:bg-rose-500 selection:text-white">
                        {report.traceback}
                      </div>
                    </div>
                  )}

                  {report.payload && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-theme-accent px-2">
                        <Database size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transmission Payload</span>
                      </div>
                      <div className="p-6 bg-black/60 rounded-3xl border border-white/5 text-[12px] text-theme-accent/80 font-mono overflow-auto max-h-[300px] custom-scrollbar leading-relaxed selection:bg-theme-accent selection:text-white">
                        {JSON.stringify(report.payload, null, 4)}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-3 sticky top-0">
                  <button 
                    onClick={() => onAcknowledge(report.id)}
                    className={cn(
                      "w-16 h-16 rounded-[24px] flex items-center justify-center transition-all duration-300 border-2", 
                      report.acknowledged 
                        ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                        : "bg-white/5 border-white/10 text-white/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-500"
                    )}
                    title={report.acknowledged ? "Resolved" : "Mark as Resolved"}
                  >
                    <CheckCircle2 size={32} strokeWidth={2.5} />
                  </button>
                  <button 
                    onClick={() => onDelete(report.id)}
                    className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 text-white/20 hover:bg-rose-500 border-rose-500/20 hover:text-white flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-rose-500/40 group"
                  >
                    <Trash size={28} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  onEdit?: () => void;
  isEditing?: boolean;
  children: React.ReactNode;
}> = ({ title, count, isOpen, toggle, icon, onEdit, isEditing = false, children }) => (
  <div className="border-b border-white/5 pb-4">
    <div className="w-full flex items-center justify-between py-2 group">
      <button onClick={toggle} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-theme-accent/10 group-hover:text-theme-accent transition-all border border-white/5 group-hover:border-theme-accent/20">
          {icon || <Database size={14} />}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.15em] group-hover:text-white transition-colors truncate">{title}</span>
          {count !== undefined && (
            <span className="text-[9px] font-bold text-white/10 group-hover:text-theme-accent/60 uppercase tracking-widest">{count} {count === 1 ? 'Entry' : 'Entries'} Loaded</span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-2">
        {onEdit && (
          <button
            onClick={onEdit}
            className={cn(
              "px-3 h-10 rounded-xl flex items-center justify-center text-[9px] font-black uppercase tracking-widest transition-all border",
              isEditing
                ? "bg-theme-accent/15 text-theme-accent border-theme-accent/30"
                : "hover:bg-white/5 text-white/30 hover:text-white border-transparent hover:border-white/10"
            )}
          >
            <Edit3 size={12} />
          </button>
        )}
        <button onClick={toggle} className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
    </div>
    {isOpen && <div className="animate-apple-in pl-1">{children}</div>}
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
                <div className="flex items-center gap-1.5 bg-status-error/20 rounded-xl p-1.5 animate-apple-in border border-status-error/30 shadow-2xl">
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
      data.validation_needed && "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      data.diffState === 'added' && "border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
      data.diffState === 'modified' && "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      data.diagnostics?.logic_warning && "border-fuchsia-500/60 shadow-[0_0_20px_rgba(217,70,239,0.2)]",
      data.diagnostics?.orphaned_input && "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
    )}>
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
            {data.diagnostics?.logic_warning && (
              <div className="flex items-center gap-1.5 bg-fuchsia-500 text-white px-3 py-1 rounded-lg text-[12px] font-black shadow-lg shadow-fuchsia-500/20">
                TF
              </div>
            )}
            {data.diagnostics?.orphaned_input && (
              <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1 rounded-lg text-[12px] font-black shadow-lg shadow-red-500/20">
                ORPHAN
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

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack, onExit, setIsDirty }) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
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
  const [isMetadataEditMode, setIsMetadataEditMode] = useState(false);
  const [ownerPositionsCollapsed, setOwnerPositionsCollapsed] = useState(true);
  
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [sectionEditModes, setSectionEditModes] = useState<Record<string, boolean>>({});
  const [itemEditModes, setItemEditModes] = useState<Record<string, boolean>>({});
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [isBuganizerOpen, setIsBuganizerOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskEntity[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [clipboard, setClipboard] = useState<any>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  const toggleSectionEdit = (sectionId: string) => {
    setSectionEditModes(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleItemEdit = (itemId: string) => {
    setItemEditModes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const reportBug = useCallback((title: string, category: 'frontend' | 'backend', status: 'error' | 'warning', extras?: Partial<BugReport>) => {
    const newReport: BugReport = {
      id: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      timestamp: new Date().toLocaleString(),
      view: 'Workflow Builder',
      category,
      status,
      acknowledged: false,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      ...extras
    };
    setBugReports(prev => [newReport, ...prev]);
    if (status === 'error') setIsBuganizerOpen(true);
  }, []);

  // Standardize error messages - disappear after 1 second for "structural" warnings
  useEffect(() => {
    if (validationError && (validationError.includes("structural constants") || validationError.includes("Dependency Conflict"))) {
      const timer = setTimeout(() => setValidationError(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [validationError]);

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

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    name: workflow?.name || '',
    version: workflow?.version || 1,
    workspace: workflow?.workspace || 'Submitted Requests',
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
    access_control: workflow?.access_control || { visibility: 'private', viewers: [], editors: [], mention_groups: [], owner: 'Haewon Kim' },
    comments: workflow?.comments || [],
    analysis: workflow?.analysis,
    simulation: workflow?.simulation,
  });

  const saveToHistory = useCallback(() => {
    const currentState = { 
      nodes: JSON.parse(JSON.stringify(nodes)), 
      edges: JSON.parse(JSON.stringify(edges)), 
      tasks: JSON.parse(JSON.stringify(tasks)), 
      metadata: JSON.parse(JSON.stringify(metadata)) 
    };

    setHistory(prev => {
      if (prev.length > 0) {
        if (JSON.stringify(prev[prev.length - 1]) === JSON.stringify(currentState)) return prev;
      }
      return [...prev.slice(-49), currentState];
    });
    setRedoStack([]);
  }, [nodes, edges, tasks, metadata]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const mutatingChanges = changes.filter(c => c.type !== 'select');
      if (mutatingChanges.length > 0) {
        saveToHistory();
      }

      const filteredChanges = changes.filter(c => {
        if (c.type === 'remove') {
          const node = nodes.find(n => n.id === c.id);
          if (node?.data?.interface === 'TRIGGER' || node?.data?.interface === 'OUTCOME') {
            setValidationError("Trigger and Outcome entities are structural constants and cannot be deleted.");
            return false;
          }
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
    [setNodes, nodes, checkTaskDependencies, saveToHistory, selectedTaskId, setIsDirty]
  );

  const onEdgesChange = useCallback(
    (changes: any[]) => {
      const mutatingChanges = changes.filter(c => c.type !== 'select');
      if (mutatingChanges.length > 0) {
        saveToHistory();
      }

      const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
      if (removedIds.length > 0 && selectedEdgeId && removedIds.includes(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }

      setEdges((eds) => applyEdgeChanges(changes, eds));
      if (mutatingChanges.length > 0) {
        setIsDirty?.(true);
      }
    },
    [saveToHistory, selectedEdgeId, setEdges, setIsDirty]
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
  }, [metadata.trigger_type, metadata.trigger_description, metadata.output_type, metadata.output_description, setTasks, setNodes]);

  const selectedTask = useMemo(() => tasks.find(t => String(t.id) === String(selectedTaskId)), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => String(e.id) === String(selectedEdgeId)), [edges, selectedEdgeId]);
  const isProtected = selectedTask?.interface === 'TRIGGER' || selectedTask?.interface === 'OUTCOME';
  const localWorkflowState = useMemo(() => buildLocalAnalysis(tasks, edges, metadata), [tasks, edges, metadata]);
  const workflowAnalysis = localWorkflowState.analysis;
  const workflowSimulation = localWorkflowState.simulation;
  const scopedComments = useMemo(
    () => metadata.comments.filter(comment => (selectedTaskId ? comment.scope === 'task' && comment.scope_id === selectedTaskId : comment.scope === 'workflow')),
    [metadata.comments, selectedTaskId]
  );
  const decisionEdges = useMemo(
    () => selectedTaskId ? edges.filter(edge => String(edge.source) === String(selectedTaskId)) : [],
    [edges, selectedTaskId]
  );

  const taskTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === 'TASK_TYPE');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || ['Documentation', 'Hands-on', 'System Interaction', 'Shadow IT', 'Verification', 'Communication'];
  }, [systemParams]);

  const hardwareFamilies = useMemo(() => {
    const param = systemParams.find(p => p.key === 'HARDWARE_FAMILY');
    if (param) {
      return ((param.is_dynamic ? param.cached_values : param.manual_values) || []).map((f: any) => typeof f === 'string' ? f : f.label);
    }
    return taxonomy.filter((t: any) => t.category === 'ToolType').map((t: any) => t.label);
  }, [systemParams, taxonomy]);

  const toolIds = useMemo(() => {
    const param = systemParams.find(p => p.key === 'TOOL_ID');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const prcValues = useMemo(() => {
    const param = systemParams.find(p => p.key === 'PRC');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const workflowTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === 'WORKFLOW_TYPE');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const triggerTypes = taxonomy.filter((t: any) => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter((t: any) => t.category === 'OutputType');

  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const diagnostics = workflowAnalysis.diagnostics?.[node.id] || {};
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
          diffState,
        }
      };
    }));
  }, [workflowAnalysis, setNodes]);

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
  }, [fitView, setNodes, setEdges, setIsDirty, defaultEdgeStyle, nodes, edges]);

  // Ensure fitView on initial load
  const initialFitPerformed = useRef(false);
  const lastInitializedWorkflowId = useRef<number | null>(null);

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
    if (!workflow || lastInitializedWorkflowId.current === workflow.id) return;
    try {
      lastInitializedWorkflowId.current = workflow.id;
      const seenNodeIds = new Set<string>();
      
      // Update metadata state when workflow changes
      const initialMetadata = {
        name: workflow?.name || '',
        version: workflow?.version || 1,
        workspace: workflow?.workspace || 'Submitted Requests',
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
        access_control: workflow?.access_control || { visibility: 'private', viewers: [], editors: [], mention_groups: [], owner: 'Haewon Kim' },
        comments: workflow?.comments || [],
        analysis: workflow?.analysis,
        simulation: workflow?.simulation,
      };
      setMetadata(initialMetadata);

      const initializedTasks = (workflow?.tasks || []).map((t: any) => {
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
  }, [workflow, defaultEdgeStyle, handleLayout, setNodes, setEdges]);

  const updateTask = (id: string, updates: Partial<TaskEntity>) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      const updated = newTasks.find(t => t.id === id);
      if (updated) {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { 
          ...n.data, 
          label: updated.name, 
          task_type: updated.task_type, 
          manual_time: updated.manual_time_minutes, 
          automation_time: updated.automation_time_minutes, 
          occurrence: updated.occurrence, 
          involved_systems: updated.involved_systems, 
          owningTeam: updated.owning_team, 
          ownerPositions: updated.owner_positions, 
          sourceCount: (updated.source_data_list || []).length, 
          outputCount: (updated.output_data_list || []).length, 
          validation_needed: updated.validation_needed, 
          blockerCount: (updated.blockers || []).length, 
          errorCount: (updated.errors || []).length, 
          description: updated.description 
        } } : n));
      }
      return newTasks;
    });
    setIsDirty?.(true);
  };

  const updateEdge = (id: string, updates: any) => {
    saveToHistory();
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates }, markerEnd: { type: MarkerType.ArrowClosed, color: updates.color || e.data?.color || '#ffffff' } } : e));
    setIsDirty?.(true);
  };

  const onConnect = (params: Connection) => {
    if (!params.source || !params.target) return;
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
    const newEdge: Edge = { ...params, id: `e-${params.source}-${params.target}-${Date.now()}`, type: 'custom', data: { label: '', edgeStyle: defaultEdgeStyle, color: '#ffffff', lineStyle: 'solid' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, source: params.source, target: params.target };
    setEdges(eds => addEdge(newEdge, eds));
    setIsDirty?.(true);
  };

  const deleteTask = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.interface) return;
    saveToHistory();
    const outputIds = new Set((task?.output_data_list || []).map(output => output.id));
    setTasks(prev => prev
      .filter(t => t.id !== id)
      .map(t => ({
        ...t,
        source_data_list: (t.source_data_list || []).map(source =>
          source.from_task_id && outputIds.has(source.from_task_id)
            ? { ...source, orphaned_input: true, from_task_name: `${source.from_task_name || 'Source'} (Removed)` }
            : source
        )
      })));
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => {
      const incoming = eds.filter(e => e.target === id);
      const outgoing = eds.filter(e => e.source === id);
      const survivors = eds.filter(e => e.source !== id && e.target !== id);
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
      return [...survivors, ...healed.filter(edge => edge.source !== edge.target)];
    });
    setSelectedTaskId(null);
    setConfirmingDelete(null);
    setIsDirty?.(true);
  }, [tasks, setNodes, setEdges, setIsDirty, saveToHistory]);

const onAddNode = (type: 'TASK' | 'CONDITION') => {
    saveToHistory();
    const id = `node-${Date.now()}`;
    const center = project({ x: (window.innerWidth - inspectorWidth) / 2, y: window.innerHeight / 2 });
    const newNode: Node = { id, type: type === 'CONDITION' ? 'diamond' : 'matrix', position: { x: Math.round((center.x - 160) / 10) * 10, y: Math.round((center.y - 140) / 10) * 10 }, data: { label: type === 'TASK' ? 'New Operational Task' : 'New Process Condition', task_type: type === 'TASK' ? 'System Interaction' : 'LOOP', manual_time: 0, automation_time: 0, occurrence: 1, involved_systems: [], validation_needed: false, blockerCount: 0, errorCount: 0, baseFontSize } };
    const newTask: TaskEntity = { 
      id, 
      node_id: id, 
      name: newNode.data.label, 
      description: type === 'TASK' ? 'Describe the operational steps and purpose of this task.' : 'Define the condition being evaluated (e.g., Is value > limit?).', 
      task_type: newNode.data.task_type, 
      involved_systems: [], 
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
      instructions: [] 
    };
    setTasks(prev => [...prev, newTask]);
    setNodes(nds => [...nds, newNode]);
    setSelectedTaskId(id);
    setIsDirty?.(true);
  };

  const handleSave = () => {
    if (tasks.length === 0) return;
    
    // Check Workflow Definition first
    const isWorkflowInvalid = 
      !metadata.name || metadata.name.length < 2 || 
      !metadata.description || 
      !metadata.prc || 
      !metadata.workflow_type || 
      !metadata.trigger_type || 
      !metadata.trigger_description || 
      !metadata.output_type || 
      !metadata.output_description || 
      metadata.tool_family.length === 0 || 
      metadata.applicable_tools.length === 0;

    if (isWorkflowInvalid) {
      setValidationError("Workflow Definition is incomplete. Please ensure all mandatory fields (*) are filled.");
      setShowErrors(true);
      setSelectedTaskId(null); // Show metadata panel
      return;
    }

    // Validation
    const invalidTasks = tasks.filter(t => {
      // Basic task validation - Name and Description are REQUIRED by Pydantic
      if (!t.name || t.name.trim().length === 0) return true;
      if (!t.description || t.description.trim().length === 0) return true;
      
      // Blocker validation - entity, reason, and mitigation are REQUIRED
      const hasInvalidBlockers = t.blockers.some(b => 
        !b.blocking_entity || b.blocking_entity.trim().length === 0 || 
        !b.reason || b.reason.trim().length === 0 || 
        !b.standard_mitigation || b.standard_mitigation.trim().length === 0
      );
      if (hasInvalidBlockers) return true;
      
      // Error validation - type and description are REQUIRED
      const hasInvalidErrors = t.errors.some(e => 
        !e.error_type || e.error_type.trim().length === 0 || 
        !e.description || e.description.trim().length === 0
      );
      if (hasInvalidErrors) return true;
      
      // Validation steps - description is REQUIRED if validation is enabled
      if (t.validation_needed && t.validation_procedure_steps.length > 0) {
        const hasInvalidSteps = t.validation_procedure_steps.some(s => !s.description || s.description.trim().length === 0);
        if (hasInvalidSteps) return true;
      }
      
      return false;
    });

    if (invalidTasks.length > 0) {
      setValidationError(`Validation Failed: ${invalidTasks.length} task(s) have missing required fields. Highlighted in red.`);
      setShowErrors(true);
      // Select the first invalid task to help the user
      setSelectedTaskId(invalidTasks[0].id);
      return;
    }

    if (workflowAnalysis.has_cycle) {
      setValidationError("Validation Failed: The workflow contains a routing cycle. Remove the infinite loop before saving.");
      return;
    }
    if (workflowAnalysis.malformed_logic_nodes.length > 0) {
      setValidationError("Validation Failed: Decision nodes must expose exactly two outgoing routes labeled True and False.");
      setSelectedTaskId(workflowAnalysis.malformed_logic_nodes[0]);
      return;
    }
    if (workflowAnalysis.unreachable_nodes.length > 0 || workflowAnalysis.disconnected_nodes.length > 0) {
      setValidationError("Validation Failed: All nodes must remain connected from Trigger to Outcome. Review disconnected or unreachable tasks.");
      setSelectedTaskId((workflowAnalysis.unreachable_nodes[0] || workflowAnalysis.disconnected_nodes[0]) || null);
      return;
    }

    try {
      const { applicable_tools, ...metaRest } = metadata;
      const finalData = {
        ...metaRest,
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
      onSave(finalData);
      setValidationError(null);
      setShowErrors(false);
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
    const ids = deleted
      .filter(n => n.data?.interface !== 'TRIGGER' && n.data?.interface !== 'OUTCOME')
      .map(n => n.id);

    if (ids.length === 0) {
      return;
    }

    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    setEdges(eds => {
      let nextEdges = [...eds];
      for (const id of ids) {
        const incoming = nextEdges.filter(edge => edge.target === id);
        const outgoing = nextEdges.filter(edge => edge.source === id);
        nextEdges = nextEdges.filter(edge => edge.source !== id && edge.target !== id);
        nextEdges.push(...incoming.flatMap(inEdge => outgoing.map(outEdge => ({
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
        }))));
      }
      return nextEdges.filter(edge => edge.source !== edge.target);
    });
    if (selectedTaskId && ids.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }
    setIsDirty?.(true);
  }, [selectedTaskId, setTasks, setEdges, setIsDirty]);

  return (
    <div className="flex h-full w-full bg-[#050914] overflow-hidden">
      {validationError && (
        <ValidationMessage 
          message={validationError} 
          onClear={() => setValidationError(null)} 
        />
      )}
      {isBuganizerOpen && (
        <BuganizerConsole 
          reports={bugReports} 
          onAcknowledge={(id) => setBugReports(prev => prev.map(r => r.id === id ? { ...r, acknowledged: true } : r))}
          onDelete={(id) => setBugReports(prev => prev.filter(r => r.id !== id))}
          onClear={() => setBugReports([])}
          onClose={() => setIsBuganizerOpen(false)}
        />
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
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Critical Path Nodes</p>
              <div className="flex flex-wrap gap-2">
                {workflowSimulation.critical_path_nodes.map(nodeId => {
                  const task = tasks.find(item => String(item.node_id || item.id) === nodeId);
                  return <span key={nodeId} className="px-3 py-2 rounded-xl bg-theme-accent/10 border border-theme-accent/20 text-[10px] font-black uppercase tracking-widest text-theme-accent">{task?.name || nodeId}</span>;
                })}
              </div>
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
	        <div className="h-16 border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
	          <div className="flex items-center gap-4">
	            <button onClick={() => onBack(metadata)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
	            <div className="flex flex-col"><span className="text-[10px] font-black text-theme-accent uppercase tracking-widest mb-1">Workflow Builder</span><h1 className="text-[14px] font-black text-white uppercase truncate max-w-[300px]">{workflow?.name}</h1></div>
              <div className="hidden xl:flex items-center gap-2 pl-4">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/50">{metadata.workspace}</span>
                <span className="px-3 py-1 rounded-full bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase tracking-widest text-theme-accent">Critical {workflowAnalysis.critical_path_hours.toFixed(1)}h</span>
                {workflowAnalysis.shift_handoff_risk && <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest text-amber-400">Shift Handoff Risk</span>}
                {workflowAnalysis.has_cycle && <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-400">Loop Detected</span>}
                {workflowAnalysis.diff_summary.has_changes && <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">Diff Active</span>}
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
	                  saveToHistory();
	                  setDefaultEdgeStyle(s);
	                  setEdges(eds => eds.map(e => ({ ...e, data: { ...e.data, edgeStyle: s } })));
	                  setIsDirty?.(true);
	                }} 
	                className={cn("px-3 h-full text-[9px] font-black uppercase rounded-lg transition-all", defaultEdgeStyle === s ? "bg-theme-accent text-white" : "text-white/20 hover:text-white/40")}
	              >
                {s === 'smoothstep' ? 'Angled' : s === 'bezier' ? 'Smooth' : 'Straight'}
              </button>
            ))}
          </div>
	          <button onClick={() => handleLayout(nodes, edges)} className="flex items-center gap-2 px-4 h-[38px] bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all"><RefreshCw size={14} className="text-theme-accent" /> Auto Layout</button>
            <button onClick={() => setIsSimulationOpen(true)} className="flex items-center gap-2 px-4 h-[38px] bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all"><Activity size={14} className="text-emerald-400" /> Simulate</button>
	          <button onClick={() => setIsBuganizerOpen(true)} className={cn("w-[38px] h-[38px] rounded-xl transition-all border flex items-center justify-center relative", bugReports.some(r => !r.acknowledged) ? "bg-rose-500/20 border-rose-500/40 text-rose-500 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/10 text-white/40 hover:text-white")}>
            <Bug size={18} />
            {bugReports.filter(r => !r.acknowledged).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-[#0a1120]">{bugReports.filter(r => !r.acknowledged).length}</span>
            )}
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 h-[38px] bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-theme-accent/20 hover:scale-[1.02] transition-all"><Save size={14} /> Commit Changes</button>
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
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl"><button onClick={() => onAddNode('TASK')} className="flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Task</button><button onClick={() => onAddNode('CONDITION')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:scale-[1.05] transition-all"><Plus size={12} /> Add Condition</button></div>
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
                <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">{selectedTask.task_type}</span>
              </div>
            </div>
            {!isProtected && (
              <div className="flex items-center gap-2">
                {confirmingDelete === selectedTaskId ? (
                  <div className="flex items-center gap-1.5 bg-status-error/20 border border-status-error/30 rounded-xl p-1.5 animate-apple-in">
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
              {inspectorTab === 'overview' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={cn("text-[9px] font-black uppercase tracking-widest px-1", (showErrors && !selectedTask.name) ? "text-status-error" : "text-white/40")}>
                      {selectedTask.interface ? (selectedTask.interface === 'TRIGGER' ? 'Trigger Origin *' : 'Outcome Result *') : (selectedTask.task_type === 'LOOP' ? 'Condition Nomenclature *' : 'Operational Title *')}
                    </label>
                    <input 
                      className={cn(
                        "w-full bg-black/40 border rounded-xl px-4 py-3 text-[14px] font-black text-white uppercase focus:border-theme-accent outline-none transition-all",
                        (showErrors && !selectedTask.name) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                      )} 
                      value={selectedTask.name} 
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
                      value={selectedTask.description} 
                      onFocus={saveToHistory}
                      onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                      disabled={isProtected}
                    />
                  </div>

                  {!isProtected && (
                    <>
                      <div className="space-y-2">
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
                                <input className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-black text-white uppercase outline-none focus:border-theme-accent" value={edge.data?.label || ''} onChange={e => updateEdge(edge.id, { label: e.target.value })} placeholder="TRUE or FALSE" />
                                <button onClick={() => updateEdge(edge.id, { label: 'True' })} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">True</button>
                                <button onClick={() => updateEdge(edge.id, { label: 'False' })} className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest text-rose-400">False</button>
                              </div>
                            )) : (
                              <div className="rounded-xl border border-dashed border-fuchsia-500/20 p-4 text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-400/70">
                                Create two outgoing edges from this decision node to unlock branch labeling.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1 text-center block">TAT Manual (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-blue-400 text-center" value={selectedTask.manual_time_minutes} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { manual_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest px-1 text-center block">TAT Machine (m)</label>
                          <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[14px] font-black text-white outline-none focus:border-purple-400 text-center" value={selectedTask.automation_time_minutes} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { automation_time_minutes: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Owner Team</label>
                          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 text-[12px] font-bold text-white outline-none focus:border-theme-accent placeholder:text-white/10 transition-all" value={selectedTask.owning_team} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { owning_team: e.target.value })} placeholder="Team Name" />
                        </div>
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
                                          <button onClick={() => { updateTask(selectedTaskId, { owner_positions: selectedTask.owner_positions?.filter((_, i) => i !== idx) }); setConfirmingDelete(null); }} className="px-2 py-1 bg-status-error text-[7px] font-black uppercase text-white rounded-sm">Conf</button>
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
                              updateTask(selectedTaskId, { owner_positions: newList });
                              toggleItemEdit(`pos-${newList.length - 1}`);
                            }} 
                            className="w-full py-2.5 bg-theme-accent/10 border border-theme-accent/30 rounded-xl text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-theme-accent/5"
                          >
                            <Plus size={14} strokeWidth={3} /> Add Operation Role
                          </button>
                        </div>
                      )}

                      <CollapsibleSection 
                        title="Involved IT Systems" 
                        isOpen={expandedSections.involved_systems || false} 
                        toggle={() => toggleSection('involved_systems')} 
                        count={selectedTask.involved_systems.length}
                        onEdit={() => toggleSectionEdit('involved_systems')}
                        isEditing={sectionEditModes['involved_systems']}
                      >
                        <div className="space-y-3 pt-4">
                          {(selectedTask.involved_systems || []).map(sys => (
                            <NestedCollapsible 
                              key={sys.id} 
                              title={sys.name || "New System Entry"} 
                              isOpen={openItems[sys.id]} 
                              toggle={() => toggleItem(sys.id)} 
                              onDelete={() => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.filter(x => x.id !== sys.id) })}
                              isEditing={sectionEditModes['involved_systems']}
                              onEdit={() => toggleSectionEdit('involved_systems')}
                            >
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">System Name</label>
                                  <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] text-white outline-none focus:border-theme-accent" value={sys.name} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, name: e.target.value } : x) })} placeholder="e.g., SAP, Salesforce, Internal Tool" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Usage Context</label>
                                  <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-white/60 h-20 resize-none outline-none focus:border-theme-accent" value={sys.usage} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, usage: e.target.value } : x) })} placeholder="Describe how the system is used in this task..." />
                                </div>
                                <ImagePasteField figures={sys.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, figures: figs } : x) })} label="System Screenshots (Ctrl+V)" />
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Documentation Link</label>
                                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                    <Link2 size={12} className="text-theme-accent" />
                                    <input className="flex-1 bg-transparent border-none p-0 text-[11px] text-theme-accent underline outline-none" value={sys.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { involved_systems: selectedTask.involved_systems.map(x => x.id === sys.id ? { ...x, link: e.target.value } : x) })} placeholder="URL to SOP or Wiki" />
                                  </div>
                                </div>
                              </div>
                            </NestedCollapsible>
                          ))}
                          <button 
                            onClick={() => updateTask(selectedTaskId, { involved_systems: [...(selectedTask.involved_systems || []), { id: Date.now().toString(), name: '', usage: '', figures: [], link: '' }] })} 
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
                    onEdit={() => toggleSectionEdit('inputs')}
                    isEditing={sectionEditModes['inputs']}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.source_data_list.map((sd) => (
                        <NestedCollapsible 
                          key={sd.id} 
                          title={sd.name || "New Input"} 
                          isOpen={openItems[sd.id]} 
                          toggle={() => toggleItem(sd.id)} 
                          onDelete={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} 
                          isLocked={!!sd.from_task_id}
                          isEditing={sectionEditModes['inputs']}
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
                            <ImagePasteField figures={sd.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" isLocked={!!sd.from_task_id} />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none disabled:opacity-50" value={sd.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" disabled={!!sd.from_task_id} />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {sectionEditModes['inputs'] && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} className="py-2 bg-theme-accent/10 border border-theme-accent/30 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-lg flex items-center justify-center gap-2"><Plus size={12} /> Add Manual Input</button>
                          <button onClick={() => setIsOutputPickerOpen(true)} className="py-2 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-white/40 hover:text-white transition-all rounded-lg flex items-center justify-center gap-2"><Search size={12} /> Registry Search</button>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Task Outputs" 
                    isOpen={expandedSections.outputs} 
                    toggle={() => toggleSection('outputs')} 
                    count={selectedTask.output_data_list.length}
                    onEdit={() => toggleSectionEdit('outputs')}
                    isEditing={sectionEditModes['outputs']}
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
                              updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) });
                            }
                          }}
                          isEditing={sectionEditModes['outputs']}
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
                            <ImagePasteField figures={od.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" />
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-widest">Links</label>
                              <input className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-theme-accent outline-none" value={od.link} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, link: e.target.value } : x) })} placeholder="Relevant URL" />
                            </div>
                          </div>
                        </NestedCollapsible>
                      ))}
                      {sectionEditModes['outputs'] && (
                        <button 
                          onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', figures: [], link: '', data_example: '' }] })} 
                          className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all rounded-lg flex items-center justify-center gap-2 mt-2"
                        >
                          <Plus size={12} /> Add Output Artifact
                        </button>
                      )}
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
                    onEdit={() => toggleSectionEdit('blockers')}
                    isEditing={sectionEditModes['blockers']}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.blockers.map((b) => (
                        <NestedCollapsible 
                          key={b.id} 
                          title={b.blocking_entity || "New Roadblock"} 
                          isOpen={openItems[b.id]} 
                          toggle={() => toggleItem(b.id)} 
                          onDelete={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })}
                          isEditing={sectionEditModes['blockers']}
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
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={b.average_delay_minutes || 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) || 0 } : x) })} />
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
                      {sectionEditModes['blockers'] && (
                        <button 
                          onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', standard_mitigation: '', average_delay_minutes: 0, probability_percent: 10 }] })} 
                          className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          <Plus size={12} /> Add Roadblock
                        </button>
                      )}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Human Errors & Recoveries" 
                    isOpen={expandedSections.errors} 
                    toggle={() => toggleSection('errors')} 
                    count={selectedTask.errors.length}
                    onEdit={() => toggleSectionEdit('errors')}
                    isEditing={sectionEditModes['errors']}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.errors.map((er) => (
                        <NestedCollapsible 
                          key={er.id} 
                          title={er.error_type || "New Error"} 
                          isOpen={openItems[er.id]} 
                          toggle={() => toggleItem(er.id)} 
                          onDelete={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== er.id) })}
                          isEditing={sectionEditModes['errors']}
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
                              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[12px] text-white" value={er.recovery_time_minutes || 0} onFocus={saveToHistory} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === er.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) || 0 } : x) })} />
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
                      {sectionEditModes['errors'] && (
                        <button 
                          onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', recovery_time_minutes: 0, probability_percent: 5, correction_method: '' }] })} 
                          className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          <Plus size={12} /> Add Human Error
                        </button>
                      )}
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
                        onClick={() => updateTask(selectedTaskId, { validation_needed: !selectedTask.validation_needed })} 
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
                          onEdit={() => toggleSectionEdit('validation')}
                          isEditing={sectionEditModes['validation']}
                        >
                          <div className="space-y-4 pt-4">
                            {(selectedTask.validation_procedure_steps || []).map((step, idx) => (
                              <NestedCollapsible 
                                key={step.id} 
                                title={`Verification Step ${idx + 1}`} 
                                isOpen={openItems[step.id]} 
                                toggle={() => toggleItem(step.id)} 
                                onDelete={() => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.filter(x => x.id !== step.id) })}
                                isEditing={sectionEditModes['validation']}
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
                                  <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { validation_procedure_steps: selectedTask.validation_procedure_steps.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Evidence Figures (Ctrl+V)" isLocked={!sectionEditModes['validation']} />
                                </div>
                              </NestedCollapsible>
                            ))}
                            {sectionEditModes['validation'] && (
                              <button 
                                onClick={() => updateTask(selectedTaskId, { validation_procedure_steps: [...(selectedTask.validation_procedure_steps || []), { id: Date.now().toString(), description: '', figures: [] }] })} 
                                className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                              >
                                + Add Verification Step
                              </button>
                            )}
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
                        {scopedComments.map(comment => (
                          <div key={comment.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">{comment.author}</span>
                              <span className="text-[8px] text-white/20 font-black uppercase">{new Date(comment.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-[12px] font-bold text-white/80 leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                            {comment.mentions.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {comment.mentions.map(mention => <span key={mention} className="px-2 py-1 rounded-lg bg-theme-accent/10 border border-theme-accent/20 text-[9px] font-black uppercase tracking-widest text-theme-accent">@{mention}</span>)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/80 h-28 resize-none outline-none focus:border-theme-accent transition-all" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Leave a node-specific note. Use @Automation Team or @Metrology SME to mention groups." />
                        <div className="flex gap-3">
                          <button onClick={() => {
                            if (!commentDraft.trim()) return;
                            saveToHistory();
                            const mentions = MENTION_OPTIONS.filter(option => commentDraft.toLowerCase().includes(`@${option.toLowerCase()}`));
                            setMetadata({
                              ...metadata,
                              comments: [
                                ...metadata.comments,
                                { id: createLocalId('comment'), scope: 'task', scope_id: selectedTaskId || undefined, author: metadata.access_control.owner || 'Haewon Kim', message: commentDraft.trim(), mentions, created_at: new Date().toISOString(), resolved: false }
                              ]
                            });
                            setCommentDraft('');
                            setIsDirty?.(true);
                          }} className="px-5 py-2.5 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Add Comment</button>
                          <div className="flex-1">
                            <SearchableSelect label="Mentions" options={MENTION_OPTIONS} value={[]} onChange={() => {}} placeholder="@MENTION DIRECTORY" isMulti />
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
                    onEdit={() => toggleSectionEdit('references')}
                    isEditing={sectionEditModes['references']}
                  >
                    <div className="space-y-3 pt-4">
                      {selectedTask.reference_links.map(l => (
                        <NestedCollapsible 
                          key={l.id} 
                          title={l.label || "New Reference"} 
                          isOpen={openItems[l.id]} 
                          toggle={() => toggleItem(l.id)} 
                          onDelete={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== l.id) })}
                          isEditing={sectionEditModes['references']}
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
                      {sectionEditModes['references'] && (
                        <button 
                          onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), label: '', url: '' }] })} 
                          className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                        >
                          + Add Reference Link
                        </button>
                      )}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Task Visual Assets" 
                    isOpen={expandedSections.assets} 
                    toggle={() => toggleSection('assets')} 
                    count={selectedTask.media.length}
                    onEdit={() => toggleSectionEdit('assets')}
                    isEditing={sectionEditModes['assets']}
                  >
                    <div className="pt-4">
                      <ImagePasteField figures={selectedTask.media.map(m => m.url)} onPaste={(figs) => updateTask(selectedTaskId, { media: figs.map(f => ({ id: Date.now().toString(), type: 'image', url: f, label: 'Pasted Asset' })) })} label="Visual Assets (Ctrl+V)" isLocked={!sectionEditModes['assets']} />
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection 
                    title="Step-by-Step Instructions" 
                    isOpen={expandedSections.instructions} 
                    toggle={() => toggleSection('instructions')} 
                    count={selectedTask.instructions.length}
                    onEdit={() => toggleSectionEdit('instructions')}
                    isEditing={sectionEditModes['instructions']}
                  >
                    <div className="space-y-4 pt-4">
                      {selectedTask.instructions.map((step, idx) => (
                        <NestedCollapsible 
                          key={step.id} 
                          title={`Instruction Step ${idx + 1}`} 
                          isOpen={openItems[step.id]} 
                          toggle={() => toggleItem(step.id)} 
                          onDelete={() => updateTask(selectedTaskId, { instructions: selectedTask.instructions.filter(x => x.id !== step.id) })}
                          isEditing={sectionEditModes['instructions']}
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
                            <ImagePasteField figures={step.figures || []} onPaste={(figs) => updateTask(selectedTaskId, { instructions: selectedTask.instructions.map(x => x.id === step.id ? { ...x, figures: figs } : x) })} label="Step Figures (Ctrl+V)" isLocked={!sectionEditModes['instructions']} />
                          </div>
                        </NestedCollapsible>
                      ))}
                      {sectionEditModes['instructions'] && (
                        <button 
                          onClick={() => updateTask(selectedTaskId, { instructions: [...selectedTask.instructions, { id: Date.now().toString(), description: '', figures: [], links: [] }] })} 
                          className="w-full py-2 bg-theme-accent/10 border border-theme-accent/30 rounded-lg text-[9px] font-black uppercase text-theme-accent hover:bg-theme-accent hover:text-white transition-all mt-2"
                        >
                          + Add Instruction Step
                        </button>
                      )}
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
	                  <button onClick={() => { saveToHistory(); setEdges(eds => eds.filter(e => e.id !== selectedEdgeId)); setSelectedEdgeId(null); setIsDirty?.(true); }} className="text-status-error hover:bg-status-error/10 p-2 border border-status-error/20 rounded-md transition-all"><Trash size={16} /></button>
                </div>
              </div>
	              <div className="space-y-6">
	                <div className="space-y-2">
	                  <label className="text-[9px] font-black text-white/40 uppercase px-1">Label</label>
	                  <input className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-3 text-[13px] font-black text-white uppercase outline-none focus:border-theme-accent transition-all" value={selectedEdge.data?.label || ''} onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })} />
	                </div>
                  {selectedTaskId === null && tasks.find(task => String(task.node_id || task.id) === String(selectedEdge.source))?.task_type === 'LOOP' && (
                    <div className="flex gap-2">
                      <button onClick={() => updateEdge(selectedEdgeId, { label: 'True' })} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">Set True</button>
                      <button onClick={() => updateEdge(selectedEdgeId, { label: 'False' })} className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-400">Set False</button>
                    </div>
                  )}
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
                        <label className={cn("text-[9px] font-black uppercase tracking-widest", (showErrors && metadata.name.length < 2) ? "text-status-error" : "text-white/40")}>Workflow Name *</label>
                        <span className="text-[8px] text-white/10 font-mono">{metadata.name.length} / 60</span>
                      </div>
                      <input 
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
                        className={cn(
                          "w-full bg-black/40 border rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 h-32 resize-none focus:border-theme-accent outline-none leading-relaxed transition-all",
                          (showErrors && !metadata.description) ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]" : "border-white/10"
                        )} 
                        value={metadata.description} 
                        onFocus={saveToHistory}
                        onChange={e => setMetadata({...metadata, description: e.target.value})} 
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <SearchableSelect 
                        label="PRC *"
                        options={prcValues}
                        value={metadata.prc}
                        onChange={val => { saveToHistory(); setMetadata({...metadata, prc: val}); }}
                        placeholder="SELECT PRC..."
                        error={showErrors && !metadata.prc}
                      />
                      <SearchableSelect 
                        label="Type *"
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
                            value={metadata.cadence_count} 
                            onFocus={saveToHistory}
                            onChange={e => setMetadata({...metadata, cadence_count: parseFloat(e.target.value) || 1})} 
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
	                  <div className="flex items-center gap-2 text-theme-accent font-black px-1">
	                    <Zap size={14} />
	                    <span className="text-[10px] tracking-[0.2em] uppercase">Trigger & Output</span>
                  </div>
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
                    <div className="flex items-center gap-2 text-theme-accent font-black px-1">
                      <ShieldAlert size={14} />
                      <span className="text-[10px] tracking-[0.2em] uppercase">Governance & Collaboration</span>
                    </div>
                    <div className="apple-card space-y-6 !bg-white/[0.02] border-white/5 p-6 rounded-2xl">
                      <div className="grid grid-cols-3 gap-4">
                        <SearchableSelect label="Workspace" options={WORKSPACE_OPTIONS} value={metadata.workspace} onChange={val => { saveToHistory(); setMetadata({...metadata, workspace: val}); }} />
                        <SearchableSelect label="Visibility" options={['private', 'workspace', 'org']} value={metadata.access_control.visibility} onChange={val => { saveToHistory(); setMetadata({...metadata, access_control: { ...metadata.access_control, visibility: val }}); }} />
                        <SearchableSelect label="Editors" options={MENTION_OPTIONS} value={metadata.access_control.editors} onChange={vals => { saveToHistory(); setMetadata({...metadata, access_control: { ...metadata.access_control, editors: vals }}); }} isMulti />
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
                            const mentions = MENTION_OPTIONS.filter(option => commentDraft.toLowerCase().includes(`@${option.toLowerCase()}`));
                            setMetadata({
                              ...metadata,
                              comments: [
                                ...metadata.comments,
                                { id: createLocalId('comment'), scope: 'workflow', author: metadata.access_control.owner || 'Haewon Kim', message: commentDraft.trim(), mentions, created_at: new Date().toISOString(), resolved: false }
                              ]
                            });
                            setCommentDraft('');
                          }} className="px-4 py-2 bg-theme-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Add Workflow Comment</button>
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
