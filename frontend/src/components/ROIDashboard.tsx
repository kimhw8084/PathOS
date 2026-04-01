import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
}

const COLORS = ['#0071e3', '#30d158', '#ff9f0a', '#bf5af2', '#64d2ff'];

const ROIDashboard: React.FC<ROIDashboardProps> = ({ workflows }) => {
  const chartData = workflows.map(wf => ({
    name: wf.name.length > 15 ? wf.name.substring(0, 12) + '...' : wf.name,
    roi: wf.total_roi_saved_hours
  })).sort((a, b) => b.roi - a.roi).slice(0, 5);

  const statusData = [
    { name: 'Completed', value: workflows.filter(wf => wf.status.includes('Automated')).length },
    { name: 'Active', value: workflows.filter(wf => wf.status.includes('Automation')).length },
    { name: 'Backlog', value: workflows.filter(wf => wf.status.includes('Created')).length },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Primary ROI Metric */}
      <div className="lg:col-span-12 apple-card flex flex-col md:flex-row items-center justify-between gap-10 bg-gradient-to-br from-[#0c0c0c] to-[#000000]">
        <div className="flex-1 space-y-2 text-center md:text-left">
          <span className="text-[10px] font-bold text-theme-accent uppercase tracking-[0.2em] mb-2 block">Total Ecosystem Savings</span>
          <div className="text-6xl font-bold tracking-tight text-white mb-2">
            {workflows.reduce((acc, wf) => acc + (wf.total_roi_saved_hours || 0), 0).toFixed(0)}
            <span className="text-3xl text-theme-secondary opacity-50 ml-2">h/mo</span>
          </div>
          <p className="text-theme-secondary text-sm max-w-md">Aggregate automated time retrieval across all Metrology operation nodes.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-theme-accent/10 flex items-center justify-center text-theme-accent animate-pulse">
            <Zap size={32} />
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="lg:col-span-7 apple-card min-h-[400px]">
        <div className="flex items-center gap-2 mb-8">
          <Zap size={18} className="text-theme-accent" />
          <h3 className="text-sm font-bold tracking-tight uppercase opacity-60">Top 5 ROI Initiatives (Hrs Saved/Mo)</h3>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#86868b', fontSize: 10, fontWeight: 500 }} 
                dy={15}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#86868b', fontSize: 10 }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: 'rgba(0,0,0,0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: '#fff' }}
                itemStyle={{ color: '#0071e3' }}
              />
              <Bar dataKey="roi" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-5 apple-card min-h-[400px] flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <Clock size={18} className="text-theme-accent" />
          <h3 className="text-sm font-bold tracking-tight uppercase opacity-60">Automation Lifecycle Distribution</h3>
        </div>
        <div className="flex-1 flex items-center justify-center relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-white">{workflows.length}</span>
            <span className="text-[10px] uppercase tracking-widest text-theme-secondary">Projects</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={75}
                outerRadius={95}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'rgba(0,0,0,0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {statusData.map((d, i) => (
            <div key={d.name} className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
              <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-1">{d.name}</span>
              <span className="text-lg font-bold" style={{ color: COLORS[i % COLORS.length] }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
