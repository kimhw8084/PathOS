import React, { useMemo, useState } from 'react';
import { Activity, BriefcaseBusiness, CircleAlert, Clock3, Gauge, Plus, Zap } from 'lucide-react';

interface OperationalBoardProps {
  workflows: any[];
  executions: any[];
  projects: any[];
  onCreateExecution: (payload: any) => void;
  onCreateProject: (payload: any) => void;
  onUpdateProject: (id: number, payload: any) => void;
}

const PROJECT_COLUMNS = ['Scoping', 'Planned', 'In Progress', 'Validation', 'Deployed'];

const emptyExecution = {
  workflow_id: 0,
  execution_started_at: new Date().toISOString(),
  execution_completed_at: new Date().toISOString(),
  executed_by: 'Haewon Kim',
  team: 'Metrology',
  site: 'ATX',
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
  owner: 'Haewon Kim',
  sponsor: 'Metrology Leadership',
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
  onCreateExecution,
  onCreateProject,
  onUpdateProject,
}) => {
  const [executionDraft, setExecutionDraft] = useState<any>({
    ...emptyExecution,
    workflow_id: workflows[0]?.id || 0,
  });
  const [projectDraft, setProjectDraft] = useState<any>(emptyProject);

  const recentExecutions = useMemo(
    () => [...executions].sort((a, b) => new Date(b.execution_started_at).getTime() - new Date(a.execution_started_at).getTime()).slice(0, 8),
    [executions]
  );

  const projectColumns = useMemo(
    () => PROJECT_COLUMNS.map((status) => ({ status, items: projects.filter((project) => project.status === status) })),
    [projects]
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

  const totalSavedYesterday = useMemo(
    () => executions.reduce((sum, execution) => sum + Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0), 0),
    [executions]
  );

  const activeProjects = projects.filter((project) => !['Deployed', 'Done'].includes(project.status));
  const openExceptions = executions.reduce((sum, execution) => sum + (execution.exception_count || 0), 0);

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto animate-apple-in">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard icon={Clock3} label="Manual Yesterday" value={`${totalManualYesterday.toFixed(0)}m`} hint="Baseline effort logged yesterday" accent="text-amber-400" />
        <StatCard icon={Zap} label="Saved Time" value={`${totalSavedYesterday.toFixed(0)}m`} hint="Measured reduction from tracked executions" accent="text-emerald-400" />
        <StatCard icon={BriefcaseBusiness} label="Active Projects" value={activeProjects.length} hint="Automation projects in flight" />
        <StatCard icon={CircleAlert} label="Exceptions" value={openExceptions} hint="Exceptions recorded across execution logs" accent="text-rose-400" />
        <StatCard icon={Gauge} label="Tracked Runs" value={executions.length} hint="Execution records driving analytics" accent="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Execution Intake</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Capture real timing, automation coverage, and exceptions</p>
            </div>
            <Activity size={18} className="text-theme-accent" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Workflow</span>
              <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={executionDraft.workflow_id} onChange={(e) => setExecutionDraft({ ...executionDraft, workflow_id: Number(e.target.value) })}>
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
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Create delivery work directly from workflow burden</p>
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
              <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold outline-none" value={projectDraft.workflow_ids[0] || ''} onChange={(e) => setProjectDraft({ ...projectDraft, workflow_ids: e.target.value ? [Number(e.target.value)] : [] })}>
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

      <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">Operational Board</h3>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Automation delivery pipeline tied to workflow evidence</p>
          </div>
          <BriefcaseBusiness size={18} className="text-theme-accent" />
        </div>
        <div className="grid xl:grid-cols-5 gap-4 overflow-x-auto">
          {projectColumns.map((column) => (
            <div key={column.status} className="min-w-[240px] bg-black/20 border border-white/5 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{column.status}</h4>
                <span className="text-[10px] font-black text-theme-accent">{column.items.length}</span>
              </div>
              <div className="space-y-3">
                {column.items.length === 0 && <div className="text-[10px] font-black uppercase tracking-widest text-white/15 py-10 text-center">No Projects</div>}
                {column.items.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      const nextIndex = PROJECT_COLUMNS.indexOf(project.status);
                      const nextStatus = PROJECT_COLUMNS[Math.min(nextIndex + 1, PROJECT_COLUMNS.length - 1)];
                      if (nextStatus !== project.status) {
                        onUpdateProject(project.id, { ...project, status: nextStatus, progress_percent: Math.min((project.progress_percent || 0) + 20, 100) });
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
            <div key={execution.id} className="grid md:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-3 items-center rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <div className="text-[12px] font-black text-white uppercase tracking-tight">{execution.workflow?.name || workflows.find((workflow) => workflow.id === execution.workflow_id)?.name || `Workflow ${execution.workflow_id}`}</div>
                <div className="text-[9px] text-white/25 font-black uppercase tracking-widest mt-1">{execution.executed_by || 'Unknown'} • {new Date(execution.execution_started_at).toLocaleString()}</div>
              </div>
              <div className="text-[11px] font-black text-amber-400">{(execution.baseline_manual_minutes || 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-cyan-400">{(execution.actual_duration_minutes || 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-emerald-400">{Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0).toFixed(0)}m</div>
              <div className="text-[11px] font-black text-rose-400">{execution.exception_count || 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OperationalBoard;
