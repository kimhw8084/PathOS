import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock, Trophy, Activity, ShieldAlert, Cpu, BarChart3, Layers, ChevronRight, TrendingUp } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
  executions?: any[];
  projects?: any[];
}

const StatBox = ({ icon: Icon, label, value, subValue, colorClass = "text-white" }: any) => (
  <div className="apple-card !p-4 flex flex-col gap-2 group hover:scale-[1.01] transition-all duration-300 !bg-[#111827]/40 border-white/10 hover:border-blue-500/30 shadow-xl shadow-black/20">
    <div className="flex items-center gap-2 text-white/40">
      <div className="p-1.5 bg-white/[0.03] rounded-lg border border-white/10 group-hover:bg-blue-600/10 group-hover:border-blue-500/20 transition-all">
        <Icon size={14} className="group-hover:text-blue-400 transition-colors" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.15em] group-hover:text-white/60 transition-colors">{label}</span>
    </div>
    <div className="flex flex-col">
      <span className={`text-2xl font-black tracking-tighter uppercase ${colorClass} leading-none`}>{value}</span>
      {subValue && <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">{subValue}</span>}
    </div>
  </div>
);

const ROIDashboard: React.FC<ROIDashboardProps> = ({ workflows, executions = [], projects = [] }) => {
  const sortedWorkflows = [...workflows].sort((a, b) => (b.total_roi_saved_hours || 0) - (a.total_roi_saved_hours || 0));
  const leaderboard = sortedWorkflows.slice(0, 10);

  const chartData = leaderboard.map(wf => ({
    name: wf.name.length > 12 ? wf.name.substring(0, 10) + '..' : wf.name,
    roi: wf.total_roi_saved_hours
  }));

  const statusData = [
    { name: 'STANDARD', value: workflows.filter(wf => wf.status === 'PROD').length },
    { name: 'REVIEW', value: workflows.filter(wf => ['DRAFT', 'Verification'].includes(wf.status)).length },
    { name: 'PENDING', value: workflows.filter(wf => !['PROD', 'DRAFT', 'Verification'].includes(wf.status)).length },
  ].filter(d => d.value > 0);

  const totalWeeklySavings = workflows.reduce((acc, wf) => acc + (wf.total_roi_saved_hours || 0), 0);
  const totalTasks = workflows.reduce((acc, wf) => acc + (wf.tasks?.length || 0), 0);
  const totalBlockers = workflows.reduce((acc, wf) => acc + (wf.tasks?.reduce((tAcc: number, t: any) => tAcc + (t.blockers?.length || 0), 0) || 0), 0);
  const avgComplexity = workflows.length > 0 ? (totalTasks / workflows.length).toFixed(1) : 0;
  const trackedRuns = executions.length;
  const realizedMinutes = executions.reduce((acc, execution) => acc + Math.max((execution.baseline_manual_minutes || 0) - (execution.actual_duration_minutes || 0), 0), 0);
  const activeProjects = projects.filter((project: any) => !['Deployed', 'Done'].includes(project.status)).length;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="apple-glass !bg-[#0f172a]/95 !border-blue-500/30 p-3 rounded-xl shadow-2xl backdrop-blur-2xl">
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1.5 border-b border-white/5 pb-1.5">{label}</p>
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-blue-400" />
            <p className="text-[14px] font-black text-white">{payload[0].value.toFixed(1)} <span className="text-[10px] text-white/40">HRS / WK</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-apple-in">
      {/* High-Density Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBox icon={Zap} label="Savings" value={`${totalWeeklySavings.toFixed(0)}h`} subValue="Projected weekly cap" colorClass="text-blue-400" />
        <StatBox icon={Activity} label="Coverage" value={`${(workflows.length > 0 ? (workflows.filter(wf => wf.status === 'PROD').length / workflows.length) * 100 : 0).toFixed(0)}%`} subValue="Standard ratio" />
        <StatBox icon={Cpu} label="Operations" value={totalTasks} subValue="Active Modules" />
        <StatBox icon={ShieldAlert} label="Risks" value={totalBlockers} subValue="Critical Issues" colorClass="text-red-500" />
        <StatBox icon={Layers} label="Density" value={avgComplexity} subValue="Steps Per Op" />
        <StatBox icon={Clock} label="Tracked Runs" value={trackedRuns} subValue={`${realizedMinutes.toFixed(0)}m realized`} colorClass="text-emerald-400" />
        <StatBox icon={BarChart3} label="Programs" value={activeProjects} subValue="Automation projects" />
        <StatBox icon={Trophy} label="Workflows" value={workflows.length} subValue="Active repositories" />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Visualization */}
        <div className="lg:col-span-2 apple-card flex flex-col gap-4 !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/20 shadow-lg shadow-blue-500/5">
                <BarChart3 size={16} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Performance</h3>
                <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em] block">Operational Metrics</span>
              </div>
            </div>
            <div className="text-[10px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full">Top Performers</div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                <Bar dataKey="roi" radius={[4, 4, 0, 0]} barSize={32}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lifecycle Distribution */}
        <div className="apple-card flex flex-col gap-4 !bg-[#111827]/40 border-white/10 p-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="p-2 bg-emerald-600/20 rounded-lg border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Clock size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Lifecycle</h3>
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em] block">Status Analysis</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[160px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-1">
              <span className="text-3xl font-black text-white tracking-tighter">{workflows.length}</span>
              <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">Total</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={6} dataKey="value" stroke="none">
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
             {statusData.map((d, i) => (
               <div key={i} className="text-center">
                 <p className="text-[9px] text-white/30 font-black truncate mb-0.5 uppercase tracking-widest">{d.name}</p>
                 <p className="text-[12px] font-black text-white">{d.value}</p>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="apple-card !p-0 overflow-hidden !bg-[#111827]/40 border-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/20">
              <Trophy size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Leaderboard</h3>
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em] block">Operational Audit</span>
            </div>
          </div>
          <div className="text-[10px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full">Top 10</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 px-6 py-2">
          {leaderboard.map((wf, idx) => (
            <div key={wf.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-all duration-300 group">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-[12px] font-black text-white/10 w-5 group-hover:text-blue-400 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-[12px] font-black text-white uppercase truncate tracking-tight group-hover:text-blue-400 transition-colors">{wf.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{wf.trigger_type}</span>
                    <div className="h-0.5 w-0.5 bg-white/10 rounded-full" />
                    <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{wf.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <TrendingUp size={10} className="text-blue-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[13px] font-black text-blue-400">+{wf.total_roi_saved_hours?.toFixed(1)}h</p>
                  </div>
                  <p className="text-[9px] text-white/20 font-black uppercase tracking-widest leading-none">Weekly</p>
                </div>
                <ChevronRight size={14} className="text-white/10 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
