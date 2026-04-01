import React from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  id?: number | string
  value: string
  label: string
}

interface StyledSelectProps {
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: Option[]
  label?: string
  placeholder?: string
  className?: string
  error?: boolean
}

export const StyledSelect = ({ 
  value, 
  onChange, 
  options, 
  label, 
  placeholder, 
  className = '',
  error = false
}: StyledSelectProps) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="text-[9px] font-black text-slate-500 uppercase block tracking-widest px-1">
          {label}
        </label>
      )}
      <div className="relative group">
        <select 
          value={value} 
          onChange={onChange}
          className={`
            w-full appearance-none bg-slate-900 border 
            ${error ? 'border-rose-500/50' : 'border-white/10 group-hover:border-white/20'} 
            rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 
            transition-all cursor-pointer 
            ${!value ? 'text-slate-500 italic' : 'text-slate-200'}
          `}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.id || opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300 transition-colors">
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  )
}
