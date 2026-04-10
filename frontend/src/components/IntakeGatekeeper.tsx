import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Zap, Target, ArrowRight, ChevronLeft, 
  Layout, CheckCircle2, XCircle, Box, Clock
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
    repeatability_check: true // Forced true if they pass the rubric
  });

  useEffect(() => {
    settingsApi.listParameters().then(setSystemParams).catch(() => {});
  }, []);

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');
  const toolFamilies = taxonomy.filter(t => t.category === 'ToolType');

  const handleRubricSubmit = () => {
    if (rubricAnswers.is_standard && rubricAnswers.is_repeatable && rubricAnswers.has_measurable_output) {
      setPhase('definition');
    }
  };

  const isRubricFailed = !rubricAnswers.is_standard || !rubricAnswers.is_repeatable || !rubricAnswers.has_measurable_output;

  if (phase === 'rubric') {
    return (
      <div className="max-w-2xl mx-auto mt-20 animate-apple-in">
        <div className="apple-card !p-0 overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
          <div className="h-16 bg-white/[0.02] border-b border-theme-border flex items-center px-10 gap-4">
            <div className="p-2 bg-theme-accent/10 rounded-xl">
              <ShieldAlert size={20} className="text-theme-accent" />
            </div>
            <span className="text-nav text-white">System Intake Validation</span>
          </div>
          
          <div className="p-12 space-y-10">
            <div className="space-y-3">
              <h2 className="text-header-main">Pre-Flight Rubric</h2>
              <p className="text-subtext max-w-md">Verify the following operational criteria to initialize the strategy architect session.</p>
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
                  className={`w-full p-6 rounded-2xl border flex items-center justify-between transition-all duration-300 group ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent/[0.05] border-theme-accent/50' : 'bg-white/[0.02] border-theme-border hover:border-theme-border-bright hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-5 text-left">
                    <div className={`p-3 rounded-xl transition-colors ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent text-white shadow-lg shadow-theme-accent/20' : 'bg-white/[0.05] text-theme-muted group-hover:text-theme-secondary'}`}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <span className={`text-[15px] font-bold block ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'text-white' : 'text-theme-secondary'}`}>{item.label}</span>
                      <span className="text-hint opacity-60 normal-case tracking-tight">{item.desc}</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${rubricAnswers[item.id as keyof typeof rubricAnswers] ? 'bg-theme-accent border-theme-accent' : 'border-theme-border'}`}>
                    {rubricAnswers[item.id as keyof typeof rubricAnswers] && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>

            {isRubricFailed && (
              <div className="bg-status-error/10 border border-status-error/20 p-5 rounded-2xl flex items-start gap-4">
                <XCircle size={18} className="text-status-error shrink-0 mt-0.5" />
                <p className="text-main-content text-status-error font-bold leading-relaxed">
                  Validation Notice: Automation is reserved for standardized, repeatable tasks. One-off troubleshooting should be escalated via departmental JIRA channels.
                </p>
              </div>
            )}

            <button 
              onClick={handleRubricSubmit}
              disabled={isRubricFailed}
              className="w-full btn-apple-primary !py-4 !rounded-2xl tracking-normal shadow-2xl disabled:opacity-5 shadow-theme-accent/30"
            >
              Initialize Strategy Definition
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-apple-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-theme-accent/10 rounded-2xl">
            <Box size={24} className="text-theme-accent" />
          </div>
          <div>
            <h2 className="text-header-main">Unified Definition</h2>
            <p className="text-subtext">Map the high-level metadata for this automation node.</p>
          </div>
        </div>
        <button onClick={() => setPhase('rubric')} className="btn-apple-secondary flex items-center gap-2">
          <ChevronLeft size={16} /> Reset Rubric
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <div className="apple-card space-y-6">
            <div className="space-y-2.5">
              <label className="text-hint px-1">Workflow Title</label>
              <input 
                className="input-apple !bg-black/40 text-lg font-bold" 
                placeholder="e.g. CD-SEM Recipe Qualification" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-hint px-1">Hardware Family</label>
                <select 
                  className="input-apple !bg-black/40 font-bold appearance-none"
                  value={formData.tool_family}
                  onChange={e => setFormData({...formData, tool_family: e.target.value})}
                >
                  <option value="">Select Hardware...</option>
                  {toolFamilies.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-2.5">
                <label className="text-hint px-1">Specific Tool ID</label>
                <select 
                  className="input-apple !bg-black/40 font-bold appearance-none text-theme-accent"
                  value={formData.tool_id}
                  onChange={e => setFormData({...formData, tool_id: e.target.value})}
                >
                  <option value="">Manual Entry / None</option>
                  {systemParams.find(p => p.key === 'TOOL_ID')?.cached_values?.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  {(!systemParams.find(p => p.key === 'TOOL_ID')?.cached_values) && (
                     <option disabled>No dynamic tools found. Configure in Settings.</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="apple-card space-y-6">
            <div className="space-y-2.5">
              <label className="text-hint px-1">Trigger Archetype</label>
              <select 
                className="input-apple !bg-black/40 font-bold text-theme-accent appearance-none"
                value={formData.trigger_type}
                onChange={e => setFormData({...formData, trigger_type: e.target.value})}
              >
                <option value="">Select Primary Trigger...</option>
                {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2.5">
              <label className="text-hint px-1">Logistics Detail</label>
              <textarea 
                className="input-apple !bg-black/40 h-28 resize-none leading-relaxed text-[13px]" 
                placeholder="Describe the exact event that initiates this sequence..." 
                value={formData.trigger_description} 
                onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div className="apple-card space-y-6">
            <div className="space-y-2.5">
              <label className="text-hint px-1">Output Classification</label>
              <select 
                className="input-apple !bg-black/40 font-bold text-theme-secondary appearance-none"
                value={formData.output_type}
                onChange={e => setFormData({...formData, output_type: e.target.value})}
              >
                <option value="">Select Primary Output...</option>
                {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2.5">
              <label className="text-hint px-1">Deliverable Specification</label>
              <textarea 
                className="input-apple !bg-black/40 h-28 resize-none leading-relaxed text-[13px]" 
                placeholder="Describe the final state or product of this workflow..." 
                value={formData.output_description} 
                onChange={e => setFormData({...formData, output_description: e.target.value})} 
              />
            </div>
          </div>

          <div className="apple-card space-y-6">
            <div className="flex items-center gap-3 text-theme-accent border-b border-theme-border/50 pb-3">
              <Clock size={18} />
              <span className="text-hint text-theme-accent">Operational Cadence</span>
            </div>
            <div className="space-y-2.5">
              <label className="text-hint px-1">Weekly Execution Frequency</label>
              <input 
                type="number" 
                className="input-apple !bg-black/40 font-black text-lg text-theme-accent" 
                value={formData.frequency} 
                onChange={e => setFormData({...formData, frequency: parseFloat(e.target.value)})} 
              />
              <p className="text-hint text-[10px] normal-case opacity-40 px-1">How many times this sequence repeats across all shifts per week.</p>
            </div>
          </div>
          </div>

      </div>

      <div className="pt-10 flex items-center justify-center">
        <button 
          onClick={() => onSuccess(formData)}
          disabled={!formData.name || !formData.trigger_type || !formData.output_type}
          className="btn-apple-primary !px-16 !py-5 !rounded-2xl shadow-2xl disabled:opacity-5 group"
        >
          Initialize Strategy Architecture <ArrowRight size={20} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>

  );
};

export default IntakeGatekeeper;
