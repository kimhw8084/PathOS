import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Zap, Clock } from 'lucide-react';

interface ROIDashboardProps {
  workflows: any[];
}

const ROIDashboard: React.FC<ROIDashboardProps> = ({ workflows }) => {
  const chartData = workflows.map(wf => ({
    name: wf.name.length > 20 ? wf.name.substring(0, 17) + '...' : wf.name,
    roi: wf.total_roi_saved_hours
  })).sort((a, b) => b.roi - a.roi).slice(0, 5);

  const statusData = [
    { name: 'Completed', value: workflows.filter(wf => wf.status.includes('Automated')).length },
    { name: 'In Progress', value: workflows.filter(wf => wf.status.includes('Automation')).length },
    { name: 'Backlog', value: workflows.filter(wf => !wf.status.includes('Automation') && !wf.status.includes('Automated')).length },
  ];

  const COLORS = ['#9ece6a', '#7aa2f7', '#565f89'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-theme-secondary mb-6 flex items-center gap-2">
            <Zap size={16} className="text-theme-accent" />
            Top 5 ROI Initiatives (Hrs Saved/Mo)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292e42" vertical={false} />
                <XAxis dataKey="name" stroke="#565f89" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#565f89" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1b26', border: '1px solid #292e42', borderRadius: '8px' }}
                  itemStyle={{ color: '#7aa2f7' }}
                />
                <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-theme-secondary mb-6 flex items-center gap-2">
            <Clock size={16} className="text-theme-accent" />
            Automation Lifecycle Distribution
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 pr-8">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-theme-secondary">{s.name}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
