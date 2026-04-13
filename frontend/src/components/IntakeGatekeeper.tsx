import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, Zap, Target, ArrowRight, ChevronLeft, 
  Layout, CheckCircle2, XCircle, Clock, Layers,
  Cpu, HardDrive, Settings, Hash, Activity
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

  const handleRubricSubmit = () => {
    if (rubricAnswers.is_standard && rubricAnswers.is_repeatable && rubricAnswers.has_measurable_output) {
      setPhase('definition');
    }
  };

  const isRubricFailed = !rubricAnswers.is_standard || !rubricAnswers.is_repeatable || !rubricAnswers.has_measurable_output;

  if (phase === 'rubric') {
    return (
      <div className="max-w-2xl mx-auto mt-20 animate-apple-in">
        <div className="apple-card !p-0 overflow-hidden shadow-[0_32px_128px_rgba(0,0,0,0.5)] border-theme-border bg-[#111827]/80">
          <div className="h-20 bg-white/[0.03] border-b border-theme-border flex items-center px-10 gap-5">
            <div className="p-3 bg-blue-500/20 rounded-2xl">
              <ShieldAlert size={24} className="text-blue-400" />
            </div>
            <div>
              <span className="text-nav text-white font-black uppercase tracking-widest block leading-tight">Request Validation</span>
              <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.2em]">Phase 01: Initial Assessment</span>
            </div>
          </div>
          
          <div className="p-12 space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white tracking-tighter leading-tight uppercase">Process Configuration</h2>
              <p className="text-subtext text-theme-secondary max-w-md leading-relaxed">Verification of operational baseline is required to proceed with process mapping.</p>
            </div>

            <div className="space-y-4">
              {[
                { id: 'is_standard', label: 'Standardized Process', icon: Layout, desc: 'Does this follow a documented SOP or departmental standard?' },
                { id: 'is_repeatable', label: 'Repeatable Execution', icon: Target, desc: 'Is the logic consistent across different operators?' },
                { id: 'has_measurable_output', label: 'Measurable Yield', icon: Zap, desc: 'Does it result in a verifiable data point or hardware state?' }
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setRubricAnswers({...rubricAnswers, [item.id]: !rubricAnswers[item.id as keyof typeof rubricAnswers]})}
                  className={`w-full p-6 rounded-2xl border flex items-center justify-between transition-all duration-300 group ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5' : 'bg-white/[0.03] border-theme-border hover:border-white/30 hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center gap-6 text-left">
                    <div className={`p-4 rounded-xl transition-all duration-300 ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40' : 'bg-[#1e293b] text-white/40 group-hover:text-white'}`}>
                      <item.icon size={22} />
                    </div>
                    <div>
                      <span className={`text-[16px] font-black block uppercase tracking-tight ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>{item.label}</span>
                      <span className="text-[12px] text-white/30 font-bold normal-case tracking-tight group-hover:text-white/60 transition-colors">{item.desc}</span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-blue-600 border-blue-600 scale-110 shadow-lg shadow-blue-600/30' : 'border-white/10 group-hover:border-white/30'}`}>
                    {rubricAnswers[item.id as keyof typeof rubricAnswers] && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>

            {isRubricFailed && (
              <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-red-500 font-black uppercase tracking-tight leading-tight">Operational Constraint Detected</p>
                  <p className="text-[11px] text-red-500/60 font-bold mt-1">Automation is reserved for standardized, repeatable tasks. Verify criteria to proceed.</p>
                </div>
              </div>
            )}

            <button 
              onClick={handleRubricSubmit}
              disabled={isRubricFailed}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white !py-6 !rounded-2xl tracking-widest uppercase font-black text-[13px] shadow-2xl disabled:opacity-20 shadow-blue-600/30 flex items-center justify-center gap-4 group transition-all"
            >
              Start Process Definition <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-apple-in pb-20">
      <div className="flex items-center justify-between border-b border-white/10 pb-10">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-blue-600/20 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Layers size={32} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter leading-tight uppercase">Process Definition</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-blue-400 font-black uppercase tracking-[0.3em]">Primary Configuration</span>
              <div className="h-1 w-1 bg-white/20 rounded-full" />
              <p className="text-subtext text-white/40 font-bold">Initializing operational high-level metadata.</p>
            </div>
          </div>
        </div>
        <button onClick={() => setPhase('rubric')} className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/30 transition-all font-black text-[11px] uppercase tracking-widest flex items-center gap-3 group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Restart Assessment
        </button>
      </div>

      <div className="space-y-12">
        {/* Section 1: Identity */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 text-blue-400 font-black px-2">
            <Cpu size={20} />
            <span className="text-[14px] tracking-[0.3em] uppercase">Identity & Infrastructure</span>
          </div>
          
          <div className="apple-card space-y-10 !bg-[#111827]/40 border-white/10 p-10">
            <div className="space-y-4 px-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Process Name</label>
                <span className="text-[10px] text-white/20 font-mono">{formData.name.length} / 60</span>
              </div>
              <input 
                className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-6 py-5 text-2xl font-black text-white uppercase focus:border-blue-500 outline-none transition-all placeholder:text-white/5" 
                placeholder="ENTER NAME..." 
                maxLength={60}
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-4 px-2">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Hardware Family</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-6 py-4 text-[14px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
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
                  <Settings className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={16} />
                </div>
              </div>
              <div className="space-y-4 px-2">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Specific Tool ID</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-6 py-4 text-[14px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.tool_id}
                    onChange={e => setFormData({...formData, tool_id: e.target.value})}
                  >
                    <option value="">MANUAL ENTRY / NONE</option>
                    {toolIds.map((v: string) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <HardDrive className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={16} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Logistics */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4 text-blue-400 font-black px-2">
            <Zap size={20} />
            <span className="text-[14px] tracking-[0.3em] uppercase">Logistics Matrix</span>
          </div>

          <div className="apple-card space-y-12 !bg-[#111827]/40 border-white/10 p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4 px-2">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Trigger Mechanism</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-6 py-4 text-[14px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.trigger_type}
                    onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                  >
                    <option value="">SELECT TRIGGER...</option>
                    {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Zap className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={16} />
                </div>
              </div>

              <div className="space-y-4 px-2">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Output Classification</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-6 py-4 text-[14px] font-black text-white appearance-none focus:border-blue-500 outline-none transition-all cursor-pointer"
                    value={formData.output_type}
                    onChange={e => setFormData({...formData, output_type: e.target.value})}
                  >
                    <option value="">SELECT OUTPUT...</option>
                    {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Layers className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-blue-400 transition-colors" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-4 px-2 border-t border-white/5 pt-10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Trigger Architecture</label>
                <span className="text-[10px] text-white/20 font-mono">{formData.trigger_description.length} / 500</span>
              </div>
              <textarea 
                className="w-full bg-[#1e293b]/30 border border-white/10 rounded-2xl px-6 py-5 text-[14px] text-white/80 font-bold leading-relaxed h-32 resize-none outline-none focus:border-blue-500 transition-all" 
                placeholder="Specify the exact event or state that initiates this workflow..." 
                maxLength={500}
                value={formData.trigger_description} 
                onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
              />
            </div>

            <div className="space-y-4 px-2 border-t border-white/5 pt-10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Output Deliverable</label>
                <span className="text-[10px] text-white/20 font-mono">{formData.output_description.length} / 500</span>
              </div>
              <textarea 
                className="w-full bg-[#1e293b]/30 border border-white/10 rounded-2xl px-6 py-5 text-[14px] text-white/80 font-bold leading-relaxed h-32 resize-none outline-none focus:border-blue-500 transition-all" 
                placeholder="Define the final product, state, or verification result..." 
                maxLength={500}
                value={formData.output_description} 
                onChange={e => setFormData({...formData, output_description: e.target.value})} 
              />
            </div>
          </div>
        </section>

        {/* Section 3: Performance */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-4 text-white/60 font-black px-2">
            <Clock size={20} />
            <span className="text-[14px] tracking-[0.3em] uppercase">Execution Strategy</span>
          </div>

          <div className="apple-card !bg-blue-600/5 border-blue-500/20 p-12">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-4">
                <h4 className="text-2xl font-black text-white uppercase tracking-tight">Global Cadence</h4>
                <p className="text-subtext text-white/40 font-bold leading-relaxed">
                  Define the operational frequency to project high-precision reclaimed ROI hours.
                </p>
              </div>
              <div className="w-full md:w-80 flex items-center gap-4">
                <div className="flex-1 relative group">
                  <div className="absolute -top-3 left-4 bg-[#0a1120] px-2 z-10">
                    <span className="text-[11px] text-blue-400 font-black uppercase tracking-widest">Count</span>
                  </div>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full bg-[#1e293b] border-2 border-blue-500/30 font-black text-4xl text-white text-center py-8 rounded-2xl focus:border-blue-500 outline-none transition-all shadow-xl shadow-blue-500/5" 
                    value={formData.cadence_count} 
                    onChange={e => setFormData({...formData, cadence_count: parseFloat(e.target.value)})} 
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Hash size={12} className="text-blue-500/40" />
                  </div>
                </div>
                <div className="w-28 h-28 bg-[#1e293b] border-2 border-white/10 rounded-2xl overflow-hidden relative group">
                  <select 
                    className="w-full h-full bg-transparent text-white font-black text-center appearance-none cursor-pointer hover:bg-white/5 transition-all uppercase text-[13px] tracking-tighter outline-none"
                    value={formData.cadence_unit}
                    onChange={e => setFormData({...formData, cadence_unit: e.target.value})}
                  >
                    <option value="day">PER DAY</option>
                    <option value="week">PER WEEK</option>
                    <option value="month">PER MONTH</option>
                    <option value="year">PER YEAR</option>
                  </select>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                    <Activity size={10} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="pt-16 border-t border-white/10 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <button 
          onClick={() => onSuccess(formData)}
          disabled={!formData.name || !formData.trigger_type || !formData.output_type}
          className="bg-blue-600 hover:bg-blue-500 text-white !px-24 !py-8 !rounded-2xl shadow-[0_32px_64px_rgba(59,130,246,0.3)] disabled:opacity-20 group flex items-center gap-6 text-xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Finalize Process Configuration <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
        </button>
        <p className="text-[11px] text-white/20 font-bold uppercase tracking-[0.4em]">Advanced Planning System v4.2</p>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
