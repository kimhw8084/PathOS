import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  MapPin, ServerCrash, Database, Share2, Layers, 
  LayoutDashboard, Server, Network, Activity, 
  ChevronRight, ArrowUpRight, Globe, Zap, Shield,
  Cpu, Box, Terminal, ListTree
} from 'lucide-react'
import { motion } from 'framer-motion'
import { apiFetch } from '../api/apiClient'

const BentoCard = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  color, 
  total, 
  breakdown, 
  onClick, 
  delay = 0 
}: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      {/* Glow Effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 rounded-[40px] blur-xl transition-all duration-500`} />
      
      <div className="relative h-full glass-panel p-8 rounded-[40px] border-white/5 group-hover:border-white/10 group-hover:bg-white/[0.03] transition-all duration-500 flex flex-col">
        <div className="flex items-start justify-between mb-8">
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${color.replace('from-', 'from-').replace('to-', 'to-')} bg-opacity-10 shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-500`}>
            <Icon size={24} className="text-white" />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{subtitle}</span>
            <div className="flex items-baseline space-x-1">
              <h2 className="text-5xl font-black text-white tracking-tighter tabular-nums">{total}</h2>
              <ArrowUpRight size={14} className="text-slate-600 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
        </div>

        <h3 className="text-sm font-black text-white uppercase tracking-tight mb-6 flex items-center">
          {title}
          <div className="ml-3 h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
        </h3>

        <div className="space-y-3 mt-auto">
          {breakdown && Object.entries(breakdown).slice(0, 4).map(([key, value]: any) => (
            <div key={key} className="flex items-center justify-between group/item">
              <div className="flex items-center space-x-2">
                <div className={`w-1 h-1 rounded-full ${color.split(' ')[1].replace('to-', 'bg-')}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter group-hover/item:text-slate-200 transition-colors">{key}</span>
              </div>
              <span className="text-[11px] font-black text-slate-500 group-hover/item:text-white transition-colors tabular-nums">
                {value}
              </span>
            </div>
          ))}
          {(!breakdown || Object.keys(breakdown).length === 0) && (
            <p className="text-[9px] font-bold text-slate-600 uppercase italic tracking-widest text-center py-4">Registry Empty</p>
          )}
        </div>
        
        {/* Progress Bar Style Indicator */}
        <div className="mt-6 w-full h-1 bg-white/5 rounded-full overflow-hidden">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: '100%' }}
             transition={{ delay: delay + 0.5, duration: 1 }}
             className={`h-full bg-gradient-to-r ${color}`} 
           />
        </div>
      </div>
    </motion.div>
  )
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/dashboard/metrics')
      return res.json()
    }
  })

  const { data: monitoringItems } = useQuery({
    queryKey: ['monitoring-items'],
    queryFn: async () => (await apiFetch('/api/v1/monitoring/')).json()
  })

  // Calculate monitoring summary
  const monSummary = monitoringItems?.reduce((acc: any, item: any) => {
    acc.total = (acc.total || 0) + 1
    acc.categories = acc.categories || {}
    acc.categories[item.category] = (acc.categories[item.category] || 0) + 1
    return acc
  }, { total: 0, categories: {} })

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <Zap size={48} className="text-blue-500 animate-pulse opacity-20" />
    </div>
  )

  return (
    <div className="h-full flex flex-col space-y-12 max-w-7xl mx-auto overflow-y-auto custom-scrollbar pr-4 pb-12">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
             <LayoutDashboard size={20} className="text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">Command Center</h1>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-[0.5em] font-black ml-1">Real-time Infrastructure Orchestration & Intelligence Matrix</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Nodes Card */}
        <BentoCard 
          title="Infrastructure Nodes"
          subtitle="Regional Presence"
          icon={MapPin}
          color="from-blue-600 to-indigo-700"
          total={metrics?.sites || 0}
          breakdown={{
            "Regional Sites": metrics?.sites || 0,
            "Rack Assemblies": metrics?.racks || 0,
            "Total Units": metrics?.total_u_space || 0,
            "Utilized Units": metrics?.used_u_space || 0
          }}
          onClick={() => onNavigate('racks')}
          delay={0.1}
        />

        {/* Assets Card */}
        <BentoCard 
          title="Assets"
          subtitle="Hardware Composition"
          icon={Server}
          color="from-emerald-600 to-teal-700"
          total={Object.values(metrics?.asset_types || {}).reduce((a: any, b: any) => a + b, 0)}
          breakdown={metrics?.asset_types}
          onClick={() => onNavigate('assets')}
          delay={0.2}
        />

        {/* Services Card */}
        <BentoCard 
          title="Application Stack"
          subtitle="Logical Microservices"
          icon={Layers}
          color="from-purple-600 to-fuchsia-700"
          total={Object.values(metrics?.service_types || {}).reduce((a: any, b: any) => a + b, 0)}
          breakdown={metrics?.service_types}
          onClick={() => onNavigate('services')}
          delay={0.3}
        />

        {/* Network Card */}
        <BentoCard 
          title="Network Fabric"
          subtitle="Interconnect Matrix"
          icon={Network}
          color="from-amber-600 to-orange-700"
          total={Object.values(metrics?.network_fabric || {}).reduce((a: any, b: any) => a + b, 0)}
          breakdown={metrics?.network_fabric}
          onClick={() => onNavigate('network')}
          delay={0.4}
        />

        {/* Monitoring Card */}
        <BentoCard 
          title="Observability"
          subtitle="Monitoring Items"
          icon={Activity}
          color="from-rose-600 to-pink-700"
          total={monSummary?.total || 0}
          breakdown={monSummary?.categories}
          onClick={() => onNavigate('monitoring')}
          delay={0.5}
        />

        {/* System Intelligence Placeholder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="relative glass-panel rounded-[40px] border-dashed border-white/10 flex flex-col items-center justify-center p-8 space-y-4 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-blue-500/30 transition-all duration-500">
             <Shield size={24} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="text-center">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">Predictive Analytics</h3>
             <p className="text-[8px] font-bold text-slate-700 uppercase tracking-tighter mt-1 group-hover:text-slate-400">Security & Performance Forensics</p>
          </div>
          <button className="px-6 py-2 bg-white/5 border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all">
             Initialize Neural Grid
          </button>
        </motion.div>
      </div>

      {/* Global Health Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="glass-panel p-6 rounded-[32px] border-white/5 flex items-center justify-between bg-gradient-to-r from-transparent via-blue-500/[0.02] to-transparent"
      >
        <div className="flex items-center space-x-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Global System Pulse</span>
              <div className="flex items-center space-x-2 mt-1">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                 <span className="text-[11px] font-black uppercase text-emerald-500">All Modules Nominal</span>
              </div>
           </div>
           <div className="h-8 w-px bg-white/5" />
           <div className="flex space-x-8">
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">API Latency</span>
                 <span className="text-[11px] font-black text-white">12ms</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">Sync Precision</span>
                 <span className="text-[11px] font-black text-white">99.98%</span>
              </div>
           </div>
        </div>
        <div className="flex items-center space-x-3">
           <span className="text-[9px] font-black text-slate-500 uppercase">Orchestration Engine v1.2.5</span>
           <div className="p-2 bg-white/5 rounded-lg border border-white/5">
              <Terminal size={12} className="text-slate-500" />
           </div>
        </div>
      </motion.div>
    </div>
  )
}
