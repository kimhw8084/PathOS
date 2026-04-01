import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { LayoutDashboard, Server, Network, Shield, Settings, Search, ServerCrash, Terminal, Layers, Menu, X, ChevronRight, Zap, Info, Star, AlertOctagon, RefreshCcw, Activity, Grid3X3, Clock, AlertTriangle, Upload, Workflow, Package, Globe } from "lucide-react"
import { Toaster, toast } from "react-hot-toast"
import { apiFetch } from "./api/apiClient"

import Dashboard from "./components/Dashboard"
import RackElevations from "./components/RackElevations"
import AssetGrid from "./components/AssetGrid"
import AssetTemp from "./components/AssetTemp"
import NetworkFabric from "./components/NetworkFabric"
import Intelligence from "./components/Intelligence"
import AuditLogs from "./components/AuditLogs"
import ServiceRegistry from "./components/ServiceRegistry"
import SettingsPage from "./components/Settings"
import Maintenance from "./components/Maintenance"
import MonitoringGrid from "./components/MonitoringGrid"
import Troubleshooting from "./components/Troubleshooting"
import DataFlowDesigner from "./components/DataFlowDesigner"
import ExternalIntelligence from "./components/ExternalIntelligence"
import Temp1 from "./components/Temp1"
import RackTemp from "./components/RackTemp"
import metadata from "./metadata.json"
import { ErrorDetailModal } from "./components/shared/ErrorDetailModal"

