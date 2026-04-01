import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Database, Plus, Search, Filter, ExternalLink, 
  Trash2, Edit2, Shield, Cpu, Network, X, Check,
  ArrowRightLeft, Link as LinkIcon, Key, Info, Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AgGridReact } from 'ag-grid-react'
import toast from 'react-hot-toast'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { apiFetch } from "../api/apiClient"
import { StyledSelect } from "./shared/StyledSelect"
import { ConfirmationModal } from "./shared/ConfirmationModal"

export default function ExternalIntelligence() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'Registry' | 'Connectivity'>('Registry')
  const [searchTerm, setSearchTerm] = useState('')
  const [showEntityModal, setShowEntityModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingEntity, setEditingEntity] = useState<any>(null)
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  // Data fetching
  const { data: entities, isLoading: entLoading } = useQuery({ 
    queryKey: ['external-entities'], 
    queryFn: async () => (await (await apiFetch('/api/v1/intelligence/entities')).json()) 
  })
  const { data: links, isLoading: linkLoading } = useQuery({ 
    queryKey: ['external-links'], 
    queryFn: async () => (await (await apiFetch('/api/v1/intelligence/links')).json()) 
  })
  const { data: devices } = useQuery({ 
    queryKey: ['devices'], 
    queryFn: async () => (await (await apiFetch('/api/v1/devices/')).json()) 
  })

  // Mutations
  const entityMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingEntity ? `/api/v1/intelligence/entities/${editingEntity.id}` : '/api/v1/intelligence/entities'
      const method = editingEntity ? 'PUT' : 'POST'
      return (await apiFetch(url, { method, body: JSON.stringify(data) })).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-entities'] })
      toast.success(editingEntity ? 'Entity Synchronized' : 'External System Registered')
      setShowEntityModal(false); setEditingEntity(null)
    }
  })

  const linkMutation = useMutation({
    mutationFn: async (data: any) => {
      return (await apiFetch('/api/v1/intelligence/links', { method: 'POST', body: JSON.stringify(data) })).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-links'] })
      toast.success('Interconnect Established')
      setShowLinkModal(false)
    }
  })

  const deleteEntityMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/intelligence/entities/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-entities'] })
      toast.success('System Purged from Registry')
      setConfirmModal({ ...confirmModal, isOpen: false })
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await apiFetch(`/api/v1/intelligence/links/${id}`, { method: 'DELETE' })).json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-links'] })
      toast.success('Link Severed')
      setConfirmModal({ ...confirmModal, isOpen: false })
    }
  })

  // Grid Definitions
  const entityColumns = useMemo(() => [
    { field: "name", headerName: "System Name", flex: 1.5, cellClass: "text-blue-400 font-bold", headerClass: 'text-center' },
    { field: "type", headerName: "Type", flex: 1, cellClass: "text-center", headerClass: 'text-center' },
    { field: "ip_address", headerName: "Primary IP", flex: 1, cellClass: "font-mono text-center text-emerald-400", headerClass: 'text-center' },
    { field: "owner_organization", headerName: "Partner / Owner", flex: 1.2, cellClass: "text-center", headerClass: 'text-center' },
    { 
      headerName: "Ops", 
      width: 100, 
      pinned: 'right', 
      cellClass: "text-center",
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-center space-x-1 h-full">
          <button onClick={() => { setEditingEntity(p.data); setShowEntityModal(true) }} className="p-1.5 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded transition-colors"><Edit2 size={12}/></button>
          <button onClick={() => setConfirmModal({ isOpen: true, title: 'Purge System', message: 'Purge this external entity? All links must be severed first.', onConfirm: () => deleteEntityMutation.mutate(p.data.id) })} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition-colors"><Trash2 size={12}/></button>
        </div>
      )
    }
  ], [deleteEntityMutation])

  const linkColumns = useMemo(() => [
    { field: "external_entity_name", headerName: "External Peer", flex: 1, cellClass: "text-blue-400 font-bold", headerClass: 'text-center' },
    { 
      field: "direction", 
      headerName: "Flow", 
      width: 100, 
      cellClass: "text-center",
      cellRenderer: (p: any) => (
        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block ${p.value === 'Upstream' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
          {p.value}
        </div>
      )
    },
    { field: "device_name", headerName: "Internal Asset", flex: 1, cellClass: "text-emerald-400 font-bold text-center", headerClass: 'text-center' },
    { field: "service_name", headerName: "Logical Service", flex: 1, cellClass: "text-center italic text-slate-400", headerClass: 'text-center', cellRenderer: (p: any) => p.value || '-' },
    { field: "purpose", headerName: "Interconnect Purpose", flex: 1.5, headerClass: 'text-left' },
    { field: "protocol", headerName: "Prot", width: 80, cellClass: "text-center font-mono text-[9px]", headerClass: 'text-center' },
    { field: "port", headerName: "Port", width: 80, cellClass: "text-center font-mono text-indigo-300", headerClass: 'text-center' },
    { 
      headerName: "Ops", 
      width: 80, 
      pinned: 'right', 
      cellClass: "text-center",
      cellRenderer: (p: any) => (
        <button onClick={() => setConfirmModal({ isOpen: true, title: 'Sever Link', message: 'Sever this interconnect?', onConfirm: () => deleteLinkMutation.mutate(p.data.id) })} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition-colors"><Trash2 size={12}/></button>
      )
    }
  ], [deleteLinkMutation])

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight italic">Partner IQ</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">External Interconnect & Intelligence Matrix</p>
           </div>

           <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 ml-2">
                <button 
                  onClick={() => setActiveTab('Registry')} 
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${activeTab === 'Registry' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Globe size={14}/> <span>Registry</span>
                </button>
                <button 
                  onClick={() => setActiveTab('Connectivity')} 
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${activeTab === 'Connectivity' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <LinkIcon size={14}/> <span>Connectivity</span>
                </button>
           </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
             <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-indigo-500/50 w-64 transition-all" 
             />
          </div>

          <button 
             onClick={() => activeTab === 'Registry' ? setShowEntityModal(true) : setShowLinkModal(true)}
             className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
             + {activeTab === 'Registry' ? 'Register' : 'Map Link'}
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden ag-theme-alpine-dark relative border-white/5">
        {(entLoading || linkLoading) && (
           <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Synchronizing Global Matrix...</p>
           </div>
        )}
        <AgGridReact 
          rowData={activeTab === 'Registry' ? entities : links} 
          columnDefs={activeTab === 'Registry' ? entityColumns : linkColumns}
          headerHeight={28}
          rowHeight={28}
          quickFilterText={searchTerm}
        />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showEntityModal && (
          <EntityForm 
            entity={editingEntity} 
            onClose={() => { setShowEntityModal(false); setEditingEntity(null) }}
            onSave={(data: any) => entityMutation.mutate(data)}
            isPending={entityMutation.isPending}
          />
        )}
        {showLinkModal && (
          <LinkForm 
            entities={entities}
            devices={devices}
            onClose={() => setShowLinkModal(false)}
            onSave={(data: any) => linkMutation.mutate(data)}
            isPending={linkMutation.isPending}
          />
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
      />

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
        .ag-header-cell-label { font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; font-size: 9px !important; }
      `}</style>
    </div>
  )
}

function EntityForm({ entity, onClose, onSave, isPending }: any) {
  const [formData, setFormData] = useState(entity || {
    name: '', type: 'Server', hostname: '', ip_address: '', owner_organization: '', description: '', contact_info: ''
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-10">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-full max-w-2xl p-10 rounded-[40px] border-indigo-500/30">
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
           <div className="flex items-center space-x-4">
              <div className="p-4 bg-indigo-600/10 rounded-2xl text-indigo-400">
                <Globe size={20} />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                {entity ? 'Refine System Data' : 'Register External System'}
              </h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="grid grid-cols-2 gap-6">
           <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">System Name *</label>
              <input 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                placeholder="e.g., Azure Auth Gateway"
              />
           </div>
           <StyledSelect 
              label="System Type"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
              options={["Server", "Database", "PC/Workstation", "Network Gear", "Cloud Service", "Partner API"].map(t => ({ value: t, label: t }))}
           />
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Owner / Organization</label>
              <input 
                value={formData.owner_organization} onChange={e => setFormData({...formData, owner_organization: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                placeholder="e.g., Microsoft / Partner-X"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Primary IP Address</label>
              <input 
                value={formData.ip_address} onChange={e => setFormData({...formData, ip_address: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-[11px] font-mono text-emerald-400 outline-none focus:border-indigo-500 transition-all"
                placeholder="0.0.0.0"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">FQDN / Hostname</label>
              <input 
                value={formData.hostname} onChange={e => setFormData({...formData, hostname: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                placeholder="api.partner.com"
              />
           </div>
           <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Description / Notes</label>
              <textarea 
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all h-24 resize-none"
              />
           </div>
        </div>

        <div className="flex space-x-4 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Abort</button>
           <button 
             onClick={() => onSave(formData)}
             disabled={!formData.name || isPending}
             className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
           >Commit Registry</button>
        </div>
      </motion.div>
    </div>
  )
}

function LinkForm({ entities, devices, onClose, onSave, isPending }: any) {
  const [formData, setFormData] = useState({
    external_entity_id: '', device_id: '', service_id: '', direction: 'Upstream', purpose: '', protocol: 'TCP', port: '',
    credentials: { username: '', password: '', note: '' }
  })

  const { data: services } = useQuery({
    queryKey: ['device-services', formData.device_id],
    queryFn: async () => {
      if (!formData.device_id) return []
      return (await apiFetch(`/api/v1/logical-services/?device_id=${formData.device_id}`)).json()
    },
    enabled: !!formData.device_id
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-10">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-full max-w-3xl p-10 rounded-[40px] border-indigo-500/30 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
           <div className="flex items-center space-x-4">
              <div className="p-4 bg-indigo-600/10 rounded-2xl text-indigo-400">
                <LinkIcon size={20} />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Establish Interconnect Link</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="grid grid-cols-2 gap-6">
           <div className="col-span-2 p-6 bg-white/5 border border-white/5 rounded-[30px] grid grid-cols-2 gap-6">
              <StyledSelect 
                 label="External Entity (Peer)"
                 value={formData.external_entity_id}
                 onChange={e => setFormData({...formData, external_entity_id: e.target.value})}
                 options={entities?.map((e: any) => ({ value: e.id, label: `${e.name} [${e.ip_address || 'No IP'}]` })) || []}
                 placeholder="Select Remote System..."
              />
              <StyledSelect 
                 label="Flow Direction"
                 value={formData.direction}
                 onChange={e => setFormData({...formData, direction: e.target.value})}
                 options={[{value: 'Upstream', label: 'Upstream (Input)'}, {value: 'Downstream', label: 'Downstream (Output)'}]}
              />
           </div>

           <div className="col-span-2 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[30px] grid grid-cols-2 gap-6">
              <StyledSelect 
                 label="Internal Asset (Host)"
                 value={formData.device_id}
                 onChange={e => setFormData({...formData, device_id: e.target.value, service_id: ''})}
                 options={devices?.map((d: any) => ({ value: d.id, label: d.name })) || []}
                 placeholder="Select Internal Asset..."
              />
              <StyledSelect 
                 label="Target Service (Optional)"
                 value={formData.service_id}
                 onChange={e => setFormData({...formData, service_id: e.target.value})}
                 options={services?.map((s: any) => ({ value: s.id, label: s.name })) || []}
                 placeholder={formData.device_id ? "Select Service..." : "Select Asset First..."}
              />
           </div>

           <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Interconnect Purpose</label>
              <input 
                value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                placeholder="e.g., Daily DB Synchronization Feed"
              />
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Protocol</label>
              <input 
                value={formData.protocol} onChange={e => setFormData({...formData, protocol: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-mono text-white outline-none focus:border-indigo-500 transition-all"
                placeholder="TCP / HTTPS / SFTP"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Port</label>
              <input 
                value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs font-mono text-indigo-300 outline-none focus:border-indigo-500 transition-all"
                placeholder="443"
              />
           </div>

           <div className="col-span-2 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[30px] space-y-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Key size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">Connection Credentials</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <input 
                   value={formData.credentials.username} onChange={e => setFormData({...formData, credentials: {...formData.credentials, username: e.target.value}})}
                   className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white outline-none focus:border-indigo-500 transition-all"
                   placeholder="Service Username"
                 />
                 <input 
                   type="password"
                   value={formData.credentials.password} onChange={e => setFormData({...formData, credentials: {...formData.credentials, password: e.target.value}})}
                   className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white outline-none focus:border-indigo-500 transition-all"
                   placeholder="Password"
                 />
                 <textarea 
                   className="col-span-2 w-full bg-black/60 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold text-slate-400 outline-none focus:border-indigo-500 transition-all h-16 resize-none"
                   placeholder="Credential Notes / Secret Store ID..."
                   value={formData.credentials.note}
                   onChange={e => setFormData({...formData, credentials: {...formData.credentials, note: e.target.value}})}
                 />
              </div>
           </div>
        </div>

        <div className="flex space-x-4 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Abort</button>
           <button 
             onClick={() => onSave({
               ...formData,
               external_entity_id: parseInt(formData.external_entity_id),
               device_id: parseInt(formData.device_id),
               service_id: formData.service_id ? parseInt(formData.service_id) : null
             })}
             disabled={!formData.external_entity_id || !formData.device_id || isPending}
             className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
           >Establish Link</button>
        </div>
      </motion.div>
    </div>
  )
}
