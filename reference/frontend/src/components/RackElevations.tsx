import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Zap, Trash2, Edit2, Search, MapPin, X, ArrowRightLeft, Server,
  Monitor, AlertTriangle, Check, MoreVertical, RefreshCcw,
  Package, BarChart3, ExternalLink,
  Network, HardDrive, TrendingUp, Layers
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { apiFetch } from '../api/apiClient'
import { ConfirmationModal } from './shared/ConfirmationModal'
import { StyledSelect } from './shared/StyledSelect'

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; dot: string; badge: string }> = {
  Active:        { color: 'text-emerald-400', dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  Maintenance:   { color: 'text-amber-400',   dot: 'bg-amber-400',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  Decommissioned:{ color: 'text-rose-400',    dot: 'bg-rose-400',    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
  Offline:       { color: 'text-slate-400',   dot: 'bg-slate-500',   badge: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
  Standby:       { color: 'text-sky-400',     dot: 'bg-sky-400',     badge: 'bg-sky-500/15 text-sky-400 border-sky-500/25' },
}

const TYPE_CONFIG: Record<string, { color: string; short: string }> = {
  physical: { color: 'text-violet-400', short: 'PHY' },
  virtual:  { color: 'text-blue-400',   short: 'VM'  },
  storage:  { color: 'text-amber-400',  short: 'STO' },
  switch:   { color: 'text-rose-400',   short: 'NET' },
  server:   { color: 'text-emerald-400',short: 'SRV' },
}

const getStatusCfg = (s: string) => STATUS_CONFIG[s] ?? STATUS_CONFIG['Offline']
const getTypeCfg = (t: string) => TYPE_CONFIG[t?.toLowerCase()] ?? { color: 'text-slate-400', short: t?.slice(0,3).toUpperCase() || 'UNK' }

const fillColor = (pct: number) => {
  if (pct >= 90) return 'bg-rose-500'
  if (pct >= 70) return 'bg-amber-500'
  if (pct >= 50) return 'bg-blue-500'
  return 'bg-emerald-500'
}

const powerColor = (pct: number) => {
  if (pct >= 90) return 'bg-rose-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-sky-400'
}

// ─── Rack Unit Row ─────────────────────────────────────────────────────────────

interface RackUnitProps {
  uNumber: number
  loc?: any
  isTop?: boolean
  isBottom?: boolean
  highlight: boolean
  onSelect: () => void
  onManage: (device: any, loc: any) => void
  isDeleted: boolean
}

const RackUnit = ({ uNumber, loc, isTop, isBottom, highlight, onSelect, onManage, isDeleted }: RackUnitProps) => {
  const device = loc?.device
  const statusCfg = device ? getStatusCfg(device.status) : null
  const typeCfg = device ? getTypeCfg(device.type) : null

  const bgBase = device
    ? highlight
      ? 'bg-amber-500/30'
      : device.status === 'Maintenance'
        ? 'bg-amber-500/15'
        : device.status === 'Decommissioned'
          ? 'bg-rose-500/15'
          : 'bg-blue-600/30'
    : 'hover:bg-white/[0.04]'

  const borderClass = device
    ? `${isTop ? 'border-t border-white/10' : ''} ${isBottom ? 'border-b border-black/40' : 'border-b border-white/[0.03]'}`
    : 'border-b border-white/[0.06]'

  const roundedClass = device
    ? `${isTop ? 'rounded-t-md' : ''} ${isBottom ? 'rounded-b-md' : ''}`
    : ''

  return (
    <div
      onClick={() => device ? (!isDeleted && onManage(device, loc)) : (!isDeleted && onSelect())}
      className={`relative flex items-center px-2 transition-all cursor-pointer group ${bgBase} ${borderClass} ${roundedClass} ${device ? 'mx-[1px] bg-gradient-to-b from-white/[0.05] to-transparent' : ''}`}
      style={{ height: '22px' }}
    >
      <span className={`text-[8px] font-mono w-5 select-none shrink-0 transition-colors tabular-nums ${device ? 'text-slate-400 font-bold' : 'text-slate-600 group-hover:text-slate-400'}`}>
        {uNumber}
      </span>

      {isBottom && device && (
        <div className="flex-1 flex items-center justify-between overflow-hidden gap-1 pl-1">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className={`shrink-0 ${statusCfg?.dot} w-1.5 h-1.5 rounded-full`} />
            <span className={`text-[9px] font-black truncate uppercase tracking-tight ${highlight ? 'text-white' : 'text-slate-100'}`}>
              {device.name}
            </span>
            {device.system && (
              <span className="text-[8px] text-slate-500 truncate">{device.system}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {loc?.size_u > 1 && (
              <span className="text-[7px] text-slate-600 font-mono">{loc.size_u}U</span>
            )}
            <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded border ${typeCfg?.color} border-current/20 bg-current/5`}>
              {typeCfg?.short}
            </span>
          </div>
        </div>
      )}

      {!device && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center pl-8 pointer-events-none">
          <Plus size={8} className="text-blue-500/70 mr-1" />
          <span className="text-[7px] text-blue-500/60 font-bold uppercase tracking-widest">Mount</span>
        </div>
      )}
    </div>
  )
}

// ─── Power / Fill Mini Bar ─────────────────────────────────────────────────────

const MiniBar = ({ value, max, colorFn, label, unit }: { value: number; max: number; colorFn: (p: number) => string; label: string; unit: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
        <span className="text-[8px] font-black text-slate-300 tabular-nums">{value.toFixed(1)}<span className="text-slate-500 font-normal">/{max}{unit}</span></span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorFn(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Rack Elevation Card ───────────────────────────────────────────────────────

interface RackElevationProps {
  rack: any
  onDelete: (id: number) => void
  onEdit: (rack: any) => void
  onMove?: (dir: 'left' | 'right') => void
  searchTerm: string
  onMount: (rackId: number, u: number) => void
  onManageDevice: (device: any, loc: any, rack: any) => void
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onRestore?: (id: number) => void
  isDeleted: boolean
  viewMode: 'normal' | 'compact'
}

const RackElevation = ({
  rack, onDelete, onEdit, onMove, searchTerm, onMount, onManageDevice,
  isSelected, onToggleSelect, onRestore, isDeleted, viewMode
}: RackElevationProps) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const totalU = rack.total_u || 42
  const units = Array.from({ length: totalU }, (_, i) => totalU - i)

  const occupiedU = useMemo(() =>
    (rack.device_locations || []).reduce((acc: number, l: any) => acc + (l.size_u || 1), 0),
  [rack.device_locations])

  const fillPct = Math.round((occupiedU / totalU) * 100)

  const estimatedPowerKw = useMemo(() =>
    (rack.device_locations || []).reduce((acc: number, l: any) => acc + ((l.device?.power_typical_w || 0) / 1000), 0),
  [rack.device_locations])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of rack.device_locations || []) {
      const s = l.device?.status || 'Unknown'
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [rack.device_locations])

  const isHighlighted = (device: any) =>
    !!searchTerm && device?.name?.toLowerCase().includes(searchTerm.toLowerCase())

  return (
    <div className={`glass-panel flex-shrink-0 rounded-2xl overflow-hidden flex flex-col border transition-all group relative
      ${isSelected ? 'border-blue-500/60 shadow-blue-500/15 shadow-2xl bg-blue-900/[0.07]' : 'border-white/[0.07] hover:border-white/20'}
      ${isDeleted ? 'opacity-60 grayscale-[0.4]' : ''}
      ${viewMode === 'compact' ? 'w-52' : 'w-64'}
    `}>

      {/* Checkbox */}
      <div className="absolute top-3 left-3 z-20" onClick={e => e.stopPropagation()}>
        <div
          onClick={() => onToggleSelect(rack.id)}
          className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer border transition-all ${
            isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/50' : 'border-white/20 bg-black/30 hover:border-blue-400'
          }`}
        >
          {isSelected && <Check size={10} strokeWidth={3.5} />}
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-3 bg-white/[0.03] border-b border-white/[0.06] space-y-2.5">
        <div className="flex items-start justify-between ml-6 gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-[11px] uppercase tracking-widest text-white truncate leading-tight">{rack.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={9} className="text-slate-600 shrink-0" />
              <span className="text-[8px] text-slate-500 font-bold uppercase truncate">{rack.site_name || 'Unassigned'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isDeleted ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRestore?.(rack.id)}
                  className="px-2 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-emerald-500/25 transition-all flex items-center gap-1"
                >
                  <RefreshCcw size={9} /> Restore
                </button>
                <button
                  onClick={() => onDelete(rack.id)}
                  className="p-1 hover:bg-rose-500/10 rounded text-rose-500 transition-colors"
                  title="Permanent Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={13} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute right-0 top-8 w-36 bg-slate-950/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl z-[70] overflow-hidden p-1"
                      >
                        {onMove && (<>
                          <button onClick={() => { onMove('left'); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                            <ArrowRightLeft size={9} className="scale-x-[-1]" /> Move Left
                          </button>
                          <button onClick={() => { onMove('right'); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                            <ArrowRightLeft size={9} /> Move Right
                          </button>
                          <div className="h-px bg-white/5 my-1" />
                        </>)}
                        <button onClick={() => { onEdit(rack); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg flex items-center gap-2 transition-colors">
                          <Edit2 size={9} /> Edit Rack
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button onClick={() => { onDelete(rack.id); setMenuOpen(false) }} className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 transition-colors">
                          <Trash2 size={9} /> Decommission
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Capacity bars */}
        <div className="space-y-1.5">
          <MiniBar value={occupiedU} max={totalU} colorFn={fillColor} label="Fill" unit="U" />
          <MiniBar value={estimatedPowerKw} max={rack.max_power_kw || 10} colorFn={powerColor} label="Power" unit="kW" />
        </div>

        {/* KPI pills */}
        <div className="flex flex-wrap gap-1">
          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5 tabular-nums">
            {totalU}U
          </span>
          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md border tabular-nums ${
            fillPct >= 90 ? 'bg-rose-500/15 text-rose-400 border-rose-500/25' :
            fillPct >= 70 ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
            'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          }`}>
            {fillPct}% fill
          </span>
          {Object.entries(statusCounts).map(([s, n]) => (
            <span key={s} className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md border ${getStatusCfg(s).badge} tabular-nums`}>
              {n} {s.slice(0,3)}
            </span>
          ))}
          {isDeleted && (
            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/25">Purged</span>
          )}
        </div>
      </div>

      {/* Elevation grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: `${22 * Math.min(totalU, 48) + 8}px` }}>
        <div className="bg-black/30 mx-2 my-2 border border-white/[0.05] rounded-lg overflow-hidden">
          {units.map(u => {
            const loc = rack.device_locations?.find((l: any) => u >= l.start_unit && u < l.start_unit + l.size_u)
            return (
              <RackUnit
                key={u}
                uNumber={u}
                loc={loc}
                isTop={loc ? u === loc.start_unit + loc.size_u - 1 : false}
                isBottom={loc ? u === loc.start_unit : false}
                highlight={loc?.device ? isHighlighted(loc.device) : false}
                onSelect={() => onMount(rack.id, u)}
                onManage={(device, l) => onManageDevice(device, l, rack)}
                isDeleted={isDeleted}
              />
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white/[0.02] border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[7px] text-slate-600 font-bold uppercase tracking-wider">{(rack.device_locations || []).length} assets</span>
        <span className="text-[7px] text-slate-600 font-mono">{totalU - occupiedU}U free</span>
      </div>
    </div>
  )
}

// ─── Site Capacity Summary Bar ─────────────────────────────────────────────────

const SiteCapacityBar = ({ racks }: { racks: any[] }) => {
  const totalU = racks.reduce((a: number, r: any) => a + (r.total_u || 42), 0)
  const usedU = racks.reduce((a: number, r: any) => a + (r.device_locations || []).reduce((b: number, l: any) => b + (l.size_u || 1), 0), 0)
  const totalDevices = racks.reduce((a: number, r: any) => a + (r.device_locations || []).length, 0)
  const fillPct = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0
  const estimatedPowerKw = racks.reduce((a: number, r: any) =>
    a + (r.device_locations || []).reduce((b: number, l: any) => b + ((l.device?.power_typical_w || 0) / 1000), 0), 0)
  const totalPowerCapKw = racks.reduce((a: number, r: any) => a + (r.max_power_kw || 10), 0)

  const stats = [
    { label: 'Racks',     value: String(racks.length),                icon: <Server size={12}/>,      color: 'text-blue-400' },
    { label: 'Assets',    value: String(totalDevices),                 icon: <Package size={12}/>,     color: 'text-violet-400' },
    { label: 'Fill',      value: `${fillPct}%`,                        icon: <BarChart3 size={12}/>,   color: fillPct >= 90 ? 'text-rose-400' : fillPct >= 70 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'Power Est.',value: `${estimatedPowerKw.toFixed(1)}kW`,   icon: <Zap size={12}/>,         color: 'text-sky-400' },
    { label: 'Capacity',  value: `${totalPowerCapKw.toFixed(0)}kW`,    icon: <TrendingUp size={12}/>,  color: 'text-slate-400' },
  ]

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <div className="h-5 w-px bg-white/10" />}
          <div className="flex items-center gap-1.5">
            <span className={`${s.color} opacity-70`}>{s.icon}</span>
            <div>
              <div className={`text-[11px] font-black tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[7px] text-slate-600 uppercase font-bold tracking-wider">{s.label}</div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Floating Bulk Toolbar ─────────────────────────────────────────────────────

const BulkToolbar = ({ count, onDelete, onRelocate, onCompare, onClear, isDeleted, onRestore }:
  { count: number; onDelete: () => void; onRelocate: () => void; onCompare: () => void; onClear: () => void; isDeleted: boolean; onRestore: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 16 }}
    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-3 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl"
  >
    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mr-2">{count} selected</span>
    <div className="h-4 w-px bg-white/10" />
    {isDeleted ? (
      <>
        <button onClick={onRestore} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-500/25 transition-all">
          <RefreshCcw size={11} /> Restore
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-rose-500/25 transition-all">
          <Trash2 size={11} /> Purge
        </button>
      </>
    ) : (<>
      <button onClick={onCompare} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-blue-500/25 transition-all">
        <Server size={11} /> Compare
      </button>
      <button onClick={onRelocate} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-violet-500/25 transition-all">
        <ArrowRightLeft size={11} /> Relocate
      </button>
      <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-rose-500/25 transition-all">
        <Trash2 size={11} /> Decommission
      </button>
    </>)}
    <div className="h-4 w-px bg-white/10" />
    <button onClick={onClear} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
      <X size={13} />
    </button>
  </motion.div>
)

// ─── Device Detail Modal ───────────────────────────────────────────────────────

const DeviceDetailModal = ({ device, loc, rack, onClose, onUnmount, onUpdateMount, onUpdateDevice }:
  { device: any; loc: any; rack: any; onClose: () => void; onUnmount: (id: number) => void; onUpdateMount: (data: any) => void; onUpdateDevice?: (data: any) => void }) => {
  const [newSizeU, setNewSizeU] = useState(loc?.size_u || device?.size_u || 1)
  const [powerTypicalW, setPowerTypicalW] = useState(device?.power_typical_w || 0)
  const [powerMaxW, setPowerMaxW] = useState(device?.power_max_w || 0)
  const [confirmUnmount, setConfirmUnmount] = useState(false)

  const statusCfg = getStatusCfg(device?.status)
  const typeCfg = getTypeCfg(device?.type)

  const infoRows = [
    { label: 'System',        value: device?.system },
    { label: 'Environment',   value: device?.environment },
    { label: 'Owner',         value: device?.owner },
    { label: 'Business Unit', value: device?.business_unit },
    { label: 'Manufacturer',  value: device?.manufacturer },
    { label: 'Model',         value: device?.model },
    { label: 'OS',            value: device?.os_name ? `${device.os_name} ${device.os_version || ''}`.trim() : null },
    { label: 'Mgmt IP',       value: device?.management_ip },
    { label: 'Serial',        value: device?.serial_number },
    { label: 'Asset Tag',     value: device?.asset_tag },
    { label: 'Rack',          value: rack?.name },
    { label: 'Position',      value: loc ? `U${loc.start_unit} – U${loc.start_unit + loc.size_u - 1}` : null },
  ].filter(r => r.value)

  const warrantyDate = device?.warranty_end ? new Date(device.warranty_end) : null
  const warrantyExpired = warrantyDate && warrantyDate < new Date()
  const eolDate = device?.eol_date ? new Date(device.eol_date) : null
  const eolExpired = eolDate && eolDate < new Date()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="glass-panel w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white/[0.03] border-b border-white/[0.07] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 ${typeCfg.color}`}>
              <Monitor size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black uppercase tracking-tight text-white truncate">{device?.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${statusCfg.color}`}>{device?.status}</span>
                <span className="text-slate-700">·</span>
                <span className={`text-[9px] font-bold uppercase ${typeCfg.color}`}>{device?.type}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Warranty / EOL alerts */}
        {(warrantyExpired || eolExpired) && (
          <div className="px-6 py-3 bg-amber-500/[0.07] border-b border-amber-500/20 flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
              {warrantyExpired && 'Warranty Expired'}{warrantyExpired && eolExpired && ' · '}{eolExpired && 'End of Life Reached'}
            </span>
          </div>
        )}

        {/* Info grid */}
        <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 max-h-56 overflow-y-auto custom-scrollbar">
          {infoRows.map(row => (
            <div key={row.label}>
              <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{row.label}</p>
              <p className="text-[10px] font-bold text-slate-200 mt-0.5 truncate">{row.value}</p>
            </div>
          ))}
          {device?.management_url && (
            <div className="col-span-2">
              <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Management URL</p>
              <a href={device.management_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 mt-0.5 flex items-center gap-1 truncate transition-colors">
                {device.management_url} <ExternalLink size={9} className="shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Power consumption (editable) */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.06] space-y-3">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Power Consumption (W)</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Avg (Typical)</label>
              <input
                type="number" min={0} step={0.1}
                value={powerTypicalW}
                onChange={e => setPowerTypicalW(parseFloat(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Max Peak</label>
              <input
                type="number" min={0} step={0.1}
                value={powerMaxW}
                onChange={e => setPowerMaxW(parseFloat(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono"
              />
            </div>
          </div>
          {(powerTypicalW !== device?.power_typical_w || powerMaxW !== device?.power_max_w) && (
            <button
              onClick={() => {
                onUpdateDevice?.({ id: device.id, power_typical_w: powerTypicalW, power_max_w: powerMaxW })
              }}
              className="w-full px-3 py-2 bg-emerald-600/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-600/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={11} /> Save Power
            </button>
          )}
        </div>

        {/* Mount resize controls */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rack Position</span>
            <span className="text-[9px] font-mono text-slate-300">{rack?.name} · U{loc?.start_unit}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Vertical Size (U)</label>
              <input
                type="number" min={1} max={rack?.total_u || 42}
                value={newSizeU}
                onChange={e => setNewSizeU(parseInt(e.target.value) || 1)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono"
              />
            </div>
            <button
              onClick={() => { if (rack && loc) onUpdateMount({ rackId: rack.id, device_id: device.id, start_u: loc.start_unit, size_u: newSizeU }) }}
              className="px-4 py-2 bg-blue-600/15 text-blue-400 border border-blue-500/25 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600/25 transition-all flex items-center gap-1.5 mt-4"
            >
              <Check size={11} /> Apply
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <button
            onClick={() => setConfirmUnmount(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-rose-500/20 transition-all"
          >
            <Trash2 size={11} /> Unmount Asset
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-[9px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">
            Close
          </button>
        </div>
      </motion.div>

      <ConfirmationModal
        isOpen={confirmUnmount}
        onClose={() => setConfirmUnmount(false)}
        onConfirm={() => { onUnmount(device.id); onClose() }}
        title="Unmount Asset"
        message={`Remove ${device?.name} from ${rack?.name}? The device will remain in the asset registry.`}
        variant="warning"
        confirmText="Unmount"
      />
    </div>
  )
}

// ─── Relocate Modal ────────────────────────────────────────────────────────────

const RelocateModal = ({ selectedRacks, sites, onClose, onRelocate }:
  { selectedRacks: number[]; sites: any[]; onClose: () => void; onRelocate: (siteId: number) => void }) => {
  const [targetSiteId, setTargetSiteId] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-[420px] p-8 rounded-3xl space-y-6 border border-violet-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/15 rounded-xl border border-violet-500/20">
            <ArrowRightLeft size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-white">Relocate Racks</h2>
            <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{selectedRacks.length} rack(s) selected</p>
          </div>
        </div>
        <StyledSelect
          label="Destination Site"
          value={targetSiteId}
          onChange={e => setTargetSiteId(e.target.value)}
          options={sites?.map((s: any) => ({ value: String(s.id), label: s.name })) || []}
          placeholder="Select target site..."
        />
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
          <button
            disabled={!targetSiteId}
            onClick={() => { if (targetSiteId) { onRelocate(parseInt(targetSiteId)); onClose() } }}
            className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-violet-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Relocate
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RackElevations() {
  const queryClient = useQueryClient()

  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: async () => (await (await apiFetch('/api/v1/devices')).json()) })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: async () => (await (await apiFetch('/api/v1/sites/')).json()) })

  const [searchTerm, setSearchTerm] = useState('')
  const [activeSite, setActiveSite] = useState<number | null>(null)
  const [activeSiteMenu, setActiveSiteMenu] = useState<number | null>(null)
  const [isAddingSite, setIsAddingSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', address: '' })
  const [isEditingSite, setIsEditingSite] = useState<any>(null)
  const [isAddingRack, setIsAddingRack] = useState(false)
  const [newRack, setNewRack] = useState({ name: '', total_u: 42, max_power_kw: 10.0, site_id: '' })
  const [isEditingRack, setIsEditingRack] = useState<any>(null)
  const [isProvisioning, setIsProvisioning] = useState<any>(null)
  const [managingDevice, setManagingDevice] = useState<{ device: any; loc: any; rack: any } | null>(null)
  const [showCompareOnly, setShowCompareOnly] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active')
  const [selectedRacks, setSelectedRacks] = useState<number[]>([])
  const [viewMode, setViewMode] = useState<'normal' | 'compact'>('normal')
  const [showRelocateModal, setShowRelocateModal] = useState(false)
  const [restoreWizard, setRestoreWizard] = useState<{
    step: 'site-select' | 'name-conflict' | 'asset-warning' | null
    ids: number[]
    targetSiteId?: number
    nameConflicts: Array<{ rackId: number; rackName: string; newName: string }>
    assetWarnings: Array<{ rackName: string; devices: string[] }>
    generalAssetWarning: boolean
  } | null>(null)
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'info' })

  const openConfirm = (title: string, message: string, onConfirm: () => void, variant: any = 'danger') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant })
  }

  const { data: allRacks, isLoading } = useQuery({
    queryKey: ['racks-all'],
    queryFn: async () => (await (await apiFetch('/api/v1/racks/?include_deleted=true')).json())
  })

  const { activeRacks, deletedRacks } = useMemo(() => {
    if (!allRacks) return { activeRacks: [], deletedRacks: [] }
    return {
      activeRacks: allRacks.filter((r: any) => !r.is_deleted),
      deletedRacks: allRacks.filter((r: any) => r.is_deleted)
    }
  }, [allRacks])

  const racks = activeTab === 'active' ? activeRacks : deletedRacks

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const siteMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/v1/sites/${data.id}` : '/api/v1/sites/'
      const method = data.id ? 'PUT' : 'POST'
      const res = await apiFetch(url, { method, body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setIsAddingSite(false); setIsEditingSite(null)
      toast.success('Site registry updated')
    },
    onError: (e: any) => {
      if (e.message === 'DUPLICATE_SITE') toast.error('Site name already exists')
      else toast.error('Failed to save site')
    }
  })

  const siteDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/v1/sites/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); toast.success('Site decommissioned'); setActiveSite(null) },
    onError: (e: any) => toast.error(`Cannot decommission: ${e.message}`)
  })

  const rackMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/v1/racks/${data.id}` : '/api/v1/racks/'
      const method = data.id ? 'PUT' : 'POST'
      const res = await apiFetch(url, { method, body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      setIsAddingRack(false); setIsEditingRack(null)
      toast.success('Rack synchronized')
    },
    onError: (e: any) => {
      if (e.message === 'DUPLICATE_RACK') toast.error('Rack name already exists at this site')
      else if (e.message === 'SHRINK_CONFLICT') toast.error('Cannot shrink — occupied units in removal zone')
      else toast.error(e.message)
    }
  })

  const mountMutation = useMutation({
    mutationFn: async (data: any) => {
      const { rackId, ...rest } = data
      if (!rest.device_id) throw new Error('DEVICE_REQUIRED')
      const payload = { ...rest, size_u: rest.size_u || 1 }
      const res = await apiFetch(`/api/v1/racks/${rackId}/mount`, { method: 'POST', body: JSON.stringify(payload) })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Asset mounted successfully')
      setIsProvisioning(null)
    },
    onError: (e: any) => {
      if (e.data?.type === 'RELOCATION_CONFLICT') {
        const device = devices?.find((d: any) => String(d.id) === String(e.data.payload.device_id))
        const msg = `${device?.name || 'Asset'} is currently at ${e.data.detail}.\n\nDo you want to relocate it to this new position?`
        
        openConfirm(
          'Relocate Asset', 
          msg,
          () => mountMutation.mutate({ ...e.data.payload, relocate: true, rackId: e.data.rackId }), 
          'warning'
        )
      } else if (e.message === 'DEVICE_REQUIRED') toast.error('Select an asset first')
      else toast.error(e.message || 'Mounting failed')
    }
  })

  const unmountMutation = useMutation({
    mutationFn: async (deviceId: number) => {
      const res = await apiFetch(`/api/v1/racks/mount/${deviceId}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Asset unmounted')
      setManagingDevice(null)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const updateMountMutation = useMutation({
    mutationFn: async ({ rackId, device_id, start_u, size_u }: any) => {
      const res = await apiFetch(`/api/v1/racks/${rackId}/mount`, {
        method: 'POST',
        body: JSON.stringify({ device_id, start_u, size_u, relocate: true })
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Mount updated')
      setManagingDevice(null)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/racks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['racks-all'] }); toast.success('Rack decommissioned') }
  })

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, ids, payload }: any) => {
      const res = await apiFetch('/api/v1/racks/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ ids, action, payload })
      })
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['racks-all'] })
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setSelectedRacks([])
      if (data.conflicts?.length > 0) toast.error(`${data.conflicts.length} rack(s) had name conflicts and were skipped`)
      else toast.success('Bulk operation complete')
    }
  })

  const handleRestore = (ids: number[]) => {
    if (activeTab !== 'deleted' || !sites || !allRacks) {
      bulkActionMutation.mutate({ action: 'restore', ids })
      return
    }

    // ALWAYS show site selection for restore — user must confirm target site
    setRestoreWizard({
      step: 'site-select',
      ids,
      nameConflicts: [],
      assetWarnings: [],
      generalAssetWarning: false
    })
  }

  const proceedRestoreWizard = (targetSiteId?: number) => {
    if (!restoreWizard || !sites || !activeRacks) return

    const racksToRestore = allRacks?.filter((r: any) => restoreWizard.ids.includes(r.id)) || []

    // Step 1: Check name conflicts
    const nameConflicts: Array<{ rackId: number; rackName: string; newName: string }> = []
    if (targetSiteId) {
      const activeRacksInSite = activeRacks.filter((r: any) => r.site_id === targetSiteId)
      const activeRackNames = new Set(activeRacksInSite.map((r: any) => r.name))

      for (const rack of racksToRestore) {
        if (activeRackNames.has(rack.name)) {
          nameConflicts.push({ rackId: rack.id, rackName: rack.name, newName: rack.name })
        }
      }
    }

    // Step 2: Check asset warnings
    const assetWarnings: Array<{ rackName: string; devices: string[] }> = []
    let generalAssetWarning = false

    const activeDeviceIds = new Set(activeRacks.flatMap((r: any) => (r.device_locations || []).map((l: any) => l.device_id)))

    for (const rack of racksToRestore) {
      if (!rack.device_locations || rack.device_locations.length === 0) {
        generalAssetWarning = true
      } else {
        const conflictingDevices = rack.device_locations
          .filter((l: any) => activeDeviceIds.has(l.device_id))
          .map((l: any) => l.device?.name || `Device ${l.device_id}`)

        if (conflictingDevices.length > 0) {
          assetWarnings.push({ rackName: rack.name, devices: conflictingDevices })
        }
      }
    }

    // Advance to next step
    if (nameConflicts.length > 0) {
      setRestoreWizard({ ...restoreWizard, step: 'name-conflict', targetSiteId, nameConflicts })
    } else if (assetWarnings.length > 0 || generalAssetWarning) {
      setRestoreWizard({ ...restoreWizard, step: 'asset-warning', targetSiteId, assetWarnings, generalAssetWarning })
    } else {
      // No conflicts or warnings, execute restore
      executeRestore(restoreWizard.ids, targetSiteId, {})
    }
  }

  const executeRestore = (ids: number[], targetSiteId?: number, renames: Record<string, string> = {}) => {
    bulkActionMutation.mutate({
      action: 'restore',
      ids,
      payload: {
        ...(targetSiteId && { new_site_id: targetSiteId }),
        ...(Object.keys(renames).length > 0 && { renames })
      }
    })
    setRestoreWizard(null)
  }

  const siteReorderMutation = useMutation({
    mutationFn: async (ids: number[]) => apiFetch('/api/v1/sites/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] })
  })

  const rackReorderMutation = useMutation({
    mutationFn: async (ids: number[]) => apiFetch('/api/v1/racks/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['racks-all'] })
  })

  const updateDeviceMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...payload } = data
      const res = await apiFetch(`/api/v1/devices/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devices'] }); queryClient.invalidateQueries({ queryKey: ['racks-all'] }); toast.success('Device power updated'); setManagingDevice(null) },
    onError: (e: any) => toast.error(e.message)
  })

  // ── Derived Data ──────────────────────────────────────────────────────────────

  const displayedRacks = useMemo(() => {
    if (!racks) return []
    let filtered = [...racks]
    if (showCompareOnly) {
      filtered = filtered.filter((r: any) => selectedRacks.includes(r.id))
    } else if (activeSite) {
      filtered = filtered.filter((r: any) => r.site_id === activeSite)
    }
    // In deleted tab, show all deleted racks (no site filtering) — site_name is displayed on the card
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((r: any) =>
        r.name.toLowerCase().includes(term) ||
        r.device_locations?.some((l: any) =>
          l.device?.name?.toLowerCase().includes(term) ||
          l.device?.system?.toLowerCase().includes(term)
        )
      )
    }
    return filtered
  }, [racks, activeSite, showCompareOnly, selectedRacks, searchTerm])

  const availableDevices = useMemo(() => {
    if (!devices) return []
    return devices.filter((d: any) => d.status !== 'Decommissioned')
  }, [devices])

  const moveSite = (id: number, direction: 'left' | 'right') => {
    if (!sites) return
    const index = sites.findIndex((s: any) => s.id === id)
    if (index === -1) return
    const arr = [...sites]
    const ni = direction === 'left' ? index - 1 : index + 1
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    siteReorderMutation.mutate(arr.map((s: any) => s.id))
  }

  const moveRack = (id: number, direction: 'left' | 'right') => {
    if (!displayedRacks) return
    const index = displayedRacks.findIndex((r: any) => r.id === id)
    if (index === -1) return
    const arr = [...displayedRacks]
    const ni = direction === 'left' ? index - 1 : index + 1
    if (ni < 0 || ni >= arr.length) return
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    rackReorderMutation.mutate(arr.map((r: any) => r.id))
  }

  const toggleSelect = useCallback((id: number) => {
    setSelectedRacks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-5 min-h-0">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight italic leading-none">Racks</h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">Physical Capacity & Spatial Intelligence</p>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/[0.06] self-start">
            <button
              onClick={() => { setActiveTab('active'); setSelectedRacks([]) }}
              className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-[#034EA2] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >Active</button>
            <button
              onClick={() => { setActiveTab('deleted'); setSelectedRacks([]) }}
              className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 'deleted' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >Purged</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/[0.06]">
            <button onClick={() => setViewMode('normal')} title="Normal"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'normal' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <Server size={13} />
            </button>
            <button onClick={() => setViewMode('compact')} title="Compact"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <Layers size={13} />
            </button>
          </div>

          {/* Site View / Compare */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/[0.06]">
            <button onClick={() => setShowCompareOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!showCompareOnly ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              All
            </button>
            <button onClick={() => setShowCompareOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${showCompareOnly ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              Compare {selectedRacks.length > 0 && `(${selectedRacks.length})`}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search racks & devices..."
              className="bg-white/5 border border-white/[0.06] rounded-xl pl-9 pr-8 py-2 text-[10px] font-bold outline-none focus:border-blue-500/50 w-56 transition-all placeholder:text-slate-600"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Add Rack */}
          {activeTab === 'active' && (
            <button
              onClick={() => { setNewRack({ name: '', total_u: 42, site_id: activeSite ? String(activeSite) : '', max_power_kw: 10.0 }); setIsAddingRack(true) }}
              className="px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all flex items-center gap-2"
            >
              <Plus size={13} /> Add Rack
            </button>
          )}
        </div>
      </div>

      {/* ── Capacity Summary Bar ── */}
      {activeRacks && activeRacks.length > 0 && !showCompareOnly && (
        <div className="shrink-0">
          <SiteCapacityBar racks={activeRacks} />
        </div>
      )}

      {/* ── Site Tabs ── */}
      {!showCompareOnly && activeTab !== 'deleted' && (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar items-center shrink-0">
          <button
            onClick={() => setActiveSite(null)}
            className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all whitespace-nowrap flex items-center gap-1.5 ${!activeSite ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/[0.07] text-slate-500 hover:border-white/20 hover:text-slate-300'}`}
          >
            All
            {activeRacks && <span className="opacity-60 font-mono">{activeRacks.length}</span>}
          </button>

          {sites?.map((s: any) => {
            const siteRacks = activeRacks?.filter((r: any) => r.site_id === s.id) || []
            const siteUsed = siteRacks.reduce((a: number, r: any) => a + (r.device_locations || []).reduce((b: number, l: any) => b + (l.size_u || 1), 0), 0)
            const siteTotal = siteRacks.reduce((a: number, r: any) => a + (r.total_u || 42), 0)
            const siteFill = siteTotal > 0 ? Math.round((siteUsed / siteTotal) * 100) : 0
            const isMenuOpen = activeSiteMenu === s.id
            const isActive = activeSite === s.id

            return (
              <div key={s.id} className="relative group/site shrink-0">
                <button
                  onClick={() => setActiveSite(s.id)}
                  className={`pl-3 pr-9 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all whitespace-nowrap flex items-center gap-2 ${isActive ? 'bg-[#034EA2] border-blue-500 text-white' : 'border-white/[0.07] text-slate-500 hover:border-white/20 hover:text-slate-300'}`}
                >
                  {s.name}
                  <span className={`text-[7px] font-black px-1 py-0.5 rounded-md tabular-nums ${
                    siteFill >= 90 ? 'bg-rose-500/30 text-rose-300' :
                    siteFill >= 70 ? 'bg-amber-500/30 text-amber-300' :
                    isActive ? 'bg-white/20 text-white/70' : 'bg-white/5 text-slate-500'
                  }`}>{siteFill}%</span>
                </button>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (!isMenuOpen) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const style = document.documentElement.style
                      style.setProperty('--site-menu-x', `${rect.left}px`)
                      style.setProperty('--site-menu-y', `${rect.bottom + 8}px`)
                    }
                    setActiveSiteMenu(isMenuOpen ? null : s.id)
                  }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors opacity-0 group-hover/site:opacity-100 ${isActive ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  <MoreVertical size={12} />
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setActiveSiteMenu(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="fixed w-36 bg-slate-950/95 backdrop-blur border border-white/10 rounded-xl shadow-2xl z-[70] overflow-hidden p-1"
                        style={{
                          left: 'var(--site-menu-x, auto)',
                          top: 'var(--site-menu-y, auto)',
                        }}
                      >
                        <button onClick={e => { e.stopPropagation(); moveSite(s.id, 'left'); setActiveSiteMenu(null) }}
                          className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                          <ArrowRightLeft size={9} className="scale-x-[-1]" /> Move Left
                        </button>
                        <button onClick={e => { e.stopPropagation(); moveSite(s.id, 'right'); setActiveSiteMenu(null) }}
                          className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2 transition-colors">
                          <ArrowRightLeft size={9} /> Move Right
                        </button>
                        <button onClick={e => { e.stopPropagation(); setIsEditingSite(s); setActiveSiteMenu(null) }}
                          className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg flex items-center gap-2 transition-colors">
                          <Edit2 size={9} /> Edit Site
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button onClick={e => { e.stopPropagation(); openConfirm('Decommission Site', `Remove site "${s.name}"? This cannot be undone.`, () => siteDeleteMutation.mutate(s.id)); setActiveSiteMenu(null) }}
                          className="w-full text-left px-3 py-2 text-[8px] font-bold uppercase text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 transition-colors">
                          <Trash2 size={9} /> Decommission
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          <button
            onClick={() => { setNewSite({ name: '', address: '' }); setIsAddingSite(true) }}
            className="p-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* ── Rack Grid ── */}
      <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar px-1 min-h-0">
        {displayedRacks.map((r: any) => (
          <RackElevation
            key={r.id}
            rack={r}
            searchTerm={searchTerm}
            isSelected={selectedRacks.includes(r.id)}
            onToggleSelect={toggleSelect}
            onDelete={id => {
              if (activeTab === 'deleted') {
                openConfirm('Purge Rack', `Permanently delete rack "${r.name}"? This cannot be undone.`, () => bulkActionMutation.mutate({ action: 'purge', ids: [id] }))
              } else {
                openConfirm('Decommission Rack', `Mark rack "${r.name}" as decommissioned?`, () => deleteMutation.mutate(id))
              }
            }}
            onEdit={rack => setIsEditingRack({ ...rack, total_u: rack.total_u })}
            onMove={dir => moveRack(r.id, dir)}
            onMount={(rackId, u) => setIsProvisioning({ rackId, start_u: u })}
            onManageDevice={(device, loc, rack) => setManagingDevice({ device, loc, rack })}
            isDeleted={activeTab === 'deleted'}
            onRestore={id => handleRestore([id])}
            viewMode={viewMode}
          />
        ))}

        {displayedRacks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <Server size={40} className="text-slate-700 mx-auto" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                {activeTab === 'deleted' ? 'No Purged Records' :
                 searchTerm ? `No results for "${searchTerm}"` :
                 'No Racks in Scope'}
              </p>
              {activeTab === 'active' && !searchTerm && (
                <button
                  onClick={() => setIsAddingRack(true)}
                  className="mt-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all flex items-center gap-2 mx-auto"
                >
                  <Plus size={12} /> Provision First Rack
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Bulk Toolbar ── */}
      <AnimatePresence>
        {selectedRacks.length > 0 && (
          <BulkToolbar
            count={selectedRacks.length}
            isDeleted={activeTab === 'deleted'}
            onDelete={() => {
              if (activeTab === 'deleted') {
                openConfirm('Purge Racks', `Permanently delete ${selectedRacks.length} selected rack(s)? This cannot be undone.`, () => bulkActionMutation.mutate({ action: 'purge', ids: selectedRacks }))
              } else {
                openConfirm('Decommission Racks', `Decommission ${selectedRacks.length} selected rack(s)?`, () => bulkActionMutation.mutate({ action: 'delete', ids: selectedRacks }))
              }
            }}
            onRelocate={() => setShowRelocateModal(true)}
            onCompare={() => setShowCompareOnly(true)}
            onRestore={() => handleRestore(selectedRacks)}
            onClear={() => setSelectedRacks([])}
          />
        )}
      </AnimatePresence>

      {/* ── Global Confirm Modal ── */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      <AnimatePresence>

        {/* Device Detail */}
        {managingDevice && (
          <DeviceDetailModal
            device={managingDevice.device}
            loc={managingDevice.loc}
            rack={managingDevice.rack}
            onClose={() => setManagingDevice(null)}
            onUnmount={id => unmountMutation.mutate(id)}
            onUpdateMount={data => updateMountMutation.mutate(data)}
            onUpdateDevice={data => updateDeviceMutation.mutate(data)}
          />
        )}

        {/* Mount Asset */}
        {isProvisioning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-panel w-[480px] p-8 rounded-3xl space-y-5 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/20">
                  <Server size={18} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-tight text-white">Mount Asset</h2>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                    {allRacks?.find((r: any) => r.id === isProvisioning.rackId)?.name} · U{isProvisioning.start_u}
                  </p>
                </div>
              </div>

              <StyledSelect
                label="Asset (Registry)"
                value={isProvisioning.device_id || ''}
                onChange={e => {
                  const d = devices?.find((d: any) => String(d.id) === e.target.value)
                  setIsProvisioning({ ...isProvisioning, device_id: e.target.value, size_u: d?.size_u || 1 })
                }}
                options={availableDevices?.map((d: any) => {
                  const locInfo = d.rack_name ? ` (@ ${d.rack_name} U${d.u_start})` : '';
                  return {
                    value: String(d.id),
                    label: `${d.name} [${d.type}] ${d.size_u || 1}U${locInfo} — ${d.system || '–'}`
                  }
                }) || []}
                placeholder="Select asset from registry..."
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Start Unit (U)</label>
                  <input type="number" min={1} value={isProvisioning.start_u}
                    onChange={e => setIsProvisioning({ ...isProvisioning, start_u: parseInt(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Vertical Size (U)</label>
                  <input type="number" min={1} value={isProvisioning.size_u || 1}
                    onChange={e => setIsProvisioning({ ...isProvisioning, size_u: parseInt(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsProvisioning(null)} className="flex-1 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                <button onClick={() => mountMutation.mutate(isProvisioning)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                  Mount Asset
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Site Create / Edit */}
        {(isAddingSite || isEditingSite) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-panel w-[420px] p-8 rounded-3xl space-y-5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/15 rounded-xl border border-emerald-500/20">
                  <MapPin size={18} className="text-emerald-400" />
                </div>
                <h2 className="text-base font-black uppercase tracking-tight text-white">
                  {isEditingSite ? 'Edit Site' : 'New Site'}
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Site Name</label>
                  <input value={isEditingSite ? isEditingSite.name : newSite.name}
                    onChange={e => isEditingSite ? setIsEditingSite({ ...isEditingSite, name: e.target.value }) : setNewSite({ ...newSite, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500/60 transition-colors"
                    placeholder="e.g. DATA-CENTER-01" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Physical Address</label>
                  <input value={isEditingSite ? isEditingSite.address : newSite.address}
                    onChange={e => isEditingSite ? setIsEditingSite({ ...isEditingSite, address: e.target.value }) : setNewSite({ ...newSite, address: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500/60 transition-colors"
                    placeholder="123 Silicon Valley Way..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsAddingSite(false); setIsEditingSite(null) }} className="flex-1 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                <button onClick={() => siteMutation.mutate(isEditingSite || newSite)}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                  {isEditingSite ? 'Save Changes' : 'Create Site'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Rack Create / Edit */}
        {(isAddingRack || isEditingRack) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-panel w-[440px] p-8 rounded-3xl space-y-5 border border-blue-500/20 my-auto">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/20">
                  <Server size={18} className="text-blue-400" />
                </div>
                <h2 className="text-base font-black uppercase tracking-tight text-white">
                  {isEditingRack ? 'Edit Rack' : 'Provision Rack'}
                </h2>
              </div>
              <div className="space-y-4 relative z-10">
                {!isEditingRack && (
                  <StyledSelect
                    label="Target Site"
                    value={newRack.site_id}
                    onChange={e => setNewRack({ ...newRack, site_id: e.target.value })}
                    options={sites?.map((s: any) => ({ value: String(s.id), label: s.name })) || []}
                    placeholder="Select deployment site..."
                  />
                )}
                <div>
                  <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Rack Identifier</label>
                  <input
                    value={isEditingRack ? isEditingRack.name : newRack.name}
                    onChange={e => isEditingRack ? setIsEditingRack({ ...isEditingRack, name: e.target.value }) : setNewRack({ ...newRack, name: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/60 transition-colors"
                    placeholder="e.g. RACK-A01" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Height (U)</label>
                    <input type="number" min={1} max={100}
                      value={isEditingRack ? isEditingRack.total_u : newRack.total_u}
                      onChange={e => isEditingRack ? setIsEditingRack({ ...isEditingRack, total_u: parseInt(e.target.value) }) : setNewRack({ ...newRack, total_u: parseInt(e.target.value) })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Max Power (kW)</label>
                    <input type="number" min={0} max={1000} step={0.5}
                      value={isEditingRack ? (isEditingRack.max_power_kw ?? 10.0) : newRack.max_power_kw}
                      onChange={e => isEditingRack ? setIsEditingRack({ ...isEditingRack, max_power_kw: parseFloat(e.target.value) }) : setNewRack({ ...newRack, max_power_kw: parseFloat(e.target.value) })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500/60 transition-colors font-mono" />
                  </div>
                </div>
                {isEditingRack && (
                  <StyledSelect
                    label="Relocate to Site (optional)"
                    value={isEditingRack.new_site_id ? String(isEditingRack.new_site_id) : ''}
                    onChange={e => setIsEditingRack({ ...isEditingRack, new_site_id: e.target.value ? parseInt(e.target.value) : null })}
                    options={sites?.map((s: any) => ({ value: String(s.id), label: s.name })) || []}
                    placeholder="Keep current site..."
                  />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsAddingRack(false); setIsEditingRack(null) }} className="flex-1 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                <button
                  onClick={() => {
                    if (!isEditingRack && !newRack.site_id) return toast.error('Site is required')
                    rackMutation.mutate(isEditingRack || newRack)
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                  {isEditingRack ? 'Save Rack' : 'Deploy Rack'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Bulk Relocate */}
        {showRelocateModal && (
          <RelocateModal
            selectedRacks={selectedRacks}
            sites={sites || []}
            onClose={() => setShowRelocateModal(false)}
            onRelocate={siteId => bulkActionMutation.mutate({ action: 'relocate', ids: selectedRacks, payload: { new_site_id: siteId } })}
          />
        )}

        {/* Restore Wizard */}
        {restoreWizard && sites && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-[100]"
            onClick={() => setRestoreWizard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {/* Step 1: Site Selection */}
              {restoreWizard.step === 'site-select' && (
                <>
                  <h2 className="text-lg font-bold text-white">Select Target Site</h2>
                  <p className="text-sm text-slate-400">Choose where to restore these racks.</p>
                  <StyledSelect
                    options={[
                      { value: '', label: 'Standalone (No Site)' },
                      ...sites.map((s: any) => ({ value: String(s.id), label: s.name }))
                    ]}
                    value={String(restoreWizard.targetSiteId || '')}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRestoreWizard({ ...restoreWizard, targetSiteId: e.target.value ? parseInt(e.target.value) : undefined })}
                    label="Target Site"
                  />
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => setRestoreWizard(null)} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold transition-colors">Cancel</button>
                    <button onClick={() => proceedRestoreWizard(restoreWizard.targetSiteId)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">Next</button>
                  </div>
                </>
              )}

              {/* Step 2: Name Conflicts */}
              {restoreWizard.step === 'name-conflict' && (
                <>
                  <h2 className="text-lg font-bold text-white">Name Conflicts</h2>
                  <p className="text-sm text-slate-400">These racks have name conflicts. Rename or skip them.</p>
                  <div className="space-y-3">
                    {restoreWizard.nameConflicts.map(nc => (
                      <div key={nc.rackId} className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">{nc.rackName}</label>
                        <input
                          type="text"
                          value={nc.newName}
                          onChange={e => {
                            const updated = restoreWizard.nameConflicts.map(c => c.rackId === nc.rackId ? { ...c, newName: e.target.value } : c)
                            setRestoreWizard({ ...restoreWizard, nameConflicts: updated })
                          }}
                          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                          placeholder="New name..."
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => setRestoreWizard(null)} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold transition-colors">Cancel</button>
                    <button onClick={() => proceedRestoreWizard(restoreWizard.targetSiteId)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">Next</button>
                  </div>
                </>
              )}

              {/* Step 3: Asset Warning */}
              {restoreWizard.step === 'asset-warning' && (
                <>
                  <h2 className="text-lg font-bold text-white">⚠️ Asset Status</h2>
                  {restoreWizard.generalAssetWarning && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-xs text-amber-200">Previously mounted assets have been reassigned elsewhere and will not return to this rack when restored.</p>
                    </div>
                  )}
                  {restoreWizard.assetWarnings.length > 0 && (
                    <div className="space-y-2">
                      {restoreWizard.assetWarnings.map((w, i) => (
                        <div key={i} className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                          <p className="text-[9px] font-bold text-amber-300 mb-1">{w.rackName}</p>
                          <p className="text-[8px] text-amber-200">Currently active in other racks: {w.devices.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-4">
                    <button onClick={() => setRestoreWizard(null)} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold transition-colors">Cancel</button>
                    <button onClick={() => executeRestore(restoreWizard.ids, restoreWizard.targetSiteId)} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors">Restore</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
