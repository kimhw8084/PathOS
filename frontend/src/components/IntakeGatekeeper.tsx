import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Info } from 'lucide-react';

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
    frequency: 1,
    output_type: '',
    output_description: '',
    repeatability_check: false
  });
  const [error, setError] = useState<string | null>(null);

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.trigger_type || !formData.trigger_description) {
        setError("Please fill in all trigger details.");
        return;
      }
    }
    
    if (step === 2) {
      if (!formData.output_type || !formData.output_description) {
        setError("Please define the measurable output.");
        return;
      }
    }

    setError(null);
    setStep(step + 1);
  };

  const handleSubmit = () => {
    if (!formData.repeatability_check) {
      setError("Workflows must be repeatable processes. One-off troubleshooting or isolated incidents should be handled via Jira.");
      return;
    }
    onSuccess(formData);
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold">New Workflow Intake</h2>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 w-8 rounded-full transition-all ${step >= i ? 'bg-theme-accent' : 'bg-theme-border'}`} />
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">Workflow Name</label>
              <input 
                type="text" 
                placeholder="e.g., CD-SEM Recipe Deploiment"
                className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-theme-accent/50"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Trigger Type</label>
                <select 
                  className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 focus:outline-none"
                  value={formData.trigger_type}
                  onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                >
                  <option value="">Select Trigger...</option>
                  {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Monthly Frequency</label>
                <input 
                  type="number" 
                  className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 focus:outline-none"
                  value={formData.frequency}
                  onChange={e => setFormData({...formData, frequency: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">Trigger Description</label>
              <textarea 
                placeholder="What exactly happens to start this work?"
                className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 min-h-[100px] focus:outline-none"
                value={formData.trigger_description}
                onChange={e => setFormData({...formData, trigger_description: e.target.value})}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">Output Type</label>
              <select 
                className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 focus:outline-none"
                value={formData.output_type}
                onChange={e => setFormData({...formData, output_type: e.target.value})}
              >
                <option value="">Select Output...</option>
                {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1.5">Measurable Outcome</label>
              <textarea 
                placeholder="What is the final, measurable product of this workflow?"
                className="w-full bg-theme-input border border-theme-border rounded-xl px-4 py-2.5 min-h-[120px] focus:outline-none"
                value={formData.output_description}
                onChange={e => setFormData({...formData, output_description: e.target.value})}
              />
              <p className="text-xs text-theme-muted mt-2 flex items-center gap-1.5">
                <Info size={14} />
                Must produce a final state (e.g. 'Recipe available on tool', 'Lot released in MES')
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className={`p-6 rounded-2xl border transition-all ${formData.repeatability_check ? 'bg-green-500/10 border-green-500/30' : 'bg-theme-input border-theme-border'}`}>
              <div className="flex items-center gap-4">
                <input 
                  type="checkbox" 
                  id="repeatability"
                  className="w-6 h-6 rounded-lg accent-theme-accent"
                  checked={formData.repeatability_check}
                  onChange={e => setFormData({...formData, repeatability_check: e.target.checked})}
                />
                <label htmlFor="repeatability" className="font-bold text-lg cursor-pointer">
                  This is a standardized, repeatable process.
                </label>
              </div>
              <p className="text-theme-secondary text-sm mt-3 ml-10">
                I confirm that this sequence follows a defined procedure and is not an ad-hoc troubleshooting task.
              </p>
            </div>

            {!formData.repeatability_check && (
              <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl text-orange-200 text-sm flex gap-3">
                <AlertCircle size={20} className="shrink-0" />
                <span>
                  <strong>Wait!</strong> If this is personal one-off work, PathOS cannot quantify its ROI for the automation backlog.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <button 
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="btn-secondary disabled:opacity-0"
          >
            Previous
          </button>
          
          {step < 3 ? (
            <button onClick={handleNext} className="btn-primary flex items-center gap-2">
              Next Step <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              className={`btn-primary flex items-center gap-2 ${!formData.repeatability_check ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Initialize Initiative <CheckCircle2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
