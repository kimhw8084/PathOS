import React, { useMemo, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Cpu, Package, X, RefreshCcw, Search, Edit2, LayoutGrid, List, FileJson, Check, MoreVertical, Settings, Sliders, Globe, Eye, EyeOff, ArrowRightLeft, Tag, AlertCircle, Layers, Terminal, FileText, Filter, Calendar, Activity, Link as LinkIcon, Database, HardDrive, Cpu as CpuIcon, Box, Network, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { apiFetch } from "../api/apiClient"
import { ConfigRegistryModal } from "./ConfigRegistry"
import { ConfirmationModal } from "./shared/ConfirmationModal"
import { ConnectionForensicsModal } from "./shared/ConnectionForensicsModal"
import { StyledSelect } from "./shared/StyledSelect"
import { ServiceDetailsView, ServiceForm } from "./ServiceRegistry"

const SharedServiceModals = ({ 
  activeDetails, 
  setActiveDetails, 
  activeEdit, 
  setActiveEdit, 
  options, 
  devices,
  onServiceUpdate
}: any) => {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = `/api/v1/logical-services/${data.id}`
      const method = "PUT"
      const res = await apiFetch(url, { method, body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["logical-services"] })
      queryClient.invalidateQueries({ queryKey: ["device-services"] })
      toast.success("Service Registry Updated")
      setActiveEdit(null)
      onServiceUpdate?.()
    },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <>
      <AnimatePresence>
        {activeEdit && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-10">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-panel w-[800px] max-h-[90vh] overflow-y-auto p-10 rounded-[40px] border border-blue-500/30 custom-scrollbar">
               <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <h2 className="text-2xl font-black uppercase flex items-center space-x-4 text-blue-400">
                     <Layers size={28}/> <span>Modify Service Configuration</span>
                  </h2>
                  <button onClick={() => setActiveEdit(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>
               <ServiceForm initialData={activeEdit} onSave={mutation.mutate} options={options} devices={devices} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDetails && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-10">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-panel w-[900px] max-h-[85vh] overflow-hidden p-10 rounded-[40px] border border-blue-500/30 flex flex-col">
               <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-black uppercase text-blue-400">{activeDetails.name}</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{activeDetails.service_type} // {activeDetails.environment}</p>
                  </div>
                  <button onClick={() => setActiveDetails(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar pt-6">
                  <ServiceDetailsView service={activeDetails} options={options} devices={devices} />
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

const AssetServicesTable = ({ deviceId, onViewDetails, onEdit }: { deviceId: number, onViewDetails: (s: any) => void, onEdit: (s: any) => void }) => {
  const { data: services, isLoading } = useQuery({
    queryKey: ['device-services', deviceId],
    queryFn: async () => (await (await apiFetch(`/api/v1/logical-services/?device_id=${deviceId}`)).json())
  })

  return (
    <div className="p-0 overflow-hidden">
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <RefreshCcw size={20} className="animate-spin mb-2" />
          <p className="text-[10px] font-black uppercase">Loading services...</p>
        </div>
      )}
      {!isLoading && (<table className="w-full text-[10px]">
        <thead className="bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Service Name</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Type</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Purpose</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Status</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Environment</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Installed</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Link</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {services?.map((s: any) => (
            <tr key={s.id} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 font-bold text-blue-400">{s.name}</td>
              <td className="px-4 py-3 text-slate-400 uppercase font-black text-[9px]">{s.service_type}</td>
              <td className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]">
                {s.purpose ? <span title={s.purpose}>{s.purpose}</span> : '-'}
              </td>
              <td className="px-4 py-3 text-center">
                 <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                    s.status === 'Running' || s.status === 'Active' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
                    s.status === 'Stopped' ? 'text-slate-400 border-slate-500/20 bg-slate-500/5' :
                    s.status === 'Maintenance' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                    'text-rose-400 border-rose-500/20 bg-rose-500/5'
                 }`}>{s.status}</span>
              </td>
              <td className="px-4 py-3 text-center text-slate-500 uppercase font-bold">{s.environment}</td>
              <td className="px-4 py-3 text-center font-mono text-blue-400/60">
                {s.installation_date ? new Date(s.installation_date).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-3 text-center">
                {s.documentation_link ? (
                  <a href={s.documentation_link} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-400 hover:text-white transition-colors inline-block">
                    <ExternalLink size={12} />
                  </a>
                ) : '-'}
              </td>
              <td className="px-4 py-3 text-center">
                 <div className="flex items-center justify-center space-x-1">
                   <button
                     onClick={() => onViewDetails(s)}
                     className="p-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-600/20 transition-all flex items-center justify-center space-x-1"
                     title="View Service Forensics"
                   >
                     <List size={14}/>
                   </button>
                   <button
                     onClick={() => onEdit(s)}
                     className="p-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-600/20 transition-all flex items-center justify-center"
                     title="Edit Service Instance"
                   >
                     <Edit2 size={14}/>
                   </button>
                 </div>
              </td>
            </tr>
          ))}
          {!services?.length && !isLoading && (
            <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600 font-bold uppercase italic tracking-widest">No logical services bound to this asset</td></tr>
          )}
        </tbody>
      </table>
      )}
    </div>
  )
}
const StatusBulkUpdateModal = ({ isOpen, onClose, onApply, options, count }: { isOpen: boolean, onClose: () => void, onApply: (status: string) => void, options: any[], count?: number }) => {
  const [selectedStatus, setSelectedStatus] = useState('')

  useEffect(() => {
    if (isOpen) setSelectedStatus('')
  }, [isOpen])

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
       <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-[400px] p-10 rounded-[40px] border border-blue-500/30 space-y-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-blue-400 flex items-center space-x-3">
               <Tag size={24}/> <span>Update Status</span>
            </h2>
            {count && <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Updating {count} asset{count !== 1 ? 's' : ''}</p>}
          </div>
          <StyledSelect
            label="Target Operational State"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            options={STATUS_ITEMS}
            placeholder="Select Status..."
          />
          <div className="flex space-x-3 pt-2">
             <button onClick={onClose} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
             <button 
               disabled={!selectedStatus}
               onClick={() => onApply(selectedStatus)} 
               className="flex-2 py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
             >
                Apply to Selection
             </button>
          </div>
       </motion.div>
    </div>
  )
}

const BulkEnvUpdateModal = ({ isOpen, onClose, onApply, options, count }: { isOpen: boolean, onClose: () => void, onApply: (env: string) => void, options: any[], count?: number }) => {
  const [selectedEnv, setSelectedEnv] = useState('')

  useEffect(() => {
    if (isOpen) setSelectedEnv('')
  }, [isOpen])

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
       <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-[400px] p-10 rounded-[40px] border border-blue-500/30 space-y-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter text-blue-400 flex items-center space-x-3">
               <Globe size={24}/> <span>Update Environment</span>
            </h2>
            {count && <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Updating {count} asset{count !== 1 ? 's' : ''}</p>}
          </div>
          <StyledSelect
            label="Target Environment"
            value={selectedEnv}
            onChange={e => setSelectedEnv(e.target.value)}
            options={ENVIRONMENT_ITEMS}
            placeholder="Select Environment..."
          />
          <div className="flex space-x-3 pt-2">
             <button onClick={onClose} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
             <button
               disabled={!selectedEnv}
               onClick={() => onApply(selectedEnv)}
               className="flex-1 py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
             >
                Apply to Selection
             </button>
          </div>
       </motion.div>
    </div>
  )
}

const MetadataEditor = ({ value, onChange, onError }: { value: any, onChange: (v: any) => void, onError?: (err: string | null) => void }) => {
  const [mode, setMode] = useState<'table' | 'json'>('table')
  const [tableRows, setTableRows] = useState<{key: string, value: string}[]>([])
  const [jsonValue, setJsonValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const obj = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {})
      setTableRows(Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) })))
      setJsonValue(JSON.stringify(obj, null, 2))
    } catch {
      setTableRows([])
      setJsonValue('')
      setError('Invalid metadata format')
      onError?.('Invalid metadata format')
    }
  }, [JSON.stringify(value), onError])

  const validateAndNotify = (rows: {key: string, value: string}[]) => {
    const obj: any = {}
    const keys = new Set()
    let hasDuplicate = false
    
    rows.forEach(r => {
      if (r.key) {
        if (keys.has(r.key)) hasDuplicate = true
        keys.add(r.key)
        obj[r.key] = r.value
      }
    })

    if (hasDuplicate) {
        setError("Duplicate keys detected")
        onError?.("Duplicate keys detected")
        return false
    } else {
        setError(null)
        onError?.(null)
        setJsonValue(JSON.stringify(obj, null, 2))
        onChange(obj)
        return true
    }
  }

  const syncFromJSON = (json: string) => {
    try {
        const obj = JSON.parse(json)
        const keys = Object.keys(obj)
        if (new Set(keys).size !== keys.length) {
            setError("Duplicate keys in JSON")
            onError?.("Duplicate keys in JSON")
            return false
        }
        const rows = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }))
        setTableRows(rows)
        setError(null)
        onError?.(null)
        onChange(obj)
        return true
    } catch (e) {
        setError("Invalid JSON format")
        onError?.("Invalid JSON format")
        return false
    }
  }

  return (
    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
         <div className="flex items-center space-x-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Service Metadata</span>
            {error && <div className="flex items-center space-x-1 text-rose-500"><AlertCircle size={12} className="animate-pulse" /><span className="text-[8px] font-black uppercase tracking-tighter">{error}</span></div>}
         </div>
         <div className="flex bg-black/40 rounded-lg p-1">
            <button onClick={() => setMode('table')} className={`px-2 py-1 rounded-md transition-all ${mode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><List size={12}/></button>
            <button onClick={() => setMode('json')} className={`px-2 py-1 rounded-md transition-all ${mode === 'json' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><FileJson size={12}/></button>
         </div>
      </div>
      <div className="p-4 min-h-[120px]">
        {mode === 'table' ? (
          <div className="space-y-2">
            {tableRows.map((row, i) => (
              <div key={i} className="flex items-center space-x-2">
                <input value={row.key} onChange={e => {
                  const n = [...tableRows]; n[i].key = e.target.value; 
                  setTableRows(n); validateAndNotify(n);
                }} placeholder="Key" className={`flex-1 bg-black/40 border ${error?.includes('Duplicate') ? 'border-rose-500/50' : 'border-white/5'} rounded-lg px-3 py-1.5 text-[11px] outline-none focus:border-blue-500`} />
                <input value={row.value} onChange={e => {
                  const n = [...tableRows]; n[i].value = e.target.value; 
                  setTableRows(n); validateAndNotify(n);
                }} placeholder="Value" className="flex-[2] bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] outline-none" />
                <button onClick={() => {
                    const n = tableRows.filter((_, idx) => idx !== i);
                    setTableRows(n); validateAndNotify(n);
                }} className="text-slate-600 hover:text-rose-400"><X size={14}/></button>
              </div>
            ))}
            <button onClick={() => {
                const n = [...tableRows, { key: '', value: '' }];
                setTableRows(n);
            }} className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-2 hover:text-blue-300 transition-colors">+ Add Attribute Pair</button>
          </div>
        ) : (
          <textarea 
            value={jsonValue} 
            onChange={e => {
                setJsonValue(e.target.value);
                syncFromJSON(e.target.value);
            }} 
            className={`w-full h-32 bg-black/40 border ${error === 'Invalid JSON format' || error === 'Duplicate keys in JSON' ? 'border-rose-500/50' : 'border-white/5'} rounded-xl px-4 py-3 text-[11px] font-mono text-blue-300 outline-none`}
          />
        )}
      </div>
    </div>
  )
}

const MetadataViewer = ({ data }: { data: any }) => {
  let obj: any = {}
  try {
    obj = typeof data === 'string' ? JSON.parse(data || '{}') : (data || {})
  } catch {
    obj = {}
  }
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">Metadata Inspection</h3>
      <div className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-[10px]">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Key</th>
              <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Object.entries(obj).map(([k, v]) => (
              <tr key={k} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2 font-black uppercase text-slate-400">{k}</td>
                <td className="px-4 py-2 text-slate-200">{String(v)}</td>
              </tr>
            ))}
            {Object.keys(obj).length === 0 && (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-600 font-bold uppercase italic">No additional payload data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const AssetReportView = ({ assets, selectedId, onSelect, options, onEdit, onViewServiceDetails, onEditService }: any) => {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState({ name: '', system: '', type: '', status: '', env: '' })
  
  const filteredAssets = useMemo(() => {
    return assets?.filter((a: any) => {
      const matchName = a.name.toLowerCase().includes(filter.name.toLowerCase())
      const matchSystem = !filter.system || a.system === filter.system
      const matchType = !filter.type || a.type === filter.type
      const matchStatus = !filter.status || a.status === filter.status
      const matchEnv = !filter.env || a.environment === filter.env
      return matchName && matchSystem && matchType && matchStatus && matchEnv
    }) || []
  }, [assets, filter])

  const selectedAsset = useMemo(() => assets?.find((a: any) => a.id === selectedId), [assets, selectedId])

  useEffect(() => {
    if (!selectedId && filteredAssets.length > 0) {
      onSelect(filteredAssets[0].id)
    }
  }, [filteredAssets, selectedId, onSelect])

  const getOptions = (cat: string) => Array.isArray(options) ? options.filter((o: any) => o.category === cat) : []

  return (
    <div className="flex-1 flex overflow-hidden space-x-4">
      {/* Left Vertical List */}
      <div className="w-80 flex flex-col glass-panel rounded-2xl overflow-hidden border-white/5">
        <div className="p-4 border-b border-white/5 space-y-3 bg-white/5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              value={filter.name} 
              onChange={e => setFilter({ ...filter, name: e.target.value })} 
              placeholder="Search Assets..." 
              className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50 transition-all" 
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filter.system} onChange={e => setFilter({ ...filter, system: e.target.value })} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 outline-none">
              <option value="">All Systems</option>
              {getOptions('LogicalSystem').map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 outline-none">
              <option value="">All Types</option>
              {ASSET_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 outline-none">
              <option value="">All Statuses</option>
              {STATUS_ITEMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filter.env} onChange={e => setFilter({ ...filter, env: e.target.value })} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-slate-400 outline-none">
              <option value="">All Envs</option>
              {ENVIRONMENT_ITEMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredAssets.map((a: any) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={`w-full flex flex-col p-3 rounded-xl transition-all text-left relative overflow-hidden group ${selectedId === a.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-[11px] uppercase tracking-tighter truncate pr-2">{a.name}</span>
                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${
                  a.status === 'Active' ? 'bg-emerald-500/20 border-emerald-500/20 text-emerald-400' :
                  a.status === 'Maintenance' ? 'bg-amber-500/20 border-amber-500/20 text-amber-400' :
                  'bg-slate-500/10 border-white/5 text-slate-500'
                } ${selectedId === a.id ? 'border-white/40 text-white' : ''}`}>
                  {a.status}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[9px] font-bold opacity-60">
                <span>{a.system}</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                <span>{a.type}</span>
              </div>
              {selectedId === a.id && <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-white" />}
            </button>
          ))}
          {!filteredAssets.length && (
            <div className="py-20 text-center text-slate-600 italic text-[10px] font-black uppercase tracking-widest">No matching assets</div>
          )}
        </div>
      </div>

      {/* Right Report Content */}
      <div className="flex-1 glass-panel rounded-2xl overflow-y-auto custom-scrollbar border-white/5 bg-[#0a0c14]/40">
        {selectedAsset ? (
          <div className="p-12 space-y-12">
            {/* Report Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                   <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                      <Box size={32} />
                   </div>
                   <div>
                      <h1 className="text-4xl font-black uppercase tracking-tighter text-white">{selectedAsset.name}</h1>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-blue-400 font-black uppercase tracking-[0.2em] text-[12px]">{selectedAsset.system}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span className="text-slate-500 font-black uppercase tracking-[0.1em] text-[10px]">{selectedAsset.type} // {selectedAsset.environment}</span>
                        {selectedAsset.role && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            <span className="text-indigo-400 font-black uppercase tracking-[0.1em] text-[10px] italic">Role: {selectedAsset.role}</span>
                          </>
                        )}
                      </div>
                   </div>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-3">
                 <div className={`px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-2xl ${
                    selectedAsset.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' :
                    selectedAsset.status === 'Maintenance' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5' :
                    'bg-slate-500/10 border-white/5 text-slate-500 shadow-black'
                 }`}>
                   {selectedAsset.status} STATUS
                 </div>
                 <button onClick={() => onEdit(selectedAsset)} className="flex items-center space-x-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                    <Edit2 size={14}/> <span>Modify Config</span>
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
               {/* Connectivity & Logic */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                     <Globe size={16} className="text-indigo-400" />
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Connectivity & Access</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Primary Network IP</p>
                        <p className="text-xl font-mono text-blue-400 font-black">{selectedAsset.primary_ip || '---.---.---.---'}</p>
                     </div>
                     <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Management OOB IP</p>
                        <p className="text-xl font-mono text-indigo-400 font-black">{selectedAsset.management_ip || '---.---.---.---'}</p>
                     </div>
                  </div>
                  {selectedAsset.management_url && (
                    <div className="bg-black/20 p-5 rounded-2xl border border-indigo-500/20 flex items-center justify-between group cursor-pointer" onClick={() => window.open(selectedAsset.management_url, '_blank')}>
                       <div className="flex items-center space-x-4">
                          <Terminal size={24} className="text-indigo-400" />
                          <div>
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Management Console</p>
                             <p className="text-xs font-bold text-white truncate max-w-[200px]">{selectedAsset.management_url}</p>
                          </div>
                       </div>
                       <ArrowRightLeft size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  )}
               </div>

               {/* Physical & OS */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                     <CpuIcon size={16} className="text-amber-400" />
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Hardware & System</h3>
                  </div>
                  <div className="bg-black/20 p-6 rounded-2xl border border-white/5 grid grid-cols-2 gap-y-6 gap-x-12">
                     <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Platform</p>
                        <p className="text-xs font-black text-white uppercase">{selectedAsset.manufacturer} {selectedAsset.model}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Identity Tag / SN</p>
                        <p className="text-xs font-mono text-white uppercase">{selectedAsset.asset_tag || 'NO TAG'} // {selectedAsset.serial_number || 'NO SN'}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Operating System</p>
                        <p className="text-xs font-black text-blue-400 uppercase">{selectedAsset.os_name} {selectedAsset.os_version}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Rack Placement</p>
                        <p className="text-xs font-black text-white uppercase">{selectedAsset.rack_name || 'UNPLACED'} // {selectedAsset.u_start ? `${selectedAsset.u_start}U` : '--'}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Resources & Components */}
            <div className="space-y-6">
               <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                  <HardDrive size={16} className="text-emerald-400" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Resource Registry ({selectedAsset.hardware_summary})</h3>
               </div>
               <div className="glass-panel rounded-2xl overflow-hidden border-white/5 bg-black/10">
                  <HWTable deviceId={selectedAsset.id} />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
               {/* Infrastructure Context */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                     <Layers size={16} className="text-blue-400" />
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Hosted Logical Services</h3>
                  </div>
                  <div className="glass-panel rounded-2xl overflow-hidden border-white/5 bg-black/10">
                     <AssetServicesTable 
                       deviceId={selectedAsset.id} 
                       onViewDetails={onViewServiceDetails} 
                       onEdit={onEditService} 
                     />
                  </div>
               </div>

               {/* Lifecycle & Logistics */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                     <Calendar size={16} className="text-rose-400" />
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Lifecycle & Logistics</h3>
                  </div>
                  <div className="bg-black/20 p-6 rounded-2xl border border-white/5 grid grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div>
                           <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Commissioning</p>
                           <p className="text-xs font-bold text-white uppercase">{selectedAsset.install_date ? new Date(selectedAsset.install_date).toLocaleDateString() : 'N/A'}</p>
                           <p className="text-[9px] font-black text-blue-400 mt-1 uppercase tracking-tighter italic">Engine Age: {selectedAsset.hardware_age}</p>
                        </div>
                        <div>
                           <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Warranty Term</p>
                           <p className="text-xs font-bold text-white uppercase">{selectedAsset.warranty_end ? new Date(selectedAsset.warranty_end).toLocaleDateString() : 'EXPIRED / NO TERM'}</p>
                        </div>
                     </div>
                     <div className="space-y-6 text-right">
                        <div>
                           <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Procurement</p>
                           <p className="text-xs font-bold text-white uppercase">{selectedAsset.purchase_date ? new Date(selectedAsset.purchase_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                           <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Retirement EOL</p>
                           <p className="text-xs font-bold text-rose-400 uppercase">{selectedAsset.eol_date ? new Date(selectedAsset.eol_date).toLocaleDateString() : 'ACTIVE REIGN'}</p>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5">
                     <div className="flex items-center space-x-3">
                        <Activity size={16} className="text-blue-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Power Payload (Avg/Max)</span>
                     </div>
                     <span className="text-xs font-mono text-white font-black">{selectedAsset.power_typical_w}W // {selectedAsset.power_max_w}W</span>
                  </div>
               </div>
            </div>

            {/* Relationships & Vectors */}
            <div className="space-y-6 pb-12">
               <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                  <LinkIcon size={16} className="text-indigo-400" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Dependency Vectors</h3>
               </div>
               <div className="glass-panel rounded-2xl overflow-hidden border-white/5 bg-black/10">
                  <RelationsTable deviceId={selectedAsset.id} />
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
            <div className="p-6 bg-white/5 rounded-full border border-white/10 opacity-20 animate-pulse">
               <FileText size={64} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] italic">Select Asset for Detailed Inspection</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AssetTemp() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'inventory' | 'deleted'>('inventory')
  const [viewMode, setViewMode] = useState<'grid' | 'report'>('grid')
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeModal, setActiveModal] = useState<any>(null)
  const [activeDetails, setActiveDetails] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false)
  const [isBulkEnvOpen, setIsBulkEnvOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'info' })

  // Shared Service Modal States (Moved from AssetDetailsView to top-level for screen-wide focus)
  const [activeServiceDetails, setActiveServiceDetails] = useState<any>(null)
  const [activeServiceEdit, setActiveServiceEdit] = useState<any>(null)
  const [activeNetworkEdit, setActiveNetworkEdit] = useState<any>(null)
  const { data: devices } = useQuery({ 
    queryKey: ["devices-list-all"], 
    queryFn: async () => (await (await apiFetch("/api/v1/devices/")).json()) 
  })

  const openConfirm = (title: string, message: string, onConfirm: () => void, variant: any = 'danger') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showBulkMenu && !target.closest('.bulk-menu-container')) {
        setShowBulkMenu(false)
      }
    }
    if (showBulkMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showBulkMenu])

  const { data: options } = useQuery({ queryKey: ['settings-options'], queryFn: async () => (await (await apiFetch('/api/v1/settings/options')).json()) })
  const { data: allAssets, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => (await (await apiFetch('/api/v1/devices/?include_deleted=true')).json())
  })

  const { inventoryAssets, deletedAssets } = useMemo(() => {
    if (!allAssets) return { inventoryAssets: [], deletedAssets: [] }
    return {
      inventoryAssets: allAssets.filter((a: any) => !a.is_deleted),
      deletedAssets: allAssets.filter((a: any) => a.is_deleted)
    }
  }, [allAssets])

  const assets = activeTab === 'inventory' ? inventoryAssets : deletedAssets

  const mutation = useMutation({
    mutationFn: async ({ data }: any) => {
      const url = data.id ? `/api/v1/devices/${data.id}` : `/api/v1/devices/`
      const method = data.id ? 'PUT' : 'POST'
      try {
        const res = await apiFetch(url, { method, body: JSON.stringify(data) })
        return res.json()
      } catch (e: any) {
        if (e.message.includes('409') || e.message.includes('DUPLICATE')) {
          throw new Error('DUPLICATE_HOSTNAME')
        }
        throw e
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      toast.success('System Registry Updated')
      setActiveModal(null)
    },
    onError: (e: any) => {
      if (e.message === 'DUPLICATE_HOSTNAME') toast.error('ERROR: Hostname already exists in registry')
      else toast.error(e.message)
    }
  })

  const bulkMutation = useMutation({
    mutationFn: async ({ action, payload = {}, ids: overrideIds }: any) => {
      const idsToUse = overrideIds ?? selectedIds
      const res = await apiFetch('/api/v1/devices/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ ids: idsToUse, action, payload })
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      setSelectedIds([])
      setShowBulkMenu(false)
      setIsBulkStatusOpen(false)
      if (variables.action === 'restore') {
        if (data.conflicts?.length > 0) {
            toast.error(`Restored ${data.restored.length} assets. ${data.conflicts.length} failed due to hostname conflict.`)
        } else {
            toast.success(`Restored ${data.restored.length} assets successfully.`)
        }
      } else {
        toast.success('Bulk Operation Complete')
      }
    },
    onError: (e: any) => toast.error(`Operation failed: ${e.message}`)
  })

  const columnDefs = useMemo(() => [
    { 
      field: "id", 
      headerName: "", 
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      checkboxSelection: true, 
      headerCheckboxSelection: true, 
      pinned: 'left', 
      cellClass: 'flex items-center justify-center pl-4 border-r border-white/5', 
      headerClass: 'flex items-center justify-center pl-4 border-r border-white/5', 
      suppressSizeToFit: true,
      resizable: false
    },
    { 
      field: "name", 
      headerName: "name", 
      pinned: 'left',
      minWidth: 120,
      flex: 1.5,
      cellClass: 'text-center',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter',
      cellRenderer: (p: any) => (
        <span className="font-bold text-blue-400">{p.value}</span>
      )
    },
    { field: "system", headerName: "System", minWidth: 100, flex: 1, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { 
      field: "type", 
      headerName: "Type", 
      width: 90,
      minWidth: 90,
      cellClass: 'text-center',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter',
      cellRenderer: (p: any) => {
        const colors: any = {
          Physical: 'text-emerald-400',
          Virtual: 'text-blue-400',
          Storage: 'text-amber-400',
          Switch: 'text-rose-400',
          Firewall: 'text-orange-400',
          'Load Balancer': 'text-purple-400'
        }
        return <span className={`font-black uppercase text-[9px] ${colors[p.value] || 'text-slate-500'}`}>{p.value}</span>
      }
    },
    { 
      field: "status", 
      headerName: "Status", 
      width: 100,
      minWidth: 100,
      cellClass: 'text-center',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter',
      cellRenderer: (p: any) => {
        const colors: any = {
          Active: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/20',
          Maintenance: 'text-amber-400 border-amber-500/40 bg-amber-500/20',
          Decommissioned: 'text-rose-400 border-rose-500/40 bg-rose-500/20',
          Planned: 'text-blue-400 border-blue-500/40 bg-blue-500/20',
          Standby: 'text-sky-400 border-sky-500/40 bg-sky-500/20',
          Offline: 'text-slate-400 border-white/20 bg-white/10'
        }
        return (
          <div className="flex items-center justify-center h-full">
            <div className={`flex items-center justify-center w-20 h-5 rounded-md border shadow-sm ${colors[p.value] || 'text-slate-400 border-white/10 bg-white/5'}`}>
              <span className="text-[7px] font-black uppercase tracking-tighter leading-none">
                {p.value}
              </span>
            </div>
          </div>
        )
      }
    },

    { field: "environment", headerName: "Env", width: 80, minWidth: 80, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "owner", headerName: "Owner", width: 90, minWidth: 90, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "manufacturer", headerName: "Make", width: 80, minWidth: 80, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "model", headerName: "Model", width: 90, minWidth: 90, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "os_name", headerName: "OS", width: 80, minWidth: 80, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "os_version", headerName: "Ver", width: 60, minWidth: 60, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { 
      field: "primary_ip", 
      headerName: "Primary IP", 
      width: 100,
      minWidth: 100,
      cellClass: 'text-center font-mono text-[9px] text-blue-400',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter'
    },
    { 
      field: "management_ip", 
      headerName: "Mgmt IP", 
      width: 100,
      minWidth: 100,
      cellClass: 'text-center font-mono text-[9px] text-indigo-400',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter'
    },
    { 
      field: "hardware_summary", 
      headerName: "Resources", 
      minWidth: 120,
      flex: 1,
      cellClass: 'text-center font-black uppercase text-[8px] text-slate-400',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter'
    },
    { 
      field: "hardware_age", 
      headerName: "Age", 
      width: 70,
      minWidth: 70,
      cellClass: 'text-center font-black text-[9px] text-slate-500',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter'
    },
    { 
      field: "open_incident_count", 
      headerName: "Health", 
      width: 60,
      minWidth: 60,
      cellClass: 'text-center',
      headerClass: 'text-center',
      cellRenderer: (p: any) => p.value > 0 ? (
        <div className="flex items-center justify-center h-full">
           <div className="flex items-center space-x-1 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md text-rose-500">
              <AlertCircle size={10} className="animate-pulse" />
              <span className="text-[9px] font-black">{p.value}</span>
           </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-emerald-500/30"><Check size={12}/></div>
      )
    },

    { field: "site_name", headerName: "Site", width: 90, minWidth: 90, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { field: "rack_name", headerName: "Rack", width: 90, minWidth: 90, cellClass: 'text-center', headerClass: 'text-center', filter: 'agTextColumnFilter' },
    { 
      field: "depth", 
      headerName: "Depth", 
      width: 70,
      minWidth: 70,
      cellClass: 'text-center',
      headerClass: 'text-center',
      filter: 'agTextColumnFilter',
      cellRenderer: (p: any) => <span className="font-black text-slate-500 uppercase text-[8px]">{p.value || 'Full'}</span>
    },
    { 
      field: "mount_orientation", 
      headerName: "Mount", 
      width: 80,
      minWidth: 80,
      cellClass: 'text-center', 
      headerClass: 'text-center', 
      filter: 'agTextColumnFilter',
      cellRenderer: (p: any) => p.value ? <span className="text-[8px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{p.value}</span> : <span className="text-slate-700 italic text-[7px]">registry</span>
    },
    { field: "u_start", headerName: "U Pos", width: 60, minWidth: 60, cellClass: "font-mono text-center", headerClass: 'text-center', filter: 'agNumberColumnFilter' },
    { field: "size_u", headerName: "Size", width: 60, minWidth: 60, cellClass: "font-mono text-center", headerClass: 'text-center', filter: 'agNumberColumnFilter' },
    { field: "power_typical_w", headerName: "Avg W", width: 70, minWidth: 70, cellClass: "font-mono text-center", headerClass: 'text-center', cellRenderer: (p: any) => p.value ? `${p.value.toFixed(0)}W` : '–' },
    { field: "power_max_w", headerName: "Max W", width: 70, minWidth: 70, cellClass: "font-mono text-center", headerClass: 'text-center', cellRenderer: (p: any) => p.value ? `${p.value.toFixed(0)}W` : '–' },
    {
      headerName: "Action",
      width: 120,
      minWidth: 120,
      pinned: 'right',
      cellClass: 'text-center',
      headerClass: 'text-center',
      resizable: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-center space-x-1 h-full">
           <div className="flex rounded-lg p-0.5 border border-white/5 bg-transparent">
               <button onClick={() => {
                 const ip = p.data.management_ip;
                 if (!ip) return toast.error("No Management IP configured");
                 window.open(`https://${ip}`, '_blank');
               }} title="Quick Console Access" className="p-1.5 text-indigo-400 hover:text-indigo-200 transition-all border-r border-white/5"><Terminal size={14}/></button>
               <button onClick={() => setActiveDetails(p.data)} title="View Details" className="p-1.5 text-blue-400 hover:text-blue-200 transition-all"><Eye size={14}/></button>
               <button onClick={() => setActiveModal(p.data)} title="Edit Configuration" className="p-1.5 text-emerald-400 hover:text-emerald-200 transition-all"><Edit2 size={14}/></button>
               {activeTab !== 'deleted' ? (
                 <button onClick={() => openConfirm('Soft Delete', 'Move this asset to deleted?', () => bulkMutation.mutate({ action: 'delete', ids: [p.data.id] }))} title="Soft Delete" className="p-1.5 text-rose-400 hover:text-rose-200 transition-all"><Trash2 size={14}/></button>
               ) : (
                 <button onClick={() => openConfirm('Purge Registry', 'PURGE PERMANENTLY?', () => bulkMutation.mutate({ action: 'purge', ids: [p.data.id] }))} title="Purge" className="p-1.5 text-rose-400 hover:text-rose-200 transition-all"><Trash2 size={14}/></button>
               )}
           </div>
        </div>
      )
    }
  ], [activeTab]) as any

  const autoSizeStrategy = useMemo(() => ({
    type: 'fitCellContents' as const
  }), []);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tight italic">Assets (Temp)</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Infrastructure Asset Registry - Experimental</p>
           </div>

           <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 ml-2">
                <button onClick={() => setViewMode('grid')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                    <LayoutGrid size={14}/> <span>Table</span>
                </button>
                <button onClick={() => setViewMode('report')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${viewMode === 'report' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                    <FileText size={14}/> <span>List</span>
                </button>
           </div>

           {viewMode === 'grid' && (
             <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                  <button onClick={() => { setActiveTab('inventory'); setSelectedIds([]) }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                      Existing
                  </button>
                  <button onClick={() => { setActiveTab('deleted'); setSelectedIds([]) }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'deleted' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                      Purged
                  </button>
             </div>
           )}
        </div>

        {viewMode === 'grid' && (
          <div className="flex items-center space-x-3">
            <div className="relative">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
               <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search assets..." className="bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50 w-64 transition-all" />
            </div>

            <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
               <button onClick={() => setShowConfig(true)} className="p-1.5 hover:bg-white/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all" title="Registry Config">
                  <Settings size={16} />
               </button>
            </div>

            <div className="relative bulk-menu-container">
              <button onClick={() => setShowBulkMenu(!showBulkMenu)} disabled={selectedIds.length === 0} className={`p-1.5 rounded-xl border transition-all ${selectedIds.length > 0 ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-slate-700 cursor-not-allowed'}`}><MoreVertical size={18}/></button>
              <AnimatePresence>
                {showBulkMenu && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                     <p className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">{selectedIds.length} Assets Selected</p>
                     {activeTab === 'deleted' ? (
                       <button onClick={() => bulkMutation.mutate({ action: 'restore' })} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-white/5 rounded-lg text-emerald-400 transition-all">Restore Selected</button>
                     ) : (
                       <>
                          <button onClick={() => { setIsBulkStatusOpen(true); setShowBulkMenu(false); }} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-white/5 rounded-lg text-blue-400 transition-all">Set Status...</button>
                          <button onClick={() => { setIsBulkEnvOpen(true); setShowBulkMenu(false); }} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-white/5 rounded-lg text-slate-400 transition-all">Set Environment...</button>
                       </>
                     )}
                     <div className="h-px bg-white/5 mx-2 my-1" />
                     <button onClick={() => { 
                         const title = activeTab === 'deleted' ? 'Purge Assets' : 'Soft Delete'
                         const msg = activeTab === 'deleted' ? 'PURGE PERMANENTLY?' : 'Soft-delete assets?'
                         openConfirm(title, msg, () => bulkMutation.mutate({ action: activeTab === 'deleted' ? 'purge' : 'delete' }))
                      }} className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-rose-500/20 rounded-lg text-rose-500 transition-all">{activeTab === 'deleted' ? 'Bulk Purge' : 'Bulk Delete'}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={() => setActiveModal({})} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">+ Add Asset</button>
          </div>
        )}
      </div>

      {viewMode === 'grid' ? (
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden ag-theme-alpine-dark relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-sm space-y-4 text-blue-400">
               <RefreshCcw size={32} className="animate-spin" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing asset registry...</p>
            </div>
          )}
          <AgGridReact 
            rowData={assets || []} 
            columnDefs={columnDefs} 
            rowSelection="multiple"
            headerHeight={28}
            rowHeight={28}
            onSelectionChanged={e => setSelectedIds(e.api.getSelectedNodes().map(n => n.data.id))}
            quickFilterText={searchTerm}
            autoSizeStrategy={autoSizeStrategy}
          />
        </div>
      ) : (
        <AssetReportView 
           assets={inventoryAssets} 
           selectedId={selectedAssetId} 
           onSelect={setSelectedAssetId} 
           options={options}
           onEdit={(a: any) => setActiveModal(a)}
           onViewServiceDetails={(s: any) => setActiveServiceDetails(s)}
           onEditService={(s: any) => setActiveServiceEdit(s)}
        />
      )}
      <StatusBulkUpdateModal
        isOpen={isBulkStatusOpen}
        onClose={() => setIsBulkStatusOpen(false)}
        onApply={(s) => bulkMutation.mutate({ action: 'update', payload: { status: s } })}
        options={options || []}
        count={selectedIds.length}
      />

      <BulkEnvUpdateModal
        isOpen={isBulkEnvOpen}
        onClose={() => setIsBulkEnvOpen(false)}
        onApply={(e) => bulkMutation.mutate({ action: 'update', payload: { environment: e } })}
        options={options || []}
        count={selectedIds.length}
      />

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-10">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-[950px] max-h-[90vh] overflow-y-auto p-10 rounded-[40px] border border-blue-500/30 custom-scrollbar">
               <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <h2 className="text-2xl font-black uppercase flex items-center space-x-4 text-blue-400">
                     <Package size={28}/> <span>{activeModal.id ? 'MODIFY ASSET CONFIGURATION' : 'New Asset Registration'}</span>
                  </h2>
                  <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>
               
               <AssetForm initialData={activeModal} onSave={mutation.mutate} options={options} isSaving={mutation.isPending} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-10">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-[900px] max-h-[85vh] overflow-hidden p-10 rounded-[40px] border border-blue-500/30 flex flex-col">
               <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-black uppercase text-blue-400">{activeDetails.name}</h2>
                    <div className="flex items-center space-x-3 mt-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{activeDetails.system} · {activeDetails.type}</p>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <p className="text-[10px] font-mono text-blue-400/80 uppercase tracking-widest" title="Primary IP">{activeDetails.primary_ip || 'NO PRIMARY IP'}</p>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <p className="text-[10px] font-mono text-indigo-400/80 uppercase tracking-widest" title="Management IP">{activeDetails.management_ip || 'NO MGMT IP'}</p>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AGE: {activeDetails.hardware_age}</p>
                                  </div>
                                  {activeDetails.role && (
                                    <p className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-widest mt-2 border-l-2 border-emerald-500/30 pl-3 italic">
                                      {activeDetails.role}
                                    </p>
                                  )}                  </div>
                  <button onClick={() => setActiveDetails(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar pt-6">
                 <AssetDetailsView
                   device={activeDetails}
                   options={options}
                   onViewServiceDetails={(s:any) => setActiveServiceDetails(s)}
                   onEditService={(s:any) => setActiveServiceEdit(s)}
                   onEditLink={(l:any) => setActiveNetworkEdit(l)}
                 />
               </div>               </motion.div>
               </div>
               )}
               </AnimatePresence>

               <SharedServiceModals 
               activeDetails={activeServiceDetails}
               setActiveDetails={setActiveServiceDetails}
               activeEdit={activeServiceEdit}
               setActiveEdit={setActiveServiceEdit}
               options={options}
               devices={devices}
               onServiceUpdate={() => {
               queryClient.invalidateQueries({ queryKey: ['device-services'] })
               }}
               />

               <SharedNetworkModals 
                 activeEdit={activeNetworkEdit}
                 setActiveEdit={setActiveNetworkEdit}
                 options={options}
                 devices={devices}
                 onUpdate={() => {
                   queryClient.invalidateQueries({ queryKey: ['device-interfaces'] })
                   queryClient.invalidateQueries({ queryKey: ['connections'] })
                 }}
               />
      <ConfigRegistryModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        title="Asset Registry Enumerations"
        sections={[
            { title: "Logical Systems", category: "LogicalSystem", icon: LayoutGrid },
            { title: "Device Types", category: "DeviceType", icon: Box },
            { title: "Business Units", category: "BusinessUnit", icon: Sliders },
            { title: "Manufacturers", category: "Manufacturer", icon: Cpu },
            { title: "Models", category: "Model", icon: Server },
            { title: "Owners / Admins", category: "Owner", icon: Database },
            { title: "Vendors", category: "Vendor", icon: Globe }
        ]}
      />

      <style>{`
        .ag-theme-alpine-dark {
          --ag-background-color: #1a1b26;
          --ag-header-background-color: #24283b;
          --ag-border-color: #292e42;
          --ag-foreground-color: #f1f5f9;
          --ag-header-foreground-color: #94a3b8;
          --ag-font-family: 'Inter', sans-serif;
          --ag-font-size: 10px;
        }
        .ag-root-wrapper { border: none !important; }
        .ag-header-cell-label { font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; font-size: 9px !important; justify-content: center !important; }
        .ag-cell { display: flex; align-items: center; justify-content: center !important; padding-left: 8px !important; }
        
        /* Make filter popups non-transparent and on top */
        .ag-popup { z-index: 1000 !important; }
        .ag-filter-wrapper { background-color: #24283b !important; border: 1px solid #414868 !important; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important; border-radius: 12px !important; opacity: 1 !important; }
        .ag-filter-body { background-color: #24283b !important; padding: 12px !important; }
        
        /* Action buttons hover effect */
        .ag-cell button { transition: transform 0.2s ease; }
        .ag-cell button:hover { transform: scale(1.2); }
      `}</style>
    </div>
  )
}

const MetadataTab = ({ device, onSave }: { device: any, onSave: (d: any) => void }) => {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [metadataError, setMetadataError] = useState<string | null>(null)
    const [localData, setLocalData] = useState({ ...device })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex space-x-1 bg-black/40 p-1 rounded-2xl w-fit">
                    <button onClick={() => setMode('view')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'view' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Read-Only View</button>
                    <button onClick={() => setMode('edit')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'edit' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Edit Metadata</button>
                </div>
                {mode === 'edit' && (
                    <button 
                        disabled={!!metadataError}
                        onClick={() => onSave(localData)} 
                        className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        Save Metadata
                    </button>
                )}
            </div>
            
            <div className="bg-black/20 rounded-[20px] p-2">
                {mode === 'view' ? (
                    <MetadataViewer data={localData.metadata_json} />
                ) : (
                    <MetadataEditor 
                        value={localData.metadata_json} 
                        onChange={v => setLocalData({...localData, metadata_json: v})} 
                        onError={setMetadataError}
                    />
                )}
            </div>
        </div>
    )
}

import { createPortal } from 'react-dom'

const SharedNetworkModals = ({
  activeEdit,
  setActiveEdit,
  options,
  devices,
  onUpdate
}: {
  activeEdit: any,
  setActiveEdit: (l: any) => void,
  options: any,
  devices: any,
  onUpdate: () => void
}) => {
  const queryClient = useQueryClient()
  const [connData, setConnData] = useState<any>({})

  useEffect(() => {
    if (activeEdit) {
      setConnData({
        ...activeEdit,
        device_a_id: activeEdit.source_device_id,
        device_b_id: activeEdit.target_device_id,
        port_a: activeEdit.source_port,
        port_b: activeEdit.target_port
      })
    }
  }, [activeEdit])

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch(`/api/v1/networks/connections/${activeEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      onUpdate()
      setActiveEdit(null)
      toast.success('Link Matrix Updated')
    },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <AnimatePresence>
      {activeEdit && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
            className="glass-panel w-[500px] p-10 rounded-[40px] space-y-6"
          >
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center space-x-4 text-blue-400">
               <LinkIcon size={24} />
               <span>Modify Connectivity</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="col-span-2">
                <StyledSelect
                  label="Source Entity *"
                  value={connData.device_a_id}
                  onChange={e => setConnData({...connData, device_a_id: e.target.value})}
                  options={devices?.map((d: any) => ({ value: String(d.id), label: `${d.name} [${d.type}]` })) || []}
                  placeholder="Select Registry Asset..."
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Source Port *</label>
                <input value={connData.source_port || connData.port_a || ''} onChange={e => setConnData({...connData, source_port: e.target.value, port_a: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" placeholder="eth0" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Src IP</label>
                  <input value={connData.source_ip || ''} onChange={e => setConnData({...connData, source_ip: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-blue-500" placeholder="10.0.1.10" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Src VLAN</label>
                  <input type="number" value={connData.source_vlan || ''} onChange={e => setConnData({...connData, source_vlan: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" placeholder="100" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Source MAC Address</label>
                <input value={connData.source_mac || ''} onChange={e => setConnData({...connData, source_mac: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-blue-500" placeholder="00:11:22:33:44:55" />
              </div>
              <StyledSelect
                  label="Direction"
                  value={connData.direction}
                  onChange={e => setConnData({...connData, direction: e.target.value})}
                  options={[{value: 'Bidirectional', label: 'Bidirectional'}, {value: 'Unidirectional', label: 'Unidirectional'}]}
              />
              <div className="col-span-2 border-t border-white/5 pt-4">
                <StyledSelect
                  label="Peer Entity *"
                  value={connData.device_b_id}
                  onChange={e => setConnData({...connData, device_b_id: e.target.value})}
                  options={devices?.filter((d:any) => d.id != connData.device_a_id).map((d: any) => ({ value: String(d.id), label: `${d.name} [${d.type}]` })) || []}
                  placeholder="Select Registry Asset..."
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Peer Port *</label>
                <input value={connData.target_port || connData.port_b || ''} onChange={e => setConnData({...connData, target_port: e.target.value, port_b: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" placeholder="Te1/1/1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Peer IP</label>
                  <input value={connData.target_ip || ''} onChange={e => setConnData({...connData, target_ip: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-blue-500" placeholder="10.0.1.254" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Peer VLAN</label>
                  <input type="number" value={connData.target_vlan || ''} onChange={e => setConnData({...connData, target_vlan: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" placeholder="100" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Peer MAC Address</label>
                <input value={connData.target_mac || ''} onChange={e => setConnData({...connData, target_mac: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-blue-500" placeholder="00:11:22:33:44:66" />
              </div>
              <StyledSelect
                  label="Link Type *"
                  value={connData.link_type}
                  onChange={e => setConnData({...connData, link_type: e.target.value})}
                  options={Array.isArray(options) && options.filter((o:any) => o.category === 'LinkPurpose').length > 0 
                      ? options.filter((o:any) => o.category === 'LinkPurpose').map((p:any) => ({ value: p.value, label: p.label }))
                      : ["Data", "Management", "Storage/iSCSI", "Backup", "vMotion", "Replication", "Heartbeat"].map(p => ({ value: p, label: p }))
                  }
              />
              <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Purpose / Description</label>
                <input value={connData.purpose || ''} onChange={e => setConnData({...connData, purpose: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" placeholder="e.g. Primary Data Uplink for Prod..." />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-1">Speed *</label>
                <input type="number" value={connData.speed_gbps} onChange={e => setConnData({...connData, speed_gbps: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
              </div>
              <StyledSelect
                  label="Unit"
                  value={connData.unit}
                  onChange={e => setConnData({...connData, unit: e.target.value})}
                  options={[{value: 'Gbps', label: 'Gbps'}, {value: 'Mbps', label: 'Mbps'}, {value: 'Tbps', label: 'Tbps'}]}
              />
            </div>
            <div className="flex space-x-3 pt-4 border-t border-white/5">
              <button onClick={() => setActiveEdit(null)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-500">Abort</button>
              <button onClick={() => {
                if(!connData.device_a_id || (!connData.source_port && !connData.port_a) || !connData.device_b_id || (!connData.target_port && !connData.port_b)) {
                  return toast.error("Entity and Port mapping required")
                }
                mutation.mutate(connData)
              }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Commit Changes</button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </AnimatePresence>
  )
}

const NetworkingTab = ({ deviceId, onEditLink }: { deviceId: number, onEditLink: (l: any) => void }) => {
  const queryClient = useQueryClient()
  const [selectedConnection, setSelectedConnection] = useState<any>(null)

  // Source all network info from the connections table (network view's source)
  const { data: allConnections, isLoading: isConnsLoading } = useQuery({ 
    queryKey: ['all-connections'], 
    queryFn: async () => (await (await apiFetch('/api/v1/networks/connections')).json()) 
  })

  const connections = useMemo(() => {
    if (!allConnections) return []
    return allConnections.filter((c: any) => c.source_device_id === deviceId || c.target_device_id === deviceId)
  }, [allConnections, deviceId])

  if (isConnsLoading) return <div className="py-20 text-center"><RefreshCcw className="animate-spin mx-auto text-blue-500 mb-4" /> <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Hydrating Fabric Data...</span></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-indigo-600 pl-3">Network Link Map (Sourced from Fabric)</h3>
      </div>
      <table className="w-full text-[10px]">
        <thead className="bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Local Port</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">IP Address</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">MAC / VLAN</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Speed</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Connection</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {connections?.map((c: any) => {
            const isSource = c.source_device_id === deviceId
            const localPort = isSource ? c.source_port : c.target_port
            const localIP = isSource ? c.source_ip : c.target_ip
            const localMAC = isSource ? c.source_mac : c.target_mac
            const localVLAN = isSource ? c.source_vlan : c.target_vlan
            const peerName = isSource ? c.server_b : c.server_a
            const peerPort = isSource ? c.target_port : c.source_port

            return (
              <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                <td className="px-4 py-3 font-bold text-blue-400 uppercase tracking-tight">{localPort}</td>
                <td className="px-4 py-3 font-mono text-slate-200">{localIP || <span className="text-slate-700 italic">Unassigned</span>}</td>
                <td className="px-4 py-3">
                   <div className="flex flex-col">
                      <span className="font-mono text-slate-500 text-[9px] uppercase">{localMAC || 'N/A'}</span>
                      {localVLAN && <span className="text-[8px] font-black text-indigo-400 uppercase mt-0.5">VLAN {localVLAN}</span>}
                   </div>
                </td>
                <td className="px-4 py-3 text-center">
                   <span className="text-slate-400 font-mono">{c.speed}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => setSelectedConnection(c)}
                    className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 mx-auto"
                  >
                    <Network size={10} /> {peerName} ({peerPort})
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <button onClick={() => onEditLink(c)} className="p-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-600/20 transition-all">
                      <Edit2 size={12}/>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
          {!connections?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600 font-bold uppercase italic">No active network links found in fabric</td></tr>}
        </tbody>
      </table>

      {selectedConnection && (
        <ConnectionForensicsModal
          isOpen={!!selectedConnection}
          onClose={() => setSelectedConnection(null)}
          connection={selectedConnection}
        />
      )}
    </div>
  )
}

const SecurityTab = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const [newRule, setNewRule] = useState({ 
    name: '', 
    risk: '', 
    source_type: 'Custom IP', 
    source_custom_ip: '', 
    dest_type: 'Device', 
    dest_device_id: deviceId, 
    protocol: 'TCP', 
    port_range: '', 
    direction: 'Inbound', 
    action: 'Allow' 
  })
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, id: null })

  const { data: rules, isLoading } = useQuery({ 
    queryKey: ['device-firewall', deviceId], 
    queryFn: async () => (await (await apiFetch(`/api/v1/security/firewall?device_id=${deviceId}`)).json()) 
  })

  const { data: interfaces } = useQuery({ 
    queryKey: ['device-interfaces', deviceId], 
    queryFn: async () => (await (await apiFetch(`/api/v1/devices/${deviceId}/interfaces`)).json()) 
  })

  const { data: selectedDevice } = useQuery({
    queryKey: ['device-detail', deviceId],
    queryFn: async () => (await (await apiFetch(`/api/v1/devices/${deviceId}`)).json())
  })

  const { data: devices } = useQuery({
    queryKey: ['devices-list-simple'],
    queryFn: async () => (await (await apiFetch('/api/v1/devices/')).json())
  })

  const availableIPs = useMemo(() => {
    const ips: any[] = []
    if (selectedDevice?.primary_ip) ips.push({ value: selectedDevice.primary_ip, label: `Primary: ${selectedDevice.primary_ip}` })
    if (selectedDevice?.management_ip) ips.push({ value: selectedDevice.management_ip, label: `Mgmt: ${selectedDevice.management_ip}` })
    
    // Add all interface IPs too
    interfaces?.forEach((i: any) => {
      const portIP = i.connection?.local_ip || i.ip_address
      if (portIP) {
        ips.push({ value: portIP, label: `Port ${i.name}: ${portIP}` })
      }
    })
    
    // De-duplicate by value if necessary, but keep the labels as they are technically independent entries
    return ips
  }, [selectedDevice, interfaces])

  const mutation = useMutation({    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/v1/security/firewall', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-firewall', deviceId] })
      setNewRule({ 
        name: '', risk: '', source_type: 'Custom IP', source_custom_ip: '', 
        dest_type: 'Device', dest_device_id: deviceId, dest_custom_ip: '', protocol: 'TCP', port_range: '', 
        direction: 'Inbound', action: 'Allow' 
      })
      toast.success('Firewall Exception Recorded')
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/security/firewall/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-firewall', deviceId] })
      setConfirmModal({ isOpen: false, id: null })
      toast.success('Security Policy Revoked')
    },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-[30px] border border-white/5 space-y-4">
        <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] mb-4">Request Firewall Exception</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">Rule Name</label>
            <input value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="e.g. DB Access for Client X" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
          </div>
          <div className="col-span-2">
            <label className="text-[9px] font-black text-rose-400 uppercase block mb-1 px-1">Risk / Impact if Missing</label>
            <input value={newRule.risk} onChange={e => setNewRule({...newRule, risk: e.target.value})} placeholder="e.g. Critical service outage for production grid" className="w-full bg-slate-900 border border-rose-500/20 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-rose-500" />
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 items-end">
          <div>
            <StyledSelect
              label="Protocol"
              value={newRule.protocol}
              onChange={e => setNewRule({...newRule, protocol: e.target.value})}
              options={[{value: 'TCP', label: 'TCP'}, {value: 'UDP', label: 'UDP'}, {value: 'ICMP', label: 'ICMP'}, {value: 'Any', label: 'Any'}]}
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">Port(s)</label>
            <input value={newRule.port_range} onChange={e => setNewRule({...newRule, port_range: e.target.value})} placeholder="e.g. 443, 1433" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
          </div>
          <div>
            <StyledSelect
              label="Destination IP *"
              value={newRule.dest_custom_ip || ''}
              onChange={e => setNewRule({...newRule, dest_custom_ip: e.target.value})}
              options={availableIPs}
              placeholder="Select Target IP..."
            />
          </div>
          <div className="col-span-1">
            <StyledSelect
              label="Source Type"
              value={newRule.source_type}
              onChange={e => setNewRule({...newRule, source_type: e.target.value})}
              options={[{value: 'Device', label: 'Device'}, {value: 'Custom IP', label: 'Custom IP/CIDR'}, {value: 'Description', label: 'Description'}]}
            />
          </div>
          <div className="col-span-1">
             {newRule.source_type === 'Device' ? (
                <StyledSelect
                  label="Source Device"
                  value={newRule.source_device_id || ''}
                  onChange={e => setNewRule({...newRule, source_device_id: parseInt(e.target.value)})}
                  options={devices?.map((d:any) => ({ value: String(d.id), label: d.name })) || []}
                />
             ) : (
                <>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">{newRule.source_type === 'Description' ? 'Source Description' : 'Source IP / CIDR'}</label>
                  <input value={newRule.source_custom_ip} onChange={e => setNewRule({...newRule, source_custom_ip: e.target.value})} placeholder={newRule.source_type === 'Description' ? 'e.g. External Cloud' : 'e.g. 10.0.0.1 or 0.0.0.0/0'} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
                </>
             )}
          </div>
        </div>
        
        <div className="flex justify-end pt-2">
          <button 
            onClick={() => { if(!newRule.name || !newRule.port_range) return toast.error("Name and Ports required"); mutation.mutate(newRule) }} 
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            Authorize Exception
          </button>
        </div>
      </div>

      <div className="p-0 overflow-hidden border border-white/5 rounded-2xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <RefreshCcw size={20} className="animate-spin mb-2" />
            <p className="text-[10px] font-black uppercase">Retrieving Security Policies...</p>
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">Rule Name</th>
                <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">Source</th>
                <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-slate-500">Destination</th>
                <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-slate-500">Protocol/Ports</th>
                <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-slate-500">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules?.map((r: any) => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-white uppercase">{r.name}</span>
                      <span className="text-[8px] text-rose-400 font-bold uppercase tracking-tight">{r.risk || 'Risk not assessed'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {r.source_type === 'Device' ? (
                      <span className="text-blue-400 font-bold">{r.source_device_name}</span>
                    ) : (r.source_custom_ip || 'ANY')}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    <div className="flex flex-col">
                      <span className="text-emerald-400 font-bold uppercase">{r.dest_device_name || 'THIS ASSET'}</span>
                      {r.dest_custom_ip && <span className="text-[9px] text-white opacity-60 italic">{r.dest_custom_ip}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-indigo-400 font-bold">
                      {r.protocol} // {r.port_range}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setConfirmModal({ isOpen: true, id: r.id })} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
              {!rules?.length && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-600 font-bold uppercase italic tracking-widest bg-black/5">No active firewall exceptions for this asset</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={() => deleteMutation.mutate(confirmModal.id)}
        title="Revoke Security Policy"
        message="Are you sure you want to revoke this firewall exception? This may cause immediate service disruption."
        variant="danger"
      />
    </div>
  )
}

const AssetDetailsView = ({ device, options, onViewServiceDetails, onEditService, onEditLink }: { device: any, options: any, onViewServiceDetails: (s:any)=>void, onEditService: (s:any)=>void, onEditLink: (l:any)=>void }) => {
    const [tab, setTab] = useState('hardware')
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiFetch(`/api/v1/devices/${device.id}`, {
                method: 'PUT', body: JSON.stringify(data)
            })
            if (!res.ok) throw new Error(await res.text())
            return res.json()
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices'] }); queryClient.invalidateQueries({ queryKey: ['racks-all'] }); toast.success('Asset synchronized') },
        onError: (e: any) => toast.error(e.message || 'Failed to update asset')
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex space-x-1 bg-black/40 p-1 rounded-2xl w-fit">
                    {['hardware', 'secrets', 'relations', 'services', 'network', 'security', 'metadata'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>
            <div className="glass-panel rounded-[30px] border-white/5 overflow-hidden p-6">
                {tab === 'metadata' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <MetadataTab device={device} onSave={(d:any) => mutation.mutate(d)} />
                  </div>
                )}
                {tab === 'hardware' && <HWTab deviceId={device.id} />}
                {tab === 'secrets' && <SecretsTab deviceId={device.id} />}
                {tab === 'relations' && <RelationshipsTab deviceId={device.id} />}
                {tab === 'services' && (
                  <AssetServicesTable 
                    deviceId={device.id} 
                    onViewDetails={onViewServiceDetails}
                    onEdit={onEditService}
                  />
                )}
                {tab === 'network' && <NetworkingTab deviceId={device.id} onEditLink={onEditLink} />}
                {tab === 'security' && <SecurityTab deviceId={device.id} />}
            </div>
        </div>
    )
}

const HWTab = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const [newComp, setNewComp] = useState({ category: 'CPU', name: '', manufacturer: '', specs: '', count: 1 })

  const mutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiFetch(`/api/v1/devices/${deviceId}/hardware`, { method: 'POST', body: JSON.stringify(d) })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-hw', deviceId] }); setNewComp({ category: 'CPU', name: '', manufacturer: '', specs: '', count: 1 }) }
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
         <select value={newComp.category} onChange={e => setNewComp({...newComp, category: e.target.value})} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] outline-none">
            <option>CPU</option><option>Memory</option><option>Card</option><option>Disk</option><option>NIC</option><option>PSU</option>
         </select>
         <input value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} placeholder="Component Name" className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] outline-none" />
         <input value={newComp.manufacturer} onChange={e => setNewComp({...newComp, manufacturer: e.target.value})} placeholder="Manufacturer" className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] outline-none" />
         <input value={newComp.specs} onChange={e => setNewComp({...newComp, specs: e.target.value})} placeholder="Specifications" className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] outline-none" />
         <input type="number" value={newComp.count} onChange={e => setNewComp({...newComp, count: parseInt(e.target.value)})} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] outline-none" />
         <button onClick={() => { if(!newComp.name) return toast.error("Name required"); mutation.mutate(newComp) }} className="bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase">Add</button>
      </div>
      <HWTable deviceId={deviceId} />
    </div>
  )
}

const HWTable = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const { data: hardware } = useQuery({ queryKey: ['device-hw', deviceId], queryFn: async () => (await (await apiFetch(`/api/v1/devices/${deviceId}/hardware`)).json()) })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  
  const delMutation = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/devices/hardware/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-hw', deviceId] }); toast.success('Component removed') },
    onError: (e: any) => toast.error(e.message || 'Failed to delete component')
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiFetch(`/api/v1/devices/hardware/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['device-hw', deviceId] })
        setEditingId(null)
        toast.success('Component Updated')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update component')
  })

  const catOptions = [
    { value: 'CPU', label: 'CPU' },
    { value: 'Memory', label: 'Memory' },
    { value: 'Card', label: 'Card' },
    { value: 'Disk', label: 'Disk' },
    { value: 'NIC', label: 'NIC' },
    { value: 'PSU', label: 'PSU' }
  ]

  return (
    <div className="p-0">
      <table className="w-full text-[10px]">
        <thead className="bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Category</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Component</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Specs</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Qty</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {hardware?.map((h: any) => (
            <tr key={h.id} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-2 text-center">
                {editingId === h.id ? (
                    <StyledSelect
                        value={editData.category}
                        onChange={e => setEditData({...editData, category: e.target.value})}
                        options={catOptions}
                        className="w-24 mx-auto"
                    />
                ) : (
                    <span className="text-[8px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">{h.category}</span>
                )}
              </td>
              <td className="px-4 py-2 font-bold text-slate-200 text-center">
                {editingId === h.id ? (
                    <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] w-full outline-none focus:border-blue-500" />
                ) : h.name}
              </td>
              <td className="px-4 py-2 text-slate-500 text-center">
                {editingId === h.id ? (
                    <input value={editData.specs} onChange={e => setEditData({...editData, specs: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] w-full outline-none focus:border-blue-500" />
                ) : h.specs}
              </td>
              <td className="px-4 py-2 font-mono text-center text-slate-400">
                {editingId === h.id ? (
                    <input type="number" value={editData.count} onChange={e => setEditData({...editData, count: parseInt(e.target.value)})} className="bg-slate-900 border border-white/10 rounded-xl px-1 py-1.5 text-[10px] w-12 outline-none focus:border-blue-500" />
                ) : `x${h.count}`}
              </td>
              <td className="px-4 py-2 text-center">
                {editingId === h.id ? (
                    <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => updateMutation.mutate(editData)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg"><Check size={14}/></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"><X size={14}/></button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => { setEditingId(h.id); setEditData({...h}); }} className="p-1.5 hover:bg-white/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all"><Edit2 size={14}/></button>
                        <button onClick={() => setConfirmModal({ isOpen: true, title: 'Purge Component', message: 'Purge this hardware component?', onConfirm: () => delMutation.mutate(h.id) })} className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition-all"><Trash2 size={14}/></button>
                    </div>
                )}
              </td>
            </tr>
          ))}
          {!hardware?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600 font-bold uppercase italic">No hardware mappings found</td></tr>}
        </tbody>
      </table>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({...confirmModal, isOpen: false})}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
      />
    </div>
  )
}

