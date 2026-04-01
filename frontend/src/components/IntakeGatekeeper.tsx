import React, { useState } from 'react';
import { ShieldAlert, Zap, Target, ArrowRight, ChevronLeft } from 'lucide-react';

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  taxonomy: any[];
}

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, taxonomy }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    trigger_type: '',
    trigger_description: '',
    repeatability_check: false,
    output_type: '',
    output_description: '',
    frequency: 20
  });

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between border-b border-theme-border pb-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-theme-secondary flex items-center gap-2">
          <Zap size={14} className="text-theme-accent" /> Node_Registration_Protocol
        </h2>
        <span className="text-[10px] font-mono text-theme-muted uppercase">Phase {step} / 3</span>
      </div>

      <div className="apple-card bg-theme-card">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">NODE_IDENTIFIER</label>
              <input className="input-apple font-bold uppercase" placeholder="NAME..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">TRIGGER_ARCHETYPE</label>
              <div className="grid grid-cols-3 gap-1.5">
                {triggerTypes.map(t => (
                  <button key={t.value} onClick={() => setFormData({...formData, trigger_type: t.value})}
                    className={`py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-colors ${formData.trigger_type === t.value ? 'bg-theme-accent border-theme-accent text-white' : 'bg-white/5 border-theme-border text-theme-secondary hover:border-theme-border-bright'}`}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">TRIGGER_LOGISTICS</label>
              <textarea className="input-apple h-20 resize-none leading-tight" placeholder="DESCRIPTION..." value={formData.trigger_description} onChange={e => setFormData({...formData, trigger_description: e.target.value})} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-status-warning/5 border border-status-warning/20 p-3 rounded flex items-center gap-3">
              <ShieldAlert size={16} className="text-status-warning shrink-0" />
              <p className="text-[10px] text-status-warning font-bold uppercase leading-tight">System tracks repeatable SOPs only. Isolated incidents proceed via Jira.</p>
            </div>
            <button onClick={() => setFormData({...formData, repeatability_check: !formData.repeatability_check})}
              className={`w-full p-4 rounded border flex items-center justify-between transition-all ${formData.repeatability_check ? 'bg-status-success/10 border-status-success text-status-success' : 'bg-white/5 border-theme-border text-theme-secondary hover:border-theme-border-bright'}`}>
              <div className="flex items-center gap-3">
                <Target size={16} />
                <span className="font-black text-xs uppercase tracking-tight">SOP_Execution_Verified</span>
              </div>
              <div className={`w-4 h-4 rounded-sm border ${formData.repeatability_check ? 'bg-status-success border-status-success' : 'border-theme-border'}`} />
            </button>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">OPERATIONAL_FREQUENCY (MO)</label>
              <input type="number" className="input-apple font-mono text-lg font-black" value={formData.frequency} onChange={e => setFormData({...formData, frequency: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">OUTPUT_CLASSIFICATION</label>
              <div className="grid grid-cols-2 gap-1.5">
                {outputTypes.map(t => (
                  <button key={t.value} onClick={() => setFormData({...formData, output_type: t.value})}
                    className={`py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-colors ${formData.output_type === t.value ? 'bg-theme-accent border-theme-accent text-white' : 'bg-white/5 border-theme-border text-theme-secondary hover:border-theme-border-bright'}`}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-theme-muted">DELIVERABLE_SPECIFICATION</label>
              <textarea className="input-apple h-32 resize-none leading-tight" placeholder="QUANTIFIABLE_OUTCOME..." value={formData.output_description} onChange={e => setFormData({...formData, output_description: e.target.value})} />
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-theme-border flex items-center justify-between">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-[10px] font-black uppercase text-theme-secondary hover:text-theme-primary"><ChevronLeft size={12} /> BACK</button>
          ) : <div />}
          <button 
            onClick={() => step < 3 ? setStep(step + 1) : onSuccess(formData)}
            disabled={
              (step === 1 && (!formData.name || !formData.trigger_type || !formData.trigger_description)) ||
              (step === 2 && !formData.repeatability_check) ||
              (step === 3 && (!formData.output_type || !formData.output_description))
            }
            className="bg-theme-accent text-white px-6 py-2 rounded text-[10px] font-black uppercase flex items-center gap-2 disabled:opacity-20">
            {step === 3 ? "COMMIT_INITIATIVE" : "NEXT_PHASE"} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
