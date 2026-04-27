import React, { useState, useEffect } from 'react';
import { 
  Settings, Code, Type, Play, Save, 
  RefreshCw, Terminal, 
  Box, ShieldAlert, Clock, AlertTriangle, ChevronRight, History, Building2, Activity
} from 'lucide-react';
import { settingsApi } from '../api/client';
import { toast } from 'react-hot-toast';
import AdminRolloutSettings from './AdminRolloutSettings';
import QualityCenter from './QualityCenter';
import { useBuganizer } from './ErrorFortress';
import { useQueryClient } from '@tanstack/react-query';

const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { reports } = useBuganizer();
  const [parameters, setParameters] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'parameters' | 'rollout' | 'quality'>('parameters');
  const [adminOverview, setAdminOverview] = useState<any>({ configs: [], members: [], saved_views: [] });
  const [qualityOverview, setQualityOverview] = useState<any>(null);

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      const [parameterData, rolloutData, qualityData] = await Promise.all([
        settingsApi.listParameters(),
        settingsApi.adminOverview(),
        settingsApi.qualityOverview(),
      ]);
      setParameters(parameterData);
      setAdminOverview(rolloutData);
      setQualityOverview(qualityData);
      if (parameterData.length > 0 && !selectedKey) setSelectedKey(parameterData[0].key);
    } catch (err) {
      toast.error("Failed to load parameters");
    } finally {
      setLoading(false);
    }
  };

  const selectedParam = parameters.find(p => p.key === selectedKey);

  useEffect(() => {
    if (selectedKey && showLogs) {
      loadLogs(selectedKey);
    }
  }, [selectedKey, showLogs]);

  const loadLogs = async (key: string) => {
    try {
      const data = await settingsApi.getParameterLogs(key);
      setLogs(data);
    } catch (err) {
      toast.error("Failed to load logs");
    }
  };

  const handleUpdate = async (key: string, data: any) => {
    try {
      const updated = await settingsApi.updateParameter(key, data);
      setParameters(parameters.map(p => p.key === key ? updated : p));
      toast.success("Configuration synchronized");
    } catch (err) {
      toast.error("Update failed");
    }
  };

  const handleExecute = async () => {
    if (!selectedKey) return;
    setExecuting(true);
    try {
      const result = await settingsApi.executeParameter(selectedKey);
      if (result.status === 'FAILED') {
        toast.error("Execution failed");
      } else if (result.status === 'DISCREPANCY') {
        toast.error("Discrepancy detected");
      } else {
        toast.success("Logic executed successfully");
      }
      loadParameters();
      if (showLogs) loadLogs(selectedKey);
    } catch (err) {
      toast.error("Execution error");
    } finally {
      setExecuting(false);
    }
  };

  const handleResolve = async (action: 'CONFIRM' | 'IGNORE') => {
    if (!selectedKey) return;
    try {
      await settingsApi.resolveDiscrepancy(selectedKey, action);
      toast.success(action === 'CONFIRM' ? "Changes applied" : "Changes ignored");
      loadParameters();
    } catch (err) {
      toast.error("Resolution failed");
    }
  };

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <RefreshCw className="animate-spin text-theme-accent" size={32} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-apple-in space-y-10 pb-20">
      <div className="flex items-center justify-between border-b border-theme-border/50 pb-8">
        <div>
          <h2 className="text-header-main mb-2">System Configuration</h2>
          <p className="text-subtext">Manage global parameters, identity simulation, company rollout defaults, and governance controls.</p>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-hint bg-status-success/10 text-status-success px-4 py-2 rounded-full border border-status-success/20">Background Engine Active</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('parameters')} className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${activeTab === 'parameters' ? 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}>
          <span className="inline-flex items-center gap-2"><Settings size={14} /> Parameter Engine</span>
        </button>
        <button onClick={() => setActiveTab('rollout')} className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${activeTab === 'rollout' ? 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}>
          <span className="inline-flex items-center gap-2"><Building2 size={14} /> Company Rollout</span>
        </button>
        <button onClick={() => setActiveTab('quality')} className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${activeTab === 'quality' ? 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}>
          <span className="inline-flex items-center gap-2"><Activity size={14} /> Quality Center</span>
        </button>
      </div>

      {activeTab === 'parameters' ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="apple-card !p-3 space-y-1 bg-black/20 border-theme-border">
            <div className="p-4 mb-2 border-b border-theme-border/50 flex items-center justify-between">
               <span className="text-hint uppercase tracking-widest text-theme-secondary font-black">Authorized Parameters</span>
               <span className="text-[10px] bg-theme-accent/20 text-theme-accent px-2 py-0.5 rounded-md">FIXED</span>
            </div>
            {parameters.map(p => (
              <button
                key={p.key}
                onClick={() => { setSelectedKey(p.key); setShowLogs(false); }}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all group ${selectedKey === p.key ? 'bg-theme-accent/10 border border-theme-accent/30 text-white' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white border border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${selectedKey === p.key ? 'bg-theme-accent text-white' : 'bg-white/5 text-theme-muted'}`}>
                    {p.is_dynamic ? <Code size={16} /> : <Type size={16} />}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-black tracking-tight">{p.label}</span>
                    <span className="text-[9px] opacity-40 font-mono">{p.key}</span>
                  </div>
                </div>
                {p.has_discrepancy && <AlertTriangle size={16} className="text-status-warning animate-pulse" />}
                {selectedKey === p.key && <ChevronRight size={16} className="text-theme-accent" />}
              </button>
            ))}
          </div>

          <div className="apple-card !bg-theme-accent/[0.03] border-theme-accent/10 space-y-4">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-theme-accent" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-white">System Integrity</h4>
            </div>
            <p className="text-[11px] text-theme-secondary leading-relaxed opacity-70">
              Parameter keys are locked to the PathOS core specification. Dynamic logic executes every hour to synchronize with hardware databases.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          {selectedParam ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="apple-card space-y-8 border-theme-border bg-white/[0.01]">
                <div className="flex items-center justify-between border-b border-theme-border/50 pb-8">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-theme-accent/10 rounded-2xl border border-theme-accent/20">
                      <Box size={24} className="text-theme-accent" />
                    </div>
                    <div>
                      <h3 className="text-header-sub !text-white">{selectedParam.label}</h3>
                      <span className="text-hint normal-case font-mono opacity-40">{selectedParam.key}</span>
                    </div>
                  </div>
                  <div className="flex bg-black/40 p-1.5 rounded-2xl border border-theme-border shadow-inner">
                    <button 
                      onClick={() => handleUpdate(selectedParam.key, { ...selectedParam, is_dynamic: false })}
                      className={`px-5 py-2 text-hint rounded-xl transition-all flex items-center gap-2.5 ${!selectedParam.is_dynamic ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
                    >
                      <Type size={14} /> Manual
                    </button>
                    <button 
                      onClick={() => handleUpdate(selectedParam.key, { ...selectedParam, is_dynamic: true })}
                      className={`px-5 py-2 text-hint rounded-xl transition-all flex items-center gap-2.5 ${selectedParam.is_dynamic ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
                    >
                      <Code size={14} /> Dynamic
                    </button>
                  </div>
                </div>

                {selectedParam.has_discrepancy && (
                  <div className="bg-status-warning/10 border border-status-warning/20 p-8 rounded-2xl space-y-6 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <AlertTriangle size={24} className="text-status-warning" />
                        <div>
                          <h4 className="text-[14px] font-black text-status-warning uppercase tracking-tight">Discrepancy Detected</h4>
                          <p className="text-[11px] text-theme-secondary">Values from latest automated run do not match confirmed configuration.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleResolve('IGNORE')} className="btn-apple-secondary !py-2 !px-4 border-status-warning/30 hover:bg-status-warning/5">Ignore</button>
                        <button onClick={() => handleResolve('CONFIRM')} className="btn-apple-primary !bg-status-warning !py-2 !px-4 !shadow-none text-black">Confirm & Update</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-status-warning/10">
                       <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase text-theme-muted tracking-widest">Currently Confirmed</span>
                          <div className="flex flex-wrap gap-2">
                             {selectedParam.cached_values?.slice(0, 5).map((v: any) => <span key={v} className="px-2 py-1 bg-white/5 rounded text-[10px] text-theme-secondary">{v}</span>)}
                             {selectedParam.cached_values?.length > 5 && <span className="text-[10px] opacity-40">+{selectedParam.cached_values.length - 5} more</span>}
                          </div>
                       </div>
                       <div className="space-y-3 border-l border-status-warning/10 pl-6">
                          <span className="text-[9px] font-black uppercase text-status-warning tracking-widest">Detected in Last Run</span>
                          <div className="flex flex-wrap gap-2">
                             {selectedParam.pending_values?.slice(0, 5).map((v: any) => <span key={v} className="px-2 py-1 bg-status-warning/20 rounded text-[10px] text-status-warning">{v}</span>)}
                             {selectedParam.pending_values?.length > 5 && <span className="text-[10px] opacity-40">+{selectedParam.pending_values.length - 5} more</span>}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-hint text-theme-secondary font-black">Display Label</label>
                      <input 
                        className="input-apple !bg-black/60 font-bold" 
                        value={selectedParam.label} 
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, label: e.target.value } : p))}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-hint text-theme-secondary font-black">Definition / Purpose</label>
                      <input 
                        className="input-apple !bg-black/60" 
                        value={selectedParam.description || ""} 
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, description: e.target.value } : p))}
                      />
                    </div>
                  </div>

                  {selectedParam.is_dynamic ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-hint font-black flex items-center gap-2">
                          <Terminal size={14} className="text-theme-accent" /> Python Retrieval Module
                        </label>
                        {selectedParam.last_executed && (
                           <div className="flex items-center gap-2 text-[10px] font-bold text-theme-muted">
                             <Clock size={12} /> Last Run: {new Date(selectedParam.last_executed).toLocaleString()}
                           </div>
                        )}
                      </div>
                      <div className="apple-card-inset !p-0 !bg-black/80 border-theme-border/50">
                        <textarea 
                          className="w-full h-80 bg-transparent p-6 font-mono text-[13px] text-theme-accent outline-none resize-none leading-relaxed"
                          spellCheck={false}
                          value={selectedParam.python_code || ""}
                          onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, python_code: e.target.value } : p))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-hint font-black px-1">Manual Master List (One per line)</label>
                      <textarea 
                        className="input-apple !bg-black/60 h-64 font-mono text-[14px] resize-none"
                        value={selectedParam.manual_values?.join('\n') || ""}
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, manual_values: e.target.value.split('\n').filter(v => v.trim()) } : p))}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-8 border-t border-theme-border/30">
                    <button 
                      onClick={() => setShowLogs(!showLogs)}
                      className="text-hint text-theme-secondary hover:text-white flex items-center gap-2.5 transition-all"
                    >
                      <History size={16} /> {showLogs ? "Hide Execution History" : "View Run Logs"}
                    </button>
                    <div className="flex items-center gap-4">
                      {selectedParam.is_dynamic && (
                        <button 
                          onClick={handleExecute}
                          disabled={executing}
                          className="btn-apple-secondary flex items-center gap-2.5 px-6 !border-theme-border"
                        >
                          {executing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                          Execute Logic
                        </button>
                      )}
                      <button 
                        onClick={() => handleUpdate(selectedParam.key, selectedParam)}
                        className="btn-apple-primary flex items-center gap-2.5 px-8 shadow-theme-accent/20 shadow-lg"
                      >
                        <Save size={16} /> Sync Configuration
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {showLogs && (
                <div className="apple-card space-y-6 animate-in slide-in-from-bottom-4 duration-500 border-theme-border bg-black/40">
                  <div className="flex items-center justify-between border-b border-theme-border/50 pb-4 px-2">
                    <h4 className="text-[12px] font-black text-white flex items-center gap-3 tracking-widest uppercase">
                       <History size={16} className="text-theme-accent" /> Execution Registry
                    </h4>
                  </div>
                  
                  <div className="space-y-3 overflow-auto max-h-[400px] custom-scrollbar pr-2">
                    {logs.map((log) => (
                      <div key={log.id} className="p-5 bg-white/[0.02] border border-theme-border rounded-xl flex items-center justify-between group hover:border-theme-border-bright">
                        <div className="flex items-center gap-5">
                          <div className={`w-2.5 h-2.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-status-success' : log.status === 'DISCREPANCY' ? 'bg-status-warning' : 'bg-status-error'}`} />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white">{new Date(log.timestamp).toLocaleString()}</span>
                            <span className="text-[10px] text-theme-muted normal-case mt-0.5">{log.message || "Execution successful"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right flex flex-col">
                              <span className="text-[10px] font-black text-white">{log.found_values?.length || 0} ITEMS</span>
                              <span className="text-[9px] text-theme-muted uppercase tracking-widest">{log.execution_time?.toFixed(3)}s</span>
                           </div>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && <div className="text-center py-10 opacity-20 text-[11px] font-black uppercase tracking-widest">No history found</div>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-20">
               <Settings size={64} className="text-theme-muted mb-6" />
               <p className="text-header-sub uppercase tracking-widest">Select Node for Configuration</p>
            </div>
          )}
        </div>
      </div>
      ) : activeTab === 'rollout' ? (
        <AdminRolloutSettings overview={adminOverview} onRefresh={async () => {
          await loadParameters();
          queryClient.invalidateQueries({ queryKey: ['runtime-config'] });
        }} />
      ) : (
        <QualityCenter overview={qualityOverview} bugReports={reports} />
      )}
    </div>
  );
};

export default SettingsView;