const SecretsTab = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const [newSec, setNewSec] = useState({ secret_type: 'Root Password', username: '', encrypted_payload: '', notes: '' })

  const mutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiFetch(`/api/v1/devices/${deviceId}/secrets`, { method: 'POST', body: JSON.stringify(d) })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-secrets', deviceId] }); setNewSec({ secret_type: 'Root Password', username: '', encrypted_payload: '', notes: '' }); toast.success('Credential added') }
  })

  const secOptions = [
    { value: 'Root Password', label: 'Root Password' },
    { value: 'Admin API Key', label: 'Admin API Key' },
    { value: 'Service Account', label: 'Service Account' },
    { value: 'SSH Key', label: 'SSH Key' },
    { value: 'ILO/IDRAC', label: 'ILO/IDRAC' }
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2 bg-white/5 p-3 rounded-xl border border-white/5 items-end">
         <div className="col-span-1">
           <StyledSelect
              value={newSec.secret_type}
              onChange={e => setNewSec({...newSec, secret_type: e.target.value})}
              options={secOptions}
              label="Secret Type"
           />
         </div>
         <div className="col-span-1">
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">Identity</label>
            <input value={newSec.username} onChange={e => setNewSec({...newSec, username: e.target.value})} placeholder="Identity / Username" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
         </div>
         <div className="col-span-1">
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">Sensitive Value</label>
            <input type="password" value={newSec.encrypted_payload} onChange={e => setNewSec({...newSec, encrypted_payload: e.target.value})} placeholder="Value" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
         </div>
         <div className="col-span-1">
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 px-1">Notes</label>
            <input value={newSec.notes} onChange={e => setNewSec({...newSec, notes: e.target.value})} placeholder="Purpose / Note" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
         </div>
         <button onClick={() => { if(!newSec.username || !newSec.encrypted_payload) return toast.error("Identity/Value required"); mutation.mutate(newSec) }} className="h-[38px] bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Add</button>
      </div>
      <SecretsTable deviceId={deviceId} />
    </div>
  )
}

