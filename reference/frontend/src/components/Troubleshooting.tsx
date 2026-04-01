import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  AlertOctagon, Clock, CheckCircle2, ChevronRight, 
  Plus, Search, Trash2, Edit2, Info, 
  ListTodo, History, ShieldAlert, Globe, 
  Zap, Save, X, PlusCircle, User, MessageSquare,
  MoreVertical, RefreshCcw, TrendingUp, AlertTriangle,
  Lightbulb, ShieldCheck, Calendar, Activity, Database, Server,
  FileText, Clipboard, Terminal, ArrowRight, Shield, Download, Share2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../api/apiClient'
import { StatusPill } from './shared/StatusPill'
import { AgGridReact } from 'ag-grid-react'
import { toast } from 'react-hot-toast'
import { ConfirmationModal } from './shared/ConfirmationModal'
import { StyledSelect } from './shared/StyledSelect'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

// --- High-Density Components ---

const DataPoint = ({ label, value, color = "text-slate-200" }: any) => (
  <div className="bg-black/20 border border-white/5 p-3 rounded-xl">
    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-sm font-bold uppercase truncate ${color}`}>{value || "---"}</p>
  </div>
)

const CompactSummary = ({ label, value, icon: Icon, color }: any) => (
  <div className="bg-[#0f172a] border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-inner">
    <div>
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-xl font-black text-white tracking-tighter">{value}</p>
    </div>
    <div className={`p-2 rounded-lg bg-white/5 ${color}`}><Icon size={18} /></div>
  </div>
)

const MultiSelect = ({ label, options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((x:any) => x !== val) : [...selected, val]
    onChange(next)
  }
  return (
    <div className="space-y-1.5 relative">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap gap-1.5 cursor-pointer min-h-[42px] items-center transition-all hover:border-white/20">
        {selected.length === 0 && <span className="text-slate-600 text-[10px]">{placeholder}</span>}
        {selected.map((s: any) => (
          <span key={s} className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1.5">
            {s} <X size={8} onClick={(e) => { e.stopPropagation(); toggle(s); }} className="hover:text-white" />
          </span>
        ))}
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[105]" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute z-[110] top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-1 max-h-48 overflow-y-auto custom-scrollbar">
              {options.map((opt: any) => (
                <div key={opt.value} onClick={() => toggle(opt.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-all ${selected.includes(opt.value) ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>{opt.label}</div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Troubleshooting() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeModal, setActiveModal] = useState<any>(null)
  const [activeDetails, setActiveDetails] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const { data: incidents, isLoading } = useQuery({ queryKey: ['incidents'], queryFn: async () => (await apiFetch('/api/v1/incidents/')).json() })
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: async () => (await apiFetch('/api/v1/devices/')).json() })
  const { data: options } = useQuery({ queryKey: ['settings-options'], queryFn: async () => (await apiFetch('/api/v1/settings/options')).json() })

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/v1/incidents/${data.id}` : '/api/v1/incidents/'
      const method = data.id ? 'PUT' : 'POST'
      const res = await apiFetch(url, { method, body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); toast.success('Entry Synchronized'); setActiveModal(null) }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/incidents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); toast.success('Record Cleared') }
  })

  const analytics = useMemo(() => {
    if (!incidents) return { active: 0, critical: 0, downtime: '0m', risk: 'Stable' }
    const active = incidents.filter((i: any) => i.status !== 'Resolved' && i.status !== 'Prevented').length
    const critical = incidents.filter((i: any) => i.severity === 'Critical').length
    return { active, critical, downtime: '124m', risk: active > 2 ? 'Elevated' : 'Stable' }
  }, [incidents])

  const columnDefs = useMemo(() => [
    { field: "id", headerName: "ID", width: 70, pinned: 'left' as const, cellClass: 'text-center font-mono text-slate-500', headerClass: 'text-center' },
    { field: "title", headerName: "Subject", flex: 1.5, pinned: 'left' as const, cellClass: 'font-bold text-white', cellRenderer: (p: any) => (
        <div className="flex items-center space-x-3 h-full"><div className={`w-2 h-2 rounded-sm ${p.data.severity === 'Critical' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : p.data.severity === 'Major' ? 'bg-amber-500' : 'bg-blue-500'}`} /><span className="truncate uppercase tracking-tight">{p.value}</span></div>
      )
    },
    { field: "status", headerName: "State", width: 110, cellClass: 'text-center', headerClass: 'text-center', cellRenderer: (p: any) => <StatusPill value={p.value} /> },
    { field: "severity", headerName: "Sev", width: 100, cellClass: 'text-center', headerClass: 'text-center', cellRenderer: (p: any) => <StatusPill value={p.value} /> },
    { field: "systems", headerName: "Impacted Domain", width: 180, cellClass: 'text-center', headerClass: 'text-center', cellRenderer: (p: any) => (
        <div className="flex flex-wrap gap-1 justify-center">{p.value?.map((s: string) => (<span key={s} className="text-[8px] font-black bg-blue-600/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{s}</span>))}</div>
      )
    },
    { field: "start_time", headerName: "Inception", width: 140, cellClass: 'text-center font-mono text-slate-400', headerClass: 'text-center', cellRenderer: (p: any) => p.value ? new Date(p.value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---' },
    { headerName: "Commands", width: 80, pinned: 'right' as const, cellClass: 'text-center', headerClass: 'text-center', cellRenderer: (p: any) => (
        <div className="flex items-center justify-center space-x-1 h-full"><div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
               <button onClick={() => setActiveDetails(p.data)} className="p-1.5 hover:bg-blue-600 hover:text-white text-slate-500 rounded-md transition-all"><Terminal size={14}/></button>
               <button onClick={() => setConfirmModal({ isOpen: true, title: 'Purge Data', message: 'Erase forensic record?', onConfirm: () => deleteMutation.mutate(p.data.id) })} className="p-1.5 hover:bg-rose-600 hover:text-white text-slate-500 rounded-md transition-all"><Trash2 size={14}/></button>
           </div></div>
      )
    }
  ], [])

  return (
    <div className="h-full flex flex-col space-y-6 text-left p-2">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex flex-col">
           <h1 className="text-3xl font-black uppercase tracking-tight text-white leading-none">Troubleshooting Log</h1>
           <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">Infrastructure Forensic Registry & Operational Impact Matrix</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative group"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="QUERY LEDGER..." className="bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50 w-64 transition-all" /></div>
          <button onClick={() => setActiveModal({ title: '', severity: 'Major', status: 'Investigating', systems: [], impacted_device_ids: [], impacts: [], start_time: new Date().toISOString() })} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"><PlusCircle size={14} /> NEW TROUBLESHOOTING</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
         <CompactSummary label="Active Faults" value={analytics.active} icon={AlertTriangle} color="text-amber-400" />
         <CompactSummary label="Critical Breaches" value={analytics.critical} icon={Zap} color="text-rose-500" />
         <CompactSummary label="Production Downtime" value={analytics.downtime} icon={Clock} color="text-blue-400" />
         <CompactSummary label="Systemic Risk" value={analytics.risk} icon={Shield} color={analytics.risk === 'Stable' ? 'text-emerald-400' : 'text-rose-400'} />
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden ag-theme-alpine-dark relative border-white/5">
        {isLoading && (<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-sm space-y-4 text-blue-500"><RefreshCcw size={32} className="animate-spin" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing Forensic Data...</p></div>)}
        <AgGridReact rowData={incidents || []} columnDefs={columnDefs as any} defaultColDef={{ resizable: true, filter: true, sortable: true }} rowSelection="multiple" headerHeight={36} rowHeight={36} onSelectionChanged={e => setSelectedIds(e.api.getSelectedNodes().map(n => n.data.id))} quickFilterText={searchTerm} />
      </div>

      <AnimatePresence>
        {activeModal && <DayZeroLogger item={activeModal} devices={devices} options={options} onClose={() => setActiveModal(null)} onSave={(data: any) => mutation.mutate(data)} isSaving={mutation.isPending} />}
        {activeDetails && <ForensicCommandCenter incident={activeDetails} devices={devices} options={options} onClose={() => setActiveDetails(null)} onSave={(data: any) => mutation.mutate(data)} />}
      </AnimatePresence>

      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} />
      <style>{`.ag-theme-alpine-dark { --ag-background-color: transparent; --ag-header-background-color: rgba(15, 23, 42, 0.9); --ag-border-color: rgba(255, 255, 255, 0.05); --ag-foreground-color: #f1f5f9; --ag-header-foreground-color: #94a3b8; --ag-font-family: 'Inter', sans-serif; --ag-font-size: 10px; } .ag-root-wrapper { border: none !important; } .ag-header-cell-label { font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.1em !important; font-size: 9px !important; justify-content: center !important; } .ag-cell { display: flex; align-items: center; justify-content: center !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; } .ag-row { border-bottom: none !important; }`}</style>
    </div>
  )
}

// --- Day Zero Logger (Initial Creation Modal) ---

function DayZeroLogger({ item, devices, options, onClose, onSave, isSaving }: any) {
  const [formData, setFormData] = useState({ ...item })
  const systemOptions = useMemo(() => options?.filter((o:any) => o.category === 'LogicalSystem').map((o:any) => ({ value: o.value, label: o.label })) || [], [options])
  const assetOptions = useMemo(() => !formData.systems.length ? [] : devices?.filter((d:any) => formData.systems.includes(d.system)).map((d:any) => ({ value: d.id, label: `${d.name} [${d.type}]` })) || [], [devices, formData.systems])
  const impactOptions = useMemo(() => options?.filter((o:any) => o.category === 'ImpactCategory').map((o:any) => ({ value: o.value, label: o.label })) || [], [options])

  const handleAssetToggle = (id: number) => { 
    const next = formData.impacted_device_ids.includes(id) ? formData.impacted_device_ids.filter((x:any) => x !== id) : [...formData.impacted_device_ids, id]
    setFormData({ ...formData, impacted_device_ids: next }) 
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 text-left">
      <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0c14] w-full max-w-xl border border-white/10 rounded-3xl flex flex-col p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
           <div className="flex items-center space-x-3 text-rose-500"><AlertOctagon size={20} /><h2 className="text-xl font-black uppercase tracking-tighter text-white">INITIAL CAPTURE</h2></div>
           <button onClick={onClose} className="text-slate-600 hover:text-white"><X size={20}/></button>
        </div>

        <div className="space-y-5">
           <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject Descriptor</label><input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 text-white" placeholder="e.g. ERP_DATABASE_OFFLINE" /></div>
           
           <div className="grid grid-cols-2 gap-4">
              <StyledSelect label="Severity" value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} options={[{value:'Critical', label:'Critical'}, {value:'Major', label:'Major'}, {value:'Minor', label:'Minor'}]} />
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Occurrence Time</label><input type="datetime-local" value={formData.start_time?.slice(0,16)} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 [color-scheme:dark]" /></div>
           </div>

           <MultiSelect label="Target Systems" options={systemOptions} selected={formData.systems} onChange={(s:any) => setFormData({ ...formData, systems: s, impacted_device_ids: [] })} placeholder="Domain impact..." />
           {formData.systems.length > 0 && (<div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Affected Nodes</label><div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 bg-black/20 rounded-xl border border-white/5">{assetOptions.map((opt: any) => (<div key={opt.value} onClick={() => handleAssetToggle(opt.value)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-all border ${formData.impacted_device_ids.includes(opt.value) ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-white/5 text-slate-600 hover:border-white/10'}`}>{opt.label}</div>))}</div></div>)}
           
           <MultiSelect label="Manufacturing Impact" options={impactOptions} selected={formData.impacts} onChange={(imp:any) => setFormData({ ...formData, impacts: imp })} placeholder="Select operational consequences..." />

           <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Primary Symptom</label><textarea value={formData.initial_symptoms} onChange={e => setFormData({...formData, initial_symptoms: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs font-medium min-h-[80px] outline-none focus:border-blue-500 text-slate-300" placeholder="Immediate engineering observation..." /></div>
        </div>

        <div className="mt-8 flex space-x-3"><button onClick={onClose} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all tracking-widest">CANCEL</button><button disabled={!formData.title || !formData.systems.length} onClick={() => onSave(formData)} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30">{isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />} REGISTER ENTRY</button></div>
      </motion.div>
    </div>
  )
}

// --- Forensic Command Center (Deep Detail View) ---

function ForensicCommandCenter({ incident, devices, options, onClose, onSave }: any) {
  const [formData, setFormData] = useState({ ...incident })
  const [activeTab, setActiveTab] = useState('Analysis')
  
  const impactOptions = useMemo(() => options?.filter((o:any) => o.category === 'ImpactCategory').map((o:any) => ({ value: o.value, label: o.label })) || [], [options])
  const addTimelineEvent = () => setFormData({ ...formData, timeline: [...(formData.timeline || []), { time: new Date().toISOString(), event: '', type: 'Info' }] })
  const addTask = () => setFormData({ ...formData, todos: [...(formData.todos || []), { task: '', status: 'Pending', owner: '' }] })
  
  const sections = [
    { id: 'Analysis', icon: Terminal, color: 'text-blue-400' },
    { id: 'Resolution', icon: Zap, color: 'text-amber-400' },
    { id: 'Timeline', icon: History, color: 'text-indigo-400' },
    { id: 'Post-Mortem', icon: ShieldCheck, color: 'text-emerald-400' },
    { id: 'Backlog', icon: ListTodo, color: 'text-pink-400' }
  ]

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 text-left">
       <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-7xl h-[95vh] bg-[#0a0c14] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
          
          {/* Header Dashboard */}
          <div className="p-10 border-b border-white/5 bg-black/40 flex items-start justify-between shrink-0">
             <div className="space-y-4 flex-1">
                <div className="flex items-center space-x-4">
                   <div className={`px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${incident.severity === 'Critical' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>CASE_{incident.id} // {incident.severity}</div>
                   <div className="flex items-center gap-2"><StatusPill value={formData.status} /></div>
                   <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-2"><Calendar size={12}/> {new Date(incident.start_time).toLocaleString()}</div>
                </div>
                <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">{incident.title}</h1>
                <div className="flex flex-wrap gap-2 pt-2">
                   {incident.systems?.map((s: string) => (<span key={s} className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-lg text-[9px] font-black text-blue-400 uppercase flex items-center gap-2"><Database size={10}/> {s}</span>))}
                   {incident.device_names?.map((n: string) => (<span key={n} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><Server size={10}/> {n}</span>))}
                </div>
             </div>
             <div className="flex flex-col items-end gap-4">
                <div className="flex gap-2">
                   <button onClick={() => { onSave(formData); toast.success("Committing Forensics..."); }} className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><Save size={16} /> SYNC DATA</button>
                   <button onClick={onClose} className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><X size={20}/></button>
                </div>
                <div className="flex gap-2">
                   <button className="p-2 text-slate-500 hover:text-blue-400 bg-white/5 rounded-lg border border-white/5"><Share2 size={14}/></button>
                   <button className="p-2 text-slate-500 hover:text-blue-400 bg-white/5 rounded-lg border border-white/5"><Download size={14}/></button>
                </div>
             </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
             {/* Navigation Sidebar */}
             <div className="w-56 border-r border-white/5 bg-black/20 p-6 space-y-1 shrink-0">
                {sections.map(s => (
                  <button key={s.id} onClick={() => setActiveTab(s.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><s.icon size={16} /><span className="text-[10px] font-black uppercase tracking-widest">{s.id}</span></button>
                ))}
             </div>

             {/* Workspace */}
             <div className="flex-1 overflow-y-auto custom-scrollbar p-10 relative">
                
                {activeTab === 'Analysis' && (
                  <div className="grid grid-cols-12 gap-8 max-w-6xl">
                     <div className="col-span-8 space-y-8">
                        <section className="space-y-3"><div className="flex items-center gap-2 text-blue-400"><Info size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Discovery & Symptoms</h3></div><textarea value={formData.initial_symptoms} onChange={e => setFormData({...formData, initial_symptoms: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium leading-relaxed outline-none focus:border-blue-500/50 text-slate-300 h-32" /></section>
                        <section className="space-y-3"><div className="flex items-center gap-2 text-amber-400"><Activity size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Root Trigger / Event Correlation</h3></div><textarea value={formData.trigger_event} onChange={e => setFormData({...formData, trigger_event: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium leading-relaxed outline-none focus:border-amber-500/50 text-slate-300 h-32" /></section>
                        <section className="space-y-3"><div className="flex items-center justify-between px-1"><div className="flex items-center gap-2 text-emerald-400"><Terminal size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Telemetry & Log Evidence</h3></div><button onClick={() => { navigator.clipboard.readText().then(t => setFormData({...formData, log_evidence: (formData.log_evidence || '') + '\n' + t})) }} className="text-[8px] font-black uppercase text-slate-500 hover:text-emerald-400 flex items-center gap-2 border border-white/5 px-2 py-1 rounded-lg"><Clipboard size={10}/> PASTE BUFFER</button></div><textarea value={formData.log_evidence} onChange={e => setFormData({...formData, log_evidence: e.target.value})} className="w-full bg-black/60 border border-white/5 rounded-2xl p-6 text-[10px] font-mono leading-relaxed outline-none focus:border-emerald-500/50 text-emerald-400 h-64" placeholder="[UTC 08:24:12] ERROR: Kernel panic on CPU 4..." /></section>
                     </div>
                     <div className="col-span-4 space-y-6">
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
                           <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><ShieldAlert size={14}/> Impact Assessment</h3>
                           <MultiSelect label="Impact Categories" options={impactOptions} selected={formData.impacts} onChange={(imp:any) => setFormData({ ...formData, impacts: imp })} placeholder="Identify production risks..." />
                           <div className="pt-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-2">Impact Analysis Narrative</label><textarea value={formData.impact_analysis} onChange={e => setFormData({...formData, impact_analysis: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-xs font-medium outline-none focus:border-rose-500/50 text-slate-300 h-40" /></div>
                        </div>
                     </div>
                  </div>
                )}

                {activeTab === 'Resolution' && (
                  <div className="max-w-4xl space-y-10">
                     <section className="space-y-3"><div className="flex items-center gap-2 text-blue-400"><Shield size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Immediate Mitigation (Stabilization)</h3></div><textarea value={formData.mitigation_steps} onChange={e => setFormData({...formData, mitigation_steps: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium outline-none focus:border-blue-500/50 text-slate-300 h-32" /></section>
                     <section className="space-y-3"><div className="flex items-center gap-2 text-rose-500"><Zap size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Verified Root Cause</h3></div><textarea value={formData.root_cause} onChange={e => setFormData({...formData, root_cause: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium outline-none focus:border-rose-500/50 text-slate-300 h-32" /></section>
                     <section className="space-y-3"><div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Permanent Resolution Actions</h3></div><textarea value={formData.resolution_steps} onChange={e => setFormData({...formData, resolution_steps: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium outline-none focus:border-emerald-500/50 text-slate-300 h-32" /></section>
                  </div>
                )}

                {activeTab === 'Timeline' && (
                  <div className="max-w-4xl space-y-8">
                     <div className="flex items-center justify-between border-b border-white/5 pb-4"><div className="flex items-center gap-3"><History size={20} className="text-indigo-400" /><h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Event Sequencing</h3></div><button onClick={addTimelineEvent} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">+ ADD MILESTONE</button></div>
                     <div className="space-y-3">
                        {formData.timeline?.map((evt: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5"><input type="datetime-local" value={evt.time?.slice(0,16)} onChange={e => { const n = [...formData.timeline]; n[i].time = e.target.value; setFormData({...formData, timeline: n}) }} className="bg-black/40 border border-white/5 rounded px-2 py-1 text-[10px] text-slate-300 outline-none [color-scheme:dark]" /><select value={evt.type} onChange={e => { const n = [...formData.timeline]; n[i].type = e.target.value; setFormData({...formData, timeline: n}) }} className="bg-black/40 border border-white/5 rounded px-2 py-1 text-[10px] font-black uppercase outline-none text-blue-400 appearance-none"><option>Info</option><option>Warning</option><option>Error</option><option>Success</option></select><input value={evt.event} onChange={e => { const n = [...formData.timeline]; n[i].event = e.target.value; setFormData({...formData, timeline: n}) }} className="flex-1 bg-transparent border-b border-white/10 px-3 py-1 text-xs font-bold text-white uppercase outline-none focus:border-indigo-500" /><button onClick={() => { const n = formData.timeline.filter((_:any,idx:number)=>idx!==i); setFormData({...formData, timeline: n}) }} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button></div>
                        ))}
                     </div>
                  </div>
                )}

                {activeTab === 'Post-Mortem' && (
                  <div className="max-w-4xl space-y-10">
                     <section className="space-y-3"><div className="flex items-center gap-2 text-emerald-400"><Lightbulb size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Engineering Lessons Learned</h3></div><textarea value={formData.lessons_learned} onChange={e => setFormData({...formData, lessons_learned: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium leading-relaxed outline-none focus:border-emerald-500/50 text-slate-300 h-48 italic" /></section>
                     <section className="space-y-3"><div className="flex items-center gap-2 text-blue-400"><ShieldCheck size={16} /><h3 className="text-[10px] font-black uppercase tracking-widest">Prevention & Fortification Strategy</h3></div><textarea value={formData.prevention_strategy} onChange={e => setFormData({...formData, prevention_strategy: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-6 text-xs font-medium leading-relaxed outline-none focus:border-blue-500/50 text-slate-300 h-48" /></section>
                  </div>
                )}

                {activeTab === 'Tasks' && (
                  <div className="max-w-4xl space-y-8">
                     <div className="flex items-center justify-between border-b border-white/5 pb-4"><div className="flex items-center gap-3"><ListTodo size={20} className="text-pink-400" /><h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Action Item Backlog</h3><button onClick={addTask} className="bg-pink-600/20 text-pink-400 border border-pink-500/30 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 transition-all">+ NEW TASK</button></div></div>
                     <div className="space-y-3">
                        {formData.todos?.map((todo: any, i: number) => (
                          <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3"><input value={todo.task} onChange={e => { const n = [...formData.todos]; n[i].task = e.target.value; setFormData({...formData, todos: n}) }} className="w-full bg-transparent border-b border-white/5 px-2 py-1 text-xs font-bold text-white uppercase outline-none focus:border-pink-500" /><div className="flex items-center justify-between"><div className="flex items-center gap-3"><select value={todo.status} onChange={e => { const n = [...formData.todos]; n[i].status = e.target.value; setFormData({...formData, todos: n}) }} className="bg-black/40 border border-white/10 rounded px-3 py-1 text-[9px] font-black uppercase outline-none text-blue-400 appearance-none"><option>Pending</option><option>Progress</option><option>Verified</option></select><div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-3 py-1"><User size={10} className="text-slate-500" /><input value={todo.owner} onChange={e => { const n = [...formData.todos]; n[i].owner = e.target.value; setFormData({...formData, todos: n}) }} className="bg-transparent text-[9px] font-black uppercase outline-none w-24 text-slate-300" /></div></div><button onClick={() => { const n = formData.todos.filter((_:any,idx:number)=>idx!==i); setFormData({...formData, todos: n}) }} className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button></div></div>
                        ))}
                     </div>
                  </div>
                )}
             </div>
          </div>
       </motion.div>
    </div>
  )
}
