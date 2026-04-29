import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CirclePlus,
  Database,
  Layers,
  Link2,
  Move3D,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import dagre from 'dagre';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  ConnectionMode,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SearchableSelect } from './IntakeGatekeeper';
import { auditWorkflowDraft, hasAuditErrors, summarizeAuditIssues, type WorkflowAuditIssue } from '../testing/workflowQuality';

type AnyRecord = Record<string, any>;

interface WorkflowBuilderProps {
  workflow: AnyRecord;
  taxonomy?: any[];
  templates?: any[];
  relatedWorkflows?: any[];
  insights?: AnyRecord;
  policyOverlay?: AnyRecord;
  rollbackPreview?: AnyRecord;
  runtimeConfig?: AnyRecord;
  onSave: (data: AnyRecord) => Promise<any>;
  onBack: (currentData?: AnyRecord) => void;
  onExit: () => void;
  onCreateRollbackDraft?: () => void;
  setIsDirty?: (value: boolean) => void;
}

type DiagramNodeData = {
  title: string;
  subtitle: string;
  kind: string;
  occurrence: number;
  manualMinutes: number;
  automationMinutes: number;
  waitMinutes: number;
  blockerCount: number;
  errorCount: number;
  tone: 'accent' | 'success' | 'warning' | 'neutral' | 'danger';
};

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const buildDraft = (workflow: AnyRecord) => {
  const draft = cloneValue(workflow || {});
  return {
    ...draft,
    name: draft.name || '',
    description: draft.description || '',
    tasks: Array.isArray(draft.tasks) ? draft.tasks : [],
    edges: Array.isArray(draft.edges) ? draft.edges : [],
    access_control: {
      visibility: 'private',
      editors: [],
      viewers: [],
      mention_groups: [],
      ...(draft.access_control || {}),
    },
    ownership: {
      owner: '',
      automation_owner: '',
      reviewers: [],
      smes: [],
      ...(draft.ownership || {}),
    },
    governance: {
      required_reviewer_roles: [],
      lifecycle_stage: 'Draft',
      review_state: 'Draft',
      approval_state: 'Draft',
      stale_after_days: 90,
      ...(draft.governance || {}),
    },
  };
};

const toId = (value: unknown) => String(value ?? '').trim();

const pillTone = (tone: 'accent' | 'success' | 'warning' | 'neutral' | 'danger' = 'neutral') => ({
  accent: 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  neutral: 'border-white/10 bg-white/5 text-white/60',
  danger: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
}[tone]);

const Pill = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'accent' | 'success' | 'warning' | 'neutral' | 'danger' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${pillTone(tone)}`}>
    {children}
  </span>
);

const BuilderStat = ({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'accent' | 'success' | 'warning' | 'neutral' | 'danger' }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
    <p className={`mt-3 text-[24px] font-black ${tone === 'accent' ? 'text-theme-accent' : tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-rose-300' : 'text-white'}`}>{value}</p>
  </div>
);

