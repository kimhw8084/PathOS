import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Zap, ArrowRight, ChevronLeft, 
  Layers,
  Cpu, Search, Check, X, ChevronDown
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
  onRestart?: () => void;
  taxonomy: any[];
  initialData?: any;
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

export const SearchableSelect = ({ 
  label, 
  options, 
  value, 
  onChange, 
  disabled,
  placeholder = "Select...",
  isMulti = false,
  icon: Icon,
  error = false
}: { 
  label: string, 
  options: any[], 
  value: any, 
  onChange: (val: any) => void,
  disabled?: boolean,
  placeholder?: string,
  isMulti?: boolean,
  icon?: any,
  error?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => {
    const labelText = typeof opt === 'string' ? opt : opt.label;
    return labelText.toLowerCase().includes(search.toLowerCase());
  });

  const toggleOption = (opt: any) => {
    // Ensure we use the raw value without any transformations
    const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label);
    if (isMulti) {
      const current = Array.isArray(value) ? value : [];
      if (current.includes(optValue)) {
        onChange(current.filter(s => s !== optValue));
      } else {
        onChange([...current, optValue]);
      }
    } else {
      onChange(optValue);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Use capture phase to ensure we catch the click before React Flow or other components
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, []);

  const getDisplayValue = () => {
    if (isMulti) {
      const vals = Array.isArray(value) ? value : [];
      if (vals.length === 0) return null;
      return vals.map(v => (
        <span key={v} className="bg-theme-accent/20 border border-theme-accent/30 text-theme-accent text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 uppercase tracking-tighter">
          {v}
          <X size={10} className="hover:text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
        </span>
      ));
    } else {
      if (!value) return null;
      return <span className="text-[12px] font-black text-white uppercase">{value}</span>;
    }
  };

  return (
    <div className={cn("space-y-2 relative", disabled && "opacity-30 pointer-events-none")} ref={containerRef} style={{ zIndex: isOpen ? 2000 : 'auto' }}>
      <label className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-1 transition-colors", error ? "text-status-error" : "text-white/40")}>{label}</label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[#1e293b]/50 border rounded-lg px-4 py-3 min-h-[48px] flex flex-wrap gap-2 items-center cursor-pointer transition-all hover:border-white/20",
          isOpen ? "border-theme-accent ring-1 ring-theme-accent/20 bg-[#1e293b]" : (error ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-white/10")
        )}
      >
        <div className="flex-1 flex flex-wrap gap-2 items-center">
          {getDisplayValue() || (
            <span className="text-white/20 text-[11px] font-black uppercase tracking-widest">{placeholder}</span>
          )}
        </div>
        {Icon ? <Icon size={14} className={cn("text-white/20", isOpen && "text-theme-accent")} /> : <ChevronDown size={14} className={cn("text-white/20 transition-transform", isOpen && "rotate-180 text-theme-accent")} />}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] p-2 animate-apple-in backdrop-blur-3xl">
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
          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-[10px] text-white/20 font-black uppercase">No results</div>
            ) : filteredOptions.map(opt => {
              const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label);
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              const isSelected = isMulti ? (Array.isArray(value) && value.includes(optValue)) : value === optValue;
              
              return (
                <div 
                  key={optValue}
                  onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-[11px] font-bold uppercase tracking-tight",
                    isSelected ? "bg-theme-accent/20 text-theme-accent" : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {optLabel}
                  {isSelected && <Check size={12} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, onCancel, onRestart, taxonomy, initialData }) => {
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [isRegular, setIsRegular] = useState<boolean | null>(initialData ? true : null);
  const [showErrors, setShowErrors] = useState(false);
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || initialData?.forensic_description || '',
    prc: initialData?.prc || '',
    workflow_type: initialData?.workflow_type || '',
    trigger_type: initialData?.trigger_type || '',
    trigger_description: initialData?.trigger_description || '',
    output_type: initialData?.output_type || '',
    output_description: initialData?.output_description || '',
    cadence_count: initialData?.cadence_count || 1.0,
    cadence_unit: initialData?.cadence_unit || 'week',
    tool_family: initialData?.tool_family ? (typeof initialData.tool_family === 'string' ? initialData.tool_family.split(', ') : initialData.tool_family) : [] as string[],
    applicable_tools: initialData?.tool_id ? (typeof initialData.tool_id === 'string' ? initialData.tool_id.split(', ') : initialData.tool_id) : [] as string[],
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

  const handleFinalize = () => {
    const requiredFields = [
      'name', 
      'description', 
      'prc', 
      'workflow_type', 
      'trigger_type', 
      'trigger_description', 
      'output_type', 
      'output_description',
      'tool_family',
      'applicable_tools'
    ];
    
    const missing = requiredFields.filter(f => {
      const val = formData[f as keyof typeof formData];
      if (Array.isArray(val)) return val.length === 0;
      return !val;
    });
    
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }

    onSuccess({
      ...formData,
      tool_family: Array.isArray(formData.tool_family) ? formData.tool_family.join(', ') : formData.tool_family,
      tool_id: Array.isArray(formData.applicable_tools) ? formData.applicable_tools.join(', ') : formData.applicable_tools
    });
  };

  const handleRestart = () => {
    setIsRegular(null);
    setShowErrors(false);
    setFormData({
      name: '',
      description: '',
      prc: '',
      workflow_type: '',
      trigger_type: '',
      trigger_description: '',
      output_type: '',
      output_description: '',
      cadence_count: 1.0,
      cadence_unit: 'week',
      tool_family: [],
      applicable_tools: [],
      repeatability_check: true
    });
    if (onRestart) onRestart();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-apple-in pb-16 relative z-[100]">
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
          <button onClick={handleRestart} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/30 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group">
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
          <section className="space-y-4 relative z-[2]">
            <div className="flex items-center gap-3 text-theme-accent font-black px-1">
              <Cpu size={16} />
              <span className="text-[11px] tracking-[0.2em] uppercase">Overview</span>
            </div>
            
            <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.name ? "text-status-error" : "text-white/40")}>Workflow Name</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.name.length} / 60</span>
                </div>
                <input 
                  className={cn(
                    "w-full bg-[#1e293b]/50 border rounded-lg px-4 py-3 text-lg font-black text-white uppercase focus:border-theme-accent outline-none transition-all placeholder:text-white/5",
                    showErrors && !formData.name ? "border-status-error/50 bg-status-error/5" : "border-white/10"
                  )} 
                  placeholder="ENTER WORKFLOW NAME..." 
                  maxLength={60}
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.description ? "text-status-error" : "text-white/40")}>Description</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.description.length} / 500</span>
                </div>
                <textarea 
                  className={cn(
                    "w-full bg-[#1e293b]/50 border rounded-xl px-4 py-3 text-[14px] font-bold text-white/80 focus:border-theme-accent outline-none transition-all placeholder:text-white/5 h-28 resize-none leading-relaxed",
                    showErrors && !formData.description ? "border-status-error/50 bg-status-error/5" : "border-white/10"
                  )} 
                  placeholder="Provide a detailed operational purpose statement..." 
                  maxLength={500}
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <SearchableSelect 
                  label="PRC"
                  options={prcValues}
                  value={formData.prc}
                  onChange={val => setFormData({...formData, prc: val})}
                  placeholder="SELECT PRC..."
                  error={showErrors && !formData.prc}
                />
                <SearchableSelect 
                  label="Type"
                  options={workflowTypes}
                  value={formData.workflow_type}
                  onChange={val => setFormData({...formData, workflow_type: val})}
                  placeholder="SELECT TYPE..."
                  error={showErrors && !formData.workflow_type}
                />
                <div className="space-y-2">
                  <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Occurrence</label>
                  <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/10 rounded-lg p-1 min-h-[48px]">
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-16 bg-black/40 font-black text-[13px] text-white text-center py-2 rounded-lg focus:border-theme-accent outline-none transition-all ml-1" 
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
                <SearchableSelect 
                  label="Tool Family"
                  options={hardwareFamilies}
                  value={formData.tool_family}
                  onChange={vals => setFormData({...formData, tool_family: vals})}
                  placeholder="SELECT FAMILIES..."
                  isMulti
                  error={showErrors && formData.tool_family.length === 0}
                />
                <SearchableSelect 
                  label="Applicable Tools"
                  options={toolIds}
                  value={formData.applicable_tools}
                  onChange={vals => setFormData({...formData, applicable_tools: vals})}
                  placeholder="SELECT TOOLS..."
                  isMulti
                  error={showErrors && formData.applicable_tools.length === 0}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Trigger & Output */}
          <section className="space-y-4 relative z-[1]">
            <div className="flex items-center gap-3 text-theme-accent font-black px-1">
              <Zap size={16} />
              <span className="text-[11px] tracking-[0.2em] uppercase">Trigger & Output</span>
            </div>

            <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
              <div className="grid grid-cols-2 gap-6">
                <SearchableSelect 
                  label="Trigger Type"
                  options={triggerTypes}
                  value={formData.trigger_type}
                  onChange={val => setFormData({...formData, trigger_type: val})}
                  placeholder="SELECT TRIGGER..."
                  error={showErrors && !formData.trigger_type}
                />
                <SearchableSelect 
                  label="Output Type"
                  options={outputTypes}
                  value={formData.output_type}
                  onChange={val => setFormData({...formData, output_type: val})}
                  placeholder="SELECT OUTPUT..."
                  error={showErrors && !formData.output_type}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.trigger_description ? "text-status-error" : "text-white/40")}>Trigger Description</label>
                    <span className="text-[9px] text-white/20 font-mono">{formData.trigger_description.length} / 500</span>
                  </div>
                  <textarea 
                    className={cn(
                      "w-full bg-[#1e293b]/30 border rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-theme-accent transition-all",
                      showErrors && !formData.trigger_description ? "border-status-error/50 bg-status-error/5" : "border-white/10"
                    )} 
                    placeholder="Specify the exact event that initiates this workflow..." 
                    maxLength={500}
                    value={formData.trigger_description} 
                    onChange={e => setFormData({...formData, trigger_description: e.target.value})} 
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.output_description ? "text-status-error" : "text-white/40")}>Output Description</label>
                    <span className="text-[9px] text-white/20 font-mono">{formData.output_description.length} / 500</span>
                  </div>
                  <textarea 
                    className={cn(
                      "w-full bg-[#1e293b]/30 border rounded-xl px-4 py-3 text-[12px] text-white/80 font-bold leading-relaxed h-24 resize-none outline-none focus:border-theme-accent transition-all",
                      showErrors && !formData.output_description ? "border-status-error/50 bg-status-error/5" : "border-white/10"
                    )} 
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
              onClick={handleFinalize}
              className="bg-theme-accent hover:bg-blue-500 text-white !px-16 !py-4 !rounded-xl shadow-xl disabled:opacity-20 group flex items-center gap-4 text-base font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Finalize Configuration <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            {showErrors && (
              <p className="text-[10px] font-black text-status-error uppercase animate-pulse">Please complete all required fields highlighted above.</p>
            )}
            <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em]">Advanced Planning System v4.2</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakeGatekeeper;
