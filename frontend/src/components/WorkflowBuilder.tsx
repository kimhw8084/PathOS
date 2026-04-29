import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Layers,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SearchableSelect } from './IntakeGatekeeper';
import { auditWorkflowDraft, hasAuditErrors, summarizeAuditIssues } from '../testing/workflowQuality';

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

  useEffect(() => {
    setDraft(buildDraft(workflow));
    setSelectedTaskId(null);
    setIsEditing(false);
    setShowGuide(true);
    setIsDirty?.(false);
  }, [workflow, setIsDirty]);

  const draftIssues = useMemo(
    () => auditWorkflowDraft({ metadata: draft, tasks: draft.tasks || [], edges: draft.edges || [] }),
    [draft]
  );
  const insightSummary = useMemo(() => ({
    candidates: Array.isArray(insights?.automation_candidate_queue) ? insights.automation_candidate_queue.length : 0,
    narratives: Array.isArray(insights?.executive_narratives) ? insights.executive_narratives.length : 0,
    approvals: Array.isArray(insights?.workflow_operations_center?.approval_queue) ? insights.workflow_operations_center.approval_queue.length : 0,
  }), [insights]);
  const blockingIssues = draftIssues.filter((issue) => issue.severity === 'error');
  const warningIssues = draftIssues.filter((issue) => issue.severity === 'warning');
  const graphBroken = hasAuditErrors(draftIssues);

  useEffect(() => {
    if (graphBroken) {
      setIsDirty?.(true);
    }
  }, [graphBroken, setIsDirty]);

  const updateDraft = (updater: (current: AnyRecord) => AnyRecord) => {
    setDraft((current) => updater(current));
    setIsDirty?.(true);
  };

  const updateField = (field: string, value: any) => {
    updateDraft((current) => ({ ...current, [field]: value }));
  };

  const updateNested = (field: 'access_control' | 'ownership' | 'governance', value: AnyRecord) => {
    updateDraft((current) => ({ ...current, [field]: { ...(current[field] || {}), ...value } }));
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
    setIsEditing(true);
  };

  const handleSave = async () => {
    const issues = auditWorkflowDraft({ metadata: draft, tasks: draft.tasks || [], edges: draft.edges || [] });
    if (issues.length > 0) {
      const blocking = issues.filter((issue) => issue.severity === 'error');
      if (blocking.length > 0) {
        const graphIssue = blocking.find((issue) => issue.code === 'graph.unreachable' || issue.code === 'graph.disconnected' || issue.code === 'graph.cycle');
        toast.error(graphIssue?.message || 'All nodes must remain connected before saving.');
        return;
      }
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
    } catch (error) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const statusTone = blockingIssues.length > 0 ? 'danger' : warningIssues.length > 0 ? 'warning' : 'success';
  const statusLabel = blockingIssues.length > 0
    ? 'Blocking validation issues'
    : warningIssues.length > 0
      ? 'Review recommended'
      : 'Ready to save';

  return (
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
              <div>
                <h1 className="text-[28px] font-black uppercase tracking-tight text-white">Workflow Definition</h1>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.24em] text-theme-accent">Repository Definition Surface</p>
                <p className="mt-3 max-w-[70rem] text-[13px] font-bold leading-relaxed text-white/65">
                  {workflow?.description || 'Edit the workflow metadata, connected graph, governance rules, and rollback context from one surface.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent">{workflow?.workflow_type || 'Unclassified'}</Pill>
                <Pill>{workflow?.prc || 'No PRC'}</Pill>
                {workflow?.org && <Pill>{workflow.org}</Pill>}
                {workflow?.team && <Pill>{workflow.team}</Pill>}
                <Pill tone={statusTone}>{statusLabel}</Pill>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:min-w-[380px]">
              <BuilderStat label="Tasks" value={draft.tasks?.length || 0} tone="accent" />
              <BuilderStat label="Edges" value={draft.edges?.length || 0} tone="neutral" />
              <BuilderStat label="Warnings" value={warningIssues.length} tone="warning" />
              <BuilderStat label="Errors" value={blockingIssues.length} tone={blockingIssues.length > 0 ? 'danger' : 'success'} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
          {showGuide && (
            <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Builder Guide</p>
                  <p className="mt-2 text-[12px] font-bold text-white/60 max-w-[60rem]">
                    This surface keeps the workflow summary, graph validation, and governance controls in one place. Use Edit Definition to change metadata, then save after the graph passes validation.
                  </p>
                </div>
                <button data-testid="builder-guide-dismiss" onClick={() => setShowGuide(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 transition-all hover:bg-white/10 hover:text-white">
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <Workflow size={16} className="text-theme-accent" />
                  <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Metadata</h2>
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
                    <Layers size={16} className="text-theme-accent" />
                    <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Connected Graph</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={graphBroken ? 'danger' : 'success'}>{graphBroken ? 'Validation blocked' : 'Graph healthy'}</Pill>
                    <Pill tone="neutral">{(relatedWorkflows || []).length} related</Pill>
                    <Pill tone="neutral">{(templates || []).length} templates</Pill>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(draft.tasks || []).map((task: AnyRecord) => (
                    <button
                      key={task.node_id || task.id}
                      onClick={() => setSelectedTaskId(task.node_id || task.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${selectedTaskId === (task.node_id || task.id) ? 'border-theme-accent bg-theme-accent/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.05]'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{task.name || task.node_id || task.id}</p>
                          <p className="mt-1 text-[11px] font-bold text-white/55">{task.description || task.task_type || 'No description'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Pill tone="neutral">{task.task_type || 'Task'}</Pill>
                          {task.interface && <Pill tone="neutral">{task.interface}</Pill>}
                          {selectedTaskId === (task.node_id || task.id) && <CheckCircle2 size={14} className="text-theme-accent" />}
                        </div>
                      </div>
                    </button>
                  ))}
                  {(draft.tasks || []).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-[11px] font-bold text-white/45">
                      No tasks are defined yet.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
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
                  <Pill tone={hasAuditErrors(draftIssues) ? 'danger' : 'success'}>{draftIssues.length} issues</Pill>
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
            </div>
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
  );
};

export default WorkflowBuilder;
