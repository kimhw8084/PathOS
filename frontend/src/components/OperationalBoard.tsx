import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BriefcaseBusiness, CircleAlert, Clock3, Gauge, Plus, ShieldCheck, Sparkles, Zap } from 'lucide-react';

interface OperationalBoardProps {
  workflows: any[];
  executions: any[];
  projects: any[];
  insights?: any;
  governance?: any;
  inbox?: any;
  currentUser?: any;
  runtimeConfig?: any;
  onCreateExecution: (payload: any) => void;
  onCreateProject: (payload: any) => void;
  onUpdateProject: (id: number, payload: any) => void;
  onOpenWorkflow?: (workflow: any) => void;
}

const emptyExecution = {
  workflow_id: 0,
  execution_started_at: new Date().toISOString(),
  execution_completed_at: new Date().toISOString(),
  executed_by: '',
  team: '',
  site: '',
  status: 'Completed',
  actual_duration_minutes: 0,
  baseline_manual_minutes: 0,
  automated_duration_minutes: 0,
  wait_duration_minutes: 0,
  recovery_time_minutes: 0,
  exception_count: 0,
  automation_coverage_percent: 0,
  blockers_encountered: [],
  notes: '',
};

const emptyProject = {
  name: '',
  workflow_ids: [],
  summary: '',
  owner: '',
  sponsor: '',
  team: 'Automation',
  priority: 'High',
  status: 'Scoping',
  health: 'On Track',
  progress_percent: 10,
  target_completion_date: '',
  projected_hours_saved_weekly: 0,
  realized_hours_saved_weekly: 0,
  blocker_summary: [],
  milestone_summary: [],
  traceability: {},
  benefits_realization: {},
  exception_governance: {},
  delivery_metrics: {},
  next_action: '',
  last_update: '',
};

const StatCard = ({ icon: Icon, label, value, hint, accent = 'text-theme-accent' }: any) => (
  <div className="apple-card !p-4 flex flex-col gap-3 !bg-[#111827]/40 border-white/10">
    <div className="flex items-center gap-2 text-white/40">
      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10">
        <Icon size={14} className={accent} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
    <div>
      <div className={`text-2xl font-black tracking-tighter ${accent}`}>{value}</div>
      <div className="text-[9px] text-white/25 font-black uppercase tracking-widest mt-1">{hint}</div>
    </div>
  </div>
);

