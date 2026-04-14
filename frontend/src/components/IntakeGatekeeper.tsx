import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, Zap, Target, ArrowRight, ChevronLeft, 
  Layout, CheckCircle2, XCircle, Clock, Layers,
  Cpu, HardDrive, Settings
} from 'lucide-react';
import { settingsApi } from '../api/client';

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  taxonomy: any[];
}

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, taxonomy }) => {
  const [phase, setPhase] = useState<'rubric' | 'definition'>('rubric');
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [rubricAnswers, setRubricAnswers] = useState({
    is_standard: false,
    is_repeatable: false,
    has_measurable_output: false
  });
  
  const [formData, setFormData] = useState({
    name: '',
    prc: '',
    workflow_type: '',
    trigger_type: '',
    trigger_description: '',
    output_type: '',
    output_description: '',
    cadence_count: 1.0,
    cadence_unit: 'week',
    involves_equipment: false,
    equipment_state: 'Idle',
    cleanroom_execution_required: false,
    tool_family: '',
    tool_id: '',
    repeatability_check: true
  });

  useEffect(() => {
    settingsApi.listParameters().then(setSystemParams).catch(() => {});
  }, []);

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');
  
  const hardwareFamilies = useMemo(() => {
    const param = systemParams.find(p => p.key === 'HARDWARE_FAMILY');
    if (param) {
      return (param.is_dynamic ? param.cached_values : param.manual_values) || [];
    }
    return taxonomy.filter(t => t.category === 'ToolType').map(t => t.label);
  }, [systemParams, taxonomy]);

  const toolIds = useMemo(() => {
    const param = systemParams.find(p => p.key === 'TOOL_ID');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const prcValues = useMemo(() => {
    const param = systemParams.find(p => p.key === 'PRC');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const workflowTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === 'WORKFLOW_TYPE');
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [systemParams]);

  const handleRubricSubmit = () => {
    if (rubricAnswers.is_standard && rubricAnswers.is_repeatable && rubricAnswers.has_measurable_output) {
      setPhase('definition');
    }
  };

  const isRubricFailed = !rubricAnswers.is_standard || !rubricAnswers.is_repeatable || !rubricAnswers.has_measurable_output;

  if (phase === 'rubric') {
    return (
      <div className="max-w-xl mx-auto mt-10 animate-apple-in">
        <div className="apple-card !p-0 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-theme-border bg-[#111827]/80">
          <div className="h-14 bg-white/[0.03] border-b border-theme-border flex items-center px-6 gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <ShieldAlert size={18} className="text-blue-400" />
            </div>
            <div>
              <span className="text-[12px] text-white font-black uppercase tracking-widest block leading-tight">Request Validation</span>
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em]">Phase 01: Initial Assessment</span>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tighter leading-tight uppercase">Process Configuration</h2>
              <p className="text-[11px] text-theme-secondary max-w-sm leading-relaxed">Verification of operational baseline is required to proceed.</p>
            </div>

            <div className="space-y-2.5">
              {[
                { id: 'is_standard', label: 'Standardized Process', icon: Layout, desc: 'Documented SOP or departmental standard.' },
                { id: 'is_repeatable', label: 'Repeatable Execution', icon: Target, desc: 'Logic is consistent across operators.' },
                { id: 'has_measurable_output', label: 'Measurable Yield', icon: Zap, desc: 'Verifiable data point or hardware state.' }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setRubricAnswers({...rubricAnswers, [item.id]: !rubricAnswers[item.id as keyof typeof rubricAnswers]})}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all duration-300 group ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5' : 'bg-white/[0.03] border-theme-border hover:border-white/30 hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-3 rounded-lg transition-all duration-300 ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40' : 'bg-[#1e293b] text-white/40 group-hover:text-white'}`}>
                      <item.icon size={16} />
                    </div>
                    <div>
                      <span className={`text-[13px] font-black block uppercase tracking-tight ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>{item.label}</span>
                      <span className="text-[10px] text-white/30 font-bold normal-case tracking-tight group-hover:text-white/60 transition-colors">{item.desc}</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600 border-blue-600 scale-110' : 'border-white/10'}`}>
                    {rubricAnswers[item.id as keyof typeof rubricAnswers] && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>

            {isRubricFailed && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-red-500 font-black uppercase tracking-tight leading-tight">Operational Constraint</p>
                  <p className="text-[10px] text-red-500/60 font-bold mt-0.5">Automation requires standardized tasks. Verify criteria to proceed.</p>
                </div>
              </div>
            )}

            <button 
              onClick={handleRubricSubmit}
              disabled={isRubricFailed}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white !py-4 !rounded-xl tracking-widest uppercase font-black text-[11px] shadow-xl disabled:opacity-20 flex items-center justify-center gap-3 group transition-all"
            >
              Start Definition <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-apple-in pb-16">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Layers size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter leading-tight uppercase">Process Definition</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em]">Configuration</span>
              <div className="h-0.5 w-0.5 bg-white/20 rounded-full" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Initializing operational metadata.</p>
            </div>
          </div>
        </div>
        <button onClick={() => setPhase('rubric')} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/30 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group">
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Restart
        </button>
      </div>

      <div className="space-y-8">
        {/* Section 1: Identity */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-400 font-black px-1">
            <Cpu size={16} />
            <span className="text-[11px] tracking-[0.2em] uppercase">Identity & Infrastructure</span>
          </div>
          
          <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Process Name</label>
                <span className="text-[9px] text-white/20 font-mono">{formData.name.length} / 60</span>
              </div>
              <input 
                className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-lg font-black text-white uppercase focus:border-blue-500 outline-none transition-all placeholder:text-white/5" 
                placeholder="ENTER NAME..." 
                maxLength={60}
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Process Control (PRC)</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.prc}
                    onChange={e => setFormData({...formData, prc: e.target.value})}
                  >
                    <option value="">SELECT PRC...</option>
                    {prcValues.map((v: string) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Workflow Type</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.workflow_type}
                    onChange={e => setFormData({...formData, workflow_type: e.target.value})}
                  >
                    <option value="">SELECT TYPE...</option>
                    {workflowTypes.map((v: string) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <Cpu className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Hardware Family</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.tool_family}
                    onChange={e => setFormData({...formData, tool_family: e.target.value})}
                  >
                    <option value="">SELECT FAMILY...</option>
                    {hardwareFamilies.map((f: any) => (
                      <option key={typeof f === 'string' ? f : f.value} value={typeof f === 'string' ? f : f.value}>
                        {typeof f === 'string' ? f : f.label}
                      </option>
                    ))}
                  </select>
                  <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Specific Tool ID</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.tool_id}
                    onChange={e => setFormData({...formData, tool_id: e.target.value})}
                  >
                    <option value="">MANUAL ENTRY / NONE</option>
                    {toolIds.map((v: string) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <HardDrive className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Logistics */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-400 font-black px-1">
            <Zap size={16} />
            <span className="text-[11px] tracking-[0.2em] uppercase">Logistics Matrix</span>
          </div>

          <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Trigger Mechanism</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.trigger_type}
                    onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                  >
                    <option value="">SELECT TRIGGER...</option>
                    {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Zap className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Output Classification</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.output_type}
                    onChange={e => setFormData({...formData, output_type: e.target.value})}
                  >
                    <option value="">SELECT OUTPUT...</option>
                    {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={14} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Trigger Architecture</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.trigger_description.length} / 500</span>
                </div>
                <textarea 
                  className="w-full bg-[#1e293b]/30 border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-blue-500 transition-all" 
                  placeholder="Specify the exact event that initiates this workflow..." 
                  maxLength={500}
                  value={formData.trigger_description} 
                  onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Output Deliverable</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.output_description.length} / 500</span>
                </div>
                <textarea 
                  className="w-full bg-[#1e293b]/30 border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-blue-500 transition-all" 
                  placeholder="Define the final product or verification result..." 
                  maxLength={500}
                  value={formData.output_description} 
                  onChange={e => setFormData({...formData, output_description: e.target.value})} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Performance */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-white/60 font-black px-1">
            <Clock size={16} />
            <span className="text-[11px] tracking-[0.2em] uppercase">Execution Strategy</span>
          </div>

          <div className="apple-card !bg-blue-600/5 border-blue-500/20 p-6">
            <div className="flex items-center gap-8">
              <div className="flex-1 space-y-2">
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Global Cadence</h4>
                <p className="text-[11px] text-white/40 font-bold leading-relaxed">
                  Define frequency to project high-precision ROI hours.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative group w-32">
                  <div className="absolute -top-2 left-3 bg-[#0a1120] px-1.5 z-10">
                    <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Count</span>
                  </div>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full bg-[#1e293b] border border-blue-500/30 font-black text-2xl text-white text-center py-4 rounded-xl focus:border-blue-500 outline-none transition-all shadow-lg" 
                    value={formData.cadence_count} 
                    onChange={e => setFormData({...formData, cadence_count: parseFloat(e.target.value)})} 
                  />
                </div>
                <div className="w-24 h-20 bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden relative group">
                  <select 
                    className="w-full h-full bg-transparent text-white font-black text-center appearance-none cursor-pointer hover:bg-white/5 transition-all uppercase text-[11px] tracking-tighter outline-none"
                    value={formData.cadence_unit}
                    onChange={e => setFormData({...formData, cadence_unit: e.target.value})}
                  >
                    <option value="day">DAILY</option>
                    <option value="week">WEEKLY</option>
                    <option value="month">MONTHLY</option>
                    <option value="year">YEARLY</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="pt-8 border-t border-white/10 flex flex-col items-center gap-4">
        <button 
          onClick={() => onSuccess(formData)}
          disabled={!formData.name || !formData.trigger_type || !formData.output_type}
          className="bg-blue-600 hover:bg-blue-500 text-white !px-16 !py-4 !rounded-xl shadow-xl disabled:opacity-20 group flex items-center gap-4 text-base font-black uppercase tracking-widest transition-all active:scale-[0.98]"
        >
          Finalize Configuration <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em]">Advanced Planning System v4.2</p>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
