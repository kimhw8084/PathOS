import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Share2, Target, ChevronRight, RefreshCcw, Shield, Info, Maximize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../api/apiClient'
import ForceGraph2D from 'react-force-graph-2d'

// --- High-Performance MultiSelect ---

const MultiSelectHeader = ({ options, selected, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredOptions = options.filter((o: any) => 
    o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.system.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggle = (val: number) => {
    const next = selected.includes(val) ? selected.filter((x: any) => x !== val) : [...selected, val]
    onChange(next)
  }

  return (
    <div className="relative w-64">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#1e293b] border-2 border-[#334155] px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer hover:border-[#3b82f6] transition-all shadow-md active:scale-[0.98]"
      >
        <div className="flex items-center space-x-2">
          <Target size={14} className="text-[#3b82f6]" />
          <span className="text-[11px] font-black uppercase text-slate-100 tracking-wider truncate">
            {selected.length ? `${selected.length} Targeted` : 'Initialize Targets'}
          </span>
        </div>
        <ChevronRight size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[1000] bg-black/20 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 8, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 8, scale: 0.95 }} 
              className="absolute z-[1001] top-full left-0 right-0 mt-3 bg-[#0f172a] border-2 border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[380px]"
            >
              <div className="p-3 border-b border-[#1e293b] bg-[#1e293b]/50">
                 <input 
                   autoFocus
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="SEARCH INFRASTRUCTURE..."
                   className="w-full bg-[#020617] border-2 border-[#334155] rounded-lg px-4 py-2.5 text-[10px] font-bold text-white uppercase outline-none focus:border-[#3b82f6] placeholder:text-slate-600"
                 />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1 bg-[#020617]/50">
                 {filteredOptions.length === 0 ? (
                   <div className="p-8 text-center text-[10px] text-slate-500 font-black uppercase italic tracking-widest">No matching assets found</div>
                 ) : (
                   filteredOptions.map((opt: any) => (
                     <div 
                       key={opt.value} 
                       onClick={() => toggle(opt.value)}
                       className={`mx-1 my-0.5 px-4 py-3 rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all flex items-center justify-between group ${selected.includes(opt.value) ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-slate-400 hover:bg-[#1e293b]'}`}
                     >
                       <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${selected.includes(opt.value) ? 'bg-white' : 'bg-[#3b82f6]'}`} />
                          <span className="truncate max-w-[140px] tracking-tight">{opt.label}</span>
                       </div>
                       <span className={`text-[8px] px-2 py-0.5 rounded-md bg-[#020617]/40 border border-[#334155] text-slate-500 group-hover:text-slate-300`}>{opt.system}</span>
                     </div>
                   ))
                 )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Main View ---

export default function Temp1() {
  const [selectedSources, setSelectedSources] = useState<number[]>([])
  const fgRef = useRef<any>()

  const { data: devices, isLoading: isLoadingDevices } = useQuery({ 
    queryKey: ['devices'], 
    queryFn: async () => (await apiFetch('/api/v1/devices/')).json() 
  })
  
  const { data: allRelationships, isLoading: isLoadingRelationships } = useQuery({ 
    queryKey: ['all-relationships'], 
    queryFn: async () => (await apiFetch('/api/v1/devices/relationships/all')).json() 
  })

  const deviceOptions = useMemo(() => {
    return devices?.map((d: any) => ({ value: Number(d.id), label: d.name, system: d.system })) || []
  }, [devices])

  const graphData = useMemo(() => {
    if (!devices || !allRelationships || selectedSources.length === 0) {
      return { nodes: [], links: [] }
    }

    const sourceIdsSet = new Set(selectedSources.map(Number))
    const activeRelationships = Array.isArray(allRelationships) ? allRelationships.filter((r: any) => 
      sourceIdsSet.has(Number(r.source_device_id)) || sourceIdsSet.has(Number(r.target_device_id))
    ) : []

    const nodeIds = new Set<number>()
    activeRelationships.forEach((r: any) => {
      nodeIds.add(Number(r.source_device_id))
      nodeIds.add(Number(r.target_device_id))
    })
    
    selectedSources.forEach(id => nodeIds.add(Number(id)))

    const nodes = Array.from(nodeIds).map(id => {
      const dev = devices.find((d: any) => Number(d.id) === id)
      const isHub = sourceIdsSet.has(id)
      
      let color = '#94a3b8' // Slate-400 (Other)
      if (isHub) color = '#3b82f6' // Blue-500
      else {
        const type = dev?.type?.toLowerCase() || ''
        if (type.includes('physical') || type.includes('server')) color = '#10b981' // Emerald-500
        else if (type.includes('storage')) color = '#f59e0b' // Amber-500
        else if (type.includes('switch') || type.includes('network')) color = '#8b5cf6' // Violet-500
        else if (type.includes('virtual')) color = '#06b6d4' // Cyan-500
      }

      return {
        id,
        name: dev?.name || `ID:${id}`,
        system: dev?.system || 'Unknown',
        type: dev?.type || 'Asset',
        isHub,
        color,
        val: isHub ? 15 : 10
      }
    })

    const links = activeRelationships.map((r: any) => ({
      source: Number(r.source_device_id),
      target: Number(r.target_device_id),
      label: `${r.source_role} ➔ ${r.target_role}`,
      type: r.relationship_type,
      color: r.relationship_type === 'Critical' ? '#ef4444' : '#475569'
    }))

    return { nodes, links }
  }, [selectedSources, devices, allRelationships])

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Force nodes apart for clarity
      fgRef.current.d3Force('charge').strength(-800);
      fgRef.current.d3Force('link').distance(250);
      
      setTimeout(() => {
        fgRef.current.zoomToFit(600, 150)
      }, 400)
    }
  }, [graphData.nodes.length])

  if (isLoadingDevices || isLoadingRelationships) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 bg-[#020617]">
        <RefreshCcw className="text-[#3b82f6] animate-spin" size={32} />
        <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing Core Grid...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#020617] p-4 relative overflow-hidden text-slate-200">
      {/* Precision Header */}
      <header className="flex items-center justify-between shrink-0 bg-[#0f172a] border-2 border-[#1e293b] p-5 rounded-[32px] shadow-2xl relative z-[60]">
        <div className="flex items-center space-x-5">
           <div className="p-3 bg-[#3b82f6] text-white rounded-2xl shadow-lg shadow-[#3b82f6]/20">
              <Share2 size={24} />
           </div>
           <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none italic">Blast Radius Matrix</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] mt-1.5">Industrial Dependency Simulation Engine</p>
           </div>
        </div>

        <div className="flex items-center space-x-6">
           <div className="flex items-center bg-[#020617] px-5 py-2.5 rounded-2xl border-2 border-[#1e293b] space-x-8">
              <SummaryChip label="Primary" value={selectedSources.length} color="text-[#3b82f6]" />
              <div className="w-px h-8 bg-[#1e293b]" />
              <SummaryChip label="Impacted" value={graphData.nodes.length - selectedSources.length} color="text-[#10b981]" />
              <div className="w-px h-8 bg-[#1e293b]" />
              <SummaryChip label="Links" value={graphData.links.length} color="text-[#8b5cf6]" />
           </div>

           <MultiSelectHeader 
             options={deviceOptions}
             selected={selectedSources}
             onChange={setSelectedSources}
           />
           
           <button 
             onClick={() => setSelectedSources([])}
             className="p-3 bg-[#1e293b] border-2 border-[#334155] rounded-2xl text-slate-400 hover:text-white hover:border-red-500/50 transition-all shadow-xl group active:scale-95"
             title="Clear Matrix"
           >
             <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
           </button>
        </div>
      </header>

      {/* Solid Visualization Engine */}
      <div className="flex-1 bg-[#0f172a] mt-6 rounded-[48px] border-2 border-[#1e293b] overflow-hidden relative shadow-inner">
        {selectedSources.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-10 bg-[#020617]/40 backdrop-blur-sm">
             <div className="p-16 bg-[#0f172a] rounded-full border-2 border-[#1e293b] shadow-2xl animate-pulse">
                <Target size={80} className="text-slate-800" />
             </div>
             <div className="text-center space-y-2">
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-slate-600">Awaiting Target Selection</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Initialize Analysis via Command Console</p>
             </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            backgroundColor="transparent"
            nodeLabel={(node: any) => `
              <div class="bg-[#0f172a] border-2 border-[#334155] p-4 rounded-2xl shadow-2xl text-[11px] text-slate-200 min-w-[180px]">
                <div class="font-black text-white uppercase mb-2 border-b-2 border-[#1e293b] pb-2 tracking-tight">${node.name}</div>
                <div class="flex flex-col space-y-1">
                  <div class="text-[#3b82f6] uppercase font-black tracking-widest text-[9px]">${node.system}</div>
                  <div class="text-slate-400 uppercase font-black tracking-widest text-[9px]">${node.type}</div>
                </div>
              </div>
            `}
            nodeColor={(node: any) => node.color}
            nodeRelSize={1}
            linkWidth={4}
            linkColor={(link: any) => link.color}
            linkDirectionalArrowLength={0} // Using custom arrow box
            linkDirectionalParticles={0}
            
            nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
              const label = node.name;
              const baseFontSize = 16; 
              const fontSize = baseFontSize / globalScale;
              
              // Node Body
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.isHub ? 10 : 7, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
              
              // High-Contrast Border
              ctx.lineWidth = 2.5 / globalScale;
              ctx.strokeStyle = '#fff';
              ctx.stroke();

              // Hub Outer Glow
              if (node.isHub) {
                 ctx.beginPath();
                 ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI, false);
                 ctx.lineWidth = 1.5 / globalScale;
                 ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
                 ctx.stroke();
              }

              // Bold Primary Labels
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = `black ${fontSize}px Inter, system-ui, sans-serif`;
              
              const textWidth = ctx.measureText(label).width;
              
              // Label Backdrop for Extreme Clarity
              ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
              ctx.fillRect(node.x - textWidth/2 - 4, node.y + (node.isHub ? 22 : 18) - fontSize/2, textWidth + 8, fontSize + 4);

              ctx.fillStyle = '#fff';
              ctx.fillText(label, node.x, node.y + (node.isHub ? 22 : 18));

              // System Label
              if (globalScale > 0.8) {
                 ctx.font = `bold ${fontSize * 0.75}px Inter, sans-serif`;
                 ctx.fillStyle = 'rgba(203, 213, 225, 0.7)';
                 ctx.fillText(node.system.toUpperCase(), node.x, node.y + (node.isHub ? 22 : 18) + fontSize + 2);
              }
            }}
            
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={(link: any, ctx: any, globalScale: any) => {
              const start = link.source;
              const end = link.target;
              if (typeof start !== 'object' || typeof end !== 'object') return;

              const label = link.label;
              const baseFontSize = 14;
              const fontSize = baseFontSize / globalScale;
              
              const textPos = {
                x: start.x + (end.x - start.x) / 2,
                y: start.y + (end.y - start.y) / 2
              };
              const relAngle = Math.atan2(end.y - start.y, end.x - start.x);

              ctx.save();
              ctx.translate(textPos.x, textPos.y);
              ctx.rotate(relAngle);

              ctx.font = `black ${fontSize}px Inter, system-ui, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              
              // Dynamic Arrow Box (Always wraps label)
              const h = fontSize + (10 / globalScale);
              const w = textWidth + (30 / globalScale);
              const head = 15 / globalScale;

              ctx.fillStyle = '#0f172a'; 
              ctx.strokeStyle = link.color;
              ctx.lineWidth = 3 / globalScale;

              ctx.beginPath();
              ctx.moveTo(-w/2, -h/2);
              ctx.lineTo(w/2 - head, -h/2);
              ctx.lineTo(w/2, 0);
              ctx.lineTo(w/2 - head, h/2);
              ctx.lineTo(-w/2, h/2);
              ctx.closePath();
              
              ctx.fill();
              ctx.stroke();

              // Roles (Centered in the arrow box)
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(label, -head/2, 0);
              ctx.restore();
            }}
            
            enableNodeDrag={true}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}

        {/* HUD Elements */}
        <div className="absolute top-8 left-8 flex flex-col space-y-2 pointer-events-none z-[70]">
           <LegendItem color="#3b82f6" label="PRIMARY HUB" />
           <LegendItem color="#10b981" label="SERVER / COMPUTE" />
           <LegendItem color="#f59e0b" label="STORAGE SYSTEM" />
           <LegendItem color="#8b5cf6" label="NETWORK FABRIC" />
           <LegendItem color="#06b6d4" label="VIRTUAL INSTANCE" />
           <LegendItem color="#94a3b8" label="MISC ASSET" />
        </div>

        <div className="absolute bottom-8 left-8 p-5 bg-[#0f172a] border-2 border-[#1e293b] rounded-[32px] max-w-[260px] shadow-2xl pointer-events-none">
           <div className="flex items-center space-x-3 text-[#3b82f6] mb-2.5">
              <Shield size={16} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Grid Operations</h3>
           </div>
           <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
              Nodes are relocatable. Drag to reorganize view. Arrow-boxes indicate dependency roles. Red = Critical Path.
           </p>
        </div>

        <div className="absolute top-8 right-8 p-4 bg-[#0f172a]/50 border-2 border-[#1e293b] rounded-2xl pointer-events-none">
           <Maximize2 size={16} className="text-slate-600" />
        </div>
      </div>
    </div>
  )
}

const SummaryChip = ({ label, value, color }: any) => (
  <div className="flex flex-col items-center">
    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5">{label}</span>
    <span className={`text-xl font-black ${color} font-mono leading-none tracking-tighter`}>{String(value).padStart(2, '0')}</span>
  </div>
)

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center space-x-3.5 px-4 py-2 bg-[#0f172a] border-2 border-[#1e293b] rounded-2xl shadow-xl">
    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}60` }} />
    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
  </div>
)
