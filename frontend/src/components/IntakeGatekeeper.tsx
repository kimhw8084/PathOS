import React, { useState } from 'react';
import { 
  ShieldAlert, Zap, Target, ArrowRight, ChevronLeft, 
  Layout, CheckCircle2, XCircle, Box
} from 'lucide-react';

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  taxonomy: any[];
}

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, taxonomy }) => {
  const [phase, setPhase] = useState<'rubric' | 'definition'>('rubric');
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
    repeatability_check: true // Forced true if they pass the rubric
  });

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');
  const toolFamilies = taxonomy.filter(t => t.category === 'ToolType');

  const handleRubricSubmit = () => {
    if (rubricAnswers.is_standard && rubricAnswers.is_repeatable && rubricAnswers.has_measurable_output) {
      setPhase('definition');
    } else {
      // Rejection logic handled by UI
    }
  };

  const isRubricFailed = !rubricAnswers.is_standard || !rubricAnswers.is_repeatable || !rubricAnswers.has_measurable_output;

  if (phase === 'rubric') {
    return (
      <div className="max-w-xl mx-auto mt-12 animate-in zoom-in duration-300">
        <div className="bg-theme-card border border-theme-border rounded-lg overflow-hidden shadow-2xl">
          <div className="h-12 bg-theme-header border-b border-theme-border flex items-center px-6 gap-3">
            <ShieldAlert size={16} className="text-theme-accent" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Pre-Flight_Rubric_Intercept</span>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Protocol_Validation</h2>
              <p className="text-xs text-theme-secondary leading-relaxed uppercase font-bold tracking-widest opacity-60">Answer the following requirements to initialize the architect session.</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => setRubricAnswers({...rubricAnswers, is_standard: !rubricAnswers.is_standard})}
                className={`w-full p-4 rounded border flex items-center justify-between transition-all ${rubricAnswers.is_standard ? 'bg-theme-accent/10 border-theme-accent text-white' : 'bg-white/5 border-theme-border text-theme-muted hover:border-theme-border-bright'}`}
              >
                <div className="flex items-center gap-4">
                  <Layout size={18} />
                  <span className="text-xs font-black uppercase tracking-tight">Is this a standardized process?</span>
                </div>
                {rubricAnswers.is_standard ? <CheckCircle2 size={18} className="text-theme-accent" /> : <div className="w-4 h-4 border border-theme-border rounded-sm" />}
              </button>

              <button 
                onClick={() => setRubricAnswers({...rubricAnswers, is_repeatable: !rubricAnswers.is_repeatable})}
                className={`w-full p-4 rounded border flex items-center justify-between transition-all ${rubricAnswers.is_repeatable ? 'bg-theme-accent/10 border-theme-accent text-white' : 'bg-white/5 border-theme-border text-theme-muted hover:border-theme-border-bright'}`}
              >
                <div className="flex items-center gap-4">
                  <Target size={18} />
                  <span className="text-xs font-black uppercase tracking-tight">Is this execution repeatable?</span>
                </div>
                {rubricAnswers.is_repeatable ? <CheckCircle2 size={18} className="text-theme-accent" /> : <div className="w-4 h-4 border border-theme-border rounded-sm" />}
              </button>

              <button 
                onClick={() => setRubricAnswers({...rubricAnswers, has_measurable_output: !rubricAnswers.has_measurable_output})}
                className={`w-full p-4 rounded border flex items-center justify-between transition-all ${rubricAnswers.has_measurable_output ? 'bg-theme-accent/10 border-theme-accent text-white' : 'bg-white/5 border-theme-border text-theme-muted hover:border-theme-border-bright'}`}
              >
                <div className="flex items-center gap-4">
                  <Zap size={18} />
                  <span className="text-xs font-black uppercase tracking-tight">Does it produce a measurable output?</span>
                </div>
                {rubricAnswers.has_measurable_output ? <CheckCircle2 size={18} className="text-theme-accent" /> : <div className="w-4 h-4 border border-theme-border rounded-sm" />}
              </button>
            </div>

            {isRubricFailed && (
              <div className="bg-status-error/10 border border-status-error/30 p-4 rounded-md flex items-start gap-3">
                <XCircle size={16} className="text-status-error shrink-0 mt-0.5" />
                <p className="text-[10px] text-status-error font-black uppercase leading-tight">
                  Validation Failed: Workflows must be standard, repeatable processes with measurable outputs. One-off troubleshooting should be handled via Jira.
                </p>
              </div>
            )}

            <button 
              onClick={handleRubricSubmit}
              disabled={isRubricFailed}
              className="w-full bg-theme-accent text-white py-4 rounded font-black uppercase text-[11px] tracking-[0.2em] shadow-lg disabled:opacity-10 hover:scale-[1.01] transition-all"
            >
              Initialize_Workflow_Definition
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between border-b border-theme-border pb-4">
        <div className="flex items-center gap-3">
          <Box size={20} className="text-theme-accent" />
          <h2 className="text-lg font-black uppercase tracking-tighter italic text-white">
            Unified_Header_Definition
          </h2>
        </div>
        <button onClick={() => setPhase('rubric')} className="text-[10px] font-black text-theme-muted hover:text-white uppercase tracking-widest flex items-center gap-2">
          <ChevronLeft size={12} /> Reset_Rubric
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Identification & Trigger */}
        <div className="space-y-6">
          <div className="space-y-4 bg-white/[0.02] border border-theme-border p-6 rounded-lg">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Workflow_Title</label>
              <input 
                className="input-apple font-black text-lg uppercase tracking-tight" 
                placeholder="E.G. CD-SEM_RECIPE_AUTO_QUAL" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Hardware_Family</label>
                <select 
                  className="input-apple font-bold uppercase"
                  value={formData.tool_family}
                  onChange={e => setFormData({...formData, tool_family: e.target.value})}
                >
                  <option value="">Select Family...</option>
                  {toolFamilies.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Frequency_ (Ops/Wk)</label>
                <input 
                  type="number" 
                  className="input-apple font-mono font-black text-theme-accent" 
                  value={formData.frequency} 
                  onChange={e => setFormData({...formData, frequency: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-white/[0.02] border border-theme-border p-6 rounded-lg">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Trigger_Archetype</label>
              <select 
                className="input-apple font-bold uppercase text-theme-accent"
                value={formData.trigger_type}
                onChange={e => setFormData({...formData, trigger_type: e.target.value})}
              >
                <option value="">Select Trigger...</option>
                {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Trigger_Logistics</label>
              <textarea 
                className="input-apple h-24 resize-none leading-tight" 
                placeholder="Describe the exact event that initiates this sequence..." 
                value={formData.trigger_description} 
                onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
              />
            </div>
          </div>
        </div>

        {/* Right Column: Output & Environment */}
        <div className="space-y-6">
          <div className="space-y-4 bg-white/[0.02] border border-theme-border p-6 rounded-lg">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Output_Classification</label>
              <select 
                className="input-apple font-bold uppercase text-theme-secondary"
                value={formData.output_type}
                onChange={e => setFormData({...formData, output_type: e.target.value})}
              >
                <option value="">Select Output...</option>
                {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted">Deliverable_Specification</label>
              <textarea 
                className="input-apple h-24 resize-none leading-tight" 
                placeholder="Describe the final state or product of this workflow..." 
                value={formData.output_description} 
                onChange={e => setFormData({...formData, output_description: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-4 bg-white/[0.02] border border-theme-border p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-theme-accent" 
                  checked={formData.involves_equipment} 
                  onChange={e => setFormData({...formData, involves_equipment: e.target.checked})} 
                />
                <span className="text-[10px] font-black text-theme-secondary uppercase tracking-widest group-hover:text-white transition-colors">Involves_Equipment?</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-theme-accent" 
                  checked={formData.cleanroom_execution_required} 
                  onChange={e => setFormData({...formData, cleanroom_execution_required: e.target.checked})} 
                />
                <span className="text-[10px] font-black text-theme-secondary uppercase tracking-widest group-hover:text-white transition-colors">Cleanroom_Required</span>
              </label>
            </div>

            {formData.involves_equipment && (
              <div className="space-y-1.5 pt-2 animate-in slide-in-from-top duration-200">
                <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Equipment_State_Threshold</label>
                <div className="grid grid-cols-4 gap-1">
                  {['Idle', 'Local', 'Run', 'Down'].map(state => (
                    <button 
                      key={state}
                      onClick={() => setFormData({...formData, equipment_state: state})}
                      className={`py-1.5 text-[9px] font-black uppercase rounded border transition-all ${formData.equipment_state === state ? 'bg-theme-accent border-theme-accent text-white' : 'bg-black/20 border-theme-border text-theme-muted hover:border-theme-muted'}`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-8 flex items-center justify-center">
        <button 
          onClick={() => onSuccess(formData)}
          disabled={!formData.name || !formData.trigger_type || !formData.output_type}
          className="bg-theme-accent text-white px-12 py-4 rounded-full text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(var(--theme-accent-rgb),0.3)] hover:scale-[1.05] transition-all disabled:opacity-10 flex items-center gap-3"
        >
          Initialize_Architecture <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