const SecretsTable = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const { data: secrets } = useQuery({ queryKey: ['device-secrets', deviceId], queryFn: async () => (await (await apiFetch(`/api/v1/devices/${deviceId}/secrets`)).json()) })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [visibleIds, setVisibleIds] = useState<number[]>([])
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const toggleVisibility = (id: number) => {
    setVisibleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const delMutation = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/devices/secrets/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-secrets', deviceId] }); toast.success('Credential removed') },
    onError: (e: any) => toast.error(e.message || 'Failed to delete credential')
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiFetch(`/api/v1/devices/secrets/${data.id}`, {
        method: 'PUT', body: JSON.stringify(data)
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-secrets', deviceId] }); setEditingId(null); toast.success('Credential updated') },
    onError: (e: any) => toast.error(e.message || 'Failed to update credential')
  })

  const secOptions = [
    { value: 'Root Password', label: 'Root Password' },
    { value: 'Admin API Key', label: 'Admin API Key' },
    { value: 'Service Account', label: 'Service Account' },
    { value: 'SSH Key', label: 'SSH Key' },
    { value: 'ILO/IDRAC', label: 'ILO/IDRAC' }
  ]

  return (
    <div className="p-0">
      <table className="w-full text-[10px]">
        <thead className="bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Type</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Identity</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Payload</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Notes</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {secrets?.map((s: any) => (
            <tr key={s.id} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-2 font-black uppercase text-amber-500/80">
                {editingId === s.id ? (
                    <StyledSelect
                        value={editData.secret_type}
                        onChange={e => setEditData({...editData, secret_type: e.target.value})}
                        options={secOptions}
                        className="w-32"
                    />
                ) : s.secret_type}
              </td>
              <td className="px-4 py-2 font-bold text-slate-200">
                {editingId === s.id ? (
                    <input value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] w-full outline-none focus:border-blue-500" />
                ) : s.username}
              </td>
              <td className="px-4 py-2 font-mono text-slate-400">
                {editingId === s.id ? (
                    <input type="password" value={editData.encrypted_payload} onChange={e => setEditData({...editData, encrypted_payload: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] w-full outline-none focus:border-blue-500" placeholder="Update secret..." />
                ) : (
                    <div className="flex items-center space-x-3 group">
                       <span className={visibleIds.includes(s.id) ? 'text-blue-300' : 'text-slate-700'}>{visibleIds.includes(s.id) ? s.encrypted_payload : '••••••••••••'}</span>
                       <button onClick={() => toggleVisibility(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-blue-400">
                          {visibleIds.includes(s.id) ? <EyeOff size={14}/> : <Eye size={14}/>}
                       </button>
                    </div>
                )}
              </td>
              <td className="px-4 py-2 text-slate-500">
                {editingId === s.id ? (
                    <input value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1.5 text-[10px] w-full outline-none focus:border-blue-500" />
                ) : s.notes}
              </td>
              <td className="px-4 py-2 text-center">
                {editingId === s.id ? (
                    <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => updateMutation.mutate(editData)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg"><Check size={14}/></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"><X size={14}/></button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => { setEditingId(s.id); setEditData({...s}); }} className="p-1.5 hover:bg-white/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all"><Edit2 size={14}/></button>
                        <button onClick={() => setConfirmModal({ isOpen: true, title: 'Delete Credential', message: 'Remove this credential?', onConfirm: () => delMutation.mutate(s.id) })} className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition-all"><Trash2 size={14}/></button>
                    </div>
                )}
              </td>
            </tr>
          ))}
          {!secrets?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600 font-bold uppercase italic">No credentials stored</td></tr>}
        </tbody>
      </table>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({...confirmModal, isOpen: false})}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
      />
    </div>
  )
}

