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
    trigger_type: '',
    trigger_description: '',
    output_type: '',
    output_description: '',
    frequency: 20,
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
  
  // Connect to System Parameters for Hardware Family
  const hardwareFamilies = useMemo(() => {
    const param = systemParams.find(p => p.key === 'HARDWARE_FAMILY');
    if (param) {
      return (param.is_dynamic ? param.cached_values : param.manual_values) || [];
    }
    // Fallback to taxonomy if system parameter not found
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
        <div className="apple-card !p-0 overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.4)] border-theme-border">
          <div className="h-16 bg-white/[0.02] border-b border-theme-border flex items-center px-10 gap-4">
            <div className="p-2 bg-theme-accent/10 rounded-xl">
              <ShieldAlert size={20} className="text-theme-accent" />
            </div>
            <span className="text-nav text-white font-bold">System Intake Validation</span>
          </div>
          
          <div className="p-12 space-y-10">
            <div className="space-y-3">
              <h2 className="text-header-main text-white">Pre-Flight Rubric</h2>
              <p className="text-subtext text-theme-secondary max-w-md">Verify the following operational criteria to initialize the strategy architect session.</p>
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
                  className={`w-full p-6 rounded-2xl border flex items-center justify-between transition-all duration-300 group ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent/[0.08] border-theme-accent/50' : 'bg-white/[0.02] border-theme-border hover:border-theme-border-bright hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-5 text-left">
                    <div className={`p-3 rounded-xl transition-all duration-300 ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent text-white shadow-lg shadow-theme-accent/40' : 'bg-white/[0.05] text-theme-muted group-hover:text-theme-secondary'}`}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <span className={`text-[15px] font-bold block ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'text-white' : 'text-theme-secondary group-hover:text-white'}`}>{item.label}</span>
                      <span className="text-hint text-theme-muted opacity-60 normal-case tracking-tight group-hover:opacity-100 transition-opacity">{item.desc}</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent border-theme-accent scale-110 shadow-[0_0_12px_rgba(0,122,255,0.4)]' : 'border-theme-border group-hover:border-theme-secondary'}`}>
                    {rubricAnswers[item.id as keyof typeof rubricAnswers] && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>

            {isRubricFailed && (
              <div className="bg-status-error/10 border border-status-error/20 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <XCircle size={18} className="text-status-error shrink-0 mt-0.5" />
                <p className="text-[13px] text-status-error font-bold leading-relaxed">
                  Validation Notice: Automation is reserved for standardized, repeatable tasks. One-off troubleshooting should be escalated via departmental JIRA channels.
                </p>
              </div>
            )}

            <button 
              onClick={handleRubricSubmit}
              disabled={isRubricFailed}
              className="w-full btn-apple-primary !py-5 !rounded-2xl tracking-normal shadow-2xl disabled:opacity-5 shadow-theme-accent/30 flex items-center justify-center gap-3 group"
            >
              Initialize Strategy Definition <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12 animate-apple-in pb-20">
      <div className="flex items-center justify-between border-b border-theme-border/50 pb-8">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-theme-accent/10 rounded-2xl border border-theme-accent/20">
            <Layers size={28} className="text-theme-accent" />
          </div>
          <div>
            <h2 className="text-header-main text-white font-black tracking-tight">Strategy Definition</h2>
            <p className="text-subtext text-theme-secondary">Map the high-level metadata for this automation node.</p>
          </div>
        </div>
        <button onClick={() => setPhase('rubric')} className="btn-apple-secondary flex items-center gap-2 group border-theme-border hover:border-theme-accent/50">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Reset Rubric
        </button>
      </div>

      <div className="space-y-12">
        {/* Section 1: Identity */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 text-theme-accent font-bold px-2">
            <Cpu size={18} />
            <span className="text-[13px] tracking-[0.2em] uppercase">Identity & Infrastructure</span>
          </div>
          
          <div className="apple-card space-y-8 !bg-white/[0.01] border-theme-border">
            <div className="space-y-3 px-2">
              <label className="text-hint text-theme-secondary font-bold flex items-center justify-between">
                <span>Workflow Title</span>
                <span className="text-[10px] opacity-40 font-mono">NODE_IDENTIFIER</span>
              </label>
              <input 
                className="input-apple !bg-black/60 text-xl font-black text-white placeholder:text-theme-muted/30 focus:border-theme-accent" 
                placeholder="e.g. CD-SEM Recipe Qualification" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3 px-2">
                <label className="text-hint text-theme-secondary font-bold flex items-center gap-2">
                   Hardware Family
                </label>
                <div className="relative group">
                  <select 
                    className="input-apple !bg-black/60 font-bold appearance-none text-white focus:border-theme-accent pr-10"
                    value={formData.tool_family}
                    onChange={e => setFormData({...formData, tool_family: e.target.value})}
                  >
                    <option value="">Select Hardware...</option>
                    {hardwareFamilies.map((f: any) => (
                      <option key={typeof f === 'string' ? f : f.value} value={typeof f === 'string' ? f : f.value}>
                        {typeof f === 'string' ? f : f.label}
                      </option>
                    ))}
                  </select>
                  <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none group-hover:text-theme-accent transition-colors" size={14} />
                </div>
              </div>
              <div className="space-y-3 px-2">
                <label className="text-hint text-theme-secondary font-bold">Specific Tool ID</label>
                <div className="relative">
                  <select 
                    className="input-apple !bg-black/60 font-bold appearance-none text-theme-accent focus:border-theme-accent pr-10"
                    value={formData.tool_id}
                    onChange={e => setFormData({...formData, tool_id: e.target.value})}
                  >
                    <option value="">Manual Entry / None</option>
                    {toolIds.map((v: string) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <HardDrive className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" size={14} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Logistics */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 text-status-success font-bold px-2">
            <Zap size={18} />
            <span className="text-[13px] tracking-[0.2em] uppercase">Flow Logistics</span>
          </div>

          <div className="apple-card space-y-8 !bg-white/[0.01] border-theme-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-3 px-2">
                  <label className="text-hint text-theme-secondary font-bold">Trigger Archetype</label>
                  <select 
                    className="input-apple !bg-black/60 font-bold text-status-success appearance-none focus:border-status-success pr-10"
                    value={formData.trigger_type}
                    onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                  >
                    <option value="">Select Primary Trigger...</option>
                    {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-3 px-2">
                  <label className="text-hint text-theme-secondary font-bold">Initiation Detail</label>
                  <textarea 
                    className="input-apple !bg-black/60 h-32 resize-none leading-relaxed text-[14px] text-white focus:border-status-success placeholder:text-theme-muted/30" 
                    placeholder="Describe the exact event that initiates this sequence..." 
                    value={formData.trigger_description} 
                    onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-6 border-l border-theme-border/50 pl-0 md:pl-8">
                <div className="space-y-3 px-2">
                  <label className="text-hint text-theme-secondary font-bold">Output Classification</label>
                  <select 
                    className="input-apple !bg-black/60 font-bold text-theme-accent appearance-none focus:border-theme-accent pr-10"
                    value={formData.output_type}
                    onChange={e => setFormData({...formData, output_type: e.target.value})}
                  >
                    <option value="">Select Primary Output...</option>
                    {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-3 px-2">
                  <label className="text-hint text-theme-secondary font-bold">Deliverable Specification</label>
                  <textarea 
                    className="input-apple !bg-black/60 h-32 resize-none leading-relaxed text-[14px] text-white focus:border-theme-accent placeholder:text-theme-muted/30" 
                    placeholder="Describe the final state or product of this workflow..." 
                    value={formData.output_description} 
                    onChange={e => setFormData({...formData, output_description: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Performance */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 text-theme-secondary font-bold px-2">
            <Clock size={18} />
            <span className="text-[13px] tracking-[0.2em] uppercase">Operational Cadence</span>
          </div>

          <div className="apple-card !bg-theme-accent/[0.02] border-theme-accent/20 p-8">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 space-y-4">
                <h4 className="text-header-sub text-white font-bold">Weekly Execution Frequency</h4>
                <p className="text-subtext text-theme-secondary leading-relaxed">
                  How many times does this sequence repeat across all shifts per week? This directly scales the projected ROI.
                </p>
              </div>
              <div className="w-full md:w-48 space-y-3">
                <div className="relative">
                  <input 
                    type="number" 
                    className="input-apple !bg-black/80 font-black text-3xl text-theme-accent text-center !py-6 border-theme-accent/30 focus:border-theme-accent h-24" 
                    value={formData.frequency} 
                    onChange={e => setFormData({...formData, frequency: parseFloat(e.target.value)})} 
                  />
                  <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-theme-accent font-bold uppercase tracking-widest opacity-40">Hz / Week</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="pt-12 border-t border-theme-border/50 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <button 
          onClick={() => onSuccess(formData)}
          disabled={!formData.name || !formData.trigger_type || !formData.output_type}
          className="btn-apple-primary !px-20 !py-6 !rounded-2xl shadow-[0_20px_40px_rgba(0,122,255,0.3)] disabled:opacity-5 group flex items-center gap-4 text-lg font-bold"
        >
          Initialize Strategy Architecture <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-hint text-theme-muted normal-case opacity-40">Verification Protocol v1.2.6 • Samsung PathOS Engine</p>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
