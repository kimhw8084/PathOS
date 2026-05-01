import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  GitBranch,
  Search,
  Users,
  Gauge,
  Award,
  BriefcaseBusiness,
  TriangleAlert,
  Sparkles,
} from 'lucide-react';
import { canApproveWorkflow, canPerformGovernanceAction, canReviewWorkflow } from '../utils/governance';

const Pill = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'success' | 'danger' }) => {
  const tones = {
    neutral: 'border-white/10 bg-white/5 text-white/60',
    accent: 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones[tone]}`}>{children}</span>;
};

const Card = ({ title, icon, hint, children }: { title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-[1.25rem] border border-white/10 bg-[#0a1120]/90 p-4 shadow-2xl">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-3 text-theme-accent">
          {icon}
          <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">{title}</h3>
        </div>
        {hint && <p className="mt-2 text-[12px] font-bold leading-relaxed text-white/55">{hint}</p>}
      </div>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const ScoreCard = ({ label, value, hint, tone = 'accent' }: { label: string; value: number; hint: string; tone?: 'accent' | 'success' | 'warning' | 'danger' }) => {
  const toneClass = {
    accent: 'text-theme-accent border-theme-accent/20 bg-theme-accent/10',
    success: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10',
    warning: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
    danger: 'text-rose-300 border-rose-500/20 bg-rose-500/10',
  };
  return (
    <div className={`rounded-2xl border p-4 ${toneClass[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-75">{label}</p>
      <p className="mt-3 text-[30px] font-black tracking-tight">{value.toFixed(0)}</p>
      <p className="mt-2 text-[11px] font-bold leading-relaxed opacity-80">{hint}</p>
    </div>
  );
};

const WorkflowSummaryView = ({
  workflow,
  related,
  discovery,
  insights,
  presidentInsights,
  standardsLibrary,
  policyOverlay,
  rollbackPreview,
  onCreateRollbackDraft,
  onBack,
  onOpenWorkflow,
  currentUser,
  activeSessions,
  onGovernanceAction,
  onMarkNotificationRead,
}: {
  workflow: any;
  related: any[];
  discovery?: any;
  insights?: any;
  presidentInsights?: any;
  standardsLibrary?: any[];
  policyOverlay?: any;
  rollbackPreview?: any;
  runtimeConfig?: any;
  onCreateRollbackDraft?: () => void;
  onBack: () => void;
  onOpenWorkflow: (workflow: any) => void;
  currentUser?: any;
  activeSessions?: any[];
  onGovernanceAction?: (action: string, requestId?: string) => void;
  onMarkNotificationRead?: (notificationId: string) => void;
}) => {
  const [presentationMode, setPresentationMode] = useState(false);
  const ownership = workflow?.ownership || {};
  const governance = workflow?.governance || {};
  const reviewRequests = workflow?.review_requests || [];
  const notifications = workflow?.notification_feed || [];
  const activity = workflow?.activity_timeline || [];
  const analysis = workflow?.analysis || {};
  const scores = analysis?.scores || {};
  const certification = analysis?.certification || {};
  const bottlenecks = analysis?.bottlenecks || [];
  const recommendations = analysis?.recommendations || [];
  const storytelling = analysis?.storytelling || {};
  const changeImpact = analysis?.change_impact || {};
  const diffSummary = analysis?.diff_summary || {};
  const scoreTone = (value: number) => (value >= 80 ? 'success' : value >= 60 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger';
  const canReview = canReviewWorkflow(currentUser, workflow);
  const canApprove = canApproveWorkflow(currentUser, workflow);
  const canCertify = canPerformGovernanceAction(currentUser, workflow, 'certify');
  const canRequestRecertification = canPerformGovernanceAction(currentUser, workflow, 'request_recertification');

  const benchmarkEntry = useMemo(
    () => (presidentInsights?.benchmarking_views || []).find((item: any) => item.workflow_id === workflow?.id),
    [presidentInsights, workflow?.id]
  );
  const candidateEntry = useMemo(
    () => (presidentInsights?.automation_candidate_queue || []).find((item: any) => item.workflow_id === workflow?.id),
    [presidentInsights, workflow?.id]
  );
  const traceabilityEntry = useMemo(
    () => (presidentInsights?.traceability_rows || []).find((item: any) => item.workflow_id === workflow?.id),
    [presidentInsights, workflow?.id]
  );
  const linkedProjects = useMemo(
    () => (presidentInsights?.projects || []).filter((project: any) => (project.workflow_ids || []).includes(workflow?.id)),
    [presidentInsights, workflow?.id]
  );

  return (
    <div className={`mx-auto space-y-4 ${presentationMode ? 'max-w-[1320px]' : 'max-w-[1480px]'}`}>
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(10,17,32,0.95))] p-4 shadow-2xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                <ArrowLeft size={14} /> Back to Repository
              </button>
              <button onClick={() => setPresentationMode(!presentationMode)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65 transition-all hover:bg-white/10 hover:text-white">
                {presentationMode ? 'Exit Presentation' : 'Presentation Mode'}
              </button>
              {rollbackPreview?.available && onCreateRollbackDraft && (
                <button onClick={onCreateRollbackDraft} className="inline-flex items-center gap-2 rounded-xl border border-theme-accent/20 bg-theme-accent/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent transition-all hover:bg-theme-accent hover:text-white">
                  Create Rollback Draft
                </button>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-theme-accent">Workflow Summary</p>
              <h1 className="mt-2 text-[26px] font-black uppercase tracking-tight text-white">{workflow?.name}</h1>
              <p className="mt-2 max-w-[60rem] text-[13px] font-bold leading-relaxed text-white/65">{storytelling?.headline || workflow?.description || 'No workflow summary available.'}</p>
              {storytelling?.executive_narrative && <p className="mt-2 max-w-[60rem] text-[12px] font-bold leading-relaxed text-emerald-200/80">{storytelling.executive_narrative}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="accent">{workflow?.workflow_type || 'Unclassified'}</Pill>
              <Pill>{workflow?.prc || 'No PRC'}</Pill>
              {workflow?.org && <Pill>{workflow.org}</Pill>}
              {workflow?.team && <Pill>{workflow.team}</Pill>}
              <Pill tone={certification?.state === 'Certified' ? 'success' : certification?.needs_recertification ? 'warning' : 'accent'}>{certification?.state || 'Draft'}</Pill>
              <Pill tone={workflow?.review_state === 'Approved' ? 'success' : 'warning'}>{workflow?.review_state || 'Draft Review'}</Pill>
              <Pill tone={workflow?.approval_state === 'Approved' ? 'success' : 'warning'}>{workflow?.approval_state || 'Draft Approval'}</Pill>
              {governance?.lifecycle_stage && <Pill>{governance.lifecycle_stage}</Pill>}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 xl:w-[21rem]">
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Open Review Requests</p>
              <p className="mt-2 text-[26px] font-black text-white">{reviewRequests.filter((item: any) => item.status === 'open').length}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Notifications</p>
              <p className="mt-2 text-[26px] font-black text-white">{notifications.filter((item: any) => !item.read).length}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Projected ROI (hrs/wk)</p>
              <p className="mt-2 text-[26px] font-black text-emerald-300">{Number(workflow?.total_roi_saved_hours || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Candidate Score</p>
              <p className="mt-2 text-[26px] font-black text-theme-accent">{Number(candidateEntry?.candidate_score || 0).toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ScoreCard label="Readiness" value={scores?.readiness || 0} hint="Automation readiness of authored systems, I/O, and routing." tone={scoreTone(scores?.readiness || 0)} />
        <ScoreCard label="Standardization" value={scores?.standardization || 0} hint="How consistent, governed, and reusable this workflow is." tone={scoreTone(scores?.standardization || 0)} />
        <ScoreCard label="Documentation" value={scores?.documentation_completeness || 0} hint="Completeness of context, validation, references, and task detail." tone={scoreTone(scores?.documentation_completeness || 0)} />
        <ScoreCard label="Risk" value={scores?.complexity_risk || 0} hint="Complexity and exception burden that will slow reliable automation." tone={scoreTone(100 - (scores?.complexity_risk || 0))} />
      </div>

      <div className={`grid gap-4 ${presentationMode ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.25fr_0.9fr]'}`}>
        <div className="space-y-4">
          <Card title="Operational Storytelling" icon={<Sparkles size={16} />} hint="Make the workflow legible to operators, reviewers, and executives in one reading.">
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-3">
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Narrative</p>
                <p className="mt-2 text-[13px] font-bold leading-relaxed text-white/72">{storytelling?.summary || 'No narrative has been generated yet.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="accent">{(analysis?.simulation?.critical_path_minutes || 0).toFixed(1)} critical-path min</Pill>
                  <Pill tone="warning">{(analysis?.simulation?.worst_case_minutes || 0).toFixed(1)} worst-case min</Pill>
                  <Pill tone="success">{(analysis?.portfolio_rollup?.projected_weekly_hours_saved || 0).toFixed(1)} projected hrs/wk</Pill>
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Certification</p>
                <p className="mt-2 text-[20px] font-black text-white">{certification?.state || 'Draft'}</p>
                <p className="mt-2 text-[11px] font-bold text-white/58">Recertify by {certification?.recertification_due_at ? new Date(certification.recertification_due_at).toLocaleDateString() : 'not scheduled'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {certification?.needs_recertification && <Pill tone="warning">Recertification Needed</Pill>}
                  {workflow?.analysis?.shift_handoff_risk && <Pill tone="warning">Shift Handoff Risk</Pill>}
                  {workflow?.analysis?.has_cycle && <Pill tone="danger">Cycle Detected</Pill>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Bottlenecks and Diagnostics" icon={<TriangleAlert size={16} />} hint="Show where time, recovery, and automation friction are concentrated.">
            <div className="space-y-3">
              {bottlenecks.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No bottleneck profile available yet.</div>}
              {bottlenecks.map((item: any) => (
                <div key={item.node_id} className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.task_name}</p>
                      <p className="mt-1 text-[12px] font-bold text-white/60">
                        {item.total_burden_minutes.toFixed(1)} weighted min/run with {item.blocker_count} blockers and {item.error_count} errors.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {item.is_critical_path && <Pill tone="warning">Critical Path</Pill>}
                      {item.owner_team && <Pill>{item.owner_team}</Pill>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <div className="rounded-[1rem] border border-white/5 bg-black/20 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Manual</p>
                      <p className="mt-2 text-[14px] font-black text-amber-300">{item.manual_minutes.toFixed(1)}m</p>
                    </div>
                    <div className="rounded-[1rem] border border-white/5 bg-black/20 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Wait</p>
                      <p className="mt-2 text-[14px] font-black text-cyan-300">{item.wait_minutes.toFixed(1)}m</p>
                    </div>
                    <div className="rounded-[1rem] border border-white/5 bg-black/20 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Automation</p>
                      <p className="mt-2 text-[14px] font-black text-emerald-300">{item.automation_minutes.toFixed(1)}m</p>
                    </div>
                    <div className="rounded-[1rem] border border-white/5 bg-black/20 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Recovery Risk</p>
                      <p className="mt-2 text-[14px] font-black text-rose-300">{item.risk_penalty_minutes.toFixed(1)}m</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recommendations and Opportunities" icon={<Gauge size={16} />} hint="Translate workflow insight directly into action that benefits the department.">
            <div className="space-y-3">
              {recommendations.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No recommendation queue has been generated yet.</div>}
              {recommendations.map((item: any, index: number) => (
                <div key={`${item.kind}-${index}`} className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.title}</p>
                    <p className="mt-1 text-[12px] font-bold text-white/58">{item.detail}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Pill tone={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'accent'}>{item.priority}</Pill>
                    <Pill>{item.kind}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ownership and Review" icon={<Users size={16} />} hint="Clarify who owns, reviews, and carries the workflow forward.">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Primary Owner</p>
                <p className="mt-2 text-[15px] font-black text-white">{ownership.owner || workflow?.access_control?.owner || 'Unassigned'}</p>
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Automation Owner</p>
                <p className="mt-2 text-[12px] font-bold text-white/65">{ownership.automation_owner || 'Not assigned'}</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Reviewers</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...(ownership.reviewers || []), ...(ownership.smes || [])].slice(0, 8).map((item: string) => <Pill key={item}>{item}</Pill>)}
                  {!((ownership.reviewers || []).length || (ownership.smes || []).length) && <span className="text-[12px] font-bold text-white/45">No reviewers configured.</span>}
                </div>
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Required Roles</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(governance.required_reviewer_roles || workflow?.required_reviewer_roles || []).map((item: string) => <Pill key={item} tone="warning">{item}</Pill>)}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {reviewRequests.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No active review requests. Use the builder governance panel to request review and assign due dates.</div>}
              {reviewRequests.map((request: any) => (
                <div key={request.id || `${request.role}-${request.due_at || ''}`} className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{request.role}</p>
                    <p className="mt-1 text-[12px] font-bold text-white/55">{request.note || 'No note attached.'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Pill tone={request.status === 'approved' ? 'success' : request.status === 'open' ? 'warning' : 'neutral'}>{request.status || 'open'}</Pill>
                    {request.due_at && <Pill>{new Date(request.due_at).toLocaleDateString()}</Pill>}
                    {request.status === 'open' && onGovernanceAction && canReview && (
                      <>
                        <button onClick={() => onGovernanceAction('approve_review', request.id)} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">
                          Approve
                        </button>
                        <button onClick={() => onGovernanceAction('request_changes', request.id)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white transition-all">
                          Request Changes
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Workflow Activity and Audit" icon={<Clock3 size={16} />} hint="Keep the operational narrative visible so contributors see momentum, review state, and version change history.">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3">
                {activity.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No activity has been recorded yet.</div>}
                {activity.map((entry: any) => (
                  <div key={entry.id || `${entry.type}-${entry.created_at || ''}`} className="flex gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                    <div className="mt-1"><CheckCircle2 size={16} className="text-theme-accent" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{entry.type}</p>
                      <p className="mt-1 text-[12px] font-bold text-white/68">{entry.message}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/30">{entry.actor || 'system_user'} • {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'No timestamp'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Version Diff</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="success">+{diffSummary?.added_nodes?.length || 0} Added</Pill>
                    <Pill tone="warning">~{diffSummary?.modified_nodes?.length || 0} Modified</Pill>
                    <Pill tone="danger">-{diffSummary?.removed_nodes?.length || 0} Removed</Pill>
                  </div>
                </div>
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Change Impact</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(changeImpact?.impacted_systems || []).slice(0, 5).map((item: string) => <Pill key={item}>{item}</Pill>)}
                    {(changeImpact?.impacted_outputs || []).slice(0, 3).map((item: string) => <Pill key={item} tone="accent">{item}</Pill>)}
                    {(changeImpact?.impacted_teams || []).slice(0, 3).map((item: string) => <Pill key={item} tone="warning">{item}</Pill>)}
                  </div>
                </div>
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Benchmark</p>
                  <p className="mt-2 text-[18px] font-black text-white">{benchmarkEntry?.measured_saved_minutes?.toFixed?.(1) || '0.0'} measured min saved</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{benchmarkEntry?.measured_exception_count || 0} measured exceptions, {benchmarkEntry?.measured_recovery_minutes?.toFixed?.(1) || '0.0'} recovery min</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Workflow Inbox" icon={<Bell size={16} />} hint="Notifications stay developer-quiet unless a user actually needs to take action.">
            <div className="space-y-3">
              {notifications.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No notifications yet.</div>}
              {notifications.map((entry: any) => (
                <div key={entry.id || `${entry.kind}-${entry.created_at || ''}`} className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{entry.title}</p>
                    <Pill tone={entry.read ? 'neutral' : 'warning'}>{entry.read ? 'Read' : 'Unread'}</Pill>
                  </div>
                  {entry.detail && <p className="mt-2 text-[12px] font-bold text-white/58">{entry.detail}</p>}
                  {!entry.read && onMarkNotificationRead && (
                    <button onClick={() => onMarkNotificationRead(entry.id)} className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/65 hover:bg-white/10 hover:text-white transition-all">
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Collaboration Snapshot" icon={<Users size={16} />} hint="Make active review and live participation visible so the workflow does not feel like a single-user artifact.">
            <div className="space-y-3">
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Current Reader / Actor</p>
                <p className="mt-2 text-[16px] font-black text-white">{currentUser?.full_name || 'Company User'}</p>
                <p className="mt-1 text-[11px] font-bold text-white/55">{currentUser?.team || 'No team'} • {currentUser?.title || 'No title'}</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Active Collaboration Sessions</p>
                <div className="mt-3 space-y-2">
                  {(activeSessions || []).slice(0, 6).map((session: any) => (
                    <div key={session.id} className="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{session.name || 'Company User'}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/55">{session.viewLabel || session.route}{session.workflowName ? ` • ${session.workflowName}` : ''}</p>
                    </div>
                  ))}
                  {!(activeSessions || []).length && <p className="text-[11px] font-bold text-white/45">No other active sessions are visible right now.</p>}
                </div>
              </div>
              {onGovernanceAction && (canReview || canApprove || canCertify || canRequestRecertification) && (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Governance Shortcuts</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canApprove && !['Approved', 'Certified'].includes(workflow?.approval_state) && <button onClick={() => onGovernanceAction('approve_workflow')} className="rounded-lg border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">Approve Workflow</button>}
                    {canCertify && workflow?.approval_state !== 'Certified' && <button onClick={() => onGovernanceAction('certify')} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">Certify</button>}
                    {canRequestRecertification && <button onClick={() => onGovernanceAction('request_recertification')} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white transition-all">Need Recertification</button>}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Traceability and Benefits" icon={<BriefcaseBusiness size={16} />} hint="Tie the workflow directly to automation projects, benefits realization, and post-deployment learning.">
            <div className="space-y-3">
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Linked Projects</p>
                <div className="mt-3 space-y-3">
                  {linkedProjects.length === 0 && <div className="text-[11px] font-bold text-white/45">No linked automation projects yet.</div>}
                  {linkedProjects.map((project: any) => (
                    <div key={project.id} className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black text-white uppercase tracking-[0.14em]">{project.name}</p>
                        <Pill tone={project.status === 'Deployed' ? 'success' : 'accent'}>{project.status}</Pill>
                      </div>
                      <p className="mt-2 text-[11px] font-bold text-white/58">
                        {project.benefits_realization?.realization_note || project.delivery_metrics?.next_gate || project.traceability?.validation_plan || 'Traceability and benefits context not fully authored yet.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Project Traceability</p>
                  <p className="mt-3 text-[22px] font-black text-white">{traceabilityEntry?.project_ids?.length || 0}</p>
                  <p className="mt-2 text-[11px] font-bold text-white/55">linked projects against workflow version {traceabilityEntry?.workflow_version || workflow?.version || 1}</p>
                </div>
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Benefits Realization</p>
                  <p className="mt-3 text-[22px] font-black text-emerald-300">{presidentInsights?.benefits_realization?.realization_rate_percent || 0}%</p>
                  <p className="mt-2 text-[11px] font-bold text-white/55">portfolio realization against projected weekly savings</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Discovery and Standards" icon={<Search size={16} />} hint="Find similar workflows, standards, and reusable context before re-inventing work.">
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Related Workflows</p>
                <div className="mt-3 space-y-3">
                  {related.length === 0 && <div className="rounded-[1.15rem] border border-dashed border-white/10 p-3 text-[11px] font-bold text-white/45">No related workflows found yet.</div>}
                  {related.map((item: any) => (
                    <button key={item.id} onClick={() => onOpenWorkflow(item)} className="block w-full rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-theme-accent/30 hover:bg-white/[0.05]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                          <p className="mt-1 text-[11px] font-bold text-white/52">{item.workflow_type || 'Unclassified'} • {item.prc || 'No PRC'}</p>
                        </div>
                        <GitBranch size={14} className="text-theme-accent" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Reusable Standards Library</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(analysis?.standards_library_matches || standardsLibrary || []).slice(0, 8).map((item: any) => (
                    <Pill key={item.key || item.flag} tone={item.matched ? 'success' : 'neutral'}>
                      {item.label || item.flag}
                    </Pill>
                  ))}
                </div>
              </div>
              {discovery?.cross_department?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Cross-Org Signals</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {discovery.cross_department.map((item: any) => <Pill key={item.id} tone="accent">{item.team || item.org || item.name}</Pill>)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Policy and Reuse Overlays" icon={<Gauge size={16} />} hint="Org, site, and reuse signals that keep the workflow safe to scale across the company.">
            <div className="space-y-4">
              <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Org / Site Policy</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="accent">{policyOverlay?.org || workflow?.org || 'Org Default'}</Pill>
                  <Pill>{policyOverlay?.team || workflow?.team || 'Unassigned Team'}</Pill>
                  {(policyOverlay?.sites || []).map((site: string) => <Pill key={site} tone="warning">{site}</Pill>)}
                </div>
                <div className="mt-3 space-y-2">
                  {(policyOverlay?.rules || []).map((rule: any) => (
                    <div key={rule.title} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{rule.title}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/55">{rule.detail}</p>
                    </div>
                  ))}
                  {!(policyOverlay?.rules || []).length && <p className="text-[11px] font-bold text-white/45">No extra policy overlays are active for this workflow right now.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Pattern Surfacing</p>
                <div className="mt-3 space-y-2">
                  {(discovery?.reuse_patterns || []).slice(0, 4).map((item: any) => (
                    <div key={`${item.workflow_id}-${item.pattern}`} className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.pattern}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/60">{item.name}</p>
                      <p className="mt-2 text-[11px] font-bold text-white/50">{item.why}</p>
                    </div>
                  ))}
                  {!(discovery?.reuse_patterns || []).length && <p className="text-[11px] font-bold text-white/45">Reuse patterns will appear as similar workflows develop stronger template and standards signals.</p>}
                </div>
              </div>
              {rollbackPreview?.available && (
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Rollback Guardrails</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone="warning">Rollback target v{rollbackPreview.target_version}</Pill>
                    <Pill>{rollbackPreview.task_count || 0} tasks</Pill>
                    <Pill>{rollbackPreview.edge_count || 0} routes</Pill>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(rollbackPreview.guardrails || []).map((item: string) => (
                      <p key={item} className="text-[11px] font-bold text-white/55">{item}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Recognition and Participation" icon={<Award size={16} />} hint="Make contribution, review, and company benefit visible so participation grows.">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Recognition</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(presidentInsights?.recognition || []).slice(0, 6).map((item: any) => <Pill key={item.label} tone="accent">{item.label} • {item.badge}</Pill>)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Contribution Signals</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(insights?.top_contributors || []).map((item: any) => <Pill key={item.label} tone="accent">{item.label} ({item.count})</Pill>)}
                  {(insights?.team_participation || []).map((item: any) => <Pill key={item.label}>{item.label} ({item.count})</Pill>)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Company-Scale Benefit</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="success">{presidentInsights?.benefits_realization?.projected_hours_weekly || 0} projected hrs/wk</Pill>
                  <Pill tone="accent">{presidentInsights?.benefits_realization?.realized_hours_weekly || 0} realized hrs/wk</Pill>
                  <Pill tone="warning">{presidentInsights?.benefits_realization?.delivered_project_count || 0} delivered projects</Pill>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSummaryView;
