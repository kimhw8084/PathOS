import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Zap, ArrowRight, ChevronLeft, 
  Layers,
  Cpu, Search, Check, X, ChevronDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsApi } from '../api/client';
import { useBuganizer } from './ErrorFortress';
import { auditIntakePayload, hasAuditErrors, summarizeAuditIssues } from '../testing/workflowQuality';
import { deriveToolPropagation, normalizeDefinitionList } from '../utils/workflowDefinition';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IntakeGatekeeperProps {
  onSuccess: (data: any) => void;
  onCancel?: () => void;
  onRestart?: () => void;
  taxonomy: any[];
  initialData?: any;
  workflows?: any[];
  runtimeConfig?: any;
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
  error = false,
  testId,
  compact = false,
}: { 
  label: string, 
  options: any[], 
  value: any, 
  onChange: (val: any) => void,
  disabled?: boolean,
  placeholder?: string,
  isMulti?: boolean,
  icon?: any,
  error?: boolean,
  testId?: string,
  compact?: boolean,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => {
    const labelText = typeof opt === 'string' ? opt : (opt?.label || String(opt?.value || ''));
    return labelText.toLowerCase().includes(search.toLowerCase());
  });

  const toggleOption = (opt: any) => {
    // Ensure we use the raw value without any transformations
    const optValue = typeof opt === 'string' ? opt : (opt.value !== undefined && opt.value !== null ? opt.value : opt.label);
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
      if (value === null || value === undefined || value === '') return null;
      return <span className="text-[12px] font-black text-white uppercase">{value}</span>;
    }
  };

  return (
    <div data-testid={testId} className={cn(compact ? "space-y-1.5" : "space-y-2", "relative", disabled && "opacity-30 pointer-events-none")} ref={containerRef} style={{ zIndex: isOpen ? 2000 : 'auto' }}>
      <label className={cn(compact ? "text-[8px]" : "text-[9px]", "font-black uppercase tracking-[0.2em] px-1 transition-colors", error ? "text-status-error" : "text-white/40")}>{label}</label>
      <div 
        data-testid={testId ? `${testId}-trigger` : undefined}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          compact ? "w-full bg-[#1e293b]/50 border rounded-[1.15rem] px-3 py-2.5 min-h-[42px] flex flex-wrap gap-1.5 items-center cursor-pointer transition-all hover:border-white/20" : "w-full bg-[#1e293b]/50 border rounded-lg px-4 py-3 min-h-[48px] flex flex-wrap gap-2 items-center cursor-pointer transition-all hover:border-white/20",
          isOpen ? "border-theme-accent ring-1 ring-theme-accent/20 bg-[#1e293b]" : (error ? "border-status-error/50 bg-status-error/5 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-white/10")
        )}
      >
        <div className="flex-1 flex flex-wrap gap-2 items-center">
          {getDisplayValue() || (
            <span className={cn(compact ? "text-white/20 text-[10px]" : "text-white/20 text-[11px]", "font-black uppercase tracking-widest")}>{placeholder}</span>
          )}
        </div>
        {Icon ? <Icon size={compact ? 12 : 14} className={cn("text-white/20", isOpen && "text-theme-accent")} /> : <ChevronDown size={compact ? 12 : 14} className={cn("text-white/20 transition-transform", isOpen && "rotate-180 text-theme-accent")} />}
      </div>

      {isOpen && (
        <div className={cn("absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-white/10 rounded-[1.15rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] animate-apple-in backdrop-blur-3xl", compact ? "p-1.5" : "p-2")}>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={compact ? 12 : 14} />
            <input 
              data-testid={testId ? `${testId}-search` : undefined}
              autoFocus
              className={cn("w-full bg-black/40 border border-white/5 rounded-[1.15rem] pl-9 pr-4 text-white font-bold outline-none focus:border-theme-accent transition-all", compact ? "py-1.5 text-[10px]" : "py-2 text-[11px]")}
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
                  data-testid={testId ? `${testId}-option-${String(optValue).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}` : undefined}
                  onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                  className={cn(
                    compact ? "flex items-center justify-between px-3 py-1.5 rounded-[1.15rem] cursor-pointer transition-all text-[10px] font-bold uppercase tracking-tight" : "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-[11px] font-bold uppercase tracking-tight",
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

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, onCancel, onRestart, taxonomy, initialData, workflows = [], runtimeConfig }) => {
  const { reportBug } = useBuganizer();
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [isRegular, setIsRegular] = useState<boolean | null>(initialData ? (initialData.repeatability_check ?? true) : null);
  const [showErrors, setShowErrors] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const workspaceOptions = runtimeConfig?.organization?.workspace_options || ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'];
  const parameterKeys = runtimeConfig?.parameters?.keys || {};

  const buildInitialFormData = (data?: any) => ({
    name: data?.name || '',
    description: data?.description || data?.forensic_description || '',
    workspace: data?.workspace || runtimeConfig?.organization?.default_workspace || 'Personal Drafts',
    parent_workflow_id: data?.parent_workflow_id || null,
    version_base_snapshot: data?.version_base_snapshot || null,
    prc: data?.prc || '',
    workflow_type: data?.workflow_type || '',
    org: data?.org || runtimeConfig?.organization?.org_options?.[0] || '',
    team: data?.team || runtimeConfig?.organization?.team_options?.[0] || '',
    trigger_type: data?.trigger_type || '',
    trigger_description: data?.trigger_description || '',
    output_type: data?.output_type || '',
    output_description: data?.output_description || '',
    cadence_count: data?.cadence_count || 1.0,
    cadence_unit: data?.cadence_unit || 'week',
    tool_family: data?.tool_family ? (typeof data.tool_family === 'string' ? data.tool_family.split(', ').map((item: string) => item.trim()).filter(Boolean) : data.tool_family) : [] as string[],
    applicable_tools: (Array.isArray(data?.tool_family) ? data.tool_family.length > 0 : Boolean(data?.tool_family))
      ? (Array.isArray(data?.applicable_tools) ? data.applicable_tools : (data?.tool_id ? (typeof data.tool_id === 'string' ? data.tool_id.split(', ') : data.tool_id) : [] as string[]))
      : [],
    repeatability_check: data?.repeatability_check ?? true,
    quick_capture_notes: data?.quick_capture_notes || '',
    related_workflow_ids: data?.related_workflow_ids || [],
  });
  
  const [formData, setFormData] = useState(buildInitialFormData(initialData));
  const draftStorageKey = initialData?.id ? `pathos-intake-draft-${initialData.id}` : 'pathos-intake-draft-new';

  useEffect(() => {
    setFormData(buildInitialFormData(initialData));
    setIsRegular(initialData ? (initialData.repeatability_check ?? true) : null);
    setShowErrors(false);
    setDraftRestored(false);
  }, [initialData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialData?.id || initialData?.name) return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setFormData(prev => {
        const next = { ...prev, ...parsed.formData };
        next.tool_family = Array.isArray(next.tool_family) ? next.tool_family : normalizeDefinitionList(next.tool_family);
        next.applicable_tools = normalizeDefinitionList(next.tool_family).length === 0
          ? []
          : normalizeDefinitionList(next.applicable_tools);
        return next;
      });
      setIsRegular(parsed.isRegular ?? true);
      setDraftRestored(true);
    } catch {
      // ignore stale drafts
    }
  }, [draftStorageKey, initialData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ formData, isRegular }));
  }, [draftStorageKey, formData, isRegular]);

  useEffect(() => {
    settingsApi.listParameters().then(setSystemParams).catch(() => {});
  }, []);

  const triggerTypes = taxonomy.filter(t => t.category === 'TriggerType');
  const outputTypes = taxonomy.filter(t => t.category === 'OutputType');
  
  const hardwareFamilies = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.hardware_family || 'HARDWARE_FAMILY'));
    if (param) {
      return ((param.is_dynamic ? param.cached_values : param.manual_values) || []).map((f: any) => typeof f === 'string' ? f : f.label);
    }
    return taxonomy.filter(t => t.category === 'ToolType').map(t => t.label);
  }, [parameterKeys.hardware_family, systemParams, taxonomy]);

  const prcValues = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.prc || 'PRC'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [parameterKeys.prc, systemParams]);

  const toolIds = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.tool_id || 'TOOL_ID'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [parameterKeys.tool_id, systemParams]);

  const workflowTypes = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.workflow_type || 'WORKFLOW_TYPE'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [parameterKeys.workflow_type, systemParams]);

  const isDisabled = isRegular !== true;
  const matchingWorkflows = useMemo(() => {
    const queryParts = [formData.name, formData.prc, formData.workflow_type, ...(formData.tool_family || [])]
      .filter(Boolean)
      .map((item: string) => String(item).toLowerCase());
    if (queryParts.length === 0) return [];
    return workflows
      .filter((workflow: any) => queryParts.some(part =>
        [
          workflow.name,
          workflow.prc,
          workflow.workflow_type,
          workflow.tool_family,
          workflow.tool_id,
          workflow.description,
        ].filter(Boolean).some((candidate: any) => String(candidate).toLowerCase().includes(part))
      ))
      .slice(0, 5);
  }, [formData.name, formData.prc, formData.workflow_type, formData.tool_family, workflows]);

  const toolPropagationSource = useMemo(
    () => [...(Array.isArray(workflows) ? workflows : []), initialData].filter(Boolean),
    [initialData, workflows]
  );

  const toolPropagation = useMemo(
    () => deriveToolPropagation(toolPropagationSource, formData.tool_family, formData.applicable_tools),
    [toolPropagationSource, formData.tool_family, formData.applicable_tools]
  );
  const applicableToolOptions = toolPropagation.availableTools.length > 0 ? toolPropagation.availableTools : toolIds;
  const selectedApplicableTools = useMemo(() => {
    if (formData.tool_family.length === 0) return [];
    return normalizeDefinitionList(formData.applicable_tools).filter((tool) => applicableToolOptions.includes(tool));
  }, [applicableToolOptions, formData.applicable_tools, formData.tool_family.length]);

  const adoptSimilarWorkflow = (workflow: any) => {
    const familySource = normalizeDefinitionList(workflow.tool_family);
    const toolSource = normalizeDefinitionList(workflow.applicable_tools || workflow.tool_id);
    const propagation = deriveToolPropagation([workflow, ...workflows], familySource, toolSource);
    setFormData(prev => ({
      ...prev,
      prc: prev.prc || workflow.prc || '',
      workflow_type: prev.workflow_type || workflow.workflow_type || '',
      tool_family: prev.tool_family.length > 0 ? prev.tool_family : familySource,
      applicable_tools: prev.applicable_tools.length > 0
        ? prev.applicable_tools.filter((tool: string) => propagation.availableTools.includes(tool))
        : propagation.selectedTools,
      related_workflow_ids: Array.from(new Set([...(prev.related_workflow_ids || []), workflow.id])).slice(0, 8),
    }));
  };

  const handleFinalize = () => {
    const normalizedPayload = {
      ...formData,
      repeatability_check: isRegular === true,
      tool_family: Array.isArray(formData.tool_family) ? formData.tool_family : [formData.tool_family].filter(Boolean),
      applicable_tools: Array.isArray(formData.applicable_tools) ? formData.applicable_tools : [formData.applicable_tools].filter(Boolean),
    };
    const auditIssues = auditIntakePayload(normalizedPayload);
    if (isRegular !== true) {
      reportBug('Intake blocked: workflow failed repeatability gate', 'frontend', 'warning', { type: 'INTAKE_REPEATABILITY_BLOCK' });
      setShowErrors(true);
      return;
    }
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
      if (f === 'applicable_tools') {
        return formData.tool_family.length > 0 && formData.applicable_tools.length === 0;
      }
      const val = formData[f as keyof typeof formData];
      if (Array.isArray(val)) return val.length === 0;
      return !val;
    });
    
    if (missing.length > 0) {
      reportBug(`Intake blocked: ${missing.length} required fields missing`, 'frontend', 'warning', {
        type: 'INTAKE_REQUIRED_FIELDS',
        payload: { missing },
      });
      setShowErrors(true);
      return;
    }

    if (hasAuditErrors(auditIssues)) {
      reportBug(summarizeAuditIssues(auditIssues), 'frontend', 'error', {
        type: 'INTAKE_AUDIT_FAILURE',
        payload: { auditIssues },
      });
      setShowErrors(true);
      return;
    }

    onSuccess({
      ...formData,
      repeatability_check: isRegular === true,
      tool_family: Array.isArray(formData.tool_family) ? formData.tool_family.join(', ') : formData.tool_family,
      tool_id: Array.isArray(formData.applicable_tools) ? formData.applicable_tools.join(', ') : formData.applicable_tools
    });
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey);
  };

  const handleRestart = () => {
    setIsRegular(null);
    setShowErrors(false);
    setFormData({
      name: '',
      description: '',
      prc: '',
      workflow_type: '',
      org: runtimeConfig?.organization?.org_options?.[0] || '',
      team: runtimeConfig?.organization?.team_options?.[0] || '',
      trigger_type: '',
      trigger_description: '',
      output_type: '',
      output_description: '',
      workspace: runtimeConfig?.organization?.default_workspace || 'Personal Drafts',
      parent_workflow_id: null,
      version_base_snapshot: null,
      cadence_count: 1.0,
      cadence_unit: 'week',
      tool_family: [],
      applicable_tools: [],
      repeatability_check: true,
      quick_capture_notes: '',
      related_workflow_ids: [],
    });
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey);
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
        {draftRestored && (
          <section className="apple-card !bg-emerald-500/5 border-emerald-500/20 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400">Draft Restored</p>
              <p className="text-[12px] font-bold text-white/80">Your last incomplete intake draft was restored automatically so partial work never blocks participation.</p>
            </div>
          </section>
        )}

        {formData.parent_workflow_id && (
          <section className="apple-card !bg-amber-500/5 border-amber-500/20 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400">Version Draft</p>
              <p className="text-[12px] font-bold text-white/80">This intake was seeded from workflow #{formData.parent_workflow_id}. Changes will be tracked as a new editable draft.</p>
            </div>
          </section>
        )}

        {matchingWorkflows.length > 0 && (
          <section className="apple-card !bg-white/[0.02] border-white/10 p-5 space-y-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-accent">Possible Duplicates / Related Workflows</p>
              <p className="mt-2 text-[12px] font-bold text-white/58">Review similar workflows before creating a new one to increase reuse and cross-team visibility.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {matchingWorkflows.map((workflow: any) => (
                <div key={workflow.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{workflow.name}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/45">{workflow.workflow_type || 'Unclassified'} • {workflow.prc || 'No PRC'} • {workflow.team || workflow.workspace}</p>
                    </div>
                    <button onClick={() => adoptSimilarWorkflow(workflow)} className="px-3 py-2 rounded-xl border border-theme-accent/20 bg-theme-accent/10 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                      Autofill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="apple-card !bg-white/[0.02] border-white/10 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-accent">Tool Propagation</p>
              <p className="text-[12px] font-bold text-white/70">Tool family selection drives the available tools. Clearing families clears the tools.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
              {toolPropagation.families.length === 0
                ? 'Select a family first'
                : toolPropagation.availableTools.length > 0
                  ? `${toolPropagation.availableTools.length} propagated tools`
                  : `${applicableToolOptions.length} registry tools`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {toolPropagation.familyChips.length > 0 ? (
              toolPropagation.familyChips.map((chip) => (
                <span key={chip.family} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">
                  {chip.family} <span className="text-white/40">({chip.toolCount})</span>
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                No tool family selected
              </span>
            )}
            {selectedApplicableTools.map((tool) => (
              <span key={tool} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                {tool}
              </span>
            ))}
          </div>
        </section>

        {/* Validation Questionnaire Inline */}
        <section className="apple-card !bg-theme-accent/5 border-theme-accent/20 p-8 flex flex-col items-center text-center gap-6">
           <div className="space-y-2">
              <h3 className="text-[11px] font-black text-theme-accent uppercase tracking-[0.3em]">Validation Questionnaire</h3>
              <p className="text-[18px] font-black text-white uppercase tracking-tight">Is this workflow executed regularly?</p>
           </div>
           
           <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 w-64">
              <button 
                data-testid="intake-repeatable-yes"
                onClick={() => setIsRegular(true)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all",
                  isRegular === true ? "bg-theme-accent text-white shadow-xl shadow-theme-accent/20" : "text-white/20 hover:text-white/40"
                )}
              >
                Yes
              </button>
              <button 
                data-testid="intake-repeatable-no"
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
                  data-testid="intake-workflow-name"
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
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.description ? "text-status-error" : "text-white/40")}>Purpose Statement</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.description.length} / 500</span>
                </div>
                <textarea 
                  data-testid="intake-description"
                  className={cn(
                    "w-full bg-[#1e293b]/50 border rounded-xl px-4 py-3 text-[14px] font-bold text-white/80 focus:border-theme-accent outline-none transition-all placeholder:text-white/5 h-28 resize-none leading-relaxed",
                    showErrors && !formData.description ? "border-status-error/50 bg-status-error/5" : "border-white/10"
                  )} 
                  placeholder="Provide the operational purpose statement..." 
                  maxLength={500}
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Quick Capture Notes</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.quick_capture_notes.length} / 500</span>
                </div>
                <textarea
                  className="w-full bg-[#1e293b]/30 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/75 outline-none h-24 resize-none focus:border-theme-accent transition-all"
                  value={formData.quick_capture_notes}
                  maxLength={500}
                  onChange={e => setFormData({...formData, quick_capture_notes: e.target.value})}
                  placeholder="Capture rough notes, context, pasted SOP snippets, or what still needs to be clarified later."
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <SearchableSelect 
                  label="Workspace"
                  testId="intake-workspace"
                  options={workspaceOptions}
                  value={formData.workspace}
                  onChange={val => setFormData({ ...formData, workspace: val })}
                  placeholder="SELECT WORKSPACE..."
                />
                <SearchableSelect 
                  label="PRC"
                  testId="intake-prc"
                  options={prcValues}
                  value={formData.prc}
                  onChange={val => setFormData({...formData, prc: val})}
                  placeholder="SELECT PRC..."
                  error={showErrors && !formData.prc}
                />
                <SearchableSelect 
                  label="Type"
                  testId="intake-workflow-type"
                  options={workflowTypes}
                  value={formData.workflow_type}
                  onChange={val => setFormData({...formData, workflow_type: val})}
                  placeholder="SELECT TYPE..."
                  error={showErrors && !formData.workflow_type}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <SearchableSelect 
                  label="Org"
                  testId="intake-org"
                  options={runtimeConfig?.organization?.org_options || []}
                  value={formData.org}
                  onChange={val => setFormData({...formData, org: val})}
                  placeholder="SELECT ORG..."
                />
                <SearchableSelect 
                  label="Team"
                  testId="intake-team"
                  options={runtimeConfig?.organization?.team_options || []}
                  value={formData.team}
                  onChange={val => setFormData({...formData, team: val})}
                  placeholder="SELECT TEAM..."
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Occurrence</label>
                  <div className="flex items-center gap-2 bg-[#1e293b]/50 border border-white/10 rounded-lg p-1 min-h-[48px]">
                    <input 
                      data-testid="intake-cadence-count"
                      type="number" 
                      step="0.1"
                      className="w-16 bg-black/40 font-black text-[13px] text-white text-center py-2 rounded-lg focus:border-theme-accent outline-none transition-all ml-1" 
                      value={isNaN(formData.cadence_count) ? '' : formData.cadence_count} 
                      onChange={e => setFormData({...formData, cadence_count: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                    />
                    <select 
                      data-testid="intake-cadence-unit"
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
                  testId="intake-tool-family"
                  options={hardwareFamilies}
                  value={formData.tool_family}
                  onChange={(vals) => {
                    const nextFamilies = Array.isArray(vals) ? vals : [];
                    const nextPropagation = deriveToolPropagation(toolPropagationSource, nextFamilies, formData.applicable_tools);
                    setFormData({ ...formData, tool_family: nextFamilies, applicable_tools: nextFamilies.length === 0 ? [] : nextPropagation.selectedTools });
                  }}
                  placeholder="SELECT FAMILIES..."
                  isMulti
                  error={showErrors && formData.tool_family.length === 0}
                />
                <SearchableSelect 
                  label="Applicable Tools"
                  testId="intake-applicable-tools"
                  options={applicableToolOptions}
                  value={selectedApplicableTools}
                  onChange={(vals) => {
                    const nextTools = Array.isArray(vals) ? vals : [];
                    setFormData({ ...formData, applicable_tools: nextTools.filter((tool) => applicableToolOptions.includes(tool)) });
                  }}
                  placeholder={formData.tool_family.length === 0 ? "SELECT A FAMILY FIRST..." : "SELECT TOOLS..."}
                  isMulti
                  error={showErrors && formData.tool_family.length > 0 && formData.applicable_tools.length === 0}
                  disabled={formData.tool_family.length === 0}
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
                  testId="intake-trigger-type"
                  options={triggerTypes}
                  value={formData.trigger_type}
                  onChange={val => setFormData({...formData, trigger_type: val})}
                  placeholder="SELECT TRIGGER..."
                  error={showErrors && !formData.trigger_type}
                />
                <SearchableSelect 
                  label="Output Type"
                  testId="intake-output-type"
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
                    data-testid="intake-trigger-description"
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
                    data-testid="intake-output-description"
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.localStorage.setItem(draftStorageKey, JSON.stringify({ formData, isRegular }));
                }}
                className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                Save Draft Progress
              </button>
            </div>
            <button 
              data-testid="intake-finalize"
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
