import React, { useMemo, useState, useEffect } from 'react';
import { 
  Trash2, 
  Zap, 
  Download, 
  FilterX, 
  Clock, 
  Search, 
  Plus, 
  Copy, 
  GitBranch, 
  FileText, 
  Eye,
  Filter,
  X,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Share2,
  Archive,
  ChevronDown,
  Check,
  ArrowRight
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { settingsApi } from '../api/client';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
  onCreateNew?: () => void;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

// Automation Status Enum from Backend
const STATUS_OPTIONS = [
  "Created", "Workflow Review", "Priority Measurement", "Feasibility Review", 
  "Backlog", "Automation Brainstorming", "Automation Planned", 
  "In Automation", "Verification", "Partially Automated", "Fully Automated"
];

const MultiSelectFilter = ({ 
  label, 
  options, 
  selected, 
  onChange 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onChange: (vals: string[]) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px] relative">
      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">{label}</label>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button className={cn(
            "flex items-center justify-between bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-[11px] text-left transition-all hover:bg-white/10",
            selected.length > 0 ? "text-theme-accent border-theme-accent/50" : "text-theme-secondary"
          )}>
            <span className="truncate max-w-[100px]">
              {selected.length === 0 ? "All" : 
               selected.length === 1 ? selected[0] : 
               `${selected.length} Selected`}
            </span>
            <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            className="w-56 bg-theme-sidebar border border-theme-border rounded-xl shadow-2xl p-1.5 z-50 animate-apple-in backdrop-blur-xl"
            sideOffset={5}
            align="start"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
              {options.length === 0 ? (
                <div className="py-2 px-3 text-[10px] text-theme-muted italic">No options available</div>
              ) : options.map(opt => (
                <button 
                  key={opt}
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-theme-secondary hover:bg-white/[0.08] hover:text-white transition-all text-[11px] font-semibold"
                >
                  {opt}
                  {selected.includes(opt) && <Check size={12} className="text-theme-accent" />}
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-theme-border mt-1 pt-1">
                <button 
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-[10px] font-black text-theme-accent hover:bg-theme-accent/10 rounded-lg uppercase tracking-widest"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete, onCreateNew }) => {
  // State for Table Features
  const [searchText, setSearchText] = useState('');
  const [activeRibbon, setActiveRibbon] = useState('Collaborative Workflows');
  const [isFilterBarOpen, setFilterBarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  
  // Multi-select filters
  const [filters, setFilters] = useState({
    prc: [] as string[],
    tool_family: [] as string[],
    type: [] as string[],
    trigger: [] as string[],
    output: [] as string[],
    status: [] as string[]
  });

  // Dynamic Parameters from Settings
  const [params, setParams] = useState<any[]>([]);
  useEffect(() => {
    settingsApi.listParameters().then(setParams).catch(console.error);
  }, []);

  const getParamValues = (key: string) => {
    const p = params.find(x => x.key === key);
    return p ? (p.cached_values || []) : [];
  };

  // Helper to calculate analytics
  const calculateAnalytics = (w: any) => {
    let freqMultiplier = 1;
    const count = w.cadence_count || 1;
    const unit = w.cadence_unit || 'week';

    if (unit === 'day') freqMultiplier = 7 * count;
    else if (unit === 'week') freqMultiplier = count;
    else if (unit === 'month') freqMultiplier = count / 4.33;
    else if (unit === 'year') freqMultiplier = count / 52;

    const totalManualMinutes = w.tasks?.reduce((acc: number, t: any) => 
      acc + ((t.active_touch_time_minutes || 0) * (t.occurrences_per_cycle || 1)), 0) || 0;
    
    const totalAutoMinutes = w.tasks?.reduce((acc: number, t: any) => 
      acc + ((t.machine_wait_time_minutes || 0) * (t.occurrences_per_cycle || 1)), 0) || 0;

    const taskCount = w.tasks?.length || 0;
    const decisionCount = w.tasks?.filter((t: any) => t.interface_type === 'DECISION').length || 0;
    const inputCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.source_data ? 1 : 0), 0) || 0;
    const outputCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.output_format_example ? 1 : 0), 0) || 0;

    return {
      manualPerCycle: totalManualMinutes / 60, // hours
      autoPerCycle: totalAutoMinutes / 60, // hours
      frequencyPerWeek: freqMultiplier,
      manualWeekly: (totalManualMinutes * freqMultiplier) / 60,
      autoWeekly: (totalAutoMinutes * freqMultiplier) / 60,
      taskCount,
      decisionCount,
      inputCount,
      outputCount
    };
  };

  // Filtering Logic
  const filteredWorkflows = useMemo(() => {
    let result = workflows || [];

    // Ribbon Filtering
    if (activeRibbon === 'Personal Drafts') result = result.filter(w => w.status === 'DRAFT' || w.status === 'Created');
    else if (activeRibbon === 'Submitted Requests') result = result.filter(w => w.status !== 'DRAFT' && w.created_by === 'system_user');
    else if (activeRibbon === 'Standard Operations') result = result.filter(w => w.status === 'FULLY_AUTOMATED' || w.status === 'PROD');

    // Multi-select Filtering
    if (filters.prc.length > 0) result = result.filter(w => filters.prc.includes(w.prc));
    if (filters.tool_family.length > 0) result = result.filter(w => filters.tool_family.includes(w.tool_family));
    if (filters.type.length > 0) result = result.filter(w => filters.type.includes(w.workflow_type));
    if (filters.status.length > 0) result = result.filter(w => filters.status.includes(w.status));
    
    if (filters.trigger.length > 0) result = result.filter(w => filters.trigger.includes(w.trigger_type));
    if (filters.output.length > 0) result = result.filter(w => filters.output.includes(w.output_type));

    // Global Search Filtering
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(w => 
        w.name?.toLowerCase().includes(lowerSearch) ||
        w.tool_family?.toLowerCase().includes(lowerSearch) ||
        w.prc?.toLowerCase().includes(lowerSearch) ||
        w.status?.toLowerCase().includes(lowerSearch)
      );
    }

    // Sorting
    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        const aAnalytics = calculateAnalytics(a);
        const bAnalytics = calculateAnalytics(b);

        if (sortConfig.key === 'manual_time') {
          aValue = aAnalytics.manualPerCycle;
          bValue = bAnalytics.manualPerCycle;
        } else if (sortConfig.key === 'auto_time') {
          aValue = aAnalytics.autoPerCycle;
          bValue = bAnalytics.autoPerCycle;
        } else if (sortConfig.key === 'frequency') {
          aValue = aAnalytics.frequencyPerWeek;
          bValue = bAnalytics.frequencyPerWeek;
        } else if (sortConfig.key === 'roi') {
          aValue = aAnalytics.manualWeekly;
          bValue = bAnalytics.manualWeekly;
        } else if (sortConfig.key === 'blockers') {
          aValue = a.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
          bValue = b.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
        } else if (sortConfig.key === 'errors') {
          aValue = a.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;
          bValue = b.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;
        }

        if (aValue === bValue) return 0;
        const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * multiplier;
        }
        return aValue < bValue ? -1 * multiplier : 1 * multiplier;
      });
    }

    return result;
  }, [workflows, activeRibbon, searchText, sortConfig, filters]);

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const onClearFilters = () => {
    setSearchText('');
    setFilters({ prc: [], tool_family: [], type: [], trigger: [], output: [], status: [] });
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };

  // Components
  const StatusBadge = ({ status }: { status: string }) => {
    const isProd = status === 'FULLY_AUTOMATED' || status === 'PROD';
    const isDraft = status === 'DRAFT' || status === 'Created';
    
    return (
      <span className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap inline-flex items-center gap-1.5 leading-none",
        isProd ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
        isDraft ? "bg-slate-500/10 text-slate-400 border-slate-500/30" :
        "bg-amber-500/10 text-amber-400 border-amber-500/30"
      )}>
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
          isProd ? "bg-emerald-400" : isDraft ? "bg-slate-400" : "bg-amber-400"
        )} />
        {status}
      </span>
    );
  };

  const CircledNumber = ({ count, colorClass }: { count: number, colorClass: string }) => (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black border",
      count > 0 ? colorClass : "bg-white/[0.02] border-white/10 text-white/20"
    )}>
      {count}
    </div>
  );

  const ActionMenu = ({ data }: { data: any }) => (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-theme-accent/20 hover:text-white transition-all rounded-lg border border-theme-border group">
          <MoreHorizontal size={14} className="text-theme-muted group-hover:text-white" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content 
          className="w-56 bg-theme-sidebar/95 backdrop-blur-xl border border-theme-border rounded-xl shadow-2xl p-1.5 z-50 animate-apple-in"
          sideOffset={5}
          align="end"
        >
          <div className="space-y-0.5">
            {[
              { icon: Eye, label: 'View Details', onClick: () => onSelect(data) },
              { icon: Copy, label: 'Duplicate Workflow' },
              { icon: GitBranch, label: 'Version History' },
              { icon: FileText, label: 'Export SOP' },
              { icon: Share2, label: 'Collaborate' },
            ].map((item, idx) => (
              <button 
                key={idx}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-theme-secondary hover:bg-white/[0.08] hover:text-white transition-all text-[11px] font-semibold"
              >
                <item.icon size={13} /> {item.label}
              </button>
            ))}
            <div className="h-[1px] bg-theme-border my-1 mx-1" />
            <button 
              onClick={() => onDelete(data.id)}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-status-error hover:bg-status-error/10 transition-all text-[11px] font-semibold"
            >
              <Trash2 size={13} /> Delete Record
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  const PeekTooltip = ({ data }: { data: any }) => {
    const stats = calculateAnalytics(data);
    const blockerCount = data.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
    const errorCount = data.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="flex flex-col cursor-help group/title overflow-hidden">
            <span className="font-bold text-white text-[13px] group-hover:text-theme-accent transition-colors truncate w-full leading-tight">
              {data.name}
            </span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content 
            className="w-80 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl p-4 z-50 animate-apple-in backdrop-blur-2xl"
            sideOffset={8}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-accent">Industrial Analytics</span>
                <span className="text-[10px] font-bold text-white/40">{data.id_prefix || 'WF'}-{data.id}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">Entities</span>
                  <div className="text-[11px] text-white font-bold flex flex-col gap-0.5">
                    <div className="flex justify-between"><span>Tasks:</span> <span className="text-theme-accent">{stats.taskCount}</span></div>
                    <div className="flex justify-between"><span>Decisions:</span> <span className="text-theme-accent">{stats.decisionCount}</span></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">Data Flux</span>
                  <div className="text-[11px] text-white font-bold flex flex-col gap-0.5">
                    <div className="flex justify-between"><span>Inputs:</span> <span className="text-emerald-400">{stats.inputCount}</span></div>
                    <div className="flex justify-between"><span>Outputs:</span> <span className="text-emerald-400">{stats.outputCount}</span></div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <span className="text-[9px] text-white/30 font-black uppercase tracking-widest block">ROI Projection (Weekly)</span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-theme-accent" />
                    <span className="text-[12px] font-black text-white">{stats.manualWeekly.toFixed(1)}h <span className="text-[9px] text-white/40">Manual</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-emerald-400" />
                    <span className="text-[12px] font-black text-white">{stats.autoWeekly.toFixed(1)}h <span className="text-[9px] text-white/40">Auto</span></span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                   <span className="text-[10px] font-black text-red-400 uppercase tracking-tighter">{blockerCount} Blockers</span>
                </div>
                <div className="flex-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                   <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">{errorCount} Errors</span>
                </div>
              </div>

              <div className="text-[11px] text-white/60 italic leading-relaxed border-t border-white/5 pt-2">
                {data.description || "System-generated industrial workflow definition."}
              </div>
            </div>
            <Tooltip.Arrow className="fill-white/10" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  return (
    <Tooltip.Provider>
    <div className="flex flex-col h-full animate-apple-in relative">
      
      {/* Top Action Bar & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex-1 max-w-lg relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search workflows, PRC, or status..." 
            className="w-full bg-white/[0.03] border border-theme-border focus:border-theme-accent outline-none rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-theme-muted/40 transition-all font-medium text-[13px] backdrop-blur-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterBarOpen(!isFilterBarOpen)}
            className={cn(
              "flex items-center gap-2 px-4 h-10 bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-lg text-theme-secondary text-[11px] font-bold uppercase tracking-widest",
              isFilterBarOpen && "border-theme-accent text-white bg-theme-accent/10"
            )}
          >
            <Filter size={14} /> 
            <span>Filters</span>
            {(filters.prc.length > 0 || filters.tool_family.length > 0 || filters.type.length > 0 || filters.status.length > 0 || filters.trigger.length > 0 || filters.output.length > 0) && (
              <div className="w-2 h-2 rounded-full bg-theme-accent animate-pulse" />
            )}
          </button>
          <div className="w-[1px] h-6 bg-theme-border mx-1" />
          <button 
            onClick={onCreateNew}
            className="btn-apple-primary h-10 !px-6 flex items-center gap-2"
          >
            <Plus size={16} strokeWidth={3} />
            <span className="text-[12px]">Create New</span>
          </button>
        </div>
      </div>

      {/* Workspace Ribbon */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-0 mb-0">
        <div className="flex items-center gap-0">
          {['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'].map((ribbon) => (
            <button
              key={ribbon}
              onClick={() => setActiveRibbon(ribbon)}
              className={cn(
                "px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                activeRibbon === ribbon 
                  ? 'text-theme-accent' 
                  : 'text-theme-muted hover:text-theme-secondary'
              )}
            >
              {ribbon}
              {activeRibbon === ribbon && (
                <motion.div 
                  layoutId="activeRibbon"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-theme-accent rounded-full shadow-[0_0_10px_var(--color-theme-accent)]" 
                />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 pr-2">
           <button onClick={onClearFilters} className="text-[10px] font-bold text-theme-muted hover:text-white flex items-center gap-1.5 transition-all uppercase tracking-wider">
             <FilterX size={12} /> Reset
           </button>
           <button className="text-[10px] font-bold text-theme-muted hover:text-white flex items-center gap-1.5 transition-all uppercase tracking-wider">
             <Download size={12} /> Export CSV
           </button>
        </div>
      </div>

      {/* Horizontal Filter Bar */}
      <AnimatePresence>
        {isFilterBarOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-x border-theme-border bg-white/[0.02]"
          >
            <div className="p-4 flex flex-wrap gap-4 border-b border-theme-border items-end">
              <MultiSelectFilter 
                label="PRC" 
                options={getParamValues('PRC')} 
                selected={filters.prc} 
                onChange={vals => setFilters({...filters, prc: vals})} 
              />
              <MultiSelectFilter 
                label="Tool Family" 
                options={getParamValues('HARDWARE_FAMILY')} 
                selected={filters.tool_family} 
                onChange={vals => setFilters({...filters, tool_family: vals})} 
              />
              <MultiSelectFilter 
                label="Type" 
                options={getParamValues('WORKFLOW_TYPE')} 
                selected={filters.type} 
                onChange={vals => setFilters({...filters, type: vals})} 
              />
              <MultiSelectFilter 
                label="Trigger" 
                options={getParamValues('TRIGGER_ARCHITECTURE')} 
                selected={filters.trigger} 
                onChange={vals => setFilters({...filters, trigger: vals})} 
              />
              <MultiSelectFilter 
                label="Output" 
                options={getParamValues('OUTPUT_CLASSIFICATION')} 
                selected={filters.output} 
                onChange={vals => setFilters({...filters, output: vals})} 
              />
              <MultiSelectFilter 
                label="Status" 
                options={STATUS_OPTIONS} 
                selected={filters.status} 
                onChange={vals => setFilters({...filters, status: vals})} 
              />
              
              <button 
                onClick={() => setFilters({ prc: [], tool_family: [], type: [], trigger: [], output: [], status: [] })}
                className="px-4 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold uppercase text-theme-muted hover:text-white ml-auto"
              >
                Clear All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Table Container */}
      <div className="flex-1 overflow-hidden border-x border-b border-theme-border bg-[#0a1120] relative">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[2100px] table-fixed">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#1e293b] border-b border-theme-border">
                <th className="p-2 w-10 text-center sticky left-0 bg-[#1e293b] border-r border-theme-border shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  <button onClick={() => setSelectedIds(selectedIds.size === filteredWorkflows.length ? new Set() : new Set(filteredWorkflows.map(w => w.id)))} className="w-5 h-5 flex items-center justify-center rounded border border-theme-border bg-white/[0.05] mx-auto">
                    {selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0 ? <CheckCircle2 size={12} className="text-theme-accent" /> : <Circle size={12} className="text-white/10" />}
                  </button>
                </th>
                
                <th className="px-4 py-3 w-[280px] text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors border-r border-theme-border" onClick={() => handleSort('name')}>
                  Workflow {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[100px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('prc')}>
                  PRC {sortConfig.key === 'prc' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[160px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('tool_family')}>
                  Tool Family {sortConfig.key === 'tool_family' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[130px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('workflow_type')}>
                  Type {sortConfig.key === 'workflow_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[280px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border text-center">
                  Trigger → Output
                </th>

                <th className="px-3 py-3 w-[100px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('frequency')}>
                  Freq / Wk {sortConfig.key === 'frequency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[110px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('manual_time')}>
                  Manual {sortConfig.key === 'manual_time' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[110px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('auto_time')}>
                  Auto {sortConfig.key === 'auto_time' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[120px] text-[10px] font-black text-theme-accent uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('roi')}>
                  ROI (h/wk) {sortConfig.key === 'roi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[90px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('blockers')}>
                  Blockers {sortConfig.key === 'blockers' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[90px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer" onClick={() => handleSort('errors')}>
                  Errors {sortConfig.key === 'errors' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[160px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('status')}>
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-3 w-[130px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('created_by')}>
                  Creator
                </th>

                <th className="px-3 py-3 w-[130px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('updated_by')}>
                  Editor
                </th>

                <th className="px-3 py-3 w-[140px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border cursor-pointer text-center" onClick={() => handleSort('created_at')}>
                  Created
                </th>

                <th className="px-3 py-3 w-[80px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border cursor-pointer sticky right-[60px] bg-[#1e293b] z-20" onClick={() => handleSort('version')}>
                  Ver
                </th>

                <th className="px-3 py-3 w-[60px] bg-[#1e293b] sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.3)] z-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((w) => {
                  const blockerCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
                  const errorCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;
                  const analytics = calculateAnalytics(w);
                  const familyDisplay = w.tool_family_count > 1 ? `${w.tool_family} + ${w.tool_family_count}` : w.tool_family;

                  return (
                    <tr 
                      key={w.id}
                      className={cn(
                        "group hover:bg-white/[0.03] transition-all cursor-default border-theme-border",
                        selectedIds.has(w.id) ? "bg-theme-accent/5" : ""
                      )}
                    >
                      <td className="p-2 text-center sticky left-0 bg-[#0a1120] group-hover:bg-[#151d2e] border-r border-theme-border z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <button 
                          onClick={() => {
                            const next = new Set(selectedIds);
                            if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                            setSelectedIds(next);
                          }}
                          className={cn(
                            "w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto",
                            selectedIds.has(w.id) ? "border-theme-accent bg-theme-accent/20" : "border-theme-border bg-white/[0.02]"
                          )}
                        >
                          {selectedIds.has(w.id) && <CheckCircle2 size={12} className="text-theme-accent" />}
                        </button>
                      </td>

                      <td className="px-4 py-3 border-r border-theme-border">
                        <PeekTooltip data={w} />
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                        <span className="text-[13px] font-mono font-black text-blue-400">{w.prc || '--'}</span>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                        <span className="text-[11px] font-black text-theme-secondary uppercase tracking-wider">
                          {familyDisplay || 'Generic'}
                        </span>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                         <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">{w.workflow_type || 'STANDARD'}</span>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-white/60">
                          <span className="truncate max-w-[120px]">{w.trigger_type}</span>
                          <ArrowRight size={10} className="text-theme-accent shrink-0" />
                          <span className="truncate max-w-[120px]">{w.output_type}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                         <span className="text-[13px] font-black text-white/80">{analytics.frequencyPerWeek.toFixed(1)}</span>
                      </td>

                      <td className="px-3 py-3 text-center border-r border-theme-border">
                        <span className="text-[13px] font-black text-white/80">{analytics.manualPerCycle.toFixed(1)}h</span>
                      </td>

                      <td className="px-3 py-3 text-center border-r border-theme-border">
                        <span className="text-[13px] font-black text-white/80">{analytics.autoPerCycle.toFixed(1)}h</span>
                      </td>

                      <td className="px-3 py-3 text-center border-r border-theme-border">
                        <span className="text-[13px] font-black text-theme-accent">+{analytics.manualWeekly.toFixed(1)}</span>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border">
                        <div className="flex justify-center">
                          <CircledNumber count={blockerCount} colorClass="bg-red-500/10 border-red-500/30 text-red-400" />
                        </div>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border">
                        <div className="flex justify-center">
                          <CircledNumber count={errorCount} colorClass="bg-amber-500/10 border-amber-500/30 text-amber-400" />
                        </div>
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-center">
                        <StatusBadge status={w.status} />
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-[11px] font-bold text-theme-secondary text-center">
                        {w.created_by?.split('_')[0] || 'System'}
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-[11px] font-bold text-theme-secondary text-center">
                        {w.updated_by?.split('_')[0] || 'System'}
                      </td>

                      <td className="px-3 py-3 border-r border-theme-border text-[11px] text-theme-muted font-mono text-center">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-3 py-3 text-center border-r border-theme-border sticky right-[60px] bg-[#0a1120] group-hover:bg-[#151d2e] z-10">
                         <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-black text-theme-secondary">
                           V{w.version}
                         </span>
                      </td>

                      <td className="px-3 py-3 text-right sticky right-0 bg-[#0a1120] group-hover:bg-[#151d2e] shadow-[-2px_0_5px_rgba(0,0,0,0.3)] z-10">
                        <ActionMenu data={w} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={18} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <FilterX size={48} />
                      <p className="text-[14px] font-black uppercase tracking-widest">No matching workflows identified</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-theme-sidebar/90 backdrop-blur-2xl border border-white/20 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] p-3 flex items-center gap-6 z-50 min-w-[500px]"
          >
            <div className="flex items-center gap-3 px-4 border-r border-white/10">
              <div className="w-8 h-8 rounded-lg bg-theme-accent flex items-center justify-center text-white font-black text-[12px]">
                {selectedIds.size}
              </div>
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Selected</span>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
                <Archive size={14} /> Archive
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
                <Download size={14} /> Export
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
                <Share2 size={14} /> Share
              </button>
            </div>

            <button 
              onClick={() => setSelectedIds(new Set())}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-all text-theme-muted hover:text-white"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </Tooltip.Provider>
  );
};

export default WorkflowRegistry;
