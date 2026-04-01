import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, X, Check, Edit2, Layout, Database, RefreshCcw, Settings } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { apiFetch } from "../api/apiClient"

export const ConfigSection = ({ title, category, options, icon: Icon }: any) => {
  const queryClient = useQueryClient()
  const [newValue, setNewValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [editMetadata, setEditMetadata] = useState("")

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/settings/options", {
        method: "POST",
        body: JSON.stringify({ category, label: newValue, value: newValue, metadata_keys: [] })
      })
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["settings-options"] }); setNewValue(""); toast.success(`Added ${newValue}`) }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, value, metadata_keys }: any) => {
        const res = await apiFetch(`/api/v1/settings/options/${id}`, {
            method: "PUT",
            body: JSON.stringify({ label: value, value: value, metadata_keys: metadata_keys })
        })
        return res.json()
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ["settings-options"] }); 
        queryClient.invalidateQueries({ queryKey: ["logical-services"] });
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["connections"] });
        setEditingId(null); 
        toast.success("Option Updated") 
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
        const res = await apiFetch(`/api/v1/settings/options/${id}`, { method: "DELETE" })
        return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["settings-options"] }); toast.success("Option Removed") },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
         <div className="flex items-center space-x-2">
            <Icon size={14} className="text-blue-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white">{title}</h3>
         </div>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 min-h-[100px]">
        {options?.map((opt: any, index: number) => (
          <div key={opt.id} className="flex flex-col p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group">
            <div className="flex items-center justify-between">
                {editingId === opt.id ? (
                    <div className="flex items-center space-x-2 flex-1">
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-black/40 border border-blue-500/50 rounded px-2 py-1 text-[10px] outline-none" onKeyDown={e => e.key === 'Enter' && updateMutation.mutate({ id: opt.id, value: editValue, metadata_keys: editMetadata.split(',').map(s => s.trim()).filter(Boolean) })} />
                        <button onClick={() => updateMutation.mutate({ id: opt.id, value: editValue, metadata_keys: editMetadata.split(',').map(s => s.trim()).filter(Boolean) })} className="text-emerald-400"><Check size={14}/></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500"><X size={14}/></button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-black text-blue-500/40 bg-blue-500/5 w-4 h-4 flex items-center justify-center rounded-md border border-blue-500/10">{index + 1}</span>
                            <span className="text-[10px] font-bold text-slate-300">{opt.label}</span>
                        </div>
                        <div className="flex items-center space-x-1 transition-all">
                            <button onClick={() => { setEditingId(opt.id); setEditValue(opt.label); setEditMetadata(opt.metadata_keys?.join(', ') || ""); }} className="p-1 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 rounded transition-all">
                                <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteMutation.mutate(opt.id)} className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-all">
                                <Trash2 size={12} />
                            </button>
                        </div>                    </>
                )}
            </div>
            {category === 'ServiceType' && (
                <div className="mt-2 pl-6">
                    {editingId === opt.id ? (
                        <div className="space-y-1">
                            <label className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Default Metadata Keys (CSV)</label>
                            <input value={editMetadata} onChange={e => setEditMetadata(e.target.value)} placeholder="port, dbname, engine..." className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[9px] outline-none focus:border-blue-500/30" />
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {opt.metadata_keys?.map((k: string) => (
                                <span key={k} className="px-1.5 py-0.5 bg-blue-500/5 border border-blue-500/10 text-blue-400/60 rounded text-[7px] font-black uppercase tracking-tighter">{k}</span>
                            ))}
                            {(!opt.metadata_keys || opt.metadata_keys.length === 0) && <span className="text-[7px] text-slate-600 italic font-bold uppercase">No default keys</span>}
                        </div>
                    )}
                </div>
            )}
          </div>
        ))}
        {options?.length === 0 && <p className="text-[8px] font-bold text-slate-600 uppercase text-center py-8 italic">No entries</p>}
      </div>

      <div className="relative">
        <input 
          value={newValue} 
          onChange={e => setNewValue(e.target.value)} 
          placeholder={`Add ${title}...`} 
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-blue-500 transition-all uppercase font-bold pr-10"
          onKeyDown={e => e.key === 'Enter' && newValue && addMutation.mutate()}
        />
        <button onClick={() => newValue && addMutation.mutate()} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-400 hover:text-white transition-colors">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

export const ConfigRegistryModal = ({ isOpen, onClose, sections, title }: any) => {
    const { data: options } = useQuery({ queryKey: ["settings-options"], queryFn: async () => (await (await apiFetch("/api/v1/settings/options")).json()) })

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-10">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-panel w-[600px] max-h-[80vh] overflow-hidden p-10 rounded-[40px] border-blue-500/30 flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-6">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-400"><Layout size={20} /></div>
                                <div>
                                    <h2 className="text-xl font-black uppercase text-white tracking-tighter">{title || 'View Configuration'}</h2>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Global Registry Enumeration</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 gap-8">
                            {sections.map((s: any) => (
                                <ConfigSection 
                                    key={s.category} 
                                    title={s.title} 
                                    category={s.category} 
                                    icon={s.icon} 
                                    options={Array.isArray(options) ? options.filter((o:any) => o.category === s.category) : []} 
                                />
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