const RelationshipsTab = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: async () => (await (await apiFetch('/api/v1/devices/')).json()) })
  
  const types = useMemo(() => [
    { label: 'Depends On', s: 'Consumer', t: 'Provider' },
    { label: 'Hosts', s: 'Hypervisor', t: 'Guest' },
    { label: 'Backs Up', s: 'Source', t: 'Target' },
    { label: 'Replicates to', s: 'Primary', t: 'Replica' },
    { label: 'Cluster Member', s: 'Node', t: 'Peer' }
  ], [])

  const currentDevice = useMemo(() => devices?.find((d: any) => d.id === deviceId), [devices, deviceId]);

  const [newRel, setNewRel] = useState({ 
    target_device_id: '', 
    relationship_type: 'Depends On', 
    source_role: 'Consumer', 
    target_role: 'Provider' 
  })

  const mutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiFetch(`/api/v1/devices/${deviceId}/relationships`, {
        method: 'POST',
        body: JSON.stringify(d)
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['device-rel', deviceId] });
        toast.success('Relationship added')
    }
  })

  const syncRoles = (role: string, isSource: boolean) => {
    const pair = types.find(t => t.s === role || t.t === role);
    if (pair) {
        if (isSource) {
            const targetRole = role === pair.s ? pair.t : pair.s;
            setNewRel(prev => ({ ...prev, source_role: role, target_role: targetRole, relationship_type: pair.label }));
        } else {
            const sourceRole = role === pair.s ? pair.t : pair.s;
            setNewRel(prev => ({ ...prev, target_role: role, source_role: sourceRole, relationship_type: pair.label }));
        }
    }
  }

  const swapRoles = () => {
    setNewRel(prev => ({
        ...prev,
        source_role: prev.target_role,
        target_role: prev.source_role
    }));
  }

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    types.forEach(t => { roles.add(t.s); roles.add(t.t); });
    return Array.from(roles).map(r => ({ value: r, label: r }));
  }, [types]);

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-6 rounded-[30px] border border-white/5 space-y-6">
         <div className="grid grid-cols-11 gap-4 items-end">
            <div className="col-span-3">
               <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 px-1">Local Asset (A)</label>
               <div className="w-full bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-2.5 text-xs text-blue-400 font-black uppercase truncate">
                  {currentDevice?.name || 'Local'}
               </div>
            </div>

            <div className="col-span-2">
               <StyledSelect
                  label="Role (A)"
                  value={newRel.source_role}
                  onChange={e => syncRoles(e.target.value, true)}
                  options={allRoles}
               />
            </div>

            <div className="col-span-1 flex justify-center pb-2">
               <button 
                 onClick={swapRoles}
                 className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all group"
                 title="Swap Roles"
               >
                  <ArrowRightLeft size={16} className="group-active:rotate-180 transition-transform duration-300" />
               </button>
            </div>

            <div className="col-span-2">
               <StyledSelect
                  label="Role (B)"
                  value={newRel.target_role}
                  onChange={e => syncRoles(e.target.value, false)}
                  options={allRoles}
               />
            </div>

            <div className="col-span-3">
               <StyledSelect
                  value={newRel.target_device_id}
                  onChange={e => setNewRel({...newRel, target_device_id: e.target.value})}
                  options={devices?.filter((d:any)=> d.id !== deviceId).map((d:any)=>({ value: String(d.id), label: `${d.name} [${d.type}]` })) || []}
                  label="Peer Asset (B)"
                  placeholder="Select Peer..."
               />
            </div>
         </div>

         <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center space-x-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vector Classification:</span>
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{newRel.relationship_type}</span>
            </div>
            <button 
              onClick={() => { if(!newRel.target_device_id) return toast.error("Select peer asset"); mutation.mutate(newRel) }} 
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center space-x-2"
            >
               <Plus size={14} /> <span>Establish Vector</span>
            </button>
         </div>
      </div>
      <RelationsTable deviceId={deviceId} />
    </div>
  )
}

