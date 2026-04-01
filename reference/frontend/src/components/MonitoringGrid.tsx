import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Activity, Plus, Search, Filter, ExternalLink, 
  Trash2, Edit2, Shield, Cpu, Database, Network, 
  Globe, Bell, Info, ChevronRight, X, Check, Save,
  AlertCircle, Clock, Zap, Settings, MoreVertical, List
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AgGridReact } from "ag-grid-react"
import toast from 'react-hot-toast'
import { apiFetch } from '../api/apiClient'
import { StyledSelect } from './shared/StyledSelect'

const CATEGORIES = [
  { value: 'Hardware', icon: Cpu, color: 'text-blue-400' },
  { value: 'Log', icon: Database, color: 'text-emerald-400' },
  { value: 'Network', icon: Network, color: 'text-amber-400' },
  { value: 'Application', icon: Activity, color: 'text-rose-400' },
  { value: 'Synthetic', icon: Globe, color: 'text-purple-400' }
]

const STATUSES = [
  { value: 'Existing', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'Planned', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'Cancelled', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' }
]

export default function MonitoringGrid() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data: items, isLoading } = useQuery({
    queryKey: ['monitoring-items'],
    queryFn: async () => (await apiFetch('/api/v1/monitoring/')).json()
  })

  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => (await apiFetch('/api/v1/devices/')).json()
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/v1/monitoring/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-items'] })
      toast.success('Monitoring item decommissioned')
    }
  })

  const columnDefs = useMemo(() => [
    { field: "id", headerName: "", width: 60, checkboxSelection: true, headerCheckboxSelection: true, pinned: 'left', cellClass: 'text-center pl-4', headerClass: 'text-center pl-4' },
    { 
      field: "category", 
      headerName: "Cat", 
      width: 130,
      cellClass: 'text-center',
      headerClass: 'text-center',
      cellRenderer: (p: any) => {
        const cat = CATEGORIES.find(c => c.value === p.value)
        const Icon = cat?.icon || Activity
        return (
          <div className="flex items-center justify-center space-x-2 h-full">
            <Icon size={12} className={cat?.color || 'text-slate-400'} />
            <span className="text-[10px] font-black uppercase tracking-tight text-white">{p.value}</span>
          </div>
        )
      }
    },
    { 
      field: "status", 
      headerName: "Status", 
      width: 110,
      cellClass: 'text-center',
      headerClass: 'text-center',
      cellRenderer: (p: any) => {
        const style = STATUSES.find(s => s.value === p.value)?.color || 'bg-slate-500/20 text-slate-400'
        return (
          <div className="flex items-center justify-center h-full">
            <span className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest ${style}`}>
              {p.value}
            </span>
          </div>
        )
      }
    },
    { field: "device_name", headerName: "Target", flex: 1, cellClass: "text-blue-400 font-bold text-center", headerClass: 'text-center' },
    { 
      field: "monitored_service_names", 
      headerName: "Services", 
      flex: 1, 
      cellClass: "text-center", 
      headerClass: 'text-center',
      cellRenderer: (p: any) => {
        const names = p.value || []
        if (names.length === 0) return <span className="text-slate-600 italic text-[9px]">None</span>
        return (
          <div className="flex items-center justify-center -space-x-1 overflow-hidden h-full" title={names.join(', ')}>
            {names.slice(0, 2).map((n: string, i: number) => (
              <div key={i} className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] font-bold text-blue-300 truncate max-w-[60px]">
                {n}
              </div>
            ))}
            {names.length > 2 && (
              <div className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[8px] font-bold text-slate-400">
                +{names.length - 2}
              </div>
            )}
          </div>
        )
      }
    },
    { field: "title", headerName: "Intent", flex: 1.5, cellClass: "text-slate-200 font-bold text-center", headerClass: 'text-center' },
    { 
      field: "platform", 
      headerName: "Platform", 
      width: 120, 
      cellClass: 'text-center', 
      headerClass: 'text-center',
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-center space-x-2 h-full">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase text-slate-300">{p.value}</span>
        </div>
      )
    },
    {
      headerName: "Ops",
      width: 100,
      pinned: 'right',
      cellClass: 'text-center',
      headerClass: 'text-center',
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-center space-x-1 h-full">
           <div className="flex bg-black/20 rounded-lg p-0.5 border border-white/5">
               {p.data.external_link && (
                 <button onClick={() => window.open(p.data.external_link, '_blank')} title="External Link" className="p-1.5 hover:bg-blue-600 hover:text-white text-blue-400 rounded-md transition-all"><ExternalLink size={14}/></button>
               )}
               <button onClick={() => { setEditingItem(p.data); setIsFormOpen(true); }} title="Edit Logic" className="p-1.5 hover:bg-blue-600 hover:text-white text-slate-500 rounded-md transition-all"><Edit2 size={14}/></button>
               <button onClick={() => deleteMutation.mutate(p.data.id)} title="Decommission" className="p-1.5 hover:bg-rose-600 hover:text-white text-slate-500 rounded-md transition-all"><Trash2 size={14}/></button>
           </div>
        </div>
      )
    }
  ], []) as any

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight italic flex items-center">
                <span>Monitoring</span>
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Observability Infrastructure & Logic Registry</p>
           </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="SEARCH LOGIC, PLATFORM..."
              className="bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50 w-64 transition-all"
            />
          </div>

          <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
             <button className="p-1.5 hover:bg-white/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all" title="Matrix Config">
                <Settings size={16} />
             </button>
          </div>

          <button 
            onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            + Add Monitoring
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden ag-theme-alpine-dark relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-sm space-y-4">
             <Zap size={32} className="text-blue-400 animate-pulse" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Scanning Monitoring Matrix...</p>
          </div>
        )}
        <AgGridReact 
          rowData={items || []} 
          columnDefs={columnDefs} 
          rowSelection="multiple"
          headerHeight={28}
          rowHeight={28}
          onSelectionChanged={e => setSelectedIds(e.api.getSelectedNodes().map(n => n.data.id))}
          quickFilterText={searchTerm}
        />
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <MonitoringForm 
            item={editingItem} 
            devices={devices}
            onClose={() => setIsFormOpen(false)} 
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['monitoring-items'] })
              setIsFormOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        .ag-theme-alpine-dark {
          --ag-background-color: transparent;
          --ag-header-background-color: rgba(15, 23, 42, 0.9);
          --ag-border-color: rgba(255, 255, 255, 0.05);
          --ag-foreground-color: #f1f5f9;
          --ag-header-foreground-color: #94a3b8;
          --ag-font-family: 'Inter', sans-serif;
          --ag-font-size: 10px;
        }
        .ag-root-wrapper { border: none !important; }
        .ag-header-cell-label { font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; font-size: 9px !important; justify-content: center !important; }
        .ag-cell { display: flex; align-items: center; justify-content: center !important; padding-left: 8px !important; padding-right: 8px !important; line-height: 28px !important; }
      `}</style>
    </div>
  )
}

function MonitoringForm({ item, devices, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState(item || {
    category: 'Hardware',
    status: 'Planned',
    title: '',
    spec: '',
    platform: 'Zabbix',
    external_link: '',
    purpose: '',
    notification_method: 'Email',
    logic: '',
    device_id: null,
    monitored_services: []
  })

  // Fetch services for selected device
  const { data: deviceServices } = useQuery({
    queryKey: ['device-services', formData.device_id],
    queryFn: async () => {
      if (!formData.device_id) return []
      return (await apiFetch(`/api/v1/logical-services/?device_id=${formData.device_id}`)).json()
    },
    enabled: !!formData.device_id
  })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = item ? `/api/v1/monitoring/${item.id}` : '/api/v1/monitoring/'
      const method = item ? 'PUT' : 'POST'
      return (await apiFetch(url, { method, body: JSON.stringify(data) })).json()
    },
    onSuccess: () => {
      toast.success(item ? 'Logic synchronized' : 'Logic deployed to matrix')
      onSuccess()
    }
  })

  const toggleService = (id: number) => {
    const current = [...(formData.monitored_services || [])]
    const idx = current.indexOf(id)
    if (idx > -1) {
      current.splice(idx, 1)
    } else {
      current.push(id)
    }
    setFormData({ ...formData, monitored_services: current })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-10">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-10 rounded-[40px] border-blue-500/30 shadow-[0_0_100px_rgba(37,99,235,0.1)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-8 mb-8">
           <div className="flex items-center space-x-4">
              <div className="p-4 bg-blue-600/10 rounded-3xl text-blue-400 border border-blue-500/20">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                  {item ? 'Update Logic' : 'Deploy Monitoring'}
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Infrastructure Command Interface</p>
              </div>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors">
              <X size={24} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-2 gap-8">
           <div className="space-y-6">
              <StyledSelect 
                label="Target Resource"
                value={formData.device_id}
                onChange={(e: any) => {
                    const val = e.target.value === "" ? null : parseInt(e.target.value);
                    setFormData({...formData, device_id: val, monitored_services: []});
                }}
                options={devices?.map((d: any) => ({ value: d.id, label: `${d.name} (${d.system})` })) || []}
                placeholder="Select Device..."
              />

              {formData.device_id && (
                <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Monitored Services</label>
                    <span className="text-[9px] font-bold text-blue-500 uppercase bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {formData.monitored_services?.length || 0} Selected
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {deviceServices?.length > 0 ? (
                      deviceServices.map((svc: any) => (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center space-x-2 border ${
                            formData.monitored_services?.includes(svc.id)
                              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105'
                              : 'bg-black/40 border-white/10 text-slate-500 hover:border-white/30 hover:text-slate-300'
                          }`}
                        >
                          {formData.monitored_services?.includes(svc.id) ? <Check size={10} strokeWidth={4} /> : <div className="w-1 h-1 rounded-full bg-slate-700" />}
                          <span>{svc.name}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-600 uppercase italic px-1">No services registered to this device</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <StyledSelect 
                  label="Category"
                  value={formData.category}
                  onChange={(e: any) => setFormData({...formData, category: e.target.value})}
                  options={CATEGORIES.map(c => ({ value: c.value, label: c.value }))}
                />
                <StyledSelect 
                  label="Status"
                  value={formData.status}
                  onChange={(e: any) => setFormData({...formData, status: e.target.value})}
                  options={STATUSES.map(s => ({ value: s.value, label: s.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monitoring Intent</label>
                <input 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., CPU Thermal Threshold / Error log parsing"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-blue-500 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Technical Specifications</label>
                <textarea 
                  value={formData.spec}
                  onChange={e => setFormData({...formData, spec: e.target.value})}
                  placeholder="Metrics, thresholds, intervals..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-blue-500 transition-all resize-none shadow-inner"
                />
              </div>
           </div>

           <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Platform</label>
                  <input 
                    value={formData.platform}
                    onChange={e => setFormData({...formData, platform: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notifications</label>
                  <input 
                    value={formData.notification_method}
                    onChange={e => setFormData({...formData, notification_method: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Direct Logic / Logic Pattern</label>
                <textarea 
                  value={formData.logic}
                  onChange={e => setFormData({...formData, logic: e.target.value})}
                  placeholder="Regex, query strings, or scripts..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[11px] font-mono text-blue-400 outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Direct Resource Link (URL)</label>
                <input 
                  value={formData.external_link}
                  onChange={e => setFormData({...formData, external_link: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[12px] font-bold text-blue-500 underline outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="p-6 bg-blue-500/5 rounded-[32px] border border-blue-500/10 flex items-start space-x-4">
                <Info className="text-blue-400 mt-1 flex-shrink-0" size={16} />
                <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                  This monitoring configuration will be synchronized with the global audit trail. All modifications are logged for compliance and alignment across the system ownership team.
                </p>
              </div>
           </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 flex justify-end space-x-4">
           <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all">Cancel</button>
           <button 
             onClick={() => mutation.mutate(formData)}
             disabled={mutation.isPending}
             className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:bg-slate-700 flex items-center space-x-2"
           >
             {mutation.isPending ? <Clock className="animate-spin" size={14} /> : <Check size={14} />}
             <span>{item ? 'Save Logic' : 'Add Monitoring'}</span>
           </button>
        </div>
      </motion.div>
    </div>
  )
}
