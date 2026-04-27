import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Zap, ArrowRight, ChevronLeft, 
  Layers,
  Cpu, Search, Check, X, ChevronDown, Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsApi, workflowsApi } from '../api/client';
import { useBuganizer } from './ErrorFortress';
import { auditIntakePayload, hasAuditErrors, summarizeAuditIssues } from '../testing/workflowQuality';

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
  templates?: any[];
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
  testId
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
  testId?: string
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
    <div data-testid={testId} className={cn("space-y-2 relative", disabled && "opacity-30 pointer-events-none")} ref={containerRef} style={{ zIndex: isOpen ? 2000 : 'auto' }}>
      <label className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-1 transition-colors", error ? "text-status-error" : "text-white/40")}>{label}</label>
      <div 
        data-testid={testId ? `${testId}-trigger` : undefined}
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
              data-testid={testId ? `${testId}-search` : undefined}
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
                  data-testid={testId ? `${testId}-option-${String(optValue).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}` : undefined}
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

const IntakeGatekeeper: React.FC<IntakeGatekeeperProps> = ({ onSuccess, onCancel, onRestart, taxonomy, initialData, workflows = [], templates = [], runtimeConfig }) => {
  const { reportBug } = useBuganizer();
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [isRegular, setIsRegular] = useState<boolean | null>(initialData ? (initialData.repeatability_check ?? true) : null);
  const [showErrors, setShowErrors] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftAssist, setDraftAssist] = useState<any>(null);
  const [draftAssistLoading, setDraftAssistLoading] = useState(false);
  const workspaceOptions = runtimeConfig?.organization?.workspace_options || ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'];
  const collaboratorDirectory = runtimeConfig?.organization?.mention_directory || ['Primary Owner', 'Automation Team', 'Process SME'];
  const mentionGroups = runtimeConfig?.organization?.mention_groups || ['Automation Team', 'Process SME'];
  const lifecycleOptions = runtimeConfig?.organization?.lifecycle_options || ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Active'];
  const reviewerRoleOptions = runtimeConfig?.organization?.reviewer_role_options || ['Process SME', 'Automation Team', 'Process Owner'];
  const workflowDefaults = runtimeConfig?.workflow_defaults || {};
  const parameterKeys = runtimeConfig?.parameters?.keys || {};
  const defaultOwner = workflowDefaults?.ownership?.owner || runtimeConfig?.current_member?.full_name || 'system_user';

  const buildInitialFormData = (data?: any) => ({
    name: data?.name || '',
    description: data?.description || data?.forensic_description || '',
    workspace: data?.workspace || runtimeConfig?.organization?.default_workspace || 'Personal Drafts',
    version_notes: data?.version_notes || '',
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
    equipment_required: data?.equipment_required || false,
    equipment_state: data?.equipment_state || '',
    cleanroom_required: data?.cleanroom_required || false,
    cadence_count: data?.cadence_count || 1.0,
    cadence_unit: data?.cadence_unit || 'week',
    tool_family: data?.tool_family ? (typeof data.tool_family === 'string' ? data.tool_family.split(', ') : data.tool_family) : [] as string[],
    applicable_tools: Array.isArray(data?.applicable_tools) ? data.applicable_tools : (data?.tool_id ? (typeof data.tool_id === 'string' ? data.tool_id.split(', ') : data.tool_id) : [] as string[]),
    repeatability_check: data?.repeatability_check ?? true,
    quick_capture_notes: data?.quick_capture_notes || '',
    template_key: data?.template_key || '',
    ownership: data?.ownership || {
      owner: data?.access_control?.owner || defaultOwner,
      smes: [],
      backup_owners: [],
      automation_owner: '',
      reviewers: [],
    },
    governance: data?.governance || {
      lifecycle_stage: 'Draft',
      review_state: data?.review_state || 'Draft',
      approval_state: data?.approval_state || 'Draft',
      required_reviewer_roles: data?.required_reviewer_roles || [],
      standards_flags: [],
      stale_after_days: workflowDefaults?.governance?.stale_after_days || 90,
      review_due_at: '',
      last_reviewed_at: '',
    },
    review_requests: data?.review_requests || [],
    activity_timeline: data?.activity_timeline || [],
    notification_feed: data?.notification_feed || [],
    related_workflow_ids: data?.related_workflow_ids || [],
    standards_profile: data?.standards_profile || {},
    access_control: data?.access_control || {
      visibility: data?.workspace === 'Collaborative Workflows' ? 'workspace' : data?.workspace === 'Standard Operations' ? 'org' : 'private',
      viewers: [],
      editors: [],
      mention_groups: [],
      owner: defaultOwner
    },
    comments: data?.comments || []
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
      setFormData(prev => ({ ...prev, ...parsed.formData }));
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

  const toolIds = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.tool_id || 'TOOL_ID'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [parameterKeys.tool_id, systemParams]);

  const prcValues = useMemo(() => {
    const param = systemParams.find(p => p.key === (parameterKeys.prc || 'PRC'));
    return (param?.is_dynamic ? param.cached_values : param?.manual_values) || [];
  }, [parameterKeys.prc, systemParams]);

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

  const suggestedTemplate = useMemo(() => {
    if (!Array.isArray(templates)) return undefined;
    return templates.find((template: any) =>
      template.workflow_type === formData.workflow_type ||
      (formData.name && template.label.toLowerCase().includes(formData.name.toLowerCase()))
    );
  }, [formData.workflow_type, formData.name, templates]);

  const requestDraftAssist = async () => {
    setDraftAssistLoading(true);
    try {
      const assist = await workflowsApi.draftAssist({
        name: formData.name,
        description: formData.description,
        quick_capture_notes: formData.quick_capture_notes,
        prc: formData.prc,
        workflow_type: formData.workflow_type,
        tool_family: formData.tool_family,
        applicable_tools: formData.applicable_tools,
      });
      setDraftAssist(assist);
    } catch (error: any) {
      reportBug(error?.response?.data?.detail || 'Draft assistant failed to analyze the workflow intake.', 'frontend', 'warning', {
        type: 'INTAKE_DRAFT_ASSIST_FAILURE',
      });
    } finally {
      setDraftAssistLoading(false);
    }
  };

  const applyTemplate = (template: any) => {
    setFormData(prev => ({
      ...prev,
      template_key: template.key,
      workflow_type: prev.workflow_type || template.workflow_type || '',
      governance: {
        ...prev.governance,
        required_reviewer_roles: template.required_reviewer_roles || prev.governance.required_reviewer_roles,
        standards_flags: template.standards_flags || prev.governance.standards_flags,
      },
      review_requests: (template.required_reviewer_roles || []).map((role: string) => ({
        id: `${template.key}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        role,
        requested_by: prev.ownership.owner || prev.access_control.owner,
        status: 'open',
        due_at: '',
        note: `Requested from intake template ${template.label}.`,
      })),
    }));
  };

  const adoptSimilarWorkflow = (workflow: any) => {
    setFormData(prev => ({
      ...prev,
      prc: prev.prc || workflow.prc || '',
      workflow_type: prev.workflow_type || workflow.workflow_type || '',
      tool_family: prev.tool_family.length > 0 ? prev.tool_family : (typeof workflow.tool_family === 'string' ? workflow.tool_family.split(',').map((item: string) => item.trim()).filter(Boolean) : (workflow.tool_family || [])),
      applicable_tools: prev.applicable_tools.length > 0 ? prev.applicable_tools : (typeof workflow.tool_id === 'string' ? workflow.tool_id.split(',').map((item: string) => item.trim()).filter(Boolean) : (workflow.applicable_tools || [])),
      ownership: {
        ...prev.ownership,
        owner: prev.ownership.owner || workflow.ownership?.owner || workflow.access_control?.owner || prev.access_control.owner,
        smes: prev.ownership.smes.length > 0 ? prev.ownership.smes : (workflow.ownership?.smes || []),
        reviewers: prev.ownership.reviewers.length > 0 ? prev.ownership.reviewers : (workflow.ownership?.reviewers || []),
        automation_owner: prev.ownership.automation_owner || workflow.ownership?.automation_owner || '',
      },
      governance: {
        ...prev.governance,
        required_reviewer_roles: prev.governance.required_reviewer_roles.length > 0 ? prev.governance.required_reviewer_roles : (workflow.governance?.required_reviewer_roles || workflow.required_reviewer_roles || []),
        standards_flags: prev.governance.standards_flags.length > 0 ? prev.governance.standards_flags : (workflow.governance?.standards_flags || []),
      },
      related_workflow_ids: Array.from(new Set([...(prev.related_workflow_ids || []), workflow.id])).slice(0, 8),
    }));
  };

  const applyDraftAssist = () => {
    if (!draftAssist) return;
    const suggestedFields = draftAssist.suggested_fields || {};
    setFormData(prev => ({
      ...prev,
      name: prev.name || draftAssist.generated_name || prev.name,
      prc: prev.prc || suggestedFields.prc || '',
      workflow_type: prev.workflow_type || suggestedFields.workflow_type || '',
      trigger_type: prev.trigger_type || suggestedFields.trigger_type || '',
      output_type: prev.output_type || suggestedFields.output_type || '',
      tool_family: prev.tool_family.length > 0 ? prev.tool_family : (suggestedFields.tool_family || []),
      governance: {
        ...prev.governance,
        required_reviewer_roles: prev.governance.required_reviewer_roles.length > 0 ? prev.governance.required_reviewer_roles : (suggestedFields.required_reviewer_roles || []),
        standards_flags: prev.governance.standards_flags.length > 0 ? prev.governance.standards_flags : (suggestedFields.standards_flags || []),
      },
      related_workflow_ids: Array.from(new Set([...(prev.related_workflow_ids || []), ...((draftAssist.reuse_candidates || []).map((item: any) => item.id))])).slice(0, 8),
    }));
    if (draftAssist.recommended_template) {
      applyTemplate(draftAssist.recommended_template);
    }
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
      version_notes: '',
      parent_workflow_id: null,
      version_base_snapshot: null,
      equipment_required: false,
      equipment_state: '',
      cleanroom_required: false,
      cadence_count: 1.0,
      cadence_unit: 'week',
      tool_family: [],
      applicable_tools: [],
      repeatability_check: true,
      access_control: {
        visibility: workflowDefaults?.access_control?.visibility || 'private',
        viewers: [],
        editors: [],
        mention_groups: [],
        owner: defaultOwner
      },
      quick_capture_notes: '',
      template_key: '',
      ownership: {
        owner: defaultOwner,
        smes: [],
        backup_owners: [],
        automation_owner: '',
        reviewers: [],
      },
      governance: {
        lifecycle_stage: 'Draft',
        review_state: 'Draft',
        approval_state: 'Draft',
        required_reviewer_roles: [],
        standards_flags: [],
        stale_after_days: workflowDefaults?.governance?.stale_after_days || 90,
        review_due_at: '',
        last_reviewed_at: '',
      },
      review_requests: [],
      activity_timeline: [],
      notification_feed: [],
      related_workflow_ids: [],
      standards_profile: {},
      comments: []
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

        {suggestedTemplate && (
          <section className="apple-card !bg-theme-accent/5 border-theme-accent/20 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-theme-accent">Suggested Template</p>
              <p className="text-[12px] font-bold text-white/80">{suggestedTemplate.label}</p>
              <p className="text-[11px] font-bold text-white/55">{suggestedTemplate.description}</p>
            </div>
            <button onClick={() => applyTemplate(suggestedTemplate)} className="px-4 py-2 rounded-xl border border-theme-accent/30 bg-theme-accent/10 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
              Apply Template
            </button>
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

        <section className="apple-card !bg-violet-500/5 border-violet-500/20 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-violet-300">AI-Assisted Drafting</p>
              <p className="text-[12px] font-bold text-white/80">Use the current notes, description, and reuse signals to draft a better workflow definition without bypassing the existing gate checks.</p>
            </div>
            <button
              onClick={requestDraftAssist}
              disabled={draftAssistLoading || !(formData.name || formData.description || formData.quick_capture_notes)}
              className="px-4 py-2 rounded-xl border border-violet-400/30 bg-violet-400/10 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200 hover:bg-violet-400 hover:text-white transition-all disabled:opacity-30 flex items-center gap-2"
            >
              <Sparkles size={14} />
              {draftAssistLoading ? 'Analyzing…' : 'Generate Assist'}
            </button>
          </div>

          {draftAssist && (
            <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Draft Confidence</p>
                    <p className="mt-1 text-[12px] font-bold text-white/55">{draftAssist.executive_summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[24px] font-black text-violet-300">{draftAssist.confidence}%</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">Assist Confidence</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Workflow Type', draftAssist.suggested_fields?.workflow_type],
                    ['PRC', draftAssist.suggested_fields?.prc],
                    ['Trigger', draftAssist.suggested_fields?.trigger_type],
                    ['Output', draftAssist.suggested_fields?.output_type],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
                      <p className="mt-2 text-[12px] font-black text-white">{value || 'No recommendation yet'}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Draft Outline</p>
                  <div className="space-y-2">
                    {(draftAssist.draft_outline || []).map((item: any) => (
                      <div key={`${item.step}-${item.title}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.step}. {item.title}</p>
                        <p className="mt-1 text-[11px] font-bold text-white/55">{item.task_type || 'Operational Step'}{item.phase_name ? ` • ${item.phase_name}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={applyDraftAssist}
                  className="px-4 py-3 rounded-2xl border border-theme-accent/30 bg-theme-accent/10 text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all"
                >
                  Apply Assist Recommendations
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Missing Questions</p>
                  <div className="mt-3 space-y-2">
                    {(draftAssist.missing_questions || []).map((item: string) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-[11px] font-bold text-white/70">{item}</div>
                    ))}
                    {!(draftAssist.missing_questions || []).length && (
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-[11px] font-bold text-white/55">The draft is already carrying enough context for a strong first-pass workflow intake.</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Reuse Candidates</p>
                  <div className="mt-3 space-y-2">
                    {(draftAssist.reuse_patterns || []).map((item: any) => (
                      <div key={`${item.workflow_id}-${item.name}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                        <p className="mt-1 text-[11px] font-bold text-white/55">{item.why}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", showErrors && !formData.description ? "text-status-error" : "text-white/40")}>Description</label>
                  <span className="text-[9px] text-white/20 font-mono">{formData.description.length} / 500</span>
                </div>
                <textarea 
                  data-testid="intake-description"
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
                  onChange={val => setFormData({
                    ...formData,
                    workspace: val,
                    access_control: {
                      ...formData.access_control,
                      visibility: val === 'Collaborative Workflows' ? 'workspace' : val === 'Standard Operations' ? 'org' : 'private'
                    }
                  })}
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
                <div className="space-y-2">
                  <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Version Notes</label>
                  <textarea
                    data-testid="intake-version-notes"
                    className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/80 outline-none h-24 resize-none focus:border-theme-accent transition-all"
                    value={formData.version_notes}
                    onChange={e => setFormData({...formData, version_notes: e.target.value})}
                    placeholder="Describe why this draft or version is being created..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button data-testid="intake-equipment-toggle" onClick={() => setFormData({...formData, equipment_required: !formData.equipment_required})} className={cn("border rounded-xl px-4 py-3 text-left transition-all", formData.equipment_required ? "border-theme-accent bg-theme-accent/10 text-white" : "border-white/10 bg-[#1e293b]/40 text-white/50")}>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]">Equipment Involved</p>
                    <p className="text-[12px] font-bold mt-2">{formData.equipment_required ? 'Enabled' : 'Not Required'}</p>
                  </button>
                  <button data-testid="intake-cleanroom-toggle" onClick={() => setFormData({...formData, cleanroom_required: !formData.cleanroom_required})} className={cn("border rounded-xl px-4 py-3 text-left transition-all", formData.cleanroom_required ? "border-theme-accent bg-theme-accent/10 text-white" : "border-white/10 bg-[#1e293b]/40 text-white/50")}>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]">Cleanroom</p>
                    <p className="text-[12px] font-bold mt-2">{formData.cleanroom_required ? 'Required' : 'No'}</p>
                  </button>
                  <div className="col-span-2">
                    <SearchableSelect
                      label="Equipment State"
                      testId="intake-equipment-state"
                      options={['Idle', 'Local', 'Run', 'Down']}
                      value={formData.equipment_state}
                      onChange={val => setFormData({...formData, equipment_state: val})}
                      placeholder="SELECT STATE..."
                      disabled={!formData.equipment_required}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <SearchableSelect 
                  label="Tool Family"
                  testId="intake-tool-family"
                  options={hardwareFamilies}
                  value={formData.tool_family}
                  onChange={vals => setFormData({...formData, tool_family: vals})}
                  placeholder="SELECT FAMILIES..."
                  isMulti
                  error={showErrors && formData.tool_family.length === 0}
                />
                <SearchableSelect 
                  label="Applicable Tools"
                  testId="intake-applicable-tools"
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

            <section className="space-y-4">
              <div className="flex items-center gap-3 text-theme-accent font-black px-1">
                <ShieldAlert size={16} />
                <span className="text-[11px] tracking-[0.2em] uppercase">Collaboration Controls</span>
              </div>
              <div className="apple-card space-y-6 !bg-[#111827]/40 border-white/10 p-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Workflow Owner</label>
                    <input
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-theme-accent transition-all"
                      value={formData.ownership.owner}
                      onChange={e => setFormData({...formData, ownership: { ...formData.ownership, owner: e.target.value }, access_control: { ...formData.access_control, owner: e.target.value }})}
                    />
                  </div>
                  <SearchableSelect
                    label="Visibility"
                    testId="intake-visibility"
                    options={['private', 'workspace', 'org']}
                    value={formData.access_control.visibility}
                    onChange={val => setFormData({...formData, access_control: { ...formData.access_control, visibility: val }})}
                  />
                  <SearchableSelect
                    label="Editors"
                    testId="intake-editors"
                    options={collaboratorDirectory}
                    value={formData.access_control.editors}
                    onChange={vals => setFormData({...formData, access_control: { ...formData.access_control, editors: vals }})}
                    isMulti
                    placeholder="SELECT EDITORS..."
                  />
                  <SearchableSelect
                    label="Mention Groups"
                    testId="intake-mention-groups"
                    options={mentionGroups}
                    value={formData.access_control.mention_groups}
                    onChange={vals => setFormData({...formData, access_control: { ...formData.access_control, mention_groups: vals }})}
                    isMulti
                    placeholder="SELECT GROUPS..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <SearchableSelect
                    label="SMEs"
                    options={collaboratorDirectory}
                    value={formData.ownership.smes}
                    onChange={vals => setFormData({...formData, ownership: { ...formData.ownership, smes: vals }})}
                    isMulti
                    placeholder="SELECT SMEs..."
                  />
                  <SearchableSelect
                    label="Review Roles"
                    options={reviewerRoleOptions}
                    value={formData.governance.required_reviewer_roles}
                    onChange={vals => setFormData({...formData, governance: { ...formData.governance, required_reviewer_roles: vals }})}
                    isMulti
                    placeholder="SELECT ROLES..."
                  />
                  <SearchableSelect
                    label="Lifecycle"
                    options={lifecycleOptions}
                    value={formData.governance.lifecycle_stage}
                    onChange={val => setFormData({...formData, governance: { ...formData.governance, lifecycle_stage: val, review_state: val === 'Approved' ? 'Approved' : formData.governance.review_state }})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Review Due</label>
                    <input
                      type="date"
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-theme-accent transition-all"
                      value={formData.governance.review_due_at}
                      onChange={e => setFormData({...formData, governance: { ...formData.governance, review_due_at: e.target.value }})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em] px-1">Stale After (Days)</label>
                    <input
                      type="number"
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-theme-accent transition-all"
                      value={formData.governance.stale_after_days}
                      onChange={e => setFormData({...formData, governance: { ...formData.governance, stale_after_days: parseInt(e.target.value || '90', 10) || 90 }})}
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
