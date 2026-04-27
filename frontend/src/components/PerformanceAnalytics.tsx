import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, Clock3, Download, Gauge, Medal, ShieldCheck, TrendingUp, Users } from 'lucide-react';

interface PerformanceAnalyticsProps {
  workflows: any[];
  executions: any[];
  projects: any[];
  insights?: any;
  runtimeConfig?: any;
}

const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa', '#14b8a6'];

const StatCard = ({ icon: Icon, label, value, hint, accent = 'text-theme-accent' }: any) => (
  <div className="apple-card !p-4 !bg-[#111827]/40 border-white/10 flex flex-col gap-3">
    <div className="flex items-center gap-2 text-white/35">
      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10">
        <Icon size={14} className={accent} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
    <div className={`text-2xl font-black tracking-tighter ${accent}`}>{value}</div>
    <div className="text-[9px] text-white/25 font-black uppercase tracking-widest">{hint}</div>
  </div>
);

const toWeekLabel = (dateString: string) => {
  const date = new Date(dateString);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return `${start.getMonth() + 1}/${start.getDate()}`;
};

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ workflows, executions, projects, insights = {}, runtimeConfig }) => {
  const appName = runtimeConfig?.app?.name || 'PathOS';
  const shortName = runtimeConfig?.app?.short_name || 'PathOS';
  const trendData = useMemo(() => {
    if (insights?.trend_data?.length) {
      return insights.trend_data.map((item: any) => ({
        week: toWeekLabel(item.week),
        baseline: item.manual || 0,
        actual: item.actual || 0,
        saved: item.saved || 0,
        exceptions: item.exceptions || 0,
        recovery: item.recovery || 0,
      }));
    }
    const grouped = new Map<string, { week: string; baseline: number; actual: number; saved: number; exceptions: number; recovery: number }>();
    executions.forEach((execution) => {
      const week = toWeekLabel(execution.execution_started_at || execution.created_at || new Date().toISOString());
      const entry = grouped.get(week) || { week, baseline: 0, actual: 0, saved: 0, exceptions: 0, recovery: 0 };
      const baseline = execution.baseline_manual_minutes || 0;
      const actual = execution.actual_duration_minutes || 0;
      entry.baseline += baseline;
      entry.actual += actual;
      entry.saved += Math.max(baseline - actual, 0);
      entry.exceptions += execution.exception_count || 0;
      entry.recovery += execution.recovery_time_minutes || 0;
      grouped.set(week, entry);
    });
    return [...grouped.values()].slice(-8);
  }, [executions, insights]);

  const workflowImpact = useMemo(() => {
    const benchmarkViews = insights?.benchmarking_views || [];
    if (benchmarkViews.length) {
      return benchmarkViews
        .slice(0, 6)
        .map((item: any) => ({
          name: item.name,
          saved: item.measured_saved_minutes || item.projected_weekly_hours || 0,
          readiness: item.readiness || 0,
        }));
    }

    const map = new Map<number, { name: string; saved: number; runs: number }>();
    executions.forEach((execution) => {
      const workflow = workflows.find((item) => item.id === execution.workflow_id);
      const entry = map.get(execution.workflow_id) || {
        name: workflow?.name || `Workflow ${execution.workflow_id}`,
        saved: 0,
        runs: 0,
      };
      entry.saved += Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0);
      entry.runs += 1;
      map.set(execution.workflow_id, entry);
    });
    return [...map.values()].sort((a, b) => b.saved - a.saved).slice(0, 6);
  }, [executions, workflows, insights]);

  const projectMix = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((project) => counts.set(project.status, (counts.get(project.status) || 0) + 1));
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [projects]);

  const candidateQueue = insights?.automation_candidate_queue || [];
  const recognition = insights?.recognition || [];
  const contributorScorecards = insights?.contributor_scorecards || [];
  const teamRollups = insights?.team_rollups || [];
  const orgRollups = insights?.org_rollups || [];
  const operationsCenter = insights?.workflow_operations_center || {};
  const reportingPack = insights?.reporting_pack || {};
  const shareableReport = insights?.shareable_report || {};
  const benefits = insights?.benefits_realization || {};
  const totalBaseline = executions.reduce((sum, execution) => sum + (execution.baseline_manual_minutes || 0), 0);
  const totalActual = executions.reduce((sum, execution) => sum + (execution.actual_duration_minutes || 0), 0);
  const totalSaved = Math.max(totalBaseline - totalActual, 0);
  const totalRecovery = executions.reduce((sum, execution) => sum + (execution.recovery_time_minutes || 0), 0);
  const avgAutomationCoverage = executions.length > 0
    ? executions.reduce((sum, execution) => sum + (execution.automation_coverage_percent || 0), 0) / executions.length
    : 0;
  const deliveredProjects = projects.filter((project) => ['Deployed', 'Done', 'Fully Automated', ...(runtimeConfig?.project_governance?.columns?.slice(-1) || [])].includes(project.status)).length;
  const exportExecutiveBrief = () => {
    const lines = [
      shareableReport.title || `${appName} Executive Rollout Brief`,
      `Generated: ${shareableReport.generated_at || new Date().toISOString()}`,
      '',
      'Highlights',
      ...((shareableReport.highlights || []).map((item: string) => `- ${item}`)),
      '',
      'Queue Snapshot',
      `- Review Queue: ${shareableReport.queues?.review || 0}`,
      `- Stale Workflows: ${shareableReport.queues?.stale || 0}`,
      `- Approval Queue: ${shareableReport.queues?.approval || 0}`,
      `- Recertification Queue: ${shareableReport.queues?.recertification || 0}`,
      '',
      'Narratives',
      ...((reportingPack.narratives || []).map((item: string) => `- ${item}`)),
    ].join('\n');
    if (typeof window === 'undefined') return;
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${shortName.toLowerCase()}-executive-brief.txt`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto animate-apple-in">
      <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">Executive Reporting Pack</p>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{shareableReport.title || `${appName} Executive Rollout Brief`}</h3>
            <p className="text-[12px] font-bold text-white/60 max-w-[60rem]">{(reportingPack.narratives || [])[0] || 'Export a leadership-ready brief with queue status, portfolio value, and rollout pressure in one artifact.'}</p>
          </div>
          <button
            onClick={exportExecutiveBrief}
            className="self-start xl:self-center rounded-2xl border border-theme-accent/30 bg-theme-accent/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all flex items-center gap-2"
          >
            <Download size={14} />
            Export Executive Brief
          </button>
        </div>
        <div className="grid md:grid-cols-4 gap-4 mt-6">
          {(reportingPack.summary_cards || []).map((item: any) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{item.label}</p>
              <p className="mt-3 text-[28px] font-black text-white">
                {item.value}
                <span className="text-[12px] text-white/30 ml-1">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard icon={Clock3} label="Baseline Manual" value={`${totalBaseline.toFixed(0)}m`} hint="Tracked historical manual time" accent="text-amber-400" />
        <StatCard icon={TrendingUp} label="Actual Runtime" value={`${totalActual.toFixed(0)}m`} hint="Observed runtime across executions" accent="text-cyan-400" />
        <StatCard icon={ArrowUpRight} label="Realized Savings" value={`${totalSaved.toFixed(0)}m`} hint="Measured reduction after execution" accent="text-emerald-400" />
        <StatCard icon={Activity} label="Recovery Burden" value={`${totalRecovery.toFixed(0)}m`} hint="Minutes lost to exception recovery" accent="text-rose-400" />
        <StatCard icon={Gauge} label="Auto Coverage" value={`${avgAutomationCoverage.toFixed(0)}%`} hint="Average automation share per run" />
        <StatCard icon={BriefcaseBusiness} label="Delivered Projects" value={deliveredProjects} hint="Projects moved to deployed state" accent="text-violet-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Contributor Scorecards</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Recognition tied to measurable workflow value and participation</p>
            </div>
            <Users size={18} className="text-theme-accent" />
          </div>
          <div className="space-y-3">
            {contributorScorecards.slice(0, 5).map((item: any) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.label}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{item.workflow_count} workflows contributing to the portfolio</p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-black text-violet-300">{Number(item.impact_score || 0).toFixed(1)}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">{Number(item.saved_minutes || 0).toFixed(0)}m saved</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Operations Pressure</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Queues and blockers that can slow a company-wide rollout</p>
            </div>
            <ShieldCheck size={18} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Review', value: operationsCenter.review_queue?.length || 0, tone: 'text-theme-accent' },
              { label: 'Stale', value: operationsCenter.stale_queue?.length || 0, tone: 'text-amber-400' },
              { label: 'Blocked Projects', value: operationsCenter.blocked_projects?.length || 0, tone: 'text-rose-400' },
              { label: 'Deployment', value: operationsCenter.deployment_queue?.length || 0, tone: 'text-cyan-400' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{item.label}</p>
                <p className={`mt-3 text-[28px] font-black ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Portfolio Health</p>
            <p className="mt-3 text-[24px] font-black text-white">{reportingPack.portfolio_health || 'Developing'}</p>
            <p className="mt-2 text-[11px] font-bold text-white/55">{(reportingPack.narratives || [])[1] || 'Queue pressure and project delivery health will be surfaced here.'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Manual vs Current Time Trend</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Before / after automation movement plus recovery burden over time</p>
            </div>
            <BarChart3 size={18} className="text-theme-accent" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="baselineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <Tooltip />
                <Area type="monotone" dataKey="baseline" stroke="#f59e0b" fill="url(#baselineFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="actual" stroke="#38bdf8" fill="url(#actualFill)" strokeWidth={2} />
                <Line type="monotone" dataKey="saved" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="recovery" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Benefits Realization</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Projected versus realized portfolio impact</p>
            </div>
            <ShieldCheck size={18} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Projected h/wk</p>
              <p className="mt-3 text-[26px] font-black text-white">{Number(benefits.projected_hours_weekly || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Realized h/wk</p>
              <p className="mt-3 text-[26px] font-black text-emerald-300">{Number(benefits.realized_hours_weekly || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 col-span-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Realization Rate</p>
              <p className="mt-3 text-[32px] font-black text-theme-accent">{Number(benefits.realization_rate_percent || 0).toFixed(1)}%</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{benefits.delivered_project_count || 0} delivered projects are feeding measured savings into the portfolio.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Top Realized Savings</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Which workflows are actually delivering time back</p>
            </div>
            <Clock3 size={18} className="text-theme-accent" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workflowImpact} layout="vertical" margin={{ left: 16, right: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <YAxis type="category" dataKey="name" width={140} stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <Tooltip />
                <Bar dataKey="saved" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Portfolio Rollups</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Team-level benefit and candidate prioritization</p>
            </div>
            <BriefcaseBusiness size={18} className="text-theme-accent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Top Candidate</p>
              <p className="mt-3 text-[16px] font-black text-white">{candidateQueue[0]?.name || 'No candidate queue yet'}</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{candidateQueue[0]?.top_opportunity || 'No recommendation yet'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Top Team</p>
              <p className="mt-3 text-[16px] font-black text-white">{teamRollups[0]?.label || 'No team rollup yet'}</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{Number(teamRollups[0]?.saved_minutes || 0).toFixed(1)} saved minutes measured</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Top Org</p>
              <p className="mt-3 text-[16px] font-black text-white">{orgRollups[0]?.label || 'No org rollup yet'}</p>
              <p className="mt-2 text-[11px] font-bold text-white/55">{Number(orgRollups[0]?.saved_minutes || 0).toFixed(1)} saved minutes measured</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 col-span-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Project Distribution</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={projectMix} dataKey="value" nameKey="name" outerRadius={75} innerRadius={46}>
                      {projectMix.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Automation Candidate Queue</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Highest-leverage workflows to automate next</p>
            </div>
            <Gauge size={18} className="text-theme-accent" />
          </div>
          <div className="space-y-3">
            {candidateQueue.map((item: any) => (
              <div key={item.workflow_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] font-bold text-white/58">{item.top_opportunity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-theme-accent">{Number(item.candidate_score || 0).toFixed(1)}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">Candidate Score</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Readiness {Number(item.readiness || 0).toFixed(0)}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Standardization {Number(item.standardization || 0).toFixed(0)}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">Complexity {Number(item.complexity_risk || 0).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Recognition and Awards</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Participation and impact signals for award-level storytelling</p>
            </div>
            <Medal size={18} className="text-theme-accent" />
          </div>
          <div className="space-y-3">
            {recognition.map((item: any) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.label}</p>
                    <p className="mt-1 text-[12px] font-bold text-white/58">{item.badge}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-black text-emerald-300">{Number(item.saved_minutes || 0).toFixed(1)}m</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">{item.count} workflows</p>
                  </div>
                </div>
              </div>
            ))}
            {(insights?.executive_narratives || []).map((item: string) => (
              <div key={item} className="rounded-2xl border border-theme-accent/20 bg-theme-accent/10 p-4 text-[12px] font-bold leading-relaxed text-white/75">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
