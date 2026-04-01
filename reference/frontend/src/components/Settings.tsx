import React, { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  Globe, Shield, Cpu, Sliders, Box, Network, Lock, Key, Activity, 
  Save, RefreshCcw, Layout, Database, Palette, Bell, Info, Server,
  Sun, Moon, Check
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { apiFetch } from "../api/apiClient"

const SettingField = ({ label, description, children }: any) => (
  <div className="flex flex-col space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group">
    <div className="flex flex-col">
      <label className="text-[10px] font-black uppercase tracking-widest text-white">{label}</label>
      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{description}</p>
    </div>
    <div className="mt-2">
      {children}
    </div>
  </div>
)

const ThemeCard = ({ id, name, type, colors, isActive, onClick }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    onClick={onClick}
    className={`relative cursor-pointer p-6 rounded-[32px] border transition-all duration-500 ${isActive ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
  >
    <div className="flex items-start justify-between mb-6">
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest text-white">{name}</span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{type}</span>
      </div>
      <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500'}`}>
        {isActive ? <Check size={14} /> : (id.startsWith('nordic') ? <Moon size={14} /> : <Sun size={14} />)}
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-2 h-20 rounded-2xl overflow-hidden border border-white/5">
       <div style={{ backgroundColor: colors.bg }} className="flex items-center justify-center">
          <div style={{ backgroundColor: colors.accent }} className="w-8 h-8 rounded-lg opacity-20 blur-xl animate-pulse" />
          <div style={{ backgroundColor: colors.accent }} className="w-4 h-4 rounded-md shadow-lg" />
       </div>
       <div style={{ backgroundColor: colors.panel }} className="border-l border-white/5 flex flex-col p-2 space-y-2">
          <div className="h-1 w-full bg-white/10 rounded-full" />
          <div className="h-1 w-2/3 bg-white/10 rounded-full" />
          <div className="mt-auto h-4 w-4 rounded-full self-end" style={{ backgroundColor: colors.accent }} />
       </div>
    </div>
  </motion.div>
)

export default function SettingsPage() {
  const [topTab, setTopTab] = useState<'local' | 'global'>('local')
  const [activeTab, setActiveTab] = useState('general')
  const queryClient = useQueryClient()
  
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'nordic-frost-v1'

  const changeTheme = (themeId: string) => {
    localStorage.setItem('sysgrid-theme', themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    toast.success(`Theme switched to ${themeId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}`)
  }

  const themes = [
    { id: 'nordic-frost-v1', name: 'Nordic Frost', type: 'Dark Mode', colors: { bg: '#1a1b26', accent: '#7aa2f7', panel: '#24283b' } },
    { id: 'clean-snow-v1', name: 'Clean Snow', type: 'Light Mode', colors: { bg: '#f8fafc', accent: '#3b82f6', panel: '#ffffff' } },
  ]

  const { data: globalSettings, isLoading: isLoadingGlobal } = useQuery({ 
    queryKey: ["global-settings"], 
    queryFn: async () => (await (await apiFetch("/api/v1/settings/global")).json()) 
  })

  const { data: uiSettings, isLoading: isLoadingUI } = useQuery({ 
    queryKey: ["ui-settings"], 
    queryFn: async () => (await (await apiFetch("/api/v1/settings/ui")).json()) 
  })

  const [localSettings, setLocalSettings] = useState<any>({})
  const [localUI, setLocalUI] = useState<any>({})

  useEffect(() => {
    if (globalSettings) setLocalSettings(globalSettings)
  }, [globalSettings])

  useEffect(() => {
    if (uiSettings) setLocalUI(uiSettings)
  }, [uiSettings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resGlobal = await apiFetch("/api/v1/settings/global", {
        method: "POST",
        body: JSON.stringify(localSettings)
      })
      
      const resUI = await apiFetch("/api/v1/settings/ui", {
        method: "POST",
        body: JSON.stringify(localUI)
      })

      if (!resGlobal.ok || !resUI.ok) throw new Error("Failed to save settings")
      return { status: "success" }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-settings"] })
      queryClient.invalidateQueries({ queryKey: ["ui-settings"] })
      toast.success("Settings synchronized successfully")
    },
    onError: (err: any) => toast.error(err.message)
  })

  const globalTabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'system', label: 'System', icon: Server },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  const handleChange = (key: string, value: string) => {
    setLocalSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  const handleUIChange = (key: string, value: any) => {
    setLocalUI((prev: any) => ({ ...prev, [key]: value }))
  }

  if (isLoadingGlobal || isLoadingUI) return (
    <div className="h-full flex items-center justify-center">
      <RefreshCcw size={48} className="text-blue-500 animate-spin opacity-20" />
    </div>
  )

  return (
    <div className="h-full flex flex-col space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 bg-white/5 p-1 rounded-2xl border border-white/5">
           <button onClick={() => setTopTab('local')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topTab === 'local' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Local UI Matrix</button>
           <button onClick={() => setTopTab('global')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${topTab === 'global' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Global Settings</button>
        </div>
        
        {topTab === 'global' && (
          <button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {saveMutation.isPending ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saveMutation.isPending ? 'Syncing...' : 'Commit Changes'}</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {topTab === 'local' ? (
          <motion.div key="local" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
             <div>
                <h2 className="text-2xl font-black uppercase tracking-tight italic text-white">Visual Identity</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Personalize local terminal aesthetics</p>
             </div>
             
             <div className="grid grid-cols-2 gap-6">
                {themes.map(theme => (
                  <ThemeCard 
                    key={theme.id}
                    {...theme}
                    isActive={currentTheme === theme.id}
                    onClick={() => changeTheme(theme.id)}
                  />
                ))}
             </div>

             <div className="p-8 bg-blue-600/5 rounded-[32px] border border-blue-500/10 flex items-start space-x-6">
                <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-400"><Palette size={24}/></div>
                <div className="space-y-1">
                   <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">Terminal Theme Engine</h4>
                   <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-tight max-w-xl">
                      Local themes are persisted in the browser's matrix storage. These settings do not affect other nodes or administrative sessions.
                   </p>
                </div>
             </div>
          </motion.div>
        ) : (
          <motion.div key="global" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 flex-1 flex flex-col min-h-0">
            <div className="flex space-x-2 border-b border-white/5 pb-1">
               {globalTabs.map(tab => (
                 <button 
                   key={tab.id} 
                   onClick={() => setActiveTab(tab.id)}
                   className={`flex items-center space-x-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   <tab.icon size={14} />
                   <span>{tab.label}</span>
                   {activeTab === tab.id && <motion.div layoutId="setting-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />}
                 </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
              <AnimatePresence mode="wait">
                {activeTab === 'general' && (
                  <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-6">
                     <SettingField label="Application Name" description="The primary identifier for this instance.">
                        <input value={localSettings.app_name || ""} onChange={e => handleChange('app_name', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all" />
                     </SettingField>
                     <SettingField label="Organization Name" description="Legal or corporate entity owning the infrastructure.">
                        <input value={localSettings.org_name || ""} onChange={e => handleChange('org_name', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all" />
                     </SettingField>
                     <SettingField label="Primary Site ID" description="Default site code for global resource allocation.">
                        <input value={localSettings.site_id || ""} onChange={e => handleChange('site_id', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all uppercase" />
                     </SettingField>
                     <SettingField label="Support Contact" description="Email address for system administrative inquiries.">
                        <input value={localSettings.support_email || ""} onChange={e => handleChange('support_email', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all" />
                     </SettingField>
                  </motion.div>
                )}

                {activeTab === 'system' && (
                  <motion.div key="system" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-6">
                     <SettingField label="Log Retention (Days)" description="Duration to persist audit and system logs before purging.">
                        <input type="number" value={localSettings.retention_days || "30"} onChange={e => handleChange('retention_days', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all" />
                     </SettingField>
                     <SettingField label="Default Timezone" description="Global temporal reference for scheduling and logging.">
                        <select value={localSettings.default_timezone || "UTC"} onChange={e => handleChange('default_timezone', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all">
                           <option value="UTC">UTC (Universal Coordinated)</option>
                           <option value="EST">EST (Eastern Standard)</option>
                           <option value="PST">PST (Pacific Standard)</option>
                           <option value="GMT">GMT (Greenwich Mean Time)</option>
                        </select>
                     </SettingField>
                     <SettingField label="Dashboard Refresh (Sec)" description="Interval for automated data synchronization on the dashboard.">
                        <input type="number" value={localSettings.dashboard_refresh_interval || "60"} onChange={e => handleChange('dashboard_refresh_interval', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all" />
                     </SettingField>
                     <SettingField label="Maintenance Mode" description="Restrict non-admin access and signal read-only state.">
                        <div className="flex items-center space-x-4">
                           <button onClick={() => handleChange('maintenance_mode', 'true')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${localSettings.maintenance_mode === 'true' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>Enabled</button>
                           <button onClick={() => handleChange('maintenance_mode', 'false')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${localSettings.maintenance_mode !== 'true' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>Disabled</button>
                        </div>
                     </SettingField>
                  </motion.div>
                )}

                {activeTab === 'branding' && (
                  <motion.div key="branding" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-6">
                     <SettingField label="Primary UI Color" description="The dominant color used for highlights and active states.">
                        <div className="flex items-center space-x-3">
                           <input type="color" value={localSettings.ui_primary_color || "#3b82f6"} onChange={e => handleChange('ui_primary_color', e.target.value)} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                           <input value={localSettings.ui_primary_color || ""} onChange={e => handleChange('ui_primary_color', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-mono text-white outline-none focus:border-blue-500" />
                        </div>
                     </SettingField>
                     <SettingField label="Accent UI Color" description="Secondary color for emphasis and status indicators.">
                        <div className="flex items-center space-x-3">
                           <input type="color" value={localSettings.ui_accent_color || "#10b981"} onChange={e => handleChange('ui_accent_color', e.target.value)} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                           <input value={localSettings.ui_accent_color || ""} onChange={e => handleChange('ui_accent_color', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-mono text-white outline-none focus:border-blue-500" />
                        </div>
                     </SettingField>
                     <SettingField label="Status Badging" description="Enable stylized badges for operational status visualization.">
                        <div className="flex items-center space-x-4">
                           <button onClick={() => handleUIChange('status_badged', true)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${localUI.status_badged ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>Pills</button>
                           <button onClick={() => handleUIChange('status_badged', false)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${!localUI.status_badged ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>Text Only</button>
                        </div>
                     </SettingField>
                     <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex items-start space-x-4">
                        <Info className="text-blue-400 mt-1" size={16} />
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Visual Identity Note</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1 leading-relaxed">Status colors can still be refined individually within the specific registry views to ensure maximum contrast and visibility across all device types.</p>
                        </div>
                     </div>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-6">
                     <SettingField label="Security Posture" description="Global enforcement level for access and validation.">
                        <select value={localSettings.security_level || "Standard"} onChange={e => handleChange('security_level', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all">
                           <option value="Standard">Standard (Balanced)</option>
                           <option value="Strict">Strict (Zero Trust)</option>
                           <option value="Lax">Lax (Development)</option>
                        </select>
                     </SettingField>
                     <SettingField label="Audit Log Verbosity" description="Detail level captured for system and user actions.">
                        <select value={localSettings.audit_log_level || "Full"} onChange={e => handleChange('audit_log_level', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all">
                           <option value="Full">Full (Trace All)</option>
                           <option value="Minimal">Minimal (Critical Only)</option>
                           <option value="None">Disabled (Not Recommended)</option>
                        </select>
                     </SettingField>
                     <div className="col-span-2 p-8 bg-amber-500/5 rounded-[32px] border border-amber-500/10 flex flex-col items-center text-center space-y-4">
                        <Lock className="text-amber-500" size={32} />
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Security & Integrity Management</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-2 max-w-lg mx-auto leading-relaxed">
                            Changes to security posture may require a system-wide session invalidation. Ensure all critical operations are completed before adjusting the global enforcement level.
                          </p>
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
