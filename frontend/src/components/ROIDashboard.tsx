import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock, Trophy, Activity, ShieldAlert, Cpu, BarChart3, Layers } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
}

const COLORS = ['#0071e3', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];

const StatBox = ({ icon: Icon, label, value, subValue, colorClass = "text-theme-primary" }: any) => (
  <div className="apple-card !p-5 flex flex-col gap-2 group hover:scale-[1.02] transition-all duration-300">
    <div className="flex items-center gap-2.5 text-theme-secondary">
      <div className="p-1.5 bg-white/[0.03] rounded-lg border border-theme-border group-hover:border-theme-accent/30 transition-colors">
        <Icon size={14} className="group-hover:text-theme-accent transition-colors" />
      </div>
      <span className="text-hint opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
    </div>
    <div className="flex items-baseline gap-2 mt-1">
      <span className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>{value}</span>
      {subValue && <span className="text-hint text-theme-muted">{subValue}</span>}
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
    { name: 'Fully Automated', value: workflows.filter(wf => wf.status === 'Fully Automated').length },
    { name: 'In Progress', value: workflows.filter(wf => ['In Automation', 'Verification', 'Partially Automated'].includes(wf.status)).length },
    { name: 'Backlog', value: workflows.filter(wf => !wf.status.includes('Automated') && wf.status !== 'In Automation').length },
  ].filter(d => d.value > 0);

  const totalMonthlySavings = workflows.reduce((acc, wf) => acc + (wf.total_roi_saved_hours || 0), 0);
  const totalTasks = workflows.reduce((acc, wf) => acc + (wf.tasks?.length || 0), 0);
  const totalBlockers = workflows.reduce((acc, wf) => acc + (wf.tasks?.reduce((tAcc: number, t: any) => tAcc + (t.blockers?.length || 0), 0) || 0), 0);
  const avgComplexity = workflows.length > 0 ? (totalTasks / workflows.length).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="apple-glass !bg-black/80 !border-theme-border p-3 rounded-xl shadow-2xl">
          <p className="text-hint text-theme-secondary mb-1">{label}</p>
          <p className="text-subtext font-extrabold text-theme-accent">{payload[0].value.toFixed(1)}h Reclaimed</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* High-Density Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBox icon={Zap} label="Yield Impact" value={`${totalMonthlySavings.toFixed(0)}h`} subValue="Monthly Savings" colorClass="text-theme-accent" />
        <StatBox icon={Activity} label="Automation" value={`${(workflows.length > 0 ? (workflows.filter(wf => wf.status.includes('Automated')).length / workflows.length) * 100 : 0).toFixed(0)}%`} subValue="System Density" />
        <StatBox icon={Cpu} label="Sys Nodes" value={totalTasks} subValue="Active Tasks" />
        <StatBox icon={ShieldAlert} label="Blockers" value={totalBlockers} subValue="Critical Paths" colorClass="text-status-error" />
        <StatBox icon={Layers} label="Complexity" value={avgComplexity} subValue="Steps / Node" />
        <StatBox icon={BarChart3} label="Ecosystem" value={workflows.length} subValue="Initiatives" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Visualization */}
        <div className="lg:col-span-2 apple-card flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-theme-accent/10 rounded-lg">
                <BarChart3 size={18} className="text-theme-accent" />
              </div>
              <h3 className="text-header-sub tracking-tight">Capacity Reclaimed Index</h3>
            </div>
            <div className="text-hint text-theme-muted">Top Performers (Hours/Month)</div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007AFF" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#007AFF" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="roi" radius={[6, 6, 0, 0]} barSize={32}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lifecycle Distribution */}
        <div className="apple-card flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-theme-border/50 pb-4">
            <div className="p-2 bg-status-success/10 rounded-lg">
              <Clock size={18} className="text-status-success" />
            </div>
            <h3 className="text-header-sub tracking-tight">Ecosystem Maturity</h3>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-5px]">
              <span className="text-3xl font-extrabold text-white tracking-tighter">{workflows.length}</span>
              <span className="text-hint text-theme-muted">Units</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={6} dataKey="value" stroke="none">
                  <Cell fill="#007AFF" />
                  <Cell fill="#34c759" />
                  <Cell fill="#ff9f0a" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-theme-border/30">
             {statusData.map((d, i) => (
               <div key={i} className="text-center">
                 <p className="text-hint text-theme-muted truncate mb-1 normal-case tracking-tight">{d.name}</p>
                 <p className="text-subtext font-extrabold text-white">{d.value}</p>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="apple-card !p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-theme-border/50 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-status-warning/10 rounded-lg">
              <Trophy size={18} className="text-status-warning" />
            </div>
            <h3 className="text-header-sub tracking-tight">High-Yield Initiative Node Ranking</h3>
          </div>
          <div className="text-hint text-theme-muted">Live Efficiency Data</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 px-6 py-2">
          {leaderboard.map((wf, idx) => (
            <div key={wf.id} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-all duration-200 group">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-subtext font-extrabold text-theme-muted w-5 opacity-40 group-hover:opacity-100 transition-opacity">{(idx + 1).toString().padStart(2, '0')}</span>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-subtext font-bold text-theme-primary truncate tracking-tight group-hover:text-theme-accent transition-colors">{wf.name}</h4>
                  <span className="text-hint text-theme-muted normal-case tracking-tight">{wf.trigger_type}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-subtext font-extrabold text-theme-accent">+{wf.total_roi_saved_hours?.toFixed(1)}h</p>
                  <p className="text-hint text-theme-muted">Monthly</p>
                </div>
                <ChevronRight size={14} className="text-theme-muted opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

  );
};

export default ROIDashboard;
