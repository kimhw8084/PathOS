import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, X, Edit2 } from 'lucide-react'

interface ConnectionForensicsModalProps {
  isOpen: boolean
  onClose: () => void
  connection: any
  onEdit?: (connection: any) => void
}

export const ConnectionForensicsModal: React.FC<ConnectionForensicsModalProps> = ({ isOpen, onClose, connection, onEdit }) => {
  if (!connection) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-panel w-full max-w-[550px] p-10 rounded-[40px] border border-emerald-500/30 space-y-8 relative overflow-hidden"
          >
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center space-x-4 text-emerald-400">
                   <Network size={28} />
                   <span>Connection Forensics</span>
                </h2>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button 
                      onClick={() => onEdit(connection)} 
                      className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all border border-blue-500/20"
                      title="Edit Connection"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                  <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white rounded-xl transition-all border border-white/10">
                    <X size={20}/>
                  </button>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                   <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 text-[8px] font-black uppercase text-blue-500/30">SOURCE ENTITY</div>
                      <p className="text-xs font-black uppercase text-slate-500 mb-1">Entity Name</p>
                      <p className="text-lg font-black text-white truncate">{connection.server_a || connection.source_device_name}</p>
                      <div className="mt-4 space-y-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Port</span>
                            <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{connection.source_port}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">IP Address</span>
                            <span className="text-[10px] font-mono text-white">{connection.source_ip || '-'}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">MAC Address</span>
                            <span className="text-[10px] font-mono text-slate-400">{connection.source_mac || '-'}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">VLAN</span>
                            <span className="text-[10px] font-black text-indigo-400">{connection.source_vlan || '-'}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 text-[8px] font-black uppercase text-emerald-500/30">PEER ENTITY</div>
                      <p className="text-xs font-black uppercase text-slate-500 mb-1">Entity Name</p>
                      <p className="text-lg font-black text-white truncate">{connection.server_b || connection.target_device_name}</p>
                      <div className="mt-4 space-y-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Port</span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{connection.target_port}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">IP Address</span>
                            <span className="text-[10px] font-mono text-white">{connection.target_ip || '-'}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">MAC Address</span>
                            <span className="text-[10px] font-mono text-slate-400">{connection.target_mac || '-'}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">VLAN</span>
                            <span className="text-[10px] font-black text-indigo-400">{connection.target_vlan || '-'}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="col-span-2 p-6 bg-white/5 border border-white/5 rounded-[30px] space-y-4">
                   <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Fabric Speed</p>
                         <p className="text-sm font-black text-indigo-400">{connection.speed || connection.speed_gbps + ' Gbps' || '-'}</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Link Topology</p>
                         <p className="text-sm font-black text-white">{connection.link_type || '-'}</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Traffic Mode</p>
                         <p className="text-sm font-black text-amber-400">{connection.direction || '-'}</p>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Mission Purpose / Logic</p>
                      <p className="text-xs text-slate-300 italic">{connection.purpose || 'No description provided for this interconnect.'}</p>
                   </div>
                </div>
             </div>

             <button onClick={onClose} className="w-full py-4 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-500/10 active:scale-95">
                Dismiss Forensics
             </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