const APP_VERSION = metadata.version
const PATCH_HISTORY = metadata.patchHistory
const queryClient = new QueryClient()

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any, showDetails: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null, showDetails: false }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: ErrorInfo) { console.error("CRASH:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
          <AlertOctagon size={64} className="text-rose-500 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black uppercase text-white tracking-tighter">System Kernel Panic</h1>
          <p className="text-slate-500 text-xs mt-2 uppercase font-bold max-w-md">An unhandled exception has occurred in the UI layer. Stack trace available for inspection.</p>
          
          <button onClick={() => this.setState({ showDetails: !this.state.showDetails })} className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-400 transition-colors">
             {this.state.showDetails ? "- Hide Traceback" : "+ Inspect Kernel Dump"}
          </button>

          {this.state.showDetails && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4 p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl max-w-2xl overflow-auto max-h-[40vh] text-left">
               <code className="text-[10px] text-rose-400 font-mono block whitespace-pre-wrap">{String(this.state.error.stack || this.state.error)}</code>
            </motion.div>
          )}

          <button onClick={() => window.location.href = "/"} className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase flex items-center space-x-2 shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
             <RefreshCcw size={16}/> <span>Reset System Matrix</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SidebarItem = ({ icon: Icon, label, path, active, isOpen }: any) => (
  <Link to={path} className={`w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-300 relative ${active ? "bg-[#034EA2] text-white shadow-lg" : "hover:bg-white/5 text-slate-400"} ${!isOpen ? "justify-center" : "space-x-3"}`}>
    <Icon size={18} className={!isOpen && active ? "text-white" : ""} />
    {isOpen && <span className="font-bold text-[11px] uppercase tracking-wider">{label}</span>}
    {active && isOpen && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
    {active && !isOpen && <motion.div layoutId="active-pill-dot" className="absolute right-2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]" />}
  </Link>
)

const PatchNotesModal = ({ onClose }: any) => {
  const [expandedIndex, setExpandedIndex] = useState(0)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel w-[600px] max-h-[80vh] overflow-hidden flex flex-col p-10 rounded-[40px] border-blue-500/30">
         <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div className="flex items-center space-x-4">
               <Star size={24} className="text-blue-400 animate-pulse" />
               <h2 className="text-2xl font-black uppercase text-white">Registry Updates</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 space-y-4">
            {PATCH_HISTORY.map((patch, idx) => (
              <div key={patch.version} className={`border border-white/5 rounded-2xl overflow-hidden ${expandedIndex === idx ? "bg-white/5 border-blue-500/20" : "hover:bg-white/5"}`}>
                 <button onClick={() => setExpandedIndex(expandedIndex === idx ? -1 : idx)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                    <div>
                       <span className={`text-[10px] font-black uppercase tracking-widest ${expandedIndex === idx ? "text-blue-400" : "text-slate-500"}`}>{patch.version}</span>
                       <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">{patch.date}</p>
                    </div>
                    <ChevronRight size={16} className={`text-slate-500 transition-transform ${expandedIndex === idx ? "rotate-90" : ""}`} />
                 </button>
                 <AnimatePresence>
                    {expandedIndex === idx && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                         <div className="px-6 pb-6 pt-2 space-y-3">
                            {patch.changes.map((change, cIdx) => (
                              <div key={cIdx} className="flex space-x-3 text-[11px] font-bold uppercase tracking-tight">
                                 <span className={`text-[8px] px-1.5 py-0.5 rounded h-fit ${change.type === 'NEW' ? 'bg-emerald-500/20 text-emerald-400' : change.type === 'FIXED' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{change.type}</span>
                                 <span className="text-slate-300 leading-tight">{change.text}</span>
                              </div>
                            ))}
                         </div>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            ))}
         </div>
         <button onClick={onClose} className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-lg shadow-blue-500/20">Close Inspection</button>
      </motion.div>
    </div>
  )
}

function MainLayout() {
  const location = useLocation(); 
  const navigate = useNavigate(); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [globalError, setGlobalError] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('sysgrid-theme') || 'nordic-frost-v1');

  const THEMES = [
    { id: 'nordic-frost-v1', label: 'Nordic Frost (Default)', color: 'bg-[#1a1b26]' },
    { id: 'industrial-slate', label: 'Industrial Slate', color: 'bg-[#1e293b]' },
    { id: 'ocean-deep', label: 'Ocean Deep', color: 'bg-[#0f172a]' },
    { id: 'solarized-light', label: 'Solarized Light', color: 'bg-[#fdf6e3]' },
    { id: 'cyber-emerald', label: 'Cyber Emerald', color: 'bg-[#050505]' },
    { id: 'pure-clarity', label: 'Pure Clarity', color: 'bg-[#ffffff]' }
  ]

  const changeTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    const isLight = ['solarized-light', 'pure-clarity', 'clean-snow-v1'].includes(themeId);
    if (isLight) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
    localStorage.setItem('sysgrid-theme', themeId);
    toast.success(`Matrix UI: ${THEMES.find(t => t.id === themeId)?.label}`);
  }

  const { data: healthData, isError: isHealthError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiFetch("/api/v1/health");
      return response.json();
    },
    refetchInterval: 10000,
    retry: 2,
    staleTime: 5000
  });

  const isOnline = !!healthData && !isHealthError;

  useEffect(() => {
    const handleError = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (error && (error.traceback || error.status || error.data)) {
        setGlobalError(error);
        toast.error((t) => (
          <div className="flex items-center justify-between space-x-4 min-w-[220px]">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-tight text-white">{error.message || 'System Fault'}</span>
              <span className="text-[8px] font-bold text-rose-400/70 uppercase">Execution Exception</span>
            </div>
            <button 
              onClick={() => { setGlobalError(error); toast.dismiss(t.id); }}
              className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border border-white/5"
            >
              Details
            </button>
          </div>
        ), { duration: 8000, position: 'top-right' });
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleError);
    return () => window.removeEventListener('unhandledrejection', handleError);
  }, []);

  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', currentTheme);
    const isLight = ['solarized-light', 'pure-clarity', 'clean-snow-v1'].includes(currentTheme);
    if (isLight) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
    apiFetch("/api/v1/settings/initialize").catch(() => {}) 
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      <motion.aside animate={{ width: isSidebarOpen ? 240 : 80 }} className="glass-panel border-r border-[var(--glass-border)] flex flex-col z-20 shadow-2xl relative bg-[var(--sidebar-bg)]">
        <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity group">
             <div className="w-9 h-9 flex-shrink-0 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/5 transition-transform group-hover:scale-105 duration-300">
                <Grid3X3 size={20} className="text-white" />
             </div>
             {isSidebarOpen && <span className="font-black text-xl text-[var(--text-primary)] tracking-tighter uppercase italic">SYSGRID</span>}
          </Link>
          {isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)]">
              <Menu size={18}/>
            </button>
          )}
        </div>
        {!isSidebarOpen && (
          <div className="flex justify-center pb-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)]">
              <Menu size={18}/>
            </button>
          </div>
        )}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/" active={location.pathname === "/"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Activity} label="Temp 1" path="/temp1" active={location.pathname === "/temp1"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Package} label="Rack Temp" path="/rack-temp" active={location.pathname === "/rack-temp"} isOpen={isSidebarOpen} />
          <SidebarItem icon={ServerCrash} label="Racks" path="/racks" active={location.pathname === "/racks"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Server} label="Assets" path="/assets" active={location.pathname === "/assets"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Server} label="Assets (Temp)" path="/asset-temp" active={location.pathname === "/asset-temp"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Layers} label="Services" path="/services" active={location.pathname === "/services"} isOpen={isSidebarOpen} />
          <SidebarItem icon={AlertTriangle} label="Troubleshooting" path="/troubleshooting" active={location.pathname === "/troubleshooting"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Network} label="Network" path="/network" active={location.pathname === "/network"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Activity} label="Monitoring" path="/monitoring" active={location.pathname === "/monitoring"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Workflow} label="Architecture" path="/architecture" active={location.pathname === "/architecture"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Globe} label="Partner IQ" path="/partner-iq" active={location.pathname === "/partner-iq"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Clock} label="CP" path="/cp" active={location.pathname === "/cp"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Settings} label="Settings" path="/settings" active={location.pathname === "/settings"} isOpen={isSidebarOpen} />
          <SidebarItem icon={Terminal} label="Logs" path="/logs" active={location.pathname === "/logs"} isOpen={isSidebarOpen} />
        </nav>
        <div className="p-4 border-t border-[var(--glass-border)] text-center opacity-30">
           {isSidebarOpen ? <p className="text-[8px] font-black uppercase tracking-[0.3em]">{APP_VERSION}</p> : <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto"/>}
        </div>
      </motion.aside>
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-[var(--glass-border)] flex items-center justify-between px-8 bg-[var(--bg-header)] backdrop-blur-xl z-10">
          <div className="flex items-center space-x-4">
            <button onClick={() => setShowPatchNotes(true)} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all">Patch Notes</button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center space-x-2">
               {THEMES.map(t => (
                 <button 
                   key={t.id} 
                   onClick={() => changeTheme(t.id)}
                   title={t.label}
                   className={`w-4 h-4 rounded-full border transition-all ${t.color} ${currentTheme === t.id ? 'border-blue-500 scale-125 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-white/10 hover:scale-110'}`}
                 />
               ))}
            </div>
          </div>
          <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
            SYSGRID ENGINE <span className={`${isOnline ? 'text-blue-400 animate-pulse' : 'text-rose-500'} transition-colors duration-500`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Dashboard onNavigate={(p:any) => navigate("/" + p)} />} />
            <Route path="/temp1" element={<Temp1 />} />
            <Route path="/rack-temp" element={<RackTemp />} />
            <Route path="/racks" element={<RackElevations />} />
            <Route path="/assets" element={<AssetGrid />} />
            <Route path="/asset-temp" element={<AssetTemp />} />
            <Route path="/services" element={<ServiceRegistry />} />
            <Route path="/troubleshooting" element={<Troubleshooting />} />
            <Route path="/network" element={<NetworkFabric />} />
            <Route path="/monitoring" element={<MonitoringGrid />} />
            <Route path="/architecture" element={<DataFlowDesigner />} />
            <Route path="/partner-iq" element={<ExternalIntelligence />} />
            <Route path="/cp" element={<Maintenance />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/logs" element={<AuditLogs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <footer className="h-8 border-t border-[var(--glass-border)] px-8 flex items-center justify-between text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-primary)]/20">
           <span>SYSGRID INFRASTRUCTURE COMMAND</span>
           <span className="text-blue-500">VERSION {APP_VERSION}</span>
        </footer>
      </main>
      <AnimatePresence>
        {showPatchNotes && <PatchNotesModal onClose={() => setShowPatchNotes(false)} />}
        {globalError && <ErrorDetailModal isOpen={!!globalError} onClose={() => setGlobalError(null)} error={globalError} />}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MainLayout />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