const RelationsTable = ({ deviceId }: { deviceId: number }) => {
  const queryClient = useQueryClient()
  const { data: relationships } = useQuery({ queryKey: ['device-rel', deviceId], queryFn: async () => (await (await apiFetch(`/api/v1/devices/${deviceId}/relationships`)).json()) })
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: async () => (await (await apiFetch('/api/v1/devices/')).json()) })
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>(null)

  const currentDevice = useMemo(() => devices?.find((d: any) => d.id === deviceId), [devices, deviceId]);

  const delMutation = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/devices/relationships/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-rel', deviceId] }); toast.success('Relationship removed') },
    onError: (e: any) => toast.error(e.message || 'Failed to delete relationship')
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiFetch(`/api/v1/devices/relationships/${data.id}`, {
        method: 'PUT', body: JSON.stringify(data)
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-rel', deviceId] }); setEditingId(null); toast.success('Relationship updated') },
    onError: (e: any) => toast.error(e.message || 'Failed to update relationship')
  })

  return (
    <div className="p-0">
      <table className="w-full text-[10px]">
        <thead className="bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Local Identity</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Relationship Type</th>
            <th className="px-4 py-2 text-left font-black uppercase tracking-widest text-slate-500">Peer Entity</th>
            <th className="px-4 py-2 text-center font-black uppercase tracking-widest text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {relationships?.map((r: any) => {
            const isSource = r.source_device_id === deviceId;
            const peerId = isSource ? r.target_device_id : r.source_device_id;
            const peer = devices?.find((d:any) => d.id === peerId);
            const localRole = isSource ? r.source_role : r.target_role;
            const peerRole = isSource ? r.target_role : r.source_role;

            return (
              <tr key={r.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                   {editingId === r.id ? (
                     <select value={isSource ? editData.source_role : editData.target_role} onChange={e => isSource ? setEditData({...editData, source_role: e.target.value}) : setEditData({...editData, target_role: e.target.value})} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] w-full outline-none focus:border-blue-500">
                       <option>Consumer</option>
                       <option>Provider</option>
                       <option>Hypervisor</option>
                       <option>Guest</option>
                       <option>Source</option>
                       <option>Target</option>
                       <option>Primary</option>
                       <option>Replica</option>
                       <option>Node</option>
                       <option>Peer</option>
                     </select>
                   ) : (
                     <div className="flex flex-col">
                        <span className="font-black text-white uppercase tracking-tight">{currentDevice?.name || 'Local'}</span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded w-fit mt-1 ${isSource ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                          {localRole}
                        </span>
                     </div>
                   )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingId === r.id ? (
                    <select value={editData.relationship_type} onChange={e => setEditData({...editData, relationship_type: e.target.value})} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] w-full outline-none focus:border-blue-500">
                      <option>Depends On</option>
                      <option>Hosts</option>
                      <option>Backs Up</option>
                      <option>Replicates to</option>
                      <option>Cluster Member</option>
                    </select>
                  ) : (
                    <div className="flex flex-col items-center">
                       <span className="font-black text-slate-500 uppercase tracking-widest text-[8px] mb-1">{r.relationship_type}</span>
                       <div className="flex items-center space-x-2 text-slate-600">
                          <div className="h-px w-8 bg-white/10" />
                          <ArrowRightLeft size={10} className={isSource ? "" : "rotate-180"} />
                          <div className="h-px w-8 bg-white/10" />
                       </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <select value={!isSource ? editData.source_role : editData.target_role} onChange={e => !isSource ? setEditData({...editData, source_role: e.target.value}) : setEditData({...editData, target_role: e.target.value})} className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-[10px] w-full outline-none focus:border-blue-500">
                        <option>Consumer</option>
                        <option>Provider</option>
                        <option>Hypervisor</option>
                        <option>Guest</option>
                        <option>Source</option>
                        <option>Target</option>
                        <option>Primary</option>
                        <option>Replica</option>
                        <option>Node</option>
                        <option>Peer</option>
                      </select>
                    ) : (
                      <div className="flex flex-col">
                         <span className="font-black text-blue-400 uppercase tracking-tight">{peer?.name || 'Unknown Entity'}</span>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded w-fit mt-1 ${!isSource ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                           {peerRole}
                         </span>
                      </div>
                    )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingId === r.id ? (
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => updateMutation.mutate(editData)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"><Check size={14}/></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-slate-500/20 text-slate-500 rounded-lg transition-all"><X size={14}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => { setEditingId(r.id); setEditData({...r}) }} className="p-1.5 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 rounded-lg transition-all"><Edit2 size={14}/></button>
                      <button onClick={() => setConfirmModal({ isOpen: true, title: 'Delete Relationship', message: 'Remove this relationship?', onConfirm: () => delMutation.mutate(r.id) })} className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition-all"><Trash2 size={14}/></button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
          {!relationships?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600 font-bold uppercase italic">No relationships defined</td></tr>}
        </tbody>
      </table>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({...confirmModal, isOpen: false})}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant="danger"
      />
    </div>
  )
}

const ASSET_TYPES = [
    { value: 'Physical', label: 'Physical' },
    { value: 'Virtual', label: 'Virtual' },
    { value: 'Storage', label: 'Storage' },
    { value: 'Switch', label: 'Switch' },
    { value: 'Firewall', label: 'Firewall' },
    { value: 'Load Balancer', label: 'Load Balancer' },
    { value: 'PDU', label: 'PDU' },
    { value: 'UPS', label: 'UPS' },
    { value: 'Patch Panel', label: 'Patch Panel' }
]

const STATUS_ITEMS = [
    { value: 'Planned', label: 'Planned' },
    { value: 'Active', label: 'Active' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Standby', label: 'Standby' },
    { value: 'Offline', label: 'Offline' },
    { value: 'Decommissioned', label: 'Decommissioned' }
]

const ENVIRONMENT_ITEMS = [
    { value: 'Production', label: 'Production' },
    { value: 'Staging', label: 'Staging' },
    { value: 'QA', label: 'QA' },
    { value: 'Dev', label: 'Dev' },
    { value: 'DR', label: 'DR' },
    { value: 'Lab', label: 'Lab' },
    { value: 'Sandbox', label: 'Sandbox' }
]

const AssetForm = ({ initialData, onSave, options, isSaving }: any) => {
  const [activeSubTab, setActiveSubTab] = useState('config')
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '', system: '', type: 'Physical', status: 'Active', environment: 'Production',
    owner: '', business_unit: '', manufacturer: '', model: '', serial_number: '', asset_tag: '',
    os_name: '', os_version: '', primary_ip: '', management_ip: '', management_url: '',
    purchase_date: '', install_date: '', warranty_end: '', eol_date: '',
    power_typical_w: 0, power_max_w: 0,
    metadata_json: {}, ...initialData
  })

  // Sync form data when initialData changes
  React.useEffect(() => {
    setFormData({
      name: '', system: '', type: 'Physical', status: 'Active', environment: 'Production',
      owner: '', business_unit: '', manufacturer: '', model: '', serial_number: '', asset_tag: '',
      os_name: '', os_version: '', primary_ip: '', management_ip: '', management_url: '',
      purchase_date: '', install_date: '', warranty_end: '', eol_date: '',
      power_typical_w: 0, power_max_w: 0,
      metadata_json: {}, ...initialData
    })
  }, [JSON.stringify(initialData)])

  const getOptions = (cat: string) => Array.isArray(options) ? options.filter((o: any) => o.category === cat) : []

  return (
    <div className="space-y-6 py-6">
      <div className="flex space-x-1 bg-black/40 p-1 rounded-2xl w-fit mb-4">
         {['config', 'hardware', 'secrets', 'relations', 'metadata'].map(t => {
           const isDisabled = !formData.id && ['hardware', 'secrets', 'relations'].includes(t)
           return (
           <button
             key={t}
             onClick={() => !isDisabled && setActiveSubTab(t)}
             disabled={isDisabled}
             title={isDisabled ? 'Save asset first' : ''}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${activeSubTab === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
             {t === 'config' ? 'Base Config' : t === 'relations' ? 'Relationships' : t}
           </button>
         )
         })}
      </div>

      {activeSubTab === 'config' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-blue-600 pl-3">Identity</h3>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Hostname</label>
                <input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className={`w-full bg-slate-900 border ${!formData.name ? 'border-rose-500/50' : 'border-white/10'} rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 transition-all`} 
                  placeholder="SRV-NAME-01" 
                />
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Asset Role / Description</label>
                <input 
                  value={formData.role || ''} 
                  onChange={e => setFormData({...formData, role: e.target.value})} 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 transition-all" 
                  placeholder="Primary ERP Database Node" 
                />
             </div>
             <StyledSelect
                label="Logical System"
                value={formData.system}
                onChange={e => setFormData({...formData, system: e.target.value})}
                options={getOptions('LogicalSystem')}
                placeholder="Select System..."
                error={!formData.system}
             />
             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Owner</label>
                    <input value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} placeholder="Owner" className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500/50" />
                </div>
                <StyledSelect
                    label="Business Unit"
                    value={formData.business_unit}
                    onChange={e => setFormData({...formData, business_unit: e.target.value})}
                    options={getOptions('BusinessUnit')}
                    placeholder="Select BU..."
                />
             </div>
          </div>

          <div className="col-span-1 space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-emerald-600 pl-3">Classification</h3>
             <div className="grid grid-cols-2 gap-2">
                <StyledSelect
                    label="Asset Type"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    options={ASSET_TYPES}
                />
                <StyledSelect
                    label="Physical Depth"
                    value={formData.depth || 'Full'}
                    onChange={e => setFormData({...formData, depth: e.target.value})}
                    options={[
                        { value: 'Full', label: 'Full Depth' },
                        { value: 'Half', label: 'Half Depth' }
                    ]}
                />
             </div>
             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Height (U)</label>
                    <input type="number" value={formData.size_u || 1} onChange={e => setFormData({...formData, size_u: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" />
                </div>
                <div />
             </div>
             <StyledSelect
                label="Operational Status"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                options={STATUS_ITEMS}
             />
             <StyledSelect
                label="Environment"
                value={formData.environment}
                onChange={e => setFormData({...formData, environment: e.target.value})}
                options={ENVIRONMENT_ITEMS}
             />
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-indigo-600 pl-3 mt-6">Management & Connectivity</h3>
             <div className="space-y-3">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Primary IP Address</label>
                    <input value={formData.primary_ip || ""} onChange={e => setFormData({...formData, primary_ip: e.target.value})} placeholder="e.g. 10.0.0.100" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-blue-500" />
                </div>
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Management IP Address</label>
                    <input value={formData.management_ip || ""} onChange={e => setFormData({...formData, management_ip: e.target.value})} placeholder="e.g. 10.0.0.50" className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:border-indigo-500" />
                </div>
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Management URL / Console</label>
                    <input value={formData.management_url || ""} onChange={e => setFormData({...formData, management_url: e.target.value})} placeholder="https://..." className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
             </div>

          </div>

          <div className="col-span-1 space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-amber-600 pl-3">Software & Hardware</h3>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Manufacturer & Model</label>
                <div className="flex space-x-2">
                   <input value={formData.manufacturer} onChange={e => setFormData({...formData, manufacturer: e.target.value})} placeholder="Dell" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                   <input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="R740" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                </div>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Operating System & Version</label>
                <div className="flex space-x-2">
                   <input value={formData.os_name} onChange={e => setFormData({...formData, os_name: e.target.value})} placeholder="Ubuntu" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                   <input value={formData.os_version} onChange={e => setFormData({...formData, os_version: e.target.value})} placeholder="24.04 LTS" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                </div>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Serial / Asset Tag</label>
                <div className="flex space-x-2">
                    <input value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="Serial" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                    <input value={formData.asset_tag} onChange={e => setFormData({...formData, asset_tag: e.target.value})} placeholder="Asset Tag" className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none" />
                </div>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Power Consumption (Watts)</label>
                <div className="flex space-x-2">
                    <div className="w-1/2">
                      <input type="number" min={0} step={0.1} value={formData.power_typical_w || 0} onChange={e => setFormData({...formData, power_typical_w: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none font-mono" />
                      <label className="text-[8px] text-slate-500 uppercase mt-0.5 block">Typical</label>
                    </div>
                    <div className="w-1/2">
                      <input type="number" min={0} step={0.1} value={formData.power_max_w || 0} onChange={e => setFormData({...formData, power_max_w: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none font-mono" />
                      <label className="text-[8px] text-slate-500 uppercase mt-0.5 block">Peak</label>
                    </div>
                </div>
             </div>
             <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-l-2 border-emerald-500 pl-3 mt-6">Lifecycle & Logistics</h3>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Purchase Date</label>
                    <input type="date" value={formData.purchase_date ? formData.purchase_date.split('T')[0] : ""} onChange={e => setFormData({...formData, purchase_date: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none" />
                </div>
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Installation Date</label>
                    <input type="date" value={formData.install_date ? formData.install_date.split('T')[0] : ""} onChange={e => setFormData({...formData, install_date: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none border-emerald-500/30" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Warranty End</label>
                    <input type="date" value={formData.warranty_end ? formData.warranty_end.split('T')[0] : ""} onChange={e => setFormData({...formData, warranty_end: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none border-amber-500/30" />
                </div>
                <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">EOL / Retirement</label>
                    <input type="date" value={formData.eol_date ? formData.eol_date.split('T')[0] : ""} onChange={e => setFormData({...formData, eol_date: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-[10px] outline-none border-rose-500/30" />
                </div>
             </div>
          </div>
        </div>
      )}

      {activeSubTab === 'metadata' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <MetadataEditor 
             value={formData.metadata_json} 
             onChange={v => setFormData({...formData, metadata_json: v})} 
             onError={setMetadataError}
           />
        </div>
      )}

      {activeSubTab === 'hardware' && (formData.id ? <HWTab deviceId={formData.id} /> : <div className="py-20 text-center text-slate-500 font-bold uppercase text-[10px]">Save the asset first to add hardware components</div>)}
      {activeSubTab === 'secrets' && (formData.id ? <SecretsTab deviceId={formData.id} /> : <div className="py-20 text-center text-slate-500 font-bold uppercase text-[10px]">Save the asset first to add credentials</div>)}
      {activeSubTab === 'relations' && (formData.id ? <RelationshipsTab deviceId={formData.id} /> : <div className="py-20 text-center text-slate-500 font-bold uppercase text-[10px]">Save the asset first to add relationships</div>)}

      <div className="flex space-x-4 pt-4 border-t border-white/5">
        <button
          disabled={!!metadataError || isSaving}
          onClick={() => {
            if(!formData.name || !formData.system) return toast.error("Hostname and Logical System are mandatory");
            onSave({ data: formData })
          }}
          className={`flex-1 py-4 ${metadataError || isSaving ? 'bg-slate-700 cursor-not-allowed' : 'bg-blue-600'} text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2`}
        >
          {isSaving && <RefreshCcw size={14} className="animate-spin" />}
          <span>Save Asset</span>
        </button>
      </div>
    </div>
  )
}
