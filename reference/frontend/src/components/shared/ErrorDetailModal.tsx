import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, Terminal, Copy, Bug } from 'lucide-react'
import toast from 'react-hot-toast'

interface ErrorDetailModalProps {
  isOpen: boolean
  onClose: () => void
  error: any
}

export const ErrorDetailModal = ({ isOpen, onClose, error }: ErrorDetailModalProps) => {
  if (!isOpen || !error) return null

  const copyToClipboard = () => {
    const text = `Error: ${error.message}\n\nTraceback:\n${error.traceback || 'No traceback available'}\n\nData:\n${JSON.stringify(error.data || {}, null, 2)}`
    navigator.clipboard.writeText(text)
    toast.success('Traceback copied to clipboard')
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-8 rounded-[40px] border-rose-500/30"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500">
              <Bug size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tighter">System Fault Exception</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Advanced Debugging Interface</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={copyToClipboard}
              className="p-3 hover:bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-colors"
              title="Copy Full Error Context"
            >
              <Copy size={20} />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6">
            <div className="flex items-center space-x-2 text-rose-400 mb-2">
              <AlertCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Exception Message</span>
            </div>
            <p className="text-sm font-bold text-white leading-relaxed">{error.message || 'Unknown error'}</p>
            {error.status && <p className="text-[10px] font-mono text-rose-500/70 mt-2">HTTP Status Code: {error.status}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-blue-400">
              <Terminal size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Server-Side Traceback</span>
            </div>
            <div className="bg-black/60 rounded-2xl p-6 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto border border-white/5 whitespace-pre">
              {error.traceback || 'No server-side traceback captured for this exception type.'}
            </div>
          </div>

          {error.data && Object.keys(error.data).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Bug size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Raw Response Data</span>
              </div>
              <pre className="bg-black/40 rounded-2xl p-6 font-mono text-[11px] text-slate-400 border border-white/5 overflow-x-auto">
                {JSON.stringify(error.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex justify-center">
           <p className="text-[9px] font-bold text-slate-600 uppercase italic tracking-[0.2em]">End of Debug Stack · SysGrid Orchestration Engine</p>
        </div>
      </motion.div>
    </div>
  )
}