const OperationalBoard: React.FC<OperationalBoardProps> = ({
  workflows,
  executions,
  projects,
  insights = {},
  governance = {},
  inbox = {},
  currentUser,
  runtimeConfig,
  onCreateExecution,
  onCreateProject,
  onUpdateProject,
  onOpenWorkflow,
}) => {
  const projectColumnsList = runtimeConfig?.project_governance?.columns || ['Scoping', 'Planned', 'In Progress', 'Validation', 'Deployed'];
  const priorityOptions = runtimeConfig?.project_governance?.priorities || ['High', 'Medium', 'Low'];
  const defaultMemberName = currentUser?.full_name || runtimeConfig?.current_member?.full_name || runtimeConfig?.workflow_defaults?.ownership?.owner || 'system_user';
  const defaultTeam = currentUser?.team || runtimeConfig?.organization?.team_options?.[0] || 'Operations';
  const defaultSite = currentUser?.site || runtimeConfig?.organization?.site_options?.[0] || 'HQ';
  const defaultSponsor = currentUser?.manager || runtimeConfig?.organization?.name || 'Leadership';
  const [executionDraft, setExecutionDraft] = useState<any>({
    ...emptyExecution,
    workflow_id: workflows[0]?.id || 0,
    executed_by: defaultMemberName,
    team: defaultTeam,
    site: defaultSite,
  });
  const [projectDraft, setProjectDraft] = useState<any>({
    ...emptyProject,
    owner: defaultMemberName,
    sponsor: defaultSponsor,
    team: currentUser?.team || runtimeConfig?.organization?.team_options?.[1] || 'Automation',
    priority: priorityOptions[0] || 'High',
    status: projectColumnsList[0] || 'Scoping',
  });

  useEffect(() => {
    setExecutionDraft((current: any) => current.executed_by ? current : { ...current, executed_by: defaultMemberName, team: defaultTeam, site: defaultSite });
    setProjectDraft((current: any) => current.owner ? current : { ...current, owner: defaultMemberName, sponsor: defaultSponsor, team: currentUser?.team || current.team, priority: current.priority || priorityOptions[0], status: current.status || projectColumnsList[0] });
  }, [currentUser?.team, defaultMemberName, defaultSite, defaultSponsor, defaultTeam, priorityOptions, projectColumnsList]);

  const recentExecutions = useMemo(
    () => [...executions].sort((a, b) => new Date(b.execution_started_at).getTime() - new Date(a.execution_started_at).getTime()).slice(0, 8),
    [executions]
  );

  const projectColumns = useMemo(
    () => projectColumnsList.map((status: string) => ({ status, items: projects.filter((project: any) => project.status === status) })),
    [projects, projectColumnsList]
  );

  const totalManualYesterday = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return executions
      .filter((execution) => {
        const date = new Date(execution.execution_started_at);
        return date.toDateString() === yesterday.toDateString();
      })
      .reduce((sum, execution) => sum + (execution.baseline_manual_minutes || 0), 0);
  }, [executions]);

  const totalSaved = useMemo(
    () => executions.reduce((sum, execution) => sum + Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0), 0),
    [executions]
  );

  const activeProjects = projects.filter((project) => !['Deployed', 'Done'].includes(project.status));
  const openExceptions = executions.reduce((sum, execution) => sum + (execution.exception_count || 0), 0);
  const candidateQueue = insights?.automation_candidate_queue || [];
  const benefits = insights?.benefits_realization || {};
  const operationsCenter = insights?.workflow_operations_center || {};
  const reviewQueue = operationsCenter.review_queue || governance.review_queue || [];
  const staleQueue = operationsCenter.stale_queue || governance.stale_workflows || [];
  const approvalQueue = operationsCenter.approval_queue || governance.approval_queue || [];
  const recertQueue = operationsCenter.recertification_queue || governance.recertification_queue || [];
  const blockedProjects = operationsCenter.blocked_projects || [];
  const deploymentQueue = operationsCenter.deployment_queue || [];
  const exceptionHotspots = operationsCenter.exception_hotspots || [];
  const inboxItems = inbox?.items || [];

  const autofillProjectFromWorkflow = (workflowId: number) => {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return;
    const topRecommendation = workflow.analysis?.recommendations?.[0];
    setProjectDraft((current: any) => ({
      ...current,
      name: `${workflow.name} Automation`,
      workflow_ids: [workflow.id],
      priority: (workflow.analysis?.scores?.readiness || 0) >= 70 ? 'High' : 'Medium',
      projected_hours_saved_weekly: workflow.total_roi_saved_hours || 0,
      summary: workflow.analysis?.storytelling?.summary || workflow.description || '',
      next_action: topRecommendation?.detail || 'Validate the top workflow bottleneck and define the automation scope.',
      last_update: topRecommendation?.title || 'Candidate generated from workflow gap analysis.',
      traceability: {
        source_workflow_id: workflow.id,
        source_workflow_name: workflow.name,
        source_workflow_version: workflow.version,
        validation_plan: 'Confirm current-state timing, exception burden, and acceptance criteria with workflow owner.',
      },
      benefits_realization: {
        projected_hours_weekly: workflow.total_roi_saved_hours || 0,
        realization_note: 'Compare execution logs before and after deployment to confirm realized savings.',
      },
      exception_governance: {
        top_exception_nodes: workflow.analysis?.task_diagnostic_summary?.top_risk_nodes || [],
      },
      delivery_metrics: {
        readiness: workflow.analysis?.scores?.readiness || 0,
        standardization: workflow.analysis?.scores?.standardization || 0,
        complexity_risk: workflow.analysis?.scores?.complexity_risk || 0,
      },
    }));
  };

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto animate-apple-in">
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard icon={Clock3} label="Manual Yesterday" value={`${totalManualYesterday.toFixed(0)}m`} hint="Baseline effort logged yesterday" accent="text-amber-400" />
        <StatCard icon={Zap} label="Saved Time" value={`${totalSaved.toFixed(0)}m`} hint="Measured reduction from tracked executions" accent="text-emerald-400" />
        <StatCard icon={BriefcaseBusiness} label="Active Projects" value={activeProjects.length} hint="Automation projects in flight" />
        <StatCard icon={CircleAlert} label="Exceptions" value={openExceptions} hint="Exceptions recorded across execution logs" accent="text-rose-400" />
        <StatCard icon={Gauge} label="Tracked Runs" value={executions.length} hint="Execution records driving analytics" accent="text-cyan-400" />
        <StatCard icon={ShieldCheck} label="Realization" value={`${Number(benefits.realization_rate_percent || 0).toFixed(0)}%`} hint="Portfolio projected vs realized value" accent="text-violet-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Workflow Operations Center</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Review, stale, approval, and recertification queues that determine rollout readiness</p>
            </div>
            <ShieldCheck size={18} className="text-theme-accent" />
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: 'Review Queue', value: reviewQueue.length, items: reviewQueue, tone: 'text-theme-accent' },
              { label: 'Stale Workflows', value: staleQueue.length, items: staleQueue, tone: 'text-amber-400' },
              { label: 'Approval Queue', value: approvalQueue.length, items: approvalQueue, tone: 'text-violet-300' },
              { label: 'Recertification', value: recertQueue.length, items: recertQueue, tone: 'text-emerald-300' },
            ].map((queue) => (
              <div key={queue.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{queue.label}</p>
                <p className={`mt-3 text-[28px] font-black ${queue.tone}`}>{queue.value}</p>
                <p className="mt-2 text-[11px] font-bold text-white/55">{queue.items[0]?.name || 'No active queue pressure.'}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Needs Review Now</p>
                <span className="text-[10px] font-black text-theme-accent">{reviewQueue.length}</span>
              </div>
              {(reviewQueue.slice(0, 4)).map((item: any) => (
                <button
                  key={`review-${item.workflow_id || item.id}`}
                  onClick={() => {
                    const workflow = workflows.find((candidate) => candidate.id === (item.workflow_id || item.id));
                    if (workflow && onOpenWorkflow) onOpenWorkflow(workflow);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{item.review_state || item.owner || 'Review pending'}</p>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Inbox Pressure</p>
                <span className="text-[10px] font-black text-emerald-300">{inboxItems.length}</span>
              </div>
              {(inboxItems.slice(0, 4)).map((item: any) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.title}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{item.detail || item.status}</p>
                </div>
              ))}
              {inboxItems.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/20">
                  {currentUser?.full_name || 'Current user'} has no active workflow inbox pressure.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Delivery Risk and Hotspots</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Blocked projects, exception hotspots, and deployment readiness in one operating readout</p>
            </div>
            <CircleAlert size={18} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Blocked Projects</p>
              <p className="mt-3 text-[28px] font-black text-rose-300">{blockedProjects.length}</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{blockedProjects[0]?.name || 'No blocked projects detected.'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Deployment Queue</p>
              <p className="mt-3 text-[28px] font-black text-cyan-300">{deploymentQueue.length}</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{deploymentQueue[0]?.name || 'Nothing is queued for deployment yet.'}</p>
            </div>
          </div>
          <div className="space-y-3">
            {exceptionHotspots.slice(0, 4).map((item: any) => (
              <div key={item.workflow_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/55">{item.top_node}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-black text-rose-300">{item.exceptions}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">{Number(item.recovery_minutes || 0).toFixed(0)}m recovery</p>
                  </div>
                </div>
              </div>
            ))}
            {exceptionHotspots.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/20">
                No exception hotspots are visible yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Execution Intake</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Capture real timing, automation coverage, exceptions, and recovery burden</p>
            </div>
            <Activity size={18} className="text-theme-accent" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Workflow</span>
              <select
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none"
                value={executionDraft.workflow_id}
                onChange={(e) => {
                  const workflowId = Number(e.target.value);
                  const workflow = workflows.find((item) => item.id === workflowId);
                  setExecutionDraft({
                    ...executionDraft,
                    workflow_id: workflowId,
                    baseline_manual_minutes: workflow?.analysis?.projected_manual_minutes_per_run || workflow?.analysis?.simulation?.critical_path_minutes || executionDraft.baseline_manual_minutes,
                  });
                }}
              >
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Operator</span>
              <input className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.executed_by} onChange={(e) => setExecutionDraft({ ...executionDraft, executed_by: e.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Baseline Manual Min</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.baseline_manual_minutes} onChange={(e) => setExecutionDraft({ ...executionDraft, baseline_manual_minutes: Number(e.target.value) })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Actual Run Min</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.actual_duration_minutes} onChange={(e) => setExecutionDraft({ ...executionDraft, actual_duration_minutes: Number(e.target.value) })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Recovery Min</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.recovery_time_minutes} onChange={(e) => setExecutionDraft({ ...executionDraft, recovery_time_minutes: Number(e.target.value) })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Automation Coverage %</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.automation_coverage_percent} onChange={(e) => setExecutionDraft({ ...executionDraft, automation_coverage_percent: Number(e.target.value) })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Exceptions</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.exception_count} onChange={(e) => setExecutionDraft({ ...executionDraft, exception_count: Number(e.target.value) })} />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Notes</span>
            <textarea className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white/80 font-bold h-24 outline-none resize-none" value={executionDraft.notes} onChange={(e) => setExecutionDraft({ ...executionDraft, notes: e.target.value })} />
          </label>

          <button
            onClick={() => {
              onCreateExecution(executionDraft);
              setExecutionDraft({ ...emptyExecution, workflow_id: workflows[0]?.id || 0 });
            }}
            className="px-4 py-3 rounded-2xl bg-theme-accent text-white text-[11px] font-black uppercase tracking-[0.18em] flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Log Execution
          </button>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Automation Project Intake</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Create delivery work directly from workflow burden, bottlenecks, and measured value</p>
            </div>
            <BriefcaseBusiness size={18} className="text-theme-accent" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Project Name</span>
              <input className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={projectDraft.name} onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Owner</span>
              <input className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={projectDraft.owner} onChange={(e) => setProjectDraft({ ...projectDraft, owner: e.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Priority</span>
              <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={projectDraft.priority} onChange={(e) => setProjectDraft({ ...projectDraft, priority: e.target.value })}>
                {['High', 'Medium', 'Low'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Linked Workflow</span>
              <select
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none"
                value={projectDraft.workflow_ids[0] || ''}
                onChange={(e) => {
                  const workflowId = e.target.value ? [Number(e.target.value)] : [];
                  setProjectDraft({ ...projectDraft, workflow_ids: workflowId });
                  if (workflowId[0]) autofillProjectFromWorkflow(workflowId[0]);
                }}
              >
                <option value="">Select workflow</option>
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Projected h/wk</span>
              <input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={projectDraft.projected_hours_saved_weekly} onChange={(e) => setProjectDraft({ ...projectDraft, projected_hours_saved_weekly: Number(e.target.value) })} />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Next Action</span>
            <textarea className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white/80 font-bold h-24 outline-none resize-none" value={projectDraft.next_action} onChange={(e) => setProjectDraft({ ...projectDraft, next_action: e.target.value, last_update: e.target.value })} />
          </label>

          <button
            onClick={() => {
              onCreateProject({
                ...projectDraft,
                target_completion_date: projectDraft.target_completion_date || null,
              });
              setProjectDraft(emptyProject);
            }}
            className="px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white text-[11px] font-black uppercase tracking-[0.18em] flex items-center gap-2 hover:bg-white/15 transition-colors"
          >
            <Plus size={14} />
            Create Automation Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Automation Candidate Queue</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Project creation directly from workflow gaps and opportunity scoring</p>
            </div>
            <Sparkles size={18} className="text-theme-accent" />
          </div>
          <div className="space-y-3">
            {candidateQueue.slice(0, 6).map((item: any) => (
              <div key={item.workflow_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] font-bold text-white/58">{item.top_opportunity}</p>
                  </div>
                  <button
                    onClick={() => autofillProjectFromWorkflow(item.workflow_id)}
                    className="shrink-0 rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent"
                  >
                    Use in Intake
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Score {Number(item.candidate_score || 0).toFixed(1)}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">{Number(item.projected_hours_saved_weekly || 0).toFixed(1)} hrs/wk</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Benefits Realization Loop</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Track whether deployed automation actually pays back the expected value</p>
            </div>
            <ShieldCheck size={18} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Projected</p>
              <p className="mt-3 text-[24px] font-black text-white">{Number(benefits.projected_hours_weekly || 0).toFixed(1)}h</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Realized</p>
              <p className="mt-3 text-[24px] font-black text-emerald-300">{Number(benefits.realized_hours_weekly || 0).toFixed(1)}h</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 col-span-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Program Readout</p>
              <p className="mt-3 text-[28px] font-black text-theme-accent">{Number(benefits.realization_rate_percent || 0).toFixed(1)}%</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{benefits.delivered_project_count || 0} delivered projects are contributing measured benefit back into the portfolio.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Operational Board</h3>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Automation delivery pipeline tied to workflow evidence, traceability, and benefits realization</p>
          </div>
          <BriefcaseBusiness size={18} className="text-theme-accent" />
        </div>
        <div className="grid xl:grid-cols-5 gap-4 overflow-x-auto">
          {projectColumns.map((column: any) => (
            <div key={column.status} className="min-w-[240px] bg-black/20 border border-white/5 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{column.status}</h4>
                <span className="text-[10px] font-black text-theme-accent">{column.items.length}</span>
              </div>
              <div className="space-y-3">
                {column.items.length === 0 && <div className="text-[10px] font-black uppercase tracking-widest text-white/15 py-10 text-center">No Projects</div>}
                {column.items.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      const nextIndex = projectColumnsList.indexOf(project.status);
                      const nextStatus = projectColumnsList[Math.min(nextIndex + 1, projectColumnsList.length - 1)];
                      if (nextStatus !== project.status) {
                        onUpdateProject(project.id, {
                          ...project,
                          status: nextStatus,
                          progress_percent: Math.min((project.progress_percent || 0) + 20, 100),
                          benefits_realization: {
                            ...(project.benefits_realization || {}),
                            realization_note: nextStatus === 'Deployed' || nextStatus === projectColumnsList[projectColumnsList.length - 1] ? 'Begin before/after measurement against workflow execution logs.' : (project.benefits_realization?.realization_note || ''),
                          },
                        });
                      }
                    }}
                    className="w-full text-left rounded-2xl bg-white/[0.03] border border-white/10 p-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-black text-white uppercase tracking-tight">{project.name}</div>
                        <div className="text-[9px] text-white/25 font-black uppercase tracking-widest mt-1">{project.owner || 'Unassigned'} • {project.priority}</div>
                      </div>
                      <div className={`text-[10px] font-black uppercase tracking-widest ${project.health === 'At Risk' ? 'text-rose-400' : 'text-emerald-400'}`}>{project.health}</div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/35">
                        <span>Progress</span>
                        <span>{project.progress_percent || 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                        <div className="h-full bg-theme-accent rounded-full transition-all" style={{ width: `${project.progress_percent || 0}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 text-[10px] text-white/55 font-bold leading-relaxed line-clamp-3">{project.next_action || project.summary || 'No next action defined.'}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Recent Execution Ledger</h3>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">What happened in operations, not just what is designed</p>
          </div>
          <Clock3 size={18} className="text-theme-accent" />
        </div>
        <div className="space-y-3">
          {recentExecutions.length === 0 && <div className="text-center py-16 text-[10px] font-black uppercase tracking-widest text-white/15">No execution data logged yet</div>}
          {recentExecutions.map((execution) => (
            <div key={execution.id} className="grid md:grid-cols-[1.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-3 items-center rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <div className="text-[12px] font-black text-white uppercase tracking-tight">{execution.workflow_name_snapshot || execution.workflow?.name || workflows.find((workflow) => workflow.id === execution.workflow_id)?.name || `Workflow ${execution.workflow_id}`}</div>
                <div className="text-[9px] text-white/25 font-black uppercase tracking-widest mt-1">{execution.executed_by || 'Unknown'} • v{execution.workflow_version || '?'} • {new Date(execution.execution_started_at).toLocaleString()}</div>
              </div>
              <div className="text-[11px] font-black text-amber-400">{(execution.baseline_manual_minutes || 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-cyan-400">{(execution.actual_duration_minutes || 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-emerald-400">{Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-rose-400">{(execution.recovery_time_minutes || 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-violet-400">{execution.exception_count || 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OperationalBoard;
