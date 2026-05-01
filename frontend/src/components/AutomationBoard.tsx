import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Copy,
  BookOpen,
  Clock3,
  Layers3,
  MessageSquare,
  Plus,
  Satellite,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Edge, Node, NodeProps } from 'reactflow';
import { canApproveAutomationBoard, canReviewAutomationBoard, formatGovernanceActor } from '../utils/governance';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AutomationComment = {
  id: string;
  taskId: string | null;
  author: string;
  body: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
};

type AutomationTask = {
  id: string;
  name: string;
  tatMinutes: number;
  originalTaskIds: string[];
  owner: string;
  notes: string;
};

type AutomationVersion = {
  id: string;
  name: string;
  status: 'Draft' | 'Review' | 'Approved';
  reviewState: 'Draft' | 'Requested' | 'Changes Requested' | 'Approved';
  approvalState: 'Draft' | 'Pending Review' | 'Approved' | 'Certified' | 'Needs Recertification';
  createdAt: string;
  updatedAt: string;
  automationTasks: AutomationTask[];
  comments: AutomationComment[];
  assumptions: string;
};

const storageKeyForWorkflow = (workflowId: number | string) => `pathos-automation-board-${workflowId}`;

const safeParse = (value: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const numberOr = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeVersion = (version: Partial<AutomationVersion> & Record<string, any>): AutomationVersion => ({
  id: version.id || `version-${Date.now()}`,
  name: version.name || 'Proposal Version',
  status: (version.status as AutomationVersion['status']) || 'Draft',
  reviewState: (version.reviewState as AutomationVersion['reviewState']) || (version.status === 'Approved' ? 'Approved' : version.status === 'Review' ? 'Requested' : 'Draft'),
  approvalState: (version.approvalState as AutomationVersion['approvalState']) || (version.status === 'Approved' ? 'Approved' : 'Draft'),
  createdAt: version.createdAt || new Date().toISOString(),
  updatedAt: version.updatedAt || new Date().toISOString(),
  automationTasks: Array.isArray(version.automationTasks) ? version.automationTasks : [],
  comments: Array.isArray(version.comments) ? version.comments : [],
  assumptions: version.assumptions || '',
});

const getTaskMinutes = (task: any) => numberOr(task?.manual_time_minutes ?? task?.manual_time ?? task?.automation_time_minutes, 0) * Math.max(1, numberOr(task?.occurrence, 1));

const getApprovedWorkflows = (workflows: any[]) => workflows.filter((workflow) => !workflow?.is_deleted && (workflow?.approval_state === 'Approved' || workflow?.review_state === 'Approved' || workflow?.status === 'Fully Automated' || workflow?.status === 'Approved'));

const TaskNode = ({ data }: NodeProps<any>) => {
  const tone =
    data.kind === 'baseline'
      ? 'border-white/10 bg-white/[0.04] text-white/75'
      : data.kind === 'mapping'
        ? 'border-theme-accent/20 bg-theme-accent/8 text-theme-accent'
        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';

  return (
  <div className={cn('min-w-[220px] max-w-[248px] rounded-[1.15rem] border px-3.5 py-3 shadow-xl backdrop-blur-xl', tone)}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-none !bg-theme-accent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">{data.kind === 'baseline' ? 'Approved Task' : data.kind === 'mapping' ? 'Maps From' : 'Automation Task'}</p>
          <h4 className="mt-1 truncate text-[12px] font-black uppercase tracking-tight text-white">{data.label}</h4>
        </div>
        {data.locked && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/45">Locked</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
        <span className="text-theme-accent">{data.tatMinutes?.toFixed?.(0) ?? 0}m</span>
        <span className={cn('rounded-full border px-2 py-0.5', data.kind === 'proposal' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-white/45')}>
          {data.kind === 'baseline' ? 'Current' : 'Proposal'}
        </span>
      </div>
      {Array.isArray(data.originalTaskIds) && data.originalTaskIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.originalTaskIds.slice(0, 3).map((taskId: string) => (
            <span key={taskId} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-theme-accent">
              {taskId}
            </span>
          ))}
          {data.originalTaskIds.length > 3 && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/45">+{data.originalTaskIds.length - 3}</span>}
        </div>
      )}
      {data.commentCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">
          <Satellite size={10} className="text-theme-accent" />
          {data.commentCount} comments
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-none !bg-theme-accent" />
    </div>
  );
};

const CommentRow = ({
  comment,
  onToggleStatus,
  onDelete,
}: {
  comment: AutomationComment;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">{comment.author}</p>
        <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/70">{comment.body}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onToggleStatus(comment.id)} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60 hover:text-white">
          {comment.status === 'open' ? 'Resolve' : 'Reopen'}
        </button>
        <button onClick={() => onDelete(comment.id)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/40 hover:text-white">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
      <span>{new Date(comment.createdAt).toLocaleString()}</span>
      <span className={comment.status === 'open' ? 'text-amber-300' : 'text-emerald-300'}>{comment.status}</span>
    </div>
  </div>
);

const AutomationBoardInner: React.FC<{
  workflow?: any;
  workflows: any[];
  onBack: () => void;
  onOpenWorkflow?: (workflowId: number) => void;
  currentUser?: any;
  runtimeConfig?: any;
}> = ({ workflow, workflows, onBack, onOpenWorkflow, currentUser, runtimeConfig }) => {
  const { fitView } = useReactFlow();
  const activeMember = currentUser || runtimeConfig?.current_member || null;
  const canReviewBoard = canReviewAutomationBoard(activeMember);
  const canApproveBoard = canApproveAutomationBoard(activeMember);
  const approvedWorkflows = useMemo(() => getApprovedWorkflows(workflows), [workflows]);

  const currentWorkflowIsApproved = workflow && !workflow.is_deleted && getApprovedWorkflows([workflow]).length > 0;
  const initialWorkflow = currentWorkflowIsApproved
    ? workflow
    : approvedWorkflows[0] || workflows.find((item) => !item?.is_deleted) || null;

  const [activeWorkflowId, setActiveWorkflowId] = useState<number | null>(initialWorkflow?.id ?? null);
  const activeWorkflow = useMemo(
    () => workflows.find((item) => item.id === activeWorkflowId) || initialWorkflow,
    [activeWorkflowId, workflows, initialWorkflow]
  );

  const workflowTasks = useMemo(
    () => (activeWorkflow?.tasks || []).filter((task: any) => task?.task_type !== 'OUTCOME' || task?.interface !== 'OUTCOME'),
    [activeWorkflow]
  );

  const baselineTaskRows = useMemo(() => {
    return workflowTasks.map((task: any, index: number) => ({
      id: String(task.node_id || task.id || `baseline-${index}`),
      label: task.name || `Task ${index + 1}`,
      tatMinutes: getTaskMinutes(task),
      locked: task.interface === 'TRIGGER' || task.interface === 'OUTCOME',
    }));
  }, [workflowTasks]);

  const [versions, setVersions] = useState<Record<number, AutomationVersion[]>>({});
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [compareVersionId, setCompareVersionId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState({ name: '', tatMinutes: '', originalTaskIds: [] as string[], notes: '' });

  const workflowStorage = activeWorkflow?.id ? storageKeyForWorkflow(activeWorkflow.id) : null;

  useEffect(() => {
    if (workflow?.id && workflow.id !== activeWorkflowId) {
      setActiveWorkflowId(workflow.id);
    }
  }, [workflow?.id, activeWorkflowId]);

  useEffect(() => {
    if (!activeWorkflow?.id) return;
    const stored = safeParse(window.localStorage.getItem(storageKeyForWorkflow(activeWorkflow.id)));
    if (stored?.versions) {
      setVersions((current) => ({ ...current, [activeWorkflow.id]: stored.versions.map((version: any) => normalizeVersion(version)) }));
      setSelectedVersionId(stored.selectedVersionId || '');
      setCompareVersionId(stored.compareVersionId || '');
      setSelectedTaskId(stored.selectedTaskId || null);
      return;
    }

    const baselineVersion = normalizeVersion({
      id: `baseline-${activeWorkflow.id}`,
      name: `${activeWorkflow.name} Proposal`,
      status: 'Draft',
      reviewState: 'Draft',
      approvalState: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      automationTasks: [],
      comments: [],
      assumptions: 'Assume current-state manual task timings remain stable until measured.',
    });

    setVersions((current) => ({ ...current, [activeWorkflow.id]: [baselineVersion] }));
    setSelectedVersionId(baselineVersion.id);
    setCompareVersionId(baselineVersion.id);
    setSelectedTaskId(null);
  }, [activeWorkflow?.id, activeWorkflow?.name]);

  const currentVersions = useMemo(
    () => (activeWorkflow?.id ? (versions[activeWorkflow.id] || []).map((version) => normalizeVersion(version)) : []),
    [activeWorkflow?.id, versions]
  );
  const activeVersion = currentVersions.find((version) => version.id === selectedVersionId) || currentVersions[0];
  const compareVersion = currentVersions.find((version) => version.id === compareVersionId) || currentVersions[0];

  useEffect(() => {
    if (!activeWorkflow?.id || !workflowStorage) return;
    window.localStorage.setItem(
      workflowStorage,
      JSON.stringify({
        versions: currentVersions,
        selectedVersionId,
        compareVersionId,
        selectedTaskId,
      })
    );
  }, [activeWorkflow?.id, workflowStorage, currentVersions, selectedVersionId, compareVersionId, selectedTaskId]);

  const selectedAutomationTask = activeVersion?.automationTasks.find((task) => task.id === selectedTaskId) || null;

  useEffect(() => {
    fitView({ duration: 400, padding: 0.12 });
  }, [activeWorkflow?.id, activeVersion?.id, fitView]);

  const baselineTotal = useMemo(() => baselineTaskRows.reduce((sum: number, task: { tatMinutes: number }) => sum + task.tatMinutes, 0), [baselineTaskRows]);

  const activeVersionCoverage = useMemo(() => {
    const covered = new Set<string>();
    activeVersion?.automationTasks.forEach((task) => task.originalTaskIds.forEach((taskId) => covered.add(taskId)));
    const coveredManualMinutes = baselineTaskRows.filter((task: { id: string; tatMinutes: number }) => covered.has(task.id)).reduce((sum: number, task: { tatMinutes: number }) => sum + task.tatMinutes, 0);
    const automationMinutes = activeVersion?.automationTasks.reduce((sum: number, task: AutomationTask) => sum + numberOr(task.tatMinutes, 0), 0) || 0;
    const savings = Math.max(coveredManualMinutes - automationMinutes, 0);
    return { coveredManualMinutes, automationMinutes, savings, savingsPercent: coveredManualMinutes > 0 ? (savings / coveredManualMinutes) * 100 : 0 };
  }, [activeVersion, baselineTaskRows]);

  const compareSummary = useMemo(() => {
    const compare = compareVersion || activeVersion;
    const compareIds = new Set(compare?.automationTasks.flatMap((task: AutomationTask) => task.originalTaskIds) || []);
    const currentIds = new Set(activeVersion?.automationTasks.flatMap((task: AutomationTask) => task.originalTaskIds) || []);
    const newTasks = (activeVersion?.automationTasks || []).filter((task: AutomationTask) => !compare?.automationTasks.some((other: AutomationTask) => other.id === task.id));
    const removedTasks = (compare?.automationTasks || []).filter((task: AutomationTask) => !activeVersion?.automationTasks.some((other: AutomationTask) => other.id === task.id));
    const changedMappings = (activeVersion?.automationTasks || []).filter((task: AutomationTask) => {
      const prior = compare?.automationTasks.find((other: AutomationTask) => other.id === task.id);
      if (!prior) return false;
      return JSON.stringify(prior.originalTaskIds.sort()) !== JSON.stringify(task.originalTaskIds.sort()) || prior.tatMinutes !== task.tatMinutes || prior.name !== task.name;
    });
    const baselineDiff = baselineTaskRows.filter((task: { id: string }) => currentIds.has(task.id) && !compareIds.has(task.id)).length;
    return { newTasks, removedTasks, changedMappings, baselineDiff };
  }, [activeVersion, compareVersion, baselineTaskRows]);

  const updateVersions = (next: AutomationVersion[]) => {
    if (!activeWorkflow?.id) return;
    setVersions((current) => ({ ...current, [activeWorkflow.id]: next }));
  };

  const patchActiveVersion = (updater: (current: AutomationVersion) => AutomationVersion) => {
    if (!activeVersion || !activeWorkflow?.id) return;
    updateVersions(currentVersions.map((version) => (version.id === activeVersion.id ? updater(version) : version)));
  };

  const addComment = () => {
    if (!commentDraft.trim() || !activeVersion) return;
    patchActiveVersion((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      comments: [
        {
          id: `comment-${Date.now()}`,
          taskId: selectedTaskId,
          author: 'Current User',
          body: commentDraft.trim(),
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current.comments,
      ],
    }));
    setCommentDraft('');
  };

  const addAutomationTask = () => {
    if (!activeVersion || !taskDraft.name.trim()) return;
    const nextTask: AutomationTask = {
      id: `automation-${Date.now()}`,
      name: taskDraft.name.trim(),
      tatMinutes: numberOr(taskDraft.tatMinutes, 0),
      originalTaskIds: taskDraft.originalTaskIds,
      owner: 'Automation Team',
      notes: taskDraft.notes.trim(),
    };
    patchActiveVersion((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      automationTasks: [nextTask, ...current.automationTasks],
    }));
    setSelectedTaskId(nextTask.id);
    setTaskDraft({ name: '', tatMinutes: '', originalTaskIds: [], notes: '' });
  };

  const toggleCommentStatus = (commentId: string) => {
    patchActiveVersion((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      comments: current.comments.map((comment) => (comment.id === commentId ? { ...comment, status: comment.status === 'open' ? 'resolved' : 'open', updatedAt: new Date().toISOString() } : comment)),
    }));
  };

  const deleteComment = (commentId: string) => {
    patchActiveVersion((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      comments: current.comments.filter((comment) => comment.id !== commentId),
    }));
  };

  const deleteAutomationTask = (taskId: string) => {
    patchActiveVersion((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      automationTasks: current.automationTasks.filter((task) => task.id !== taskId),
    }));
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  const updateApprovalState = (
    next: Partial<Pick<AutomationVersion, 'status' | 'reviewState' | 'approvalState'>>,
    action: 'review' | 'approve' = 'approve'
  ) => {
    if (!activeVersion) return;
    if (action === 'review' ? !canReviewBoard : !canApproveBoard) return;
    patchActiveVersion((current) => ({
      ...current,
      ...next,
      updatedAt: new Date().toISOString(),
    }));
  };

  const cloneVersion = (version: AutomationVersion) => {
    const next = normalizeVersion({
      ...version,
      id: `version-${Date.now()}`,
      name: `${version.name} Copy`,
      status: 'Draft',
      reviewState: version.reviewState || 'Draft',
      approvalState: version.approvalState || 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: version.comments.map((comment: AutomationComment) => ({ ...comment, id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
      automationTasks: version.automationTasks.map((task: AutomationTask) => ({ ...task, id: `automation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    });
    updateVersions([next, ...currentVersions]);
    setSelectedVersionId(next.id);
    setCompareVersionId(activeVersion?.id || next.id);
    setSelectedTaskId(null);
  };

  const newVersion = () => {
    const next = normalizeVersion({
      id: `version-${Date.now()}`,
      name: `${activeWorkflow?.name || 'Workflow'} Proposal ${currentVersions.length + 1}`,
      status: 'Draft',
      reviewState: 'Draft',
      approvalState: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      automationTasks: [],
      comments: [],
      assumptions: activeVersion?.assumptions || 'Assume current baseline timings until measured.',
    });
    updateVersions([next, ...currentVersions]);
    setSelectedVersionId(next.id);
    setCompareVersionId(activeVersion?.id || next.id);
    setSelectedTaskId(null);
  };

  const nodes = useMemo(() => {
    const baselineNodes: Node[] = baselineTaskRows.map((task: { id: string; label: string; tatMinutes: number; locked: boolean }, index: number) => ({
      id: `baseline-${task.id}`,
      type: 'automationTask',
      position: { x: index * 285, y: 0 },
      data: {
        label: task.label,
        tatMinutes: task.tatMinutes,
        kind: 'baseline',
        locked: task.locked,
      },
    }));

    const proposalNodes: Node[] = (activeVersion?.automationTasks || []).map((task: AutomationTask, index: number) => ({
      id: task.id,
      type: 'automationTask',
      position: { x: index * 285, y: 260 },
      data: {
        label: task.name,
        tatMinutes: task.tatMinutes,
        kind: 'proposal',
        originalTaskIds: task.originalTaskIds,
        commentCount: activeVersion.comments.filter((comment: AutomationComment) => comment.taskId === task.id).length,
      },
    }));

    const mappingNodes: Node[] = (activeVersion?.automationTasks || []).map((task: AutomationTask, index: number) => ({
      id: `mapping-${task.id}`,
      type: 'automationTask',
      position: { x: index * 285, y: 130 },
      data: {
        label: `${task.originalTaskIds.length || 0} mapped tasks`,
        tatMinutes: task.tatMinutes,
        kind: 'mapping',
        originalTaskIds: task.originalTaskIds,
      },
    }));

    return [...baselineNodes, ...mappingNodes, ...proposalNodes];
  }, [baselineTaskRows, activeVersion]);

  const edges = useMemo(() => {
    const baselineEdges: Edge[] = baselineTaskRows.slice(0, -1).map((task: { id: string }, index: number) => ({
      id: `baseline-edge-${task.id}-${baselineTaskRows[index + 1].id}`,
      source: `baseline-${task.id}`,
      target: `baseline-${baselineTaskRows[index + 1].id}`,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(148,163,184,0.7)' },
      style: { stroke: 'rgba(148,163,184,0.35)', strokeWidth: 1.5 },
    }));

    const proposalEdges: Edge[] = (activeVersion?.automationTasks || []).slice(0, -1).map((task: AutomationTask, index: number) => ({
      id: `proposal-edge-${task.id}-${activeVersion.automationTasks[index + 1].id}`,
      source: task.id,
      target: activeVersion.automationTasks[index + 1].id,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' },
      style: { stroke: '#38bdf8', strokeWidth: 1.8 },
    }));

    const mappingEdges: Edge[] = (activeVersion?.automationTasks || []).flatMap((task: AutomationTask) =>
      task.originalTaskIds.map((originalTaskId: string) => ({
        id: `mapping-edge-${originalTaskId}-${task.id}`,
        source: `baseline-${originalTaskId}`,
        target: `mapping-${task.id}`,
        animated: true,
        style: { stroke: 'rgba(56,189,248,0.65)', strokeDasharray: '4 4' },
      }))
    );

    const mappingToProposalEdges: Edge[] = (activeVersion?.automationTasks || []).map((task: AutomationTask) => ({
      id: `mapping-to-proposal-${task.id}`,
      source: `mapping-${task.id}`,
      target: task.id,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' },
      style: { stroke: '#38bdf8', strokeWidth: 1.8 },
    }));

    return [...baselineEdges, ...mappingEdges, ...mappingToProposalEdges, ...proposalEdges];
  }, [baselineTaskRows, activeVersion]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[0.76fr_1.58fr_0.86fr]">
      <aside className="rounded-[1.35rem] border border-white/10 bg-[#0a1120]/90 p-3 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Automation Board</p>
            <h2 className="mt-2 text-[18px] font-black uppercase tracking-tight text-white">Proposal Branches</h2>
            <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/55">Immutable approved workflow on the left, automation proposal versions on the right.</p>
          </div>
          <button onClick={onBack} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/55 hover:text-white">
            <ArrowLeft size={14} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Approved Workflow</label>
          <select
            value={activeWorkflow?.id || ''}
            onChange={(event) => {
              const nextId = Number(event.target.value);
              setActiveWorkflowId(nextId);
              setSelectedVersionId('');
              setCompareVersionId('');
              setSelectedTaskId(null);
              onOpenWorkflow?.(nextId);
            }}
            className="h-11 w-full rounded-[1rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none"
          >
            {approvedWorkflows.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Baseline TAT</p>
            <Clock3 size={12} className="text-theme-accent" />
          </div>
          <p className="mt-2 text-[24px] font-black text-white">{baselineTotal.toFixed(0)}m</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{workflowTasks.length} tasks</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">{activeWorkflow?.version || 'v1'}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">Versions</h3>
          <button onClick={newVersion} className="inline-flex items-center gap-2 rounded-full border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">
            <Plus size={12} /> New Version
          </button>
        </div>

        <div className="mt-2 space-y-2 max-h-[320px] overflow-auto custom-scrollbar pr-1">
          {currentVersions.map((version) => (
            <button
              key={version.id}
              onClick={() => {
                setSelectedVersionId(version.id);
                setSelectedTaskId(null);
              }}
              className={cn(
                'w-full rounded-[1.15rem] border px-4 py-3 text-left transition-all',
                selectedVersionId === version.id ? 'border-theme-accent/30 bg-theme-accent/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.05]'
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black uppercase tracking-tight">{version.name}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{version.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em]">{version.automationTasks.length}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      cloneVersion(version);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/45 hover:text-white"
                    title="Clone version"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em]">
                <span className="text-emerald-300">{version.automationTasks.reduce((sum, task) => sum + numberOr(task.tatMinutes, 0), 0).toFixed(0)}m automation</span>
                <span className="text-white/35">{version.comments.length} comments</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={cn('rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em]', version.reviewState === 'Approved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/45')}>
                  Review {version.reviewState}
                </span>
                <span className={cn('rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em]', version.approvalState === 'Approved' || version.approvalState === 'Certified' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/45')}>
                  Approval {version.approvalState}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">Savings</h3>
            <Sparkles size={12} className="text-emerald-300" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Net</p>
              <p className="mt-2 text-[20px] font-black text-emerald-300">{activeVersionCoverage.savings.toFixed(0)}m</p>
            </div>
            <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Saved %</p>
              <p className="mt-2 text-[20px] font-black text-theme-accent">{activeVersionCoverage.savingsPercent.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="relative min-h-0 rounded-[1.35rem] border border-white/10 bg-[#0a1120]/90 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">Current Diagram</p>
            <h3 className="truncate text-[14px] font-black uppercase tracking-tight text-white">{activeWorkflow?.name || 'Select an approved workflow'}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fitView({ duration: 350, padding: 0.12 })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 hover:text-white">
              Fit
            </button>
          </div>
        </div>
        <div className="h-[calc(100%-64px)] min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={{ automationTask: TaskNode }}
            fitView
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable
            onNodeClick={(_, node) => {
              if (String(node.id).startsWith('automation-')) {
                setSelectedTaskId(String(node.id));
              }
            }}
            className="bg-transparent"
          >
            <Background gap={18} color="rgba(255,255,255,0.05)" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-3 rounded-[1.35rem] border border-white/10 bg-[#0a1120]/90 p-3 shadow-2xl">
        <div className="border-b border-white/10 pb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-theme-accent">Proposal Editor</p>
          <h3 className="mt-2 text-[18px] font-black uppercase tracking-tight text-white">Version Control</h3>
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/55">Edit the future-state branch without touching the approved workflow.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Compare To</p>
            <select value={compareVersionId} onChange={(e) => setCompareVersionId(e.target.value)} className="mt-2 h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-2 text-[11px] font-bold text-white outline-none">
              {currentVersions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
            </select>
          </div>
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Proposal Status</p>
            <select
              value={activeVersion?.status || 'Draft'}
              onChange={(event) => patchActiveVersion((current) => ({ ...current, status: event.target.value as AutomationVersion['status'], updatedAt: new Date().toISOString() }))}
              className="mt-2 h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-2 text-[11px] font-bold text-white outline-none"
            >
              {['Draft', 'Review', 'Approved'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Assumptions</p>
          <textarea
            value={activeVersion?.assumptions || ''}
            onChange={(event) => patchActiveVersion((current) => ({ ...current, assumptions: event.target.value, updatedAt: new Date().toISOString() }))}
            className="mt-2 min-h-[90px] w-full rounded-[1rem] border border-white/10 bg-black/30 p-3 text-[12px] font-medium text-white outline-none"
            placeholder="State the basis for savings, dependencies, and measurement."
          />
        </div>

        {activeVersion && (
          <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Approval</p>
                <p className="mt-1 text-[11px] font-bold text-white/45">{formatGovernanceActor(activeMember)} controls proposal approval only when permissions allow it.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={cn('rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em]', activeVersion.reviewState === 'Approved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/45')}>
                  Review {activeVersion.reviewState}
                </span>
                <span className={cn('rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em]', activeVersion.approvalState === 'Approved' || activeVersion.approvalState === 'Certified' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-white/45')}>
                  Approval {activeVersion.approvalState}
                </span>
              </div>
            </div>
            {(canReviewBoard || canApproveBoard) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {canReviewBoard && !['Requested', 'Approved'].includes(activeVersion.reviewState) && (
                  <button onClick={() => updateApprovalState({ status: 'Review', reviewState: 'Requested', approvalState: 'Pending Review' }, 'review')} className="rounded-[0.95rem] border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55 hover:text-white">
                    Submit for Review
                  </button>
                )}
                {canApproveBoard && activeVersion.reviewState !== 'Approved' && (
                  <button onClick={() => updateApprovalState({ status: 'Approved', reviewState: 'Approved', approvalState: 'Approved' }, 'approve')} className="rounded-[0.95rem] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white">
                    Approve Version
                  </button>
                )}
                {canApproveBoard && activeVersion.approvalState !== 'Certified' && (
                  <button onClick={() => updateApprovalState({ approvalState: 'Certified', status: 'Approved', reviewState: 'Approved' }, 'approve')} className="rounded-[0.95rem] border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white">
                    Certify Proposal
                  </button>
                )}
                {canReviewBoard && activeVersion.reviewState !== 'Changes Requested' && (
                  <button onClick={() => updateApprovalState({ status: 'Draft', reviewState: 'Changes Requested', approvalState: 'Draft' }, 'review')} className="rounded-[0.95rem] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white">
                    Request Changes
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Add Automation Task</p>
            <Layers3 size={12} className="text-theme-accent" />
          </div>
          <div className="mt-3 space-y-2">
            <input value={taskDraft.name} onChange={(event) => setTaskDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none" placeholder="Task name" />
            <input value={taskDraft.tatMinutes} onChange={(event) => setTaskDraft((current) => ({ ...current, tatMinutes: event.target.value }))} className="h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none" placeholder="Projected TAT (minutes)" />
            <select
              multiple
              value={taskDraft.originalTaskIds}
              onChange={(event) => setTaskDraft((current) => ({ ...current, originalTaskIds: Array.from(event.target.selectedOptions).map((option) => option.value) }))}
              className="h-28 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-bold text-white outline-none"
            >
              {baselineTaskRows.map((task: { id: string; label: string }) => <option key={task.id} value={task.id}>{task.label}</option>)}
            </select>
            <textarea value={taskDraft.notes} onChange={(event) => setTaskDraft((current) => ({ ...current, notes: event.target.value }))} className="min-h-[72px] w-full rounded-[0.95rem] border border-white/10 bg-black/30 p-3 text-[12px] font-medium text-white outline-none" placeholder="Why this task exists" />
            <button onClick={addAutomationTask} className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] bg-theme-accent px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white">
              <Plus size={12} /> Add Task
            </button>
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Comments</p>
            <MessageSquare size={12} className="text-theme-accent" />
          </div>
          <div className="mt-3 flex gap-2">
            <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} className="h-10 flex-1 rounded-[0.95rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none" placeholder="Add a comment" />
            <button onClick={addComment} className="rounded-[0.95rem] border border-theme-accent/20 bg-theme-accent/10 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">
              Add
            </button>
          </div>
          <div className="mt-3 max-h-[220px] space-y-2 overflow-auto custom-scrollbar pr-1">
            {(activeVersion?.comments || []).length === 0 && <p className="text-[11px] font-bold text-white/40">No comments yet.</p>}
            {(activeVersion?.comments || []).map((comment) => (
              <CommentRow key={comment.id} comment={comment} onToggleStatus={toggleCommentStatus} onDelete={deleteComment} />
            ))}
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Task Detail</p>
            <BookOpen size={12} className="text-theme-accent" />
          </div>
          {selectedAutomationTask ? (
            <div className="mt-3 space-y-3">
              <input
                value={selectedAutomationTask.name}
                onChange={(event) => patchActiveVersion((current) => ({
                  ...current,
                  updatedAt: new Date().toISOString(),
                  automationTasks: current.automationTasks.map((task) => task.id === selectedAutomationTask.id ? { ...task, name: event.target.value } : task),
                }))}
                className="h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none"
              />
              <input
                value={selectedAutomationTask.tatMinutes}
                onChange={(event) => patchActiveVersion((current) => ({
                  ...current,
                  updatedAt: new Date().toISOString(),
                  automationTasks: current.automationTasks.map((task) => task.id === selectedAutomationTask.id ? { ...task, tatMinutes: numberOr(event.target.value) } : task),
                }))}
                className="h-10 w-full rounded-[0.95rem] border border-white/10 bg-black/30 px-3 text-[12px] font-bold text-white outline-none"
              />
              <textarea
                value={selectedAutomationTask.notes}
                onChange={(event) => patchActiveVersion((current) => ({
                  ...current,
                  updatedAt: new Date().toISOString(),
                  automationTasks: current.automationTasks.map((task) => task.id === selectedAutomationTask.id ? { ...task, notes: event.target.value } : task),
                }))}
                className="min-h-[90px] w-full rounded-[0.95rem] border border-white/10 bg-black/30 p-3 text-[12px] font-medium text-white outline-none"
              />
              <div className="flex flex-wrap gap-2">
                {selectedAutomationTask.originalTaskIds.map((taskId) => (
                  <span key={taskId} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">
                    {taskId}
                  </span>
                ))}
              </div>
              <button onClick={() => deleteAutomationTask(selectedAutomationTask.id)} className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
                <Trash2 size={12} /> Delete Task
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] font-bold text-white/40">Select an automation task in the proposal lane.</p>
          )}
        </div>

        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Diff Summary</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              <span>New Tasks</span><span className="text-theme-accent">{compareSummary.newTasks.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              <span>Changed Tasks</span><span className="text-amber-300">{compareSummary.changedMappings.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              <span>Removed Tasks</span><span className="text-rose-300">{compareSummary.removedTasks.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              <span>Baseline Coverage Delta</span><span className="text-emerald-300">{compareSummary.baselineDiff}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const AutomationBoard: React.FC<{
  workflow?: any;
  workflows: any[];
  onBack?: () => void;
  onOpenWorkflow?: (workflowId: number) => void;
  currentUser?: any;
  runtimeConfig?: any;
}> = ({ workflow, workflows, onBack, onOpenWorkflow, currentUser, runtimeConfig }) => {
  return (
    <ReactFlowProvider>
      <AutomationBoardInner
        workflow={workflow}
        workflows={workflows}
        onBack={onBack || (() => window.history.back())}
        onOpenWorkflow={onOpenWorkflow}
        currentUser={currentUser}
        runtimeConfig={runtimeConfig}
      />
    </ReactFlowProvider>
  );
};

export default AutomationBoard;
