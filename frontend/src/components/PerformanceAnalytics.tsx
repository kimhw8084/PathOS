import React, { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, Clock3, TrendingUp } from 'lucide-react';

interface PerformanceAnalyticsProps {
  workflows: any[];
  executions: any[];
  projects: any[];
}

const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa'];

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

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ workflows, executions, projects }) => {
  const trendData = useMemo(() => {
    const grouped = new Map<string, { week: string; baseline: number; actual: number; saved: number; exceptions: number }>();
    executions.forEach((execution) => {
      const week = toWeekLabel(execution.execution_started_at || execution.created_at || new Date().toISOString());
      const entry = grouped.get(week) || { week, baseline: 0, actual: 0, saved: 0, exceptions: 0 };
      const baseline = execution.baseline_manual_minutes || 0;
      const actual = execution.actual_duration_minutes || 0;
      entry.baseline += baseline;
      entry.actual += actual;
      entry.saved += Math.max(baseline - actual, 0);
      entry.exceptions += execution.exception_count || 0;
      grouped.set(week, entry);
    });
    return [...grouped.values()].slice(-8);
  }, [executions]);

  const workflowImpact = useMemo(() => {
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
  }, [executions, workflows]);

  const projectMix = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((project) => counts.set(project.status, (counts.get(project.status) || 0) + 1));
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [projects]);

  const totalBaseline = executions.reduce((sum, execution) => sum + (execution.baseline_manual_minutes || 0), 0);
  const totalActual = executions.reduce((sum, execution) => sum + (execution.actual_duration_minutes || 0), 0);
  const totalSaved = Math.max(totalBaseline - totalActual, 0);
  const avgAutomationCoverage = executions.length > 0
    ? executions.reduce((sum, execution) => sum + (execution.automation_coverage_percent || 0), 0) / executions.length
    : 0;
  const deliveredProjects = projects.filter((project) => ['Deployed', 'Done'].includes(project.status)).length;

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto animate-apple-in">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard icon={Clock3} label="Baseline Manual" value={`${totalBaseline.toFixed(0)}m`} hint="Tracked historical manual time" accent="text-amber-400" />
        <StatCard icon={TrendingUp} label="Actual Runtime" value={`${totalActual.toFixed(0)}m`} hint="Observed runtime across executions" accent="text-cyan-400" />
        <StatCard icon={ArrowUpRight} label="Realized Savings" value={`${totalSaved.toFixed(0)}m`} hint="Measured reduction after execution" accent="text-emerald-400" />
        <StatCard icon={Activity} label="Auto Coverage" value={`${avgAutomationCoverage.toFixed(0)}%`} hint="Average automation share per run" />
        <StatCard icon={BriefcaseBusiness} label="Delivered Projects" value={deliveredProjects} hint="Projects moved to deployed state" accent="text-violet-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Manual vs Current Time Trend</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Shows whether department execution is actually improving over time</p>
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Project Distribution</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">How the automation program is moving</p>
            </div>
            <BriefcaseBusiness size={18} className="text-theme-accent" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectMix} dataKey="value" nameKey="name" outerRadius={110} innerRadius={60}>
                  {projectMix.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
                <YAxis type="category" dataKey="name" width={110} stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <Tooltip />
                <Bar dataKey="saved" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Exception Load</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Execution friction that still blocks automation scale</p>
            </div>
            <Activity size={18} className="text-theme-accent" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fontWeight: 900 }} />
                <Tooltip />
                <Line type="monotone" dataKey="exceptions" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
