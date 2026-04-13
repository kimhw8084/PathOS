import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock, Trophy, Activity, ShieldAlert, Cpu, BarChart3, Layers, ChevronRight, TrendingUp } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
}

const StatBox = ({ icon: Icon, label, value, subValue, colorClass = "text-white" }: any) => (
  <div className="apple-card !p-6 flex flex-col gap-3 group hover:scale-[1.02] transition-all duration-300 !bg-[#111827]/40 border-white/10 hover:border-blue-500/30 shadow-xl shadow-black/20">
    <div className="flex items-center gap-3 text-white/40">
      <div className="p-2 bg-white/[0.03] rounded-xl border border-white/10 group-hover:bg-blue-600/10 group-hover:border-blue-500/20 transition-all">
        <Icon size={16} className="group-hover:text-blue-400 transition-colors" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">{label}</span>
    </div>
    <div className="flex flex-col mt-1">
      <span className={`text-3xl font-black tracking-tighter uppercase ${colorClass}`}>{value}</span>
      {subValue && <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-1">{subValue}</span>}
    </div>
  </div>
);

const ROIDashboard: React.FC<ROIDashboardProps> = ({ workflows }) => {
  const sortedWorkflows = [...workflows].sort((a, b) => (b.total_roi_saved_hours || 0) - (a.total_roi_saved_hours || 0));
  const leaderboard = sortedWorkflows.slice(0, 10);

  const chartData = leaderboard.map(wf => ({
    name: wf.name.length > 15 ? wf.name.substring(0, 13) + '..' : wf.name,
    roi: wf.total_roi_saved_hours
  }));

  const statusData = [
    { name: 'STANDARD OPERATION', value: workflows.filter(wf => wf.status === 'PROD').length },
    { name: 'UNDER REVIEW', value: workflows.filter(wf => ['DRAFT', 'Verification'].includes(wf.status)).length },
    { name: 'PENDING', value: workflows.filter(wf => !['PROD', 'DRAFT', 'Verification'].includes(wf.status)).length },
  ].filter(d => d.value > 0);

  const totalMonthlySavings = workflows.reduce((acc, wf) => acc + (wf.total_roi_saved_hours || 0), 0);
  const totalTasks = workflows.reduce((acc, wf) => acc + (wf.tasks?.length || 0), 0);
  const totalBlockers = workflows.reduce((acc, wf) => acc + (wf.tasks?.reduce((tAcc: number, t: any) => tAcc + (t.blockers?.length || 0), 0) || 0), 0);
  const avgComplexity = workflows.length > 0 ? (totalTasks / workflows.length).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="apple-glass !bg-[#0f172a]/95 !border-blue-500/30 p-4 rounded-2xl shadow-2xl backdrop-blur-2xl">
          <p className="text-[11px] text-white/40 font-black uppercase tracking-widest mb-2 border-b border-white/5 pb-2">{label}</p>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-400" />
            <p className="text-[16px] font-black text-white">{payload[0].value.toFixed(1)} <span className="text-[11px] text-white/40">HRS / MO</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-10 animate-apple-in">
      {/* High-Density Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <StatBox icon={Zap} label="Operational Savings" value={`${totalMonthlySavings.toFixed(0)}h`} subValue="Monthly Capacity" colorClass="text-blue-400" />
        <StatBox icon={Activity} label="Automation Coverage" value={`${(workflows.length > 0 ? (workflows.filter(wf => wf.status === 'PROD').length / workflows.length) * 100 : 0).toFixed(0)}%`} subValue="Standard Ratio" />
        <StatBox icon={Cpu} label="Total Operations" value={totalTasks} subValue="Active Modules" />
        <StatBox icon={ShieldAlert} label="Integrity Risks" value={totalBlockers} subValue="Critical Issues" colorClass="text-red-500" />
        <StatBox icon={Layers} label="Process Density" value={avgComplexity} subValue="Steps Per Operation" />
        <StatBox icon={BarChart3} label="Total Workflows" value={workflows.length} subValue="Active Projects" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Visualization */}
        <div className="lg:col-span-2 apple-card flex flex-col gap-8 !bg-[#111827]/40 border-white/10 p-10">
          <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
                <BarChart3 size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Performance Analytics</h3>
                <span className="text-[11px] text-white/20 font-bold uppercase tracking-[0.3em] block mt-1">Operational Performance Metrics</span>
              </div>
            </div>
            <div className="text-[11px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full">Top Performers</div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 900 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                <Bar dataKey="roi" radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lifecycle Distribution */}
        <div className="apple-card flex flex-col gap-8 !bg-[#111827]/40 border-white/10 p-10">
          <div className="flex items-center gap-4 border-b border-white/5 pb-6">
            <div className="p-3 bg-emerald-600/20 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Clock size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Workflow Lifecycle</h3>
              <span className="text-[11px] text-white/20 font-bold uppercase tracking-[0.3em] block mt-1">Lifecycle Analysis</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-2">
              <span className="text-4xl font-black text-white tracking-tighter">{workflows.length}</span>
              <span className="text-[11px] text-white/20 font-black uppercase tracking-[0.3em] mt-1">Workflows</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={75} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
             {statusData.map((d, i) => (
               <div key={i} className="text-center">
                 <p className="text-[10px] text-white/30 font-black truncate mb-1 uppercase tracking-widest">{d.name}</p>
                 <p className="text-[14px] font-black text-white">{d.value}</p>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="apple-card !p-0 overflow-hidden !bg-[#111827]/40 border-white/10">
        <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/20">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Top Performing Workflows</h3>
              <span className="text-[11px] text-white/20 font-bold uppercase tracking-[0.3em] block mt-1">Operational Audit</span>
            </div>
          </div>
          <div className="text-[11px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full">Top 10 Performers</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 px-10 py-6">
          {leaderboard.map((wf, idx) => (
            <div key={wf.id} className="flex items-center justify-between py-5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-4 px-4 rounded-2xl transition-all duration-300 group">
              <div className="flex items-center gap-6 min-w-0">
                <span className="text-[14px] font-black text-white/10 w-6 group-hover:text-blue-400 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-[14px] font-black text-white uppercase truncate tracking-tight group-hover:text-blue-400 transition-colors">{wf.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{wf.trigger_type}</span>
                    <div className="h-0.5 w-0.5 bg-white/10 rounded-full" />
                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{wf.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <TrendingUp size={12} className="text-blue-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[16px] font-black text-blue-400">+{wf.total_roi_saved_hours?.toFixed(1)}h</p>
                  </div>
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Monthly</p>
                </div>
                <ChevronRight size={16} className="text-white/10 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
