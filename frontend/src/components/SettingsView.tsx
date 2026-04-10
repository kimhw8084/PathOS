import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Code, Type, Play, Save, 
  CheckCircle2, XCircle, RefreshCw, AlertTriangle, Terminal, 
  Plus, Trash2, Box, Info, Cpu, ShieldAlert
} from 'lucide-react';
import { settingsApi } from '../api/client';
import { toast } from 'react-hot-toast';
import { useErrorFortress } from './ErrorFortress';

const SettingsView: React.FC = () => {
  const [parameters, setParameters] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { reportError } = useErrorFortress();

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      const data = await settingsApi.listParameters();
      setParameters(data);
      if (data.length > 0 && !selectedKey) setSelectedKey(data[0].key);
    } catch (err) {
      toast.error("Failed to load parameters");
    } finally {
      setLoading(false);
    }
  };

  const selectedParam = parameters.find(p => p.key === selectedKey);

  const handleUpdate = async (key: string, data: any) => {
    try {
      const updated = await settingsApi.updateParameter(key, data);
      setParameters(parameters.map(p => p.key === key ? updated : p));
      toast.success("Settings synchronized");
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  const handleTest = async () => {
    if (!selectedKey) return;
    setExecuting(true);
    setTestResult(null);
    try {
      const result = await settingsApi.executeParameter(selectedKey);
      setTestResult(result);
      if (result.error) {
        toast.error("Execution failed");
        reportError({
          detail: `Python execution error in ${selectedKey}`,
          type: "RuntimeError",
          traceback: result.error
        }, 'backend');
      } else {
        toast.success("Retrieval successful");
      }
      // Refresh list to show cached values
      loadParameters();
    } catch (err) {
      toast.error("Test execution failed");
    } finally {
      setExecuting(false);
    }
  };

  const addNewParameter = () => {
    const newKey = `NEW_PARAM_${Date.now()}`;
    const newParam = {
      key: newKey,
      label: "New Parameter",
      description: "Define usage...",
      is_dynamic: false,
      manual_values: [],
      python_code: "# result = ['Item 1', 'Item 2']",
    };
    setParameters([...parameters, newParam]);
    setSelectedKey(newKey);
  };

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <RefreshCw className="animate-spin text-theme-accent" size={32} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-apple-in space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-header-main mb-2">System Configuration</h2>
          <p className="text-subtext">Manage global parameters and secure data connectors.</p>
        </div>
        <button onClick={addNewParameter} className="btn-apple-primary flex items-center gap-2">
          <Plus size={16} /> Add Parameter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="apple-card !p-3 space-y-1 bg-black/20">
            <div className="p-3 mb-2 border-b border-theme-border/50">
               <span className="text-hint">Active Parameters</span>
            </div>
            {parameters.map(p => (
              <button
                key={p.key}
                onClick={() => setSelectedKey(p.key)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${selectedKey === p.key ? 'bg-theme-accent/10 border border-theme-accent/30 text-white' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white border border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  {p.is_dynamic ? <Code size={16} className="text-theme-accent" /> : <Type size={16} className="text-theme-muted" />}
                  <span className="text-subtext font-bold truncate max-w-[160px]">{p.label}</span>
                </div>
                {selectedKey === p.key && <CheckCircle2 size={14} className="text-theme-accent" />}
              </button>
            ))}
          </div>
          
          <div className="apple-card bg-theme-accent/[0.03] border-theme-accent/10">
            <div className="flex items-center gap-3 mb-3">
              <ShieldAlert size={18} className="text-theme-accent" />
              <h4 className="text-subtext font-bold text-white">Privacy Standard</h4>
            </div>
            <p className="text-hint normal-case tracking-tight leading-relaxed opacity-70">
              Your Python scripts execute locally within the PathOS environment. No proprietary data retrieval logic is shared with the LLM or stored outside your local instance.
            </p>
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-8">
          {selectedParam ? (
            <div className="space-y-8">
              <div className="apple-card space-y-8">
                <div className="flex items-center justify-between border-b border-theme-border/50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-theme-accent/10 rounded-2xl">
                      <Box size={24} className="text-theme-accent" />
                    </div>
                    <div>
                      <h3 className="text-header-sub">{selectedParam.label}</h3>
                      <span className="text-hint normal-case font-mono opacity-50">{selectedParam.key}</span>
                    </div>
                  </div>
                  <div className="flex bg-white/[0.04] p-1 rounded-full border border-theme-border">
                    <button 
                      onClick={() => handleUpdate(selectedParam.key, { ...selectedParam, is_dynamic: false })}
                      className={`px-4 py-1.5 text-hint rounded-full transition-all flex items-center gap-2 ${!selectedParam.is_dynamic ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
                    >
                      <Type size={14} /> Manual
                    </button>
                    <button 
                      onClick={() => handleUpdate(selectedParam.key, { ...selectedParam, is_dynamic: true })}
                      className={`px-4 py-1.5 text-hint rounded-full transition-all flex items-center gap-2 ${selectedParam.is_dynamic ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
                    >
                      <Code size={14} /> Dynamic
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-hint px-1">Display Label</label>
                      <input 
                        className="input-apple !bg-black/40" 
                        value={selectedParam.label} 
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, label: e.target.value } : p))}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-hint px-1">Description</label>
                      <input 
                        className="input-apple !bg-black/40" 
                        value={selectedParam.description || ""} 
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, description: e.target.value } : p))}
                      />
                    </div>
                  </div>

                  {selectedParam.is_dynamic ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center justify-between">
                        <label className="text-hint px-1 flex items-center gap-2">
                          <Terminal size={14} className="text-theme-accent" /> Data Retrieval Logic (Python)
                        </label>
                        <div className="flex items-center gap-2">
                           {selectedParam.last_executed && (
                             <span className="text-[10px] text-theme-muted font-medium">Last Run: {new Date(selectedParam.last_executed).toLocaleTimeString()}</span>
                           )}
                        </div>
                      </div>
                      <div className="apple-card-inset !p-0 !bg-black/60 overflow-hidden border-theme-accent/20">
                        <textarea 
                          className="w-full h-80 bg-transparent p-6 font-mono text-[12px] text-theme-accent outline-none resize-none leading-relaxed"
                          spellCheck={false}
                          value={selectedParam.python_code || ""}
                          onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, python_code: e.target.value } : p))}
                          placeholder="# Example: Connect to your DB or API\nimport pandas as pd\n\n# The engine looks for a 'result' list or 'df' dataframe\ndf = pd.DataFrame({'tool': ['SEM-01', 'SEM-02']})\n# or\nresult = ['Option A', 'Option B']"
                        />
                      </div>
                      <div className="bg-white/[0.03] border border-theme-border p-4 rounded-xl flex items-start gap-3">
                        <Info size={16} className="text-theme-accent shrink-0 mt-0.5" />
                        <p className="text-main-content opacity-70">
                          Your code should define a variable named <code className="text-theme-accent">result</code> (as a list) or <code className="text-theme-accent">df</code> (as a pandas DataFrame). The first column of the dataframe will be used as the values.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                      <label className="text-hint px-1">Manual Values (One per line)</label>
                      <textarea 
                        className="input-apple !bg-black/40 h-64 font-mono text-[13px] resize-none"
                        value={selectedParam.manual_values?.join('\n') || ""}
                        onChange={e => setParameters(parameters.map(p => p.key === selectedKey ? { ...p, manual_values: e.target.value.split('\n').filter(v => v.trim()) } : p))}
                        placeholder="SEM-01\nSEM-02\nSEM-03..."
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-4 pt-4 border-t border-theme-border/50">
                    {selectedParam.is_dynamic && (
                      <button 
                        onClick={handleTest}
                        disabled={executing || !selectedParam.python_code}
                        className="btn-apple-secondary flex items-center gap-2 px-6"
                      >
                        {executing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                        Execute Logic
                      </button>
                    )}
                    <button 
                      onClick={() => handleUpdate(selectedParam.key, selectedParam)}
                      className="btn-apple-primary flex items-center gap-2 px-8"
                    >
                      <Save size={16} /> Sync Configuration
                    </button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className="apple-card space-y-6 animate-in slide-in-from-bottom-4 duration-500 border-theme-accent/20">
                  <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
                    <h4 className="text-subtext font-bold text-white flex items-center gap-2">
                       Execution Analysis {testResult.error ? <XCircle size={14} className="text-status-error" /> : <CheckCircle2 size={14} className="text-status-success" />}
                    </h4>
                    <span className="text-hint normal-case text-theme-muted">Time: {testResult.execution_time.toFixed(3)}s</span>
                  </div>
                  
                  {testResult.error ? (
                    <div className="apple-card-inset !bg-status-error/5 border-status-error/10 text-status-error font-mono text-[11px] p-4 overflow-auto">
                      {testResult.error}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <span className="text-hint">Retrieved Values ({testResult.values?.length || 0}):</span>
                      <div className="flex flex-wrap gap-2">
                        {testResult.values?.slice(0, 20).map((v: any, i: number) => (
                          <span key={i} className="status-badge bg-theme-accent/10 text-theme-accent">{v}</span>
                        ))}
                        {testResult.values?.length > 20 && (
                          <span className="status-badge bg-white/5 text-theme-muted">+{testResult.values.length - 20} more...</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-30">
               <Settings size={48} className="text-theme-muted mb-4" />
               <p className="text-header-sub">Select a parameter to configure</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