const WorkflowNode = ({ data, selected }: NodeProps<DiagramNodeData>) => {
  const toneClass = {
    accent: 'border-theme-accent/30 bg-theme-accent/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]',
    success: 'border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.16)]',
    warning: 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.16)]',
    danger: 'border-rose-500/30 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.16)]',
    neutral: 'border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
  }[data.tone];

  return (
    <div className={`min-w-[270px] max-w-[320px] rounded-[1.75rem] border p-4 backdrop-blur-xl transition-all ${toneClass} ${selected ? 'ring-2 ring-theme-accent ring-offset-0 shadow-2xl' : ''}`}>
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-0 !bg-theme-accent" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{data.kind}</p>
          <h3 className="text-[13px] font-black leading-tight text-white">{data.title}</h3>
        </div>
        <Pill tone={data.tone}>{data.subtitle}</Pill>
      </div>

      <p className="mt-3 text-[11px] font-bold leading-relaxed text-white/62">
        {data.subtitle === 'Trigger' || data.subtitle === 'Outcome'
          ? data.subtitle
          : `Occurs ${data.occurrence}x. ${data.manualMinutes.toFixed(1)}m manual, ${data.automationMinutes.toFixed(1)}m automation, ${data.waitMinutes.toFixed(1)}m wait.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone="neutral">{data.occurrence}x</Pill>
        <Pill tone="neutral">B {data.blockerCount}</Pill>
        <Pill tone={data.errorCount > 0 ? 'danger' : 'success'}>E {data.errorCount}</Pill>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-0 !bg-white/60" />
    </div>
  );
};

const layoutGraph = (tasks: AnyRecord[], edges: AnyRecord[]) => {
  const nodeWidth = 300;
  const nodeHeight = 170;

  if (tasks.length === 0) {
    return [] as Node<DiagramNodeData>[];
  }

  if (edges.length === 0) {
    return tasks.map((task, index) => ({
      id: toId(task.node_id || task.id),
      type: 'workflowNode',
      position: { x: 0, y: index * 210 },
      data: task,
    }));
  }

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 110, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  tasks.forEach((task) => {
    const id = toId(task.node_id || task.id);
    graph.setNode(id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    const source = toId(edge.source);
    const target = toId(edge.target);
    if (source && target && graph.hasNode(source) && graph.hasNode(target)) {
      graph.setEdge(source, target);
    }
  });

  dagre.layout(graph);

  return tasks.map((task) => {
    const id = toId(task.node_id || task.id);
    const node = graph.node(id) || { x: 0, y: 0 };
    return {
      id,
      type: 'workflowNode',
      position: { x: node.x - nodeWidth / 2, y: node.y - nodeHeight / 2 },
      data: task,
    };
  });
};

const normalizeTasks = (workflow: AnyRecord) => {
  const tasks = Array.isArray(workflow.tasks) ? workflow.tasks : [];
  return tasks.map((task: AnyRecord, index: number) => {
    const nodeId = toId(task.node_id || task.id || `task-${index + 1}`);
    const blockers = Array.isArray(task.blockers) ? task.blockers : [];
    const errors = Array.isArray(task.errors) ? task.errors : [];
    const manual = Number(task.manual_time_minutes || 0);
    const automation = Number(task.automation_time_minutes || 0);
    const wait = Number(task.machine_wait_time_minutes || 0);
    const kind = String(task.interface || task.interface_type || task.task_type || 'task').toUpperCase();
    const tone = kind === 'TRIGGER'
      ? 'accent'
      : kind === 'OUTCOME'
        ? 'success'
        : kind === 'DECISION' || kind === 'CONDITION' || kind === 'LOOP'
          ? 'warning'
          : errors.length > 0
            ? 'danger'
            : blockers.length > 0
              ? 'warning'
              : 'neutral';

    return {
      ...task,
      node_id: nodeId,
      id: task.id || nodeId,
      title: task.name || nodeId,
      subtitle: task.interface || task.task_type || 'Task',
      kind,
      tone,
      description: task.description || task.task_type || 'No description provided.',
      occurrence: Number(task.occurrence || 1),
      manualMinutes: manual,
      automationMinutes: automation,
      waitMinutes: wait,
      blockerCount: blockers.length,
      errorCount: errors.length,
    };
  });
};

const normalizeEdges = (workflow: AnyRecord) => {
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
  return edges.map((edge: AnyRecord, index: number) => {
    const id = toId(edge.id || `edge-${index + 1}`);
    return {
      id,
      source: toId(edge.source),
      target: toId(edge.target),
      label: edge.label || edge.data?.label || '',
      type: 'smoothstep',
      animated: Boolean(edge.animated),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2, stroke: 'rgba(255,255,255,0.35)' },
    } as Edge;
  });
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow,
  taxonomy = [],
  templates = [],
  relatedWorkflows = [],
  insights = {},
  policyOverlay = {},
  rollbackPreview = {},
  runtimeConfig,
  onSave,
  onBack,
  onExit,
  onCreateRollbackDraft,
  setIsDirty,
}) => {
  const [draft, setDraft] = useState<AnyRecord>(() => buildDraft(workflow));
  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    setDraft(buildDraft(workflow));
    setSelectedTaskId(null);
    setSelectedEdgeId(null);
    setPositionOverrides({});
    setIsEditing(false);
    setShowGuide(true);
    setIsDirty?.(false);
  }, [workflow, setIsDirty]);

  const draftIssues = useMemo(
    () => auditWorkflowDraft({ metadata: draft, tasks: draft.tasks || [], edges: draft.edges || [] }),
    [draft]
  );
  const blockingIssues = draftIssues.filter((issue) => issue.severity === 'error');
  const warningIssues = draftIssues.filter((issue) => issue.severity === 'warning');
  const graphBroken = hasAuditErrors(draftIssues);

  useEffect(() => {
    if (graphBroken) {
      setIsDirty?.(true);
    }
  }, [graphBroken, setIsDirty]);

  useEffect(() => {
    const validTaskIds = new Set((draft.tasks || []).map((task: AnyRecord) => toId(task.node_id || task.id)));
    if (selectedTaskId && !validTaskIds.has(selectedTaskId)) {
      setSelectedTaskId(null);
    }
    if (selectedEdgeId && !(draft.edges || []).some((edge: AnyRecord) => toId(edge.id) === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
    setPositionOverrides((current) => {
      const next: Record<string, { x: number; y: number }> = {};
      Object.entries(current).forEach(([key, value]) => {
        if (validTaskIds.has(key)) {
          next[key] = value;
        }
      });
      return next;
    });
  }, [draft.tasks, draft.edges, selectedTaskId, selectedEdgeId]);

  const updateDraft = (updater: (current: AnyRecord) => AnyRecord) => {
    setDraft((current) => updater(cloneValue(current)));
    setIsDirty?.(true);
  };

  const updateField = (field: string, value: any) => {
    updateDraft((current) => ({ ...current, [field]: value }));
  };

  const updateNested = (field: 'access_control' | 'ownership' | 'governance', value: AnyRecord) => {
    updateDraft((current) => ({ ...current, [field]: { ...(current[field] || {}), ...value } }));
  };

  const updateTask = (taskId: string, patch: AnyRecord) => {
    updateDraft((current) => ({
      ...current,
      tasks: (current.tasks || []).map((task: AnyRecord) => (toId(task.node_id || task.id) === taskId ? { ...task, ...patch } : task)),
    }));
  };

  const updateEdge = (edgeId: string, patch: AnyRecord) => {
    updateDraft((current) => ({
      ...current,
      edges: (current.edges || []).map((edge: AnyRecord) => (toId(edge.id) === edgeId ? { ...edge, ...patch } : edge)),
    }));
  };

  const removeEdge = (edgeId: string) => {
    updateDraft((current) => ({
      ...current,
      edges: (current.edges || []).filter((edge: AnyRecord) => toId(edge.id) !== edgeId),
    }));
    setSelectedEdgeId(null);
  };

  const addDisconnectedTask = () => {
    const taskId = `task-${Date.now()}`;
    const newTask = {
      id: taskId,
      node_id: taskId,
      name: 'Disconnected Task',
      description: 'New disconnected node',
      task_type: 'System Interaction',
      interface: 'TASK',
      occurrence: 1,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      source_data_list: [],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    };

    updateDraft((current) => ({
      ...current,
      tasks: [...(current.tasks || []), newTask],
    }));
    setSelectedTaskId(taskId);
    setSelectedEdgeId(null);
    setIsEditing(true);
    toast.success('Task added to the canvas');
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const source = connection.source;
    const target = connection.target;
    const edgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;
    updateDraft((current) => ({
      ...current,
      edges: addEdge(
        {
          id: edgeId,
          source,
          target,
          label: 'route',
          type: 'smoothstep',
        },
        current.edges || []
      ),
    }));
    setSelectedTaskId(null);
    setSelectedEdgeId(edgeId);
    toast.success('Route connected');
  };

  const handleSave = async () => {
    const issues = auditWorkflowDraft({ metadata: draft, tasks: draft.tasks || [], edges: draft.edges || [] });
    const blocking = issues.filter((issue) => issue.severity === 'error');
    if (blocking.length > 0) {
      const graphIssue = blocking.find((issue) => issue.code === 'graph.unreachable' || issue.code === 'graph.disconnected' || issue.code === 'graph.cycle');
      toast.error(graphIssue?.message || 'All nodes must remain connected before saving.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...draft,
        tasks: draft.tasks || [],
        edges: draft.edges || [],
      });
      setIsDirty?.(false);
      setIsEditing(false);
      toast.success('Configuration Saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const nodes = useMemo(() => {
    const normalized = normalizeTasks(draft);
    const laidOut = layoutGraph(normalized, draft.edges || []);
    return laidOut.map((node) => ({
      ...node,
      position: positionOverrides[node.id] || node.position,
      data: {
        ...node.data,
        title: node.data.title,
      },
    })) as Node<DiagramNodeData>[];
  }, [draft, positionOverrides]);

  const edges = useMemo(() => {
    const normalized = normalizeEdges(draft).map((edge) => ({
      ...edge,
      selected: edge.id === selectedEdgeId,
      style: {
        ...(edge.style || {}),
        stroke: edge.id === selectedEdgeId ? '#38bdf8' : 'rgba(255,255,255,0.32)',
      },
      labelStyle: {
        fill: edge.id === selectedEdgeId ? '#7dd3fc' : '#dbeafe',
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
      },
    }));
    return normalized;
  }, [draft, selectedEdgeId]);

  const selectedTask = useMemo(
    () => (draft.tasks || []).find((task: AnyRecord) => toId(task.node_id || task.id) === selectedTaskId) || null,
    [draft.tasks, selectedTaskId]
  );
  const selectedEdge = useMemo(
    () => (draft.edges || []).find((edge: AnyRecord) => toId(edge.id) === selectedEdgeId) || null,
    [draft.edges, selectedEdgeId]
  );

  const insightSummary = useMemo(() => ({
    candidates: Array.isArray(insights?.automation_candidate_queue) ? insights.automation_candidate_queue.length : 0,
    narratives: Array.isArray(insights?.executive_narratives) ? insights.executive_narratives.length : 0,
    approvals: Array.isArray(insights?.workflow_operations_center?.approval_queue) ? insights.workflow_operations_center.approval_queue.length : 0,
  }), [insights]);

  const selectedTaskIssues = useMemo(
    () => draftIssues.filter((issue: WorkflowAuditIssue) => issue.targetId === selectedTaskId),
    [draftIssues, selectedTaskId]
  );
  const selectedEdgeIssues = useMemo(
    () => draftIssues.filter((issue: WorkflowAuditIssue) => issue.targetId === selectedEdgeId),
    [draftIssues, selectedEdgeId]
  );
  const memoizedNodeTypes = useMemo(() => ({ workflowNode: WorkflowNode }), []);

  const statusTone = blockingIssues.length > 0 ? 'danger' : warningIssues.length > 0 ? 'warning' : 'success';
  const statusLabel = blockingIssues.length > 0
    ? 'Blocking validation issues'
    : warningIssues.length > 0
      ? 'Review recommended'
      : 'Ready to save';

  const definitionSummary = useMemo(() => ({
    workspace: draft.workspace || runtimeConfig?.organization?.default_workspace || 'Personal Drafts',
    prc: draft.prc || 'No PRC',
    type: draft.workflow_type || 'Unclassified',
    org: draft.org || 'No Org',
    team: draft.team || 'No Team',
  }), [draft, runtimeConfig]);

  return (
    <ReactFlowProvider>
      <div className="h-full overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,32,0.98),rgba(8,16,29,0.98))] shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 bg-white/[0.02] px-6 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => onBack(draft)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button onClick={() => setIsEditing((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                    {isEditing ? 'View Definition' : 'Edit Definition'}
                  </button>
                  <button onClick={addDisconnectedTask} data-testid="builder-add-task" className="inline-flex items-center gap-2 rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent transition-all hover:bg-theme-accent hover:text-white">
                    <Plus size={14} /> Add Task
                  </button>
                  {onCreateRollbackDraft && rollbackPreview?.available && (
                    <button onClick={onCreateRollbackDraft} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 transition-all hover:bg-amber-500 hover:text-white">
                      <RefreshCw size={14} /> Rollback Draft
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <h1 className="text-[28px] font-black uppercase tracking-tight text-white">Workflow Definition</h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-theme-accent">Repository Definition Surface</p>
                  <p className="max-w-[72rem] text-[13px] font-bold leading-relaxed text-white/65">
                    {workflow?.description || 'Edit the workflow map, route structure, metadata, and governance context from one surface. The canvas stays readable for first-time users and dense enough for experienced operators.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="accent">{definitionSummary.type}</Pill>
                  <Pill>{definitionSummary.prc}</Pill>
                  <Pill>{definitionSummary.workspace}</Pill>
                  <Pill>{definitionSummary.org}</Pill>
                  <Pill>{definitionSummary.team}</Pill>
                  <Pill tone={statusTone}>{statusLabel}</Pill>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:min-w-[420px]">
                <BuilderStat label="Tasks" value={draft.tasks?.length || 0} tone="accent" />
                <BuilderStat label="Routes" value={draft.edges?.length || 0} tone="neutral" />
                <BuilderStat label="Warnings" value={warningIssues.length} tone="warning" />
                <BuilderStat label="Errors" value={blockingIssues.length} tone={blockingIssues.length > 0 ? 'danger' : 'success'} />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-6 py-6">
            <div className="grid h-full gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Workflow size={16} className="text-theme-accent" />
                    <div>
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Workflow Map</h2>
                      <p className="mt-1 text-[11px] font-bold text-white/45">Drag nodes, draw routes, and inspect the active path.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setPositionOverrides({})} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 transition-all hover:bg-white/10 hover:text-white">
                      <Move3D size={14} /> Reset Layout
                    </button>
                    <button onClick={addDisconnectedTask} className="inline-flex items-center gap-2 rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent transition-all hover:bg-theme-accent hover:text-white">
                      <CirclePlus size={14} /> Add Node
                    </button>
                  </div>
                </div>

                <div className="relative min-h-[520px] flex-1">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={memoizedNodeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    minZoom={0.3}
                    maxZoom={1.8}
                    nodesConnectable={isEditing}
                    nodesDraggable={isEditing}
                    elementsSelectable
                    panOnScroll
                    panOnDrag
                    onConnect={handleConnect}
                    onNodeClick={(_, node) => {
                      setSelectedTaskId(node.id);
                      setSelectedEdgeId(null);
                    }}
                    onEdgeClick={(_, edge) => {
                      setSelectedEdgeId(edge.id);
                      setSelectedTaskId(null);
                    }}
                    onPaneClick={() => {
                      setSelectedTaskId(null);
                      setSelectedEdgeId(null);
                    }}
                    onNodeDragStop={(_, node) => {
                      setPositionOverrides((current) => ({
                        ...current,
                        [node.id]: { x: node.position.x, y: node.position.y },
                      }));
                    }}
                    onEdgesDelete={(deleted) => {
                      if (!deleted.length) return;
                      const deletedIds = new Set(deleted.map((edge) => edge.id));
                      updateDraft((current) => ({
                        ...current,
                        edges: (current.edges || []).filter((edge: AnyRecord) => !deletedIds.has(toId(edge.id))),
                      }));
                    }}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148,163,184,0.22)" />
                    <Controls className="!bottom-4 !left-4 !right-auto !top-auto" showInteractive={false} />
                    <MiniMap
                      zoomable
                      pannable
                      nodeStrokeColor={(node) => {
                        const tone = (node.data as DiagramNodeData)?.tone || 'neutral';
                        return tone === 'accent' ? '#38bdf8' : tone === 'success' ? '#10b981' : tone === 'warning' ? '#f59e0b' : tone === 'danger' ? '#fb7185' : 'rgba(255,255,255,0.35)';
                      }}
                      nodeColor={(node) => {
                        const tone = (node.data as DiagramNodeData)?.tone || 'neutral';
                        return tone === 'accent' ? 'rgba(56,189,248,0.15)' : tone === 'success' ? 'rgba(16,185,129,0.15)' : tone === 'warning' ? 'rgba(245,158,11,0.15)' : tone === 'danger' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.08)';
                      }}
                      maskColor="rgba(0,0,0,0.35)"
                    />
                  </ReactFlow>

                  <div className="pointer-events-none absolute left-4 top-4 max-w-[18rem] rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Canvas Guide</p>
                    <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/60">
                      Connect nodes in edit mode. Select any node or route to inspect it on the right.
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={graphBroken ? 'danger' : 'success'}>{graphBroken ? 'Validation blocked' : 'Graph healthy'}</Pill>
                      <Pill tone="neutral">{(relatedWorkflows || []).length} related</Pill>
                      <Pill tone="neutral">{(templates || []).length} templates</Pill>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="accent">Select a node to edit it</Pill>
                      <Pill tone="neutral">Draw routes between handles</Pill>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
                {showGuide && (
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Builder Guide</p>
                        <p className="mt-2 text-[12px] font-bold text-white/60 max-w-[60rem]">
                          The canvas shows the workflow in plain language first and structure second. Use Edit Definition for metadata, select a node for task details, and connect routes directly in the diagram.
                        </p>
                      </div>
                      <button data-testid="builder-guide-dismiss" onClick={() => setShowGuide(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 transition-all hover:bg-white/10 hover:text-white">
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center gap-3">
                    <Layers size={16} className="text-theme-accent" />
                    <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Definition</h2>
                  </div>

                  {isEditing ? (
                    <div className="mt-5 space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Workflow Name</label>
                          <span className="text-[9px] font-mono text-white/20">{draft.name.length} / 60</span>
                        </div>
                        <input
                          data-testid="builder-workflow-name"
                          value={draft.name}
                          maxLength={60}
                          onChange={(e) => updateField('name', e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[14px] font-black uppercase text-white outline-none transition-all placeholder:text-white/10 focus:border-theme-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Description</label>
                          <span className="text-[9px] font-mono text-white/20">{draft.description.length} / 500</span>
                        </div>
                        <textarea
                          data-testid="builder-workflow-description"
                          value={draft.description}
                          maxLength={500}
                          onChange={(e) => updateField('description', e.target.value)}
                          className="h-28 w-full resize-none rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold leading-relaxed text-white/80 outline-none transition-all placeholder:text-white/10 focus:border-theme-accent"
                          placeholder="Describe the operational purpose of this workflow..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <SearchableSelect
                          label="Workspace"
                          options={runtimeConfig?.organization?.workspace_options || ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations']}
                          value={draft.workspace}
                          onChange={(value) => updateField('workspace', value)}
                          placeholder="SELECT WORKSPACE..."
                        />
                        <SearchableSelect
                          label="PRC"
                          options={Array.from(new Set((taxonomy || []).filter((item: any) => String(item.category).toLowerCase().includes('prc')).map((item: any) => item.value || item.label || item.name || item))).filter(Boolean)}
                          value={draft.prc}
                          onChange={(value) => updateField('prc', value)}
                          placeholder="SELECT PRC..."
                        />
                        <SearchableSelect
                          label="Type"
                          options={Array.from(new Set((taxonomy || []).filter((item: any) => String(item.category).toLowerCase().includes('type')).map((item: any) => item.value || item.label || item.name || item))).filter(Boolean)}
                          value={draft.workflow_type}
                          onChange={(value) => updateField('workflow_type', value)}
                          placeholder="SELECT TYPE..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <SearchableSelect
                          label="Org"
                          options={runtimeConfig?.organization?.org_options || []}
                          value={draft.org}
                          onChange={(value) => updateField('org', value)}
                          placeholder="SELECT ORG..."
                        />
                        <SearchableSelect
                          label="Team"
                          options={runtimeConfig?.organization?.team_options || []}
                          value={draft.team}
                          onChange={(value) => updateField('team', value)}
                          placeholder="SELECT TEAM..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <SearchableSelect
                          label="Trigger"
                          options={Array.from(new Set((taxonomy || []).filter((item: any) => String(item.category).toLowerCase().includes('trigger')).map((item: any) => item.value || item.label || item.name || item))).filter(Boolean)}
                          value={draft.trigger_type}
                          onChange={(value) => updateField('trigger_type', value)}
                          placeholder="SELECT TRIGGER..."
                        />
                        <SearchableSelect
                          label="Output"
                          options={Array.from(new Set((taxonomy || []).filter((item: any) => String(item.category).toLowerCase().includes('output')).map((item: any) => item.value || item.label || item.name || item))).filter(Boolean)}
                          value={draft.output_type}
                          onChange={(value) => updateField('output_type', value)}
                          placeholder="SELECT OUTPUT..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <SearchableSelect
                          label="Visibility"
                          options={['private', 'workspace', 'org']}
                          value={draft.access_control?.visibility}
                          onChange={(value) => updateNested('access_control', { visibility: value })}
                          placeholder="SELECT VISIBILITY..."
                        />
                        <input
                          value={draft.ownership?.owner || ''}
                          onChange={(e) => updateNested('ownership', { owner: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all placeholder:text-white/15 focus:border-theme-accent"
                          placeholder="Workflow Owner"
                        />
                        <SearchableSelect
                          label="Lifecycle"
                          options={runtimeConfig?.organization?.lifecycle_options || ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Active']}
                          value={draft.governance?.lifecycle_stage}
                          onChange={(value) => updateNested('governance', { lifecycle_stage: value })}
                          placeholder="SELECT LIFECYCLE..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Workflow Name</p>
                        <p className="mt-2 text-[16px] font-black text-white">{draft.name || 'Untitled Workflow'}</p>
                        <p className="mt-3 text-[12px] font-bold leading-relaxed text-white/60">{draft.description || 'No description provided.'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Governance Snapshot</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Pill tone="accent">Visibility {draft.access_control?.visibility || 'private'}</Pill>
                          <Pill tone="neutral">Owner {draft.ownership?.owner || 'Unassigned'}</Pill>
                          <Pill tone="neutral">Lifecycle {draft.governance?.lifecycle_stage || 'Draft'}</Pill>
                          <Pill tone="neutral">Review {draft.governance?.review_state || 'Draft'}</Pill>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Move3D size={16} className="text-theme-accent" />
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Selected Node</h2>
                    </div>
                    <Pill tone={selectedTask ? 'accent' : 'neutral'}>{selectedTask ? 'Node active' : 'No selection'}</Pill>
                  </div>

                  {selectedTask ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Node Label</p>
                        <p className="mt-2 text-[15px] font-black text-white">{selectedTask.name || selectedTask.node_id}</p>
                        <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/60">{selectedTask.description || 'No description available.'}</p>
                      </div>

                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              value={selectedTask.name || ''}
                              onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { name: e.target.value })}
                              className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                              placeholder="Node title"
                            />
                            <input
                              value={selectedTask.task_type || ''}
                              onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { task_type: e.target.value })}
                              className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                              placeholder="Task type"
                            />
                          </div>
                          <textarea
                            value={selectedTask.description || ''}
                            onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { description: e.target.value })}
                            className="h-24 w-full resize-none rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold leading-relaxed text-white outline-none transition-all focus:border-theme-accent"
                            placeholder="Node description"
                          />
                          <div className="grid gap-3 md:grid-cols-3">
                            <input
                              type="number"
                              min={0}
                              value={selectedTask.occurrence || 1}
                              onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { occurrence: Number(e.target.value) || 1 })}
                              className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                              placeholder="Occurrence"
                            />
                            <input
                              type="number"
                              min={0}
                              value={selectedTask.manual_time_minutes || 0}
                              onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { manual_time_minutes: Number(e.target.value) || 0 })}
                              className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                              placeholder="Manual min"
                            />
                            <input
                              type="number"
                              min={0}
                              value={selectedTask.automation_time_minutes || 0}
                              onChange={(e) => updateTask(selectedTask.node_id || selectedTask.id, { automation_time_minutes: Number(e.target.value) || 0 })}
                              className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                              placeholder="Automation min"
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <button
                              onClick={() => {
                                const nextId = `edge-${selectedTask.node_id || selectedTask.id}-${Date.now()}`;
                                updateDraft((current) => ({
                                  ...current,
                                  edges: [
                                    ...(current.edges || []),
                                    {
                                      id: nextId,
                                      source: selectedTask.node_id || selectedTask.id,
                                      target: (current.tasks || []).find((task: AnyRecord) => toId(task.node_id || task.id) !== toId(selectedTask.node_id || selectedTask.id))?.node_id || null,
                                      label: 'route',
                                    },
                                  ].filter((edge: AnyRecord) => Boolean(edge.target)),
                                }));
                                toast.success('Route drafted');
                              }}
                              className="rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent transition-all hover:bg-theme-accent hover:text-white"
                            >
                              <Link2 size={14} /> Link to Another Node
                            </button>
                            <button
                              onClick={() => setPositionOverrides({})}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 transition-all hover:bg-white/10 hover:text-white"
                            >
                              Reset Layout
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Type</p>
                            <p className="mt-2 text-[12px] font-bold text-white/70">{selectedTask.task_type || 'Task'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Occurrences</p>
                            <p className="mt-2 text-[12px] font-bold text-white/70">{selectedTask.occurrence || 1}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Effort</p>
                            <p className="mt-2 text-[12px] font-bold text-white/70">{Number(selectedTask.manual_time_minutes || 0).toFixed(1)}m / {Number(selectedTask.automation_time_minutes || 0).toFixed(1)}m</p>
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Validation</p>
                        <div className="mt-3 space-y-2">
                          {selectedTaskIssues.slice(0, 4).map((issue) => (
                            <div key={issue.code} className={`rounded-xl border p-3 ${issue.severity === 'error' ? 'border-rose-500/20 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
                              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${issue.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{issue.code}</p>
                              <p className="mt-1 text-[11px] font-bold text-white/70">{issue.message}</p>
                            </div>
                          ))}
                          {selectedTaskIssues.length === 0 && <p className="text-[11px] font-bold text-white/45">No issues for this node.</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] font-bold text-white/50">Select a node on the canvas to inspect or edit it.</p>
                  )}
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Link2 size={16} className="text-theme-accent" />
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Selected Route</h2>
                    </div>
                    <Pill tone={selectedEdge ? 'accent' : 'neutral'}>{selectedEdge ? 'Route active' : 'No route selected'}</Pill>
                  </div>
                  {selectedEdge ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Route Path</p>
                        <p className="mt-2 text-[12px] font-bold text-white/70">{selectedEdge.source} → {selectedEdge.target}</p>
                      </div>
                      <input
                        value={selectedEdge.label || ''}
                        onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-[#1e293b]/50 px-4 py-3 text-[12px] font-bold text-white outline-none transition-all focus:border-theme-accent"
                        placeholder="Route label"
                      />
                      <button
                        onClick={() => removeEdge(selectedEdge.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        <X size={14} /> Remove Route
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Validation</p>
                        <div className="mt-3 space-y-2">
                          {selectedEdgeIssues.slice(0, 4).map((issue) => (
                            <div key={issue.code} className={`rounded-xl border p-3 ${issue.severity === 'error' ? 'border-rose-500/20 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
                              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${issue.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{issue.code}</p>
                              <p className="mt-1 text-[11px] font-bold text-white/70">{issue.message}</p>
                            </div>
                          ))}
                          {selectedEdgeIssues.length === 0 && <p className="text-[11px] font-bold text-white/45">No issues for this route.</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] font-bold text-white/50">Select a route line to inspect or rename it.</p>
                  )}
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={16} className="text-theme-accent" />
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Governance</h2>
                    </div>
                    {policyOverlay?.rules?.length ? <Pill tone="accent">{policyOverlay.rules.length} rules</Pill> : <Pill tone="neutral">No policy overlay</Pill>}
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Owner</p>
                      <p className="mt-2 text-[13px] font-bold text-white/70">{draft.ownership?.owner || 'Unassigned'}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Visibility</p>
                        <p className="mt-2 text-[13px] font-bold text-white/70">{draft.access_control?.visibility || 'private'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Stale After</p>
                        <p className="mt-2 text-[13px] font-bold text-white/70">{draft.governance?.stale_after_days || 90} days</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <BuilderStat label="Candidates" value={insightSummary.candidates} tone="accent" />
                      <BuilderStat label="Narratives" value={insightSummary.narratives} tone="neutral" />
                      <BuilderStat label="Approvals" value={insightSummary.approvals} tone="warning" />
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Database size={16} className="text-theme-accent" />
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Review Context</h2>
                    </div>
                    <Pill tone={warningIssues.length > 0 ? 'warning' : 'neutral'}>{warningIssues.length} warnings</Pill>
                  </div>

                  <div className="mt-5 space-y-3">
                    {(policyOverlay?.rules || []).slice(0, 4).map((rule: AnyRecord, index: number) => (
                      <div key={`${rule.title || index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{rule.title || 'Policy Rule'}</p>
                        <p className="mt-1 text-[11px] font-bold text-white/55">{rule.description || rule.detail || 'No rule detail provided.'}</p>
                      </div>
                    ))}
                    {warningIssues.slice(0, 3).map((issue) => (
                      <div key={issue.code} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">{issue.code}</p>
                        <p className="mt-1 text-[11px] font-bold text-amber-200/80">{issue.message}</p>
                      </div>
                    ))}
                    {warningIssues.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-[11px] font-bold text-white/45">
                        No warnings at the moment.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Sparkles size={16} className="text-theme-accent" />
                      <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Workflow Context</h2>
                    </div>
                    <Pill tone={graphBroken ? 'danger' : 'success'}>{draftIssues.length} issues</Pill>
                  </div>
                  <div className="mt-5 space-y-3">
                    {draftIssues.slice(0, 5).map((issue) => (
                      <div key={issue.code} className={`rounded-2xl border p-4 ${issue.severity === 'error' ? 'border-rose-500/20 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${issue.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{issue.code}</p>
                        <p className="mt-1 text-[11px] font-bold text-white/70">{issue.message}</p>
                      </div>
                    ))}
                    {draftIssues.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-[11px] font-bold text-white/45">
                        No quality issues detected.
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.02] px-6 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  data-testid="builder-commit"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-theme-accent px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? 'Saving' : 'Commit'}
                </button>
                <button onClick={() => onBack(draft)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                  <ArrowLeft size={14} /> Back to Intake
                </button>
                <button onClick={onExit} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                  <X size={14} /> Exit
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={graphBroken ? 'danger' : 'success'}>{graphBroken ? 'Fix graph before commit' : 'Graph aligned'}</Pill>
                <Pill tone="neutral">{relatedWorkflows.length} related workflows</Pill>
                <Pill tone="neutral">{templates.length} templates</Pill>
              </div>
            </div>
            {blockingIssues.length > 0 && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={16} className="text-rose-300" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">All nodes must remain connected</p>
                </div>
                <p className="mt-2 text-[11px] font-bold text-rose-200/80">{summarizeAuditIssues(blockingIssues)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;
