import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Zap, ArrowRight, ChevronLeft, 
  Layers,
  Cpu, Settings, Search, Check, X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsApi } from '../api/client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  onCancel?: () => void;
  taxonomy: any[];
}

export const CreationProgressBar = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { id: 1, label: 'Validation' },
    { id: 2, label: 'Definition' },
    { id: 3, label: 'Workflow' },
    { id: 4, label: 'Submission' }
  ];

  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto mb-10 px-4">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2 relative">
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all duration-500",
              currentStep === step.id ? "bg-theme-accent border-theme-accent text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" :
              currentStep > step.id ? "bg-emerald-500 border-emerald-500 text-white" :
              "bg-[#0f172a] border-white/10 text-white/20"
            )}>
              {currentStep > step.id ? <Check size={14} strokeWidth={4} /> : step.id}
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest absolute -bottom-6 whitespace-nowrap",
              currentStep >= step.id ? "text-white" : "text-white/20"
            )}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className="flex-1 h-[2px] mx-4 bg-white/5 relative overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-theme-accent transition-all duration-700 ease-in-out" 
                style={{ width: currentStep > step.id ? '100%' : currentStep === step.id ? '50%' : '0%' }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const SearchableMultiSelect = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  disabled,
  placeholder = "Select options..." 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onChange: (vals: string[]) => void,
  disabled?: boolean,
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-3 relative", disabled && "opacity-30 pointer-events-none")} ref={containerRef}>
      <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">{label}</label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 min-h-[48px] flex flex-wrap gap-2 items-center cursor-pointer transition-all",
          isOpen && "border-theme-accent ring-1 ring-theme-accent/20"
        )}
      >
        {selected.length === 0 ? (
          <span className="text-white/20 text-[12px] font-black uppercase tracking-widest">{placeholder}</span>
        ) : (
          selected.map(s => (
            <span key={s} className="bg-theme-accent/20 border border-theme-accent/30 text-theme-accent text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 uppercase tracking-tighter">
              {s}
              <X size={10} className="hover:text-white" onClick={(e) => { e.stopPropagation(); toggleOption(s); }} />
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-theme-sidebar border border-theme-border rounded-xl shadow-2xl z-50 p-2 animate-apple-in backdrop-blur-xl">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input 
              autoFocus
              className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-[11px] text-white font-bold outline-none focus:border-theme-accent transition-all"
              placeholder="Filter list..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-[10px] text-white/20 font-black uppercase">No results</div>
            ) : filteredOptions.map(opt => (
              <div 
                key={opt}
                onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-[11px] font-bold",
                  selected.includes(opt) ? "bg-theme-accent/10 text-theme-accent" : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                {opt}
                {selected.includes(opt) && <Check size={12} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, onCancel, taxonomy }) => {
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [isRegular, setIsRegular] = useState<boolean | null>(null);
  
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
    tool_family: [] as string[],
    applicable_tools: [] as string[],
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
      return ((param.is_dynamic ? param.cached_values : param.manual_values) || []).map((f: any) => typeof f === 'string' ? f : f.label);
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

  const isDisabled = isRegular !== true;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-apple-in pb-16">
      <CreationProgressBar currentStep={isRegular === true ? 2 : 1} />

      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-theme-accent/20 rounded-xl border border-theme-accent/20 shadow-lg shadow-theme-accent/10">
            <Layers size={24} className="text-theme-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter leading-tight uppercase">Workflow Definition</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-theme-accent font-black uppercase tracking-[0.2em]">Configuration</span>
              <div className="h-0.5 w-0.5 bg-white/20 rounded-full" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Initializing operational metadata.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest">Cancel</button>
          <button onClick={() => { setIsRegular(null); setFormData({ ...formData, name: '', prc: '', tool_family: [], applicable_tools: [] }); }} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/30 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Restart
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Validation Questionnaire Inline */}
        <section className="apple-card !bg-theme-accent/5 border-theme-accent/20 p-8 flex flex-col items-center text-center gap-6">
           <div className="space-y-2">
              <h3 className="text-[11px] font-black text-theme-accent uppercase tracking-[0.3em]">Validation Questionnaire</h3>
              <p className="text-[18px] font-black text-white uppercase tracking-tight">Is this workflow executed regularly?</p>
           </div>
           
           <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 w-64">
              <button 
                onClick={() => setIsRegular(true)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all",
                  isRegular === true ? "bg-theme-accent text-white shadow-xl shadow-theme-accent/20" : "text-white/20 hover:text-white/40"
                )}
              >
                Yes
              </button>
              <button 
                onClick={() => setIsRegular(false)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all",
                  isRegular === false ? "bg-status-error text-white shadow-xl shadow-status-error/20" : "text-white/20 hover:text-white/40"
                )}
              >
                No
              </button>
           </div>

           {isRegular === false && (
             <div className="bg-status-error/10 border border-status-error/20 p-4 rounded-xl flex items-center gap-3 animate-apple-in">
                <ShieldAlert size={16} className="text-status-error" />
                <span className="text-[11px] font-black text-status-error uppercase tracking-tight">Standardization Required: Non-regular workflows cannot be automated.</span>
             </div>
           )}
        </section>

        {/* Section 1: Overview */}
        <div className={cn("space-y-8 transition-all duration-500", isDisabled && "opacity-20 grayscale blur-[2px] pointer-events-none")}>
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-theme-accent font-black px-1">
              <Cpu size={16} />
              <span className="text-[11px] tracking-[0.2em] uppercase">Overview</span>
            </div>
            
            <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Workflow Name</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.name.length} / 60</span>
                </div>
                <input 
                  className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-lg font-black text-white uppercase focus:border-theme-accent outline-none transition-all placeholder:text-white/5" 
                  placeholder="ENTER WORKFLOW NAME..." 
                  maxLength={60}
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">PRC</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-theme-accent outline-none transition-all cursor-pointer"
                      value={formData.prc}
                      onChange={e => setFormData({...formData, prc: e.target.value})}
                    >
                      <option value="">SELECT PRC...</option>
                      {prcValues.map((v: string) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-theme-accent transition-colors" size={14} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Type</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-theme-accent outline-none transition-all cursor-pointer"
                      value={formData.workflow_type}
                      onChange={e => setFormData({...formData, workflow_type: e.target.value})}
                    >
                      <option value="">SELECT TYPE...</option>
                      {workflowTypes.map((v: string) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <Cpu className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-theme-accent transition-colors" size={14} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Occurrence</label>
                  <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/10 rounded-lg p-1">
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-16 bg-black/20 font-black text-[13px] text-white text-center py-2 rounded-lg focus:border-theme-accent outline-none transition-all" 
                      value={formData.cadence_count} 
                      onChange={e => setFormData({...formData, cadence_count: parseFloat(e.target.value)})} 
                    />
                    <select 
                      className="flex-1 bg-transparent text-white font-black text-center appearance-none cursor-pointer hover:bg-white/5 transition-all uppercase text-[10px] tracking-tight outline-none py-2"
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

              <div className="grid grid-cols-2 gap-6">
                <SearchableMultiSelect 
                  label="Tool Family"
                  options={hardwareFamilies}
                  selected={formData.tool_family}
                  onChange={vals => setFormData({...formData, tool_family: vals})}
                  placeholder="SELECT FAMILIES..."
                />
                <SearchableMultiSelect 
                  label="Applicable Tools"
                  options={toolIds}
                  selected={formData.applicable_tools}
                  onChange={vals => setFormData({...formData, applicable_tools: vals})}
                  placeholder="SELECT TOOLS..."
                />
              </div>
            </div>
          </section>

          {/* Section 2: Trigger & Output */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-theme-accent font-black px-1">
              <Zap size={16} />
              <span className="text-[11px] tracking-[0.2em] uppercase">Trigger & Output</span>
            </div>

            <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Trigger Mechanism</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-theme-accent outline-none transition-all cursor-pointer"
                      value={formData.trigger_type}
                      onChange={e => setFormData({...formData, trigger_type: e.target.value})}
                    >
                      <option value="">SELECT TRIGGER...</option>
                      {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Zap className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-theme-accent transition-colors" size={14} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Output Classification</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white appearance-none focus:border-theme-accent outline-none transition-all cursor-pointer"
                      value={formData.output_type}
                      onChange={e => setFormData({...formData, output_type: e.target.value})}
                    >
                      <option value="">SELECT OUTPUT...</option>
                      {outputTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover:text-theme-accent transition-colors" size={14} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Trigger Description</label>
                    <span className="text-[9px] text-white/20 font-mono">{formData.trigger_description.length} / 500</span>
                  </div>
                  <textarea 
                    className="w-full bg-[#1e293b]/30 border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-theme-accent transition-all" 
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
                    className="w-full bg-[#1e293b]/30 border border-white/10 rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-theme-accent transition-all" 
                    placeholder="Define the final product or verification result..." 
                    maxLength={500}
                    value={formData.output_description} 
                    onChange={e => setFormData({...formData, output_description: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="pt-8 border-t border-white/10 flex flex-col items-center gap-4">
            <button 
              onClick={() => onSuccess({
                ...formData,
                tool_family: formData.tool_family.join(', '),
                tool_id: formData.applicable_tools.join(', ')
              })}
              disabled={!formData.name || !formData.trigger_type || !formData.output_type}
              className="bg-theme-accent hover:bg-blue-500 text-white !px-16 !py-4 !rounded-xl shadow-xl disabled:opacity-20 group flex items-center gap-4 text-base font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Finalize Configuration <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em]">Advanced Planning System v4.2</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
