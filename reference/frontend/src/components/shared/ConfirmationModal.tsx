import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Check, Trash2, HelpCircle } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'info' | 'warning' | 'success'
}

export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm Action', 
  cancelText = 'Cancel',
  variant = 'info'
}: ConfirmationModalProps) => {
  if (!isOpen) return null

  const getVariantIcon = () => {
    switch (variant) {
      case 'danger': return <Trash2 size={24} className="text-rose-500" />
      case 'warning': return <AlertTriangle size={24} className="text-amber-500" />
      case 'success': return <Check size={24} className="text-emerald-500" />
      default: return <HelpCircle size={24} className="text-blue-500" />
    }
  }

  const getVariantColor = () => {
    switch (variant) {
      case 'danger': return 'bg-rose-600 shadow-rose-500/20'
      case 'warning': return 'bg-amber-600 shadow-amber-500/20'
      case 'success': return 'bg-emerald-600 shadow-emerald-500/20'
      default: return 'bg-blue-600 shadow-blue-500/20'
    }
  }

  const getVariantBorder = () => {
    switch (variant) {
      case 'danger': return 'border-rose-500/30'
      case 'warning': return 'border-amber-500/30'
      case 'success': return 'border-emerald-500/30'
      default: return 'border-blue-500/30'
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.95, opacity: 0 }}
        className={`glass-panel w-[400px] p-10 rounded-[40px] border ${getVariantBorder()} space-y-6 relative overflow-hidden`}
      >
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/5 rounded-2xl">
            {getVariantIcon()}
          </div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-white">
            {title}
          </h2>
        </div>
        
        <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
          {message}
        </p>

        <div className="flex space-x-3 pt-4">
          <button 
            onClick={onClose} 
            className="flex-1 py-4 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-4 px-6 ${getVariantColor()} text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
