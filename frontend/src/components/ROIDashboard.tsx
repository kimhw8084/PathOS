import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock, Trophy, Activity, ShieldAlert, Cpu, BarChart3, Layers } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
}

const COLORS = ['#0071e3', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];

const StatBox = ({ icon: Icon, label, value, subValue, colorClass = "text-theme-primary" }: any) => (
  <div className="bg-theme-card border border-theme-border p-3 rounded flex flex-col gap-1 hover:border-theme-border-bright transition-colors">
    <div className="flex items-center gap-2 text-theme-secondary opacity-60">
      <Icon size={12} />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-xl font-black italic tracking-tighter ${colorClass}`}>{value}</span>
      {subValue && <span className="text-[10px] text-theme-muted font-mono">{subValue}</span>}
    </div>
  </div>
);

const ROIDashboard: React.FC<ROIDashboardProps> = ({ workflows }) => {
  const sortedWorkflows = [...workflows].sort((a, b) => (b.total_roi_saved_hours || 0) - (a.total_roi_saved_hours || 0));
  const leaderboard = sortedWorkflows.slice(0, 10);
  
  const chartData = leaderboard.map(wf => ({
    name: wf.name.length > 12 ? wf.name.substring(0, 10) + '..' : wf.name,
    roi: wf.total_roi_saved_hours
  }));

  const statusData = [
    { name: 'Deployed', value: workflows.filter(wf => wf.status === 'Fully Automated').length },
    { name: 'Active Dev', value: workflows.filter(wf => ['In Automation', 'Verification', 'Partially Automated'].includes(wf.status)).length },
    { name: 'Backlog', value: workflows.filter(wf => !wf.status.includes('Automated') && wf.status !== 'In Automation').length },
  ].filter(d => d.value > 0);

  const totalMonthlySavings = workflows.reduce((acc, wf) => acc + (wf.total_roi_saved_hours || 0), 0);
  const totalTasks = workflows.reduce((acc, wf) => acc + (wf.tasks?.length || 0), 0);
  const totalBlockers = workflows.reduce((acc, wf) => acc + (wf.tasks?.reduce((tAcc: number, t: any) => tAcc + (t.blockers?.length || 0), 0) || 0), 0);
  const avgComplexity = workflows.length > 0 ? (totalTasks / workflows.length).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      {/* High-Density Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatBox icon={Zap} label="Yield Impact" value={`${totalMonthlySavings.toFixed(0)}h`} subValue="RECLAIMED/MO" colorClass="text-theme-accent" />
        <StatBox icon={Activity} label="Automation" value={`${(workflows.length > 0 ? (workflows.filter(wf => wf.status.includes('Automated')).length / workflows.length) * 100 : 0).toFixed(0)}%`} subValue="DENSITY" />
        <StatBox icon={Cpu} label="Sys Nodes" value={totalTasks} subValue="ACTIVE_TASKS" />
        <StatBox icon={ShieldAlert} label="Blockers" value={totalBlockers} subValue="CRITICAL_PATHS" colorClass="text-status-error" />
        <StatBox icon={Layers} label="Complexity" value={avgComplexity} subValue="STEPS/NODE" />
        <StatBox icon={BarChart3} label="Ecosystem" value={workflows.length} subValue="TOTAL_INITIATIVES" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance Visualization - Narrower */}
        <div className="lg:col-span-2 apple-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-theme-border pb-2 mb-2">
            <BarChart3 size={14} className="text-theme-accent" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-theme-secondary">Reclaimed Capacity Index</h3>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 9 }} />
                <Tooltip 
                  contentStyle={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '8px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#0071e3' }}
                  labelStyle={{ fontSize: '10px', color: '#a3a3a3', marginBottom: '4px' }}
                />
                <Bar dataKey="roi" radius={[2, 2, 0, 0]} barSize={24}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lifecycle Distribution - Narrower */}
        <div className="apple-card flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-theme-border pb-2 mb-2">
            <Clock size={14} className="text-theme-accent" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-theme-secondary">Ecosystem Status</h3>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[180px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-white italic">{workflows.length}</span>
              <span className="text-[8px] uppercase tracking-widest text-theme-muted">Units</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none">
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '4px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboard - High Density Table Style */}
      <div className="apple-card">
        <div className="flex items-center gap-2 border-b border-theme-border pb-2 mb-3">
          <Trophy size={14} className="text-status-warning" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-theme-secondary">High-Yield Initiative Node Ranking</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          {leaderboard.map((wf, idx) => (
            <div key={wf.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] px-2 rounded transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-mono text-theme-muted w-4 font-bold">{idx + 1}.</span>
                <h4 className="text-xs font-bold text-theme-primary truncate uppercase tracking-tight group-hover:text-theme-accent">{wf.name}</h4>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[9px] text-theme-muted uppercase font-black opacity-40">{wf.trigger_type}</span>
                <span className="text-xs font-mono font-black text-theme-accent italic">+{wf.total_roi_saved_hours?.toFixed(1)}h/mo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
