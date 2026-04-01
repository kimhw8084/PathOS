import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react';

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  taxonomy: any[];
}

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, taxonomy }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    repeatability_check: false,
    output_type: '',
    output_description: '',
    frequency_per_month: 20
  });

  const categories = Array.from(new Set(taxonomy.map(t => t.category)));

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onSuccess(formData);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-theme-accent/10 text-theme-accent mb-6 shadow-2xl shadow-theme-accent/20">
          <Sparkles size={32} />
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mb-3">Initiative Intake</h2>
        <p className="text-theme-secondary text-lg opacity-60">Architecting new automation nodes for the Metrology Ecosystem.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[1, 2, 3].map(i => (
          <React.Fragment key={i}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-500 ${step >= i ? 'bg-theme-accent text-white shadow-lg shadow-theme-accent/30 scale-110' : 'bg-white/5 text-theme-muted border border-theme-border'}`}>
              {step > i ? <CheckCircle2 size={18} /> : i}
            </div>
            {i < 3 && <div className={`w-12 h-0.5 rounded-full transition-all duration-500 ${step > i ? 'bg-theme-accent' : 'bg-theme-border'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="apple-card p-10 bg-theme-bg/40 backdrop-blur-3xl shadow-3xl border border-white/5 transition-all duration-500">
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-theme-accent px-1">Definition</label>
              <input 
                className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-lg font-medium text-white placeholder:text-theme-muted focus:border-theme-accent/50 outline-none transition-all focus:bg-white/[0.08]"
                placeholder="Name of this initiative..."
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-theme-accent px-1">Taxonomy Category</label>
              <div className="grid grid-cols-2 gap-3">
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setFormData({...formData, category: cat})}
                    className={`p-4 rounded-2xl border text-sm font-semibold transition-all duration-300 ${formData.category === cat ? 'bg-theme-accent/10 border-theme-accent text-theme-accent shadow-lg shadow-theme-accent/10' : 'bg-white/5 border-theme-border text-theme-secondary hover:border-theme-border-bright hover:bg-white/10'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="p-6 rounded-2xl bg-status-warning/5 border border-status-warning/20 flex gap-4">
              <ShieldAlert className="text-status-warning shrink-0" size={24} />
              <div>
                <h4 className="text-status-warning font-bold text-sm mb-1 uppercase tracking-tight">The Gatekeeper Protocol</h4>
                <p className="text-xs text-status-warning/80 leading-relaxed font-medium">PathOS only tracks repeatable, high-frequency workflows. One-off troubleshooting should proceed via Jira.</p>
              </div>
            </div>

            <button 
              onClick={() => setFormData({...formData, repeatability_check: !formData.repeatability_check})}
              className={`w-full p-6 rounded-2xl border flex items-center justify-between transition-all duration-300 ${formData.repeatability_check ? 'bg-status-success/10 border-status-success text-status-success shadow-lg shadow-status-success/10' : 'bg-white/5 border-theme-border text-theme-secondary hover:border-theme-border-bright'}`}
            >
              <div className="flex flex-col items-start text-left">
                <span className="font-bold text-lg">Repeatable Process?</span>
                <span className="text-xs opacity-60">Confirm this follows a standard SOP or procedure.</span>
              </div>
              {formData.repeatability_check && <CheckCircle2 size={24} />}
            </button>

            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-theme-accent px-1">Cycle Frequency (Per Month)</label>
              <input 
                type="number"
                className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-xl font-mono font-bold text-white focus:border-theme-accent/50 outline-none transition-all"
                value={formData.frequency_per_month}
                onChange={e => setFormData({...formData, frequency_per_month: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-theme-accent px-1">Primary Output Product</label>
              <select 
                className="w-full bg-theme-bg border border-theme-border rounded-2xl p-4 text-white focus:border-theme-accent/50 outline-none appearance-none transition-all cursor-pointer"
                value={formData.output_type}
                onChange={e => setFormData({...formData, output_type: e.target.value})}
              >
                <option value="">Select Output Class...</option>
                <option value="Recipe">Automation Recipe (CD-SEM/OVL)</option>
                <option value="Analysis">Structured Data Report</option>
                <option value="Optimization">Parameter Tuning Configuration</option>
                <option value="Documentation">Knowledge Base Entry (Wiki)</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-theme-accent px-1">Outcome Specification</label>
              <textarea 
                className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-sm font-medium text-white placeholder:text-theme-muted focus:border-theme-accent/50 outline-none transition-all h-32 resize-none leading-relaxed"
                placeholder="What exactly is delivered at the end of this workflow?"
                value={formData.output_description}
                onChange={e => setFormData({...formData, output_description: e.target.value})}
              />
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-between gap-6 pt-8 border-t border-white/5">
          {step > 1 ? (
            <button 
              onClick={() => setStep(step - 1)}
              className="px-8 py-3 text-sm font-bold text-theme-secondary hover:text-white transition-colors"
            >
              Back
            </button>
          ) : <div />}
          
          <button 
            onClick={handleNext}
            disabled={
              (step === 1 && (!formData.name || !formData.category)) ||
              (step === 2 && !formData.repeatability_check) ||
              (step === 3 && (!formData.output_type || !formData.output_description))
            }
            className="btn-apple-primary shadow-2xl shadow-theme-accent/20 flex items-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed group"
          >
            {step === 3 ? "Initialize Strategy" : "Next Protocol"}
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
