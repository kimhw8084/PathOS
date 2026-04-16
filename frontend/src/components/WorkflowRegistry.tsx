import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  Download, 
  FilterX, 
  Search, 
  Plus, 
  Copy, 
  GitBranch, 
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
  ArrowRight,
  Maximize2,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (wf: any) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  onCreateNew?: () => void;
}

// Automation Status Enum from Backend with Explanations
const STATUS_EXPLANATIONS: Record<string, { desc: string, color: string, badgeColor: string, dotColor: string }> = {
  "Created": { 
    desc: "Initial entry by user. ROI is estimated based on preliminary data.", 
    color: "slate",
    badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    dotColor: "bg-slate-400"
  },
  "Workflow Review": { 
    desc: "Logic being reviewed by Process Integration for technical accuracy.", 
    color: "blue",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    dotColor: "bg-blue-400"
  },
  "Priority Measurement": { 
    desc: "Determining business impact and automation feasibility ranking.", 
    color: "purple",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    dotColor: "bg-purple-400"
  },
  "Feasibility Review": { 
    desc: "Technical evaluation of automation path and tool compatibility.", 
    color: "cyan",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    dotColor: "bg-cyan-400"
  },
  "Backlog": { 
    desc: "Approved for automation, awaiting resource allocation.", 
    color: "amber",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400"
  },
  "Automation Brainstorming": { 
    desc: "Designing automation script architecture and exception handling.", 
    color: "indigo",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    dotColor: "bg-indigo-400"
  },
  "Automation Planned": { 
    desc: "Development timeline and scope defined; logic locked.", 
    color: "violet",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    dotColor: "bg-violet-400"
  },
  "In Automation": { 
    desc: "Active development of automation scripts and connectors.", 
    color: "orange",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    dotColor: "bg-orange-400"
  },
  "Verification": { 
    desc: "Testing automation output in shadow mode for validation.", 
    color: "fuchsia",
    badgeColor: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
    dotColor: "bg-fuchsia-400"
  },
  "Partially Automated": { 
    desc: "Some steps automated; manual intervention still required.", 
    color: "teal",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    dotColor: "bg-teal-400"
  },
  "Fully Automated": { 
    desc: "Zero-touch execution in production environment.", 
    color: "emerald",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400"
  }
};

const STATUS_OPTIONS = Object.keys(STATUS_EXPLANATIONS);

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
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative inline-block text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all",
          selected.length > 0 
            ? "border-theme-accent bg-theme-accent/10 text-white" 
            : "border-theme-border bg-white/[0.02] text-theme-muted hover:text-white"
        )}
      >
        {label} {selected.length > 0 && `(${selected.length})`}
        <ChevronDown size={10} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-[100] mt-2 w-48 bg-theme-sidebar border border-theme-border rounded-xl shadow-2xl py-2 backdrop-blur-xl"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar px-1">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    const next = selected.includes(opt) 
                      ? selected.filter(v => v !== opt) 
                      : [...selected, opt];
                    onChange(next);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
                >
                  <span className={cn("text-[11px] font-bold", selected.includes(opt) ? "text-theme-accent" : "text-theme-secondary group-hover:text-white")}>{opt}</span>
                  {selected.includes(opt) && <Check size={12} className="text-theme-accent" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PeekTooltip = ({ data }: { data: any }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <div className="flex flex-col cursor-help">
        <span className="text-[13px] font-bold text-white group-hover:text-theme-accent transition-colors truncate max-w-[280px]">{data.name}</span>
        <div className="flex items-center gap-2 opacity-40 mt-1">
           <span className="text-[9px] font-mono tracking-tighter uppercase">{data.workflow_type || 'GENERAL'}</span>
           <div className="w-1 h-1 rounded-full bg-white/20" />
           <span className="text-[9px] font-mono tracking-tighter uppercase">{data.prc || 'NO-PRC'}</span>
        </div>
      </div>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="bg-theme-sidebar border border-theme-border p-4 rounded-xl shadow-2xl z-50 text-[11px] font-bold text-white max-w-[320px] animate-apple-in backdrop-blur-xl" sideOffset={5}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
             <span className="text-[9px] font-black uppercase text-theme-accent tracking-widest">Description</span>
             <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-black">V{data.version}</span>
          </div>
          <p className="text-theme-secondary leading-relaxed font-medium">{data.flow_summary || data.trigger_description || 'No detailed summary available.'}</p>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between opacity-50">
             <span className="text-[9px] font-black uppercase">Tasks: {data.tasks?.length || 0}</span>
             <span className="text-[9px] font-black uppercase">ROI: {data.total_roi_saved_hours?.toFixed(1)}h</span>
          </div>
        </div>
        <Tooltip.Arrow className="fill-theme-border" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const ActionMenu = ({ data, onSelect, onDelete, onRestore }: { data: any, onSelect: (wf: any) => void, onDelete: (id: number) => void, onRestore: (id: number) => void }) => (
  <Popover.Root>
    <Popover.Trigger asChild>
      <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-theme-muted hover:text-white">
        <MoreHorizontal size={14} />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="w-48 bg-theme-sidebar border border-theme-border rounded-xl shadow-2xl p-1 z-50 animate-apple-in backdrop-blur-xl" sideOffset={5} align="end">
        <div className="space-y-0.5">
          <button onClick={() => onSelect(data)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-theme-secondary hover:text-white transition-all text-[11px] font-bold group">
            <Eye size={14} className="group-hover:text-theme-accent" /> View Logic
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-theme-secondary hover:text-white transition-all text-[11px] font-bold group">
            <Copy size={14} className="group-hover:text-theme-accent" /> Clone Logic
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg text-theme-secondary hover:text-white transition-all text-[11px] font-bold group">
            <GitBranch size={14} className="group-hover:text-theme-accent" /> Fork Version
          </button>
          <div className="h-[1px] bg-white/5 my-1 mx-2" />
          {data.deleted_at ? (
            <button onClick={() => onRestore(data.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-status-success/10 text-status-success hover:text-white hover:bg-status-success rounded-lg transition-all text-[11px] font-bold group">
              <RefreshCw size={14} /> Restore Entry
            </button>
          ) : (
            <button onClick={() => onDelete(data.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-status-error/10 text-status-error hover:text-white hover:bg-status-error rounded-lg transition-all text-[11px] font-bold group">
              <Trash2 size={14} /> Delete Entry
            </button>
          )}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete, onRestore, onCreateNew }) => {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<any>({
    prc: [],
    tool_family: [],
    type: [],
    trigger: [],
    output: [],
    status: []
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [activeRibbon, setActiveRibbon] = useState('Personal Drafts');
  const [density, setDensity] = useState({ fontSize: 13, rowPadding: 2 });
  const [columnWidths, setColumnWidths] = useState<any>({
    workflow: 320,
    prc: 100,
    toolFamily: 140,
    type: 120,
    triggerOutput: 220,
    freq: 80,
    manual: 90,
    auto: 90,
    roi: 100,
    blockers: 80,
    errors: 80,
    status: 160,
    creator: 120,
    editor: 120,
    created: 120,
    ver: 60
  });

  const [viewTab, setViewTab] = useState<'active' | 'deleted'>('active');
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const [isFilterBarOpen, setFilterBarOpen] = useState(false);

  const calculateAnalytics = (wf: any) => {
    const totalManual = wf.tasks?.reduce((acc: number, t: any) => acc + (t.manual_time_minutes || 0) * (t.occurrences_per_cycle || 1), 0) || 0;
    const totalAuto = wf.tasks?.reduce((acc: number, t: any) => acc + (t.automation_time_minutes || 0) * (t.occurrences_per_cycle || 1), 0) || 0;
    const cadenceMult = wf.cadence_unit === 'day' ? 7 : wf.cadence_unit === 'month' ? 0.25 : 1;
    const frequencyPerWeek = (wf.cadence_count || 1) * cadenceMult;
    
    return {
      manualPerCycle: totalManual / 60,
      autoPerCycle: totalAuto / 60,
      manualWeekly: (totalManual / 60) * frequencyPerWeek,
      autoWeekly: (totalAuto / 60) * frequencyPerWeek,
      frequencyPerWeek
    };
  };

  const filteredWorkflows = useMemo(() => {
    let result = workflows.filter(w => {
      const isDeleted = w.deleted_at !== null;
      if (viewTab === 'active' && isDeleted) return false;
      if (viewTab === 'deleted' && !isDeleted) return false;
      
      const matchSearch = w.name.toLowerCase().includes(searchText.toLowerCase()) || 
                         (w.prc && w.prc.toLowerCase().includes(searchText.toLowerCase())) ||
                         w.status.toLowerCase().includes(searchText.toLowerCase());
      
      const matchPrc = filters.prc.length === 0 || filters.prc.includes(w.prc);
      const matchTool = filters.tool_family.length === 0 || filters.tool_family.includes(w.tool_family);
      const matchType = filters.type.length === 0 || filters.type.includes(w.workflow_type);
      const matchStatus = filters.status.length === 0 || filters.status.includes(w.status);
      
      return matchSearch && matchPrc && matchTool && matchType && matchStatus;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [workflows, searchText, filters, sortConfig, viewTab]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const startResizing = (key: string, e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = columnWidths[key];
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidths((prev: any) => ({ ...prev, [key]: Math.max(60, startWidth + delta) }));
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onClearFilters = () => {
    setSearchText('');
    setFilters({ prc: [], tool_family: [], type: [], trigger: [], output: [], status: [] });
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_EXPLANATIONS[status] || { desc: "Status unknown.", color: "slate", badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/30", dotColor: "bg-slate-400" };
    
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap inline-flex items-center gap-1.5 leading-none cursor-help shadow-sm transition-all hover:bg-white/10",
            config.badgeColor
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-pulse", 
              config.dotColor
            )} />
            <span className="whitespace-nowrap">{status}</span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="bg-theme-sidebar border border-theme-border p-3 rounded-xl shadow-2xl z-[100] text-[10px] font-bold text-white max-w-[200px] backdrop-blur-xl animate-apple-in" sideOffset={5}>
            <p className="leading-relaxed opacity-90">{config.desc}</p>
            <Tooltip.Arrow className="fill-theme-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  const CircledNumber = ({ count, colorClass }: { count: number, colorClass: string }) => (
    <div className={cn(
      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border",
      count === 0 ? "opacity-10 border-white text-white" : colorClass
    )}>
      {count}
    </div>
  );

  const ResizableHeader = ({ 
    label, 
    widthKey, 
    sortKey, 
    center = false, 
    sticky = null 
  }: { 
    label: string, 
    widthKey: string, 
    sortKey?: string, 
    center?: boolean, 
    sticky?: 'left' | 'right' | null 
  }) => (
    <th 
      style={{ width: columnWidths[widthKey] }}
      className={cn(
        "p-0 text-[9px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border relative group/th bg-[#1e293b]",
        center && "text-center",
        sticky === 'left' && "sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]",
        sticky === 'right' && "sticky right-[60px] z-20"
      )}
    >
      <div 
        className={cn(
          "w-full h-full px-3 py-2 flex items-center justify-between",
          sortKey && "cursor-pointer hover:text-white transition-colors",
          center && "justify-center"
        )}
        onClick={() => sortKey && handleSort(sortKey)}
      >
        <span className="whitespace-nowrap">{label}</span>
        {sortKey && sortConfig.key === sortKey && (
          <span className="ml-1 text-theme-accent">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent/50 transition-colors z-10"
        onMouseDown={(e) => startResizing(widthKey, e)}
      />
    </th>
  );

  return (
    <Tooltip.Provider>
    <div className="flex flex-col h-full animate-apple-in relative">
      
      {/* Top Action Bar & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-1">
        <div className="flex-1 max-w-lg relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search workflows, PRC, or status..." 
            className="w-full bg-white/[0.03] border border-theme-border focus:border-theme-accent outline-none rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-theme-muted/40 transition-all font-medium text-[13px] backdrop-blur-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="flex items-center gap-2 px-3 h-10 bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-lg text-theme-secondary text-[11px] font-bold uppercase tracking-widest">
                <Maximize2 size={14} /> Density
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="w-64 bg-theme-sidebar border border-theme-border rounded-xl shadow-2xl p-4 z-50 animate-apple-in backdrop-blur-xl" sideOffset={5}>
                 <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black uppercase text-white/40">Table Font Size</label>
                         <span className="text-[10px] font-mono text-theme-accent">{density.fontSize}px</span>
                      </div>
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        {[11, 13, 15].map(s => (
                          <button key={s} onClick={() => setDensity({...density, fontSize: s})} className={cn("flex-1 py-1.5 text-[10px] font-black rounded transition-all", density.fontSize === s ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{s}px</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black uppercase text-white/40">Row Height</label>
                         <span className="text-[10px] font-mono text-theme-accent">{density.rowPadding * 2 + 20}px</span>
                      </div>
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        {[4, 8, 12, 16].map(p => (
                          <button key={p} onClick={() => setDensity({...density, rowPadding: p})} className={cn("flex-1 py-1.5 text-[10px] font-black rounded transition-all", density.rowPadding === p ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>{p === 4 ? 'S' : p === 8 ? 'M' : p === 12 ? 'L' : 'XL'}</button>
                        ))}
                      </div>
                    </div>
                 </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

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

      {/* Workspace Ribbon & View Tabs */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-0 mb-0 px-1">
        <div className="flex items-center gap-0">
          {['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations', 'Status'].map((ribbon) => (
            <button
              key={ribbon}
              onClick={() => ribbon === 'Status' ? setShowStatusHelp(true) : setActiveRibbon(ribbon)}
              className={cn(
                "px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative",
                activeRibbon === ribbon 
                  ? 'text-theme-accent' 
                  : 'text-theme-muted hover:text-theme-secondary'
              )}
            >
              <div className="flex items-center gap-2">
                {ribbon}
                {ribbon === 'Status' && (
                  <div className="w-4 h-4 rounded-full bg-theme-accent/20 flex items-center justify-center group-hover:bg-theme-accent transition-all">
                    <HelpCircle size={10} className="text-theme-accent group-hover:text-white" />
                  </div>
                )}
              </div>
              {activeRibbon === ribbon && (
                <motion.div 
                  layoutId="activeRibbon"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-theme-accent rounded-full shadow-[0_0_10px_var(--color-theme-accent)]" 
                />
              )}
            </button>
          ))}
          
          <div className="w-[1px] h-4 bg-theme-border mx-4" />
          
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button onClick={() => setViewTab('active')} className={cn("px-3 py-1 text-[9px] font-black uppercase rounded transition-all", viewTab === 'active' ? "bg-theme-accent text-white" : "text-white/40 hover:text-white")}>Active</button>
            <button onClick={() => setViewTab('deleted')} className={cn("px-3 py-1 text-[9px] font-black uppercase rounded transition-all", viewTab === 'deleted' ? "bg-status-error text-white" : "text-white/40 hover:text-white")}>Deleted</button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 pr-2">
           <button onClick={() => setShowStatusHelp(true)} className="p-2 bg-theme-accent/10 hover:bg-theme-accent/20 border border-theme-accent/30 rounded-full text-theme-accent transition-all hover:scale-110" title="Automation Status Guide">
             <HelpCircle size={16} />
           </button>
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
                options={['CD', 'INS', 'RV', 'OCD', 'IM', 'THK', 'CON']} 
                selected={filters.prc} 
                onChange={vals => setFilters({...filters, prc: vals})} 
              />
              <MultiSelectFilter 
                label="Tool Family" 
                options={['Hitachi', 'KLA']} 
                selected={filters.tool_family} 
                onChange={vals => setFilters({...filters, tool_family: vals})} 
              />
              <MultiSelectFilter 
                label="Type" 
                options={['Equipment', 'Process', 'All']} 
                selected={filters.type} 
                onChange={vals => setFilters({...filters, type: vals})} 
              />
              <MultiSelectFilter 
                label="Applicable Tools" 
                options={Array.from({length: 10}, (_, i) => `CDSEM_${(i+1).toString().padStart(2, '0')}`)} 
                selected={filters.trigger}
                onChange={vals => setFilters({...filters, trigger: vals})} 
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
          <table className="w-full text-left border-collapse border-spacing-0 min-w-[2100px] table-fixed">
            <thead className="sticky top-0 z-30">
              <tr className="bg-[#1e293b]">
                <th className="p-0 w-10 text-center sticky left-0 bg-[#1e293b] border-r border-b border-theme-border shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-30">
                  <div className="flex items-center justify-center h-full">
                    <button onClick={() => setSelectedIds(selectedIds.size === filteredWorkflows.length ? new Set() : new Set(filteredWorkflows.map(w => w.id)))} className="w-4 h-4 flex items-center justify-center rounded border border-theme-border bg-white/[0.05]">
                      {selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0 ? <CheckCircle2 size={10} className="text-theme-accent" /> : <Circle size={10} className="text-white/10" />}
                    </button>
                  </div>
                </th>
                
                <ResizableHeader label="Workflow" widthKey="workflow" sortKey="name" sticky="left" />
                <ResizableHeader label="PRC" widthKey="prc" sortKey="prc" center />
                <ResizableHeader label="Tool Family" widthKey="toolFamily" sortKey="tool_family" center />
                <ResizableHeader label="Type" widthKey="type" sortKey="workflow_type" center />
                <ResizableHeader label="Trigger → Output" widthKey="triggerOutput" center />
                <ResizableHeader label="Freq" widthKey="freq" sortKey="frequency" center />
                <ResizableHeader label="Manual" widthKey="manual" sortKey="manual_time" center />
                <ResizableHeader label="Auto" widthKey="auto" sortKey="auto_time" center />
                <ResizableHeader label="ROI (h/wk)" widthKey="roi" sortKey="roi" center />
                <ResizableHeader label="Blockers" widthKey="blockers" sortKey="blockers" center />
                <ResizableHeader label="Errors" widthKey="errors" sortKey="errors" center />
                <ResizableHeader label="Status" widthKey="status" sortKey="status" center />
                <ResizableHeader label="Creator" widthKey="creator" sortKey="created_by" center />
                <ResizableHeader label="Editor" widthKey="editor" sortKey="updated_by" center />
                <ResizableHeader label="Created" widthKey="created" sortKey="created_at" center />
                <ResizableHeader label="Ver" widthKey="ver" sortKey="version" center sticky="right" />

                <th className="p-0 w-[60px] bg-[#1e293b] sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.3)] z-30 border-b border-theme-border"></th>
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
                      style={{ height: 'auto' }}
                    >
                      <td className="p-0 text-center sticky left-0 bg-[#0a1120] group-hover:bg-[#151d2e] border-r border-theme-border z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                        <div className="flex items-center justify-center" style={{ padding: `${density.rowPadding}px 0` }}>
                          <button 
                            onClick={() => {
                              const next = new Set(selectedIds);
                              if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                              setSelectedIds(next);
                            }}
                            className={cn(
                              "w-4 h-4 flex items-center justify-center rounded border transition-colors",
                              selectedIds.has(w.id) ? "border-theme-accent bg-theme-accent/20" : "border-theme-border bg-white/[0.02]"
                            )}
                          >
                            {selectedIds.has(w.id) && <CheckCircle2 size={10} className="text-theme-accent" />}
                          </button>
                        </div>
                      </td>

                      <td className="p-0 border-r border-theme-border sticky left-10 bg-[#0a1120] group-hover:bg-[#151d2e] z-10 transition-colors" style={{ padding: `0 12px` }}>
                        <PeekTooltip data={w} />
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                        <span className="font-mono font-black text-blue-400 whitespace-nowrap" style={{ fontSize: `${density.fontSize}px` }}>{w.prc || '--'}</span>
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                        <span className="font-black text-theme-secondary uppercase tracking-wider whitespace-nowrap" style={{ fontSize: `${density.fontSize - 2}px` }}>
                          {familyDisplay || 'Generic'}
                        </span>
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                         <span className="font-black text-white/40 uppercase tracking-widest whitespace-nowrap" style={{ fontSize: `${density.fontSize - 2}px` }}>{w.workflow_type || 'STANDARD'}</span>
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                        <div className="flex items-center justify-center gap-2 text-white/60">
                          <span className="whitespace-nowrap" style={{ fontSize: `${density.fontSize - 2}px` }}>{w.trigger_type}</span>
                          <ArrowRight size={10} className="text-theme-accent shrink-0" />
                          <span className="whitespace-nowrap" style={{ fontSize: `${density.fontSize - 2}px` }}>{w.output_type}</span>
                        </div>
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                         <span className="font-black text-white/80 whitespace-nowrap" style={{ fontSize: `${density.fontSize}px` }}>{analytics.frequencyPerWeek.toFixed(1)}</span>
                      </td>

                      <td className="p-0 text-center border-r border-theme-border" style={{ padding: `0 8px` }}>
                        <span className="font-black text-white/80 whitespace-nowrap" style={{ fontSize: `${density.fontSize}px` }}>{analytics.manualPerCycle.toFixed(1)}h</span>
                      </td>

                      <td className="p-0 text-center border-r border-theme-border" style={{ padding: `0 8px` }}>
                        <span className="font-black text-white/80 whitespace-nowrap" style={{ fontSize: `${density.fontSize}px` }}>{analytics.autoPerCycle.toFixed(1)}h</span>
                      </td>

                      <td className="p-0 text-center border-r border-theme-border" style={{ padding: `0 8px` }}>
                        <span className="font-black text-theme-accent whitespace-nowrap" style={{ fontSize: `${density.fontSize}px` }}>+{analytics.manualWeekly.toFixed(1)}</span>
                      </td>

                      <td className="p-0 border-r border-theme-border" style={{ padding: `0 8px` }}>
                        <div className="flex justify-center">
                          <CircledNumber count={blockerCount} colorClass="bg-red-500/10 border-red-500/30 text-red-400" />
                        </div>
                      </td>

                      <td className="p-0 border-r border-theme-border" style={{ padding: `0 8px` }}>
                        <div className="flex justify-center">
                          <CircledNumber count={errorCount} colorClass="bg-amber-500/10 border-amber-500/30 text-amber-400" />
                        </div>
                      </td>

                      <td className="p-0 border-r border-theme-border text-center" style={{ padding: `0 8px` }}>
                        <div className="flex justify-center items-center w-full">
                          <StatusBadge status={w.status} />
                        </div>
                      </td>

                      <td className="p-0 border-r border-theme-border font-bold text-theme-secondary text-center" style={{ padding: `0 8px`, fontSize: `${density.fontSize - 2}px` }}>
                        <span className="whitespace-nowrap">{w.created_by?.split('_')[0] || 'System'}</span>
                      </td>

                      <td className="p-0 border-r border-theme-border font-bold text-theme-secondary text-center" style={{ padding: `0 8px`, fontSize: `${density.fontSize - 2}px` }}>
                        <span className="whitespace-nowrap">{w.updated_by?.split('_')[0] || 'System'}</span>
                      </td>

                      <td className="p-0 border-r border-theme-border text-theme-muted font-mono text-center" style={{ padding: `0 8px`, fontSize: `${density.fontSize - 2}px` }}>
                        <span className="whitespace-nowrap">{new Date(w.created_at).toLocaleDateString()}</span>
                      </td>

                      <td className="p-0 text-center border-r border-theme-border sticky right-[60px] bg-[#0a1120] group-hover:bg-[#151d2e] z-10 transition-colors" style={{ padding: `0 4px` }}>
                         <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-black text-theme-secondary whitespace-nowrap">
                           V{w.version}
                         </span>
                      </td>

                      <td className="p-0 text-right sticky right-0 bg-[#0a1120] group-hover:bg-[#151d2e] shadow-[-2px_0_5px_rgba(0,0,0,0.3)] z-10 transition-colors">
                        <div className="flex justify-center items-center w-full h-full">
                          <ActionMenu data={w} onSelect={onSelect} onDelete={onDelete} onRestore={onRestore} />
                        </div>
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

      {/* Status Explanation Modal */}
      <AnimatePresence>
        {showStatusHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-theme-sidebar border border-theme-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] backdrop-blur-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-theme-accent/20 rounded-xl text-theme-accent">
                       <HelpCircle size={20} />
                    </div>
                    <div>
                       <h3 className="text-[16px] font-black text-white uppercase tracking-tight">Automation Status Guide</h3>
                       <p className="text-[10px] text-theme-muted font-bold uppercase tracking-widest">Understanding the PathOS Automation Lifecycle</p>
                    </div>
                 </div>
                 <button onClick={() => setShowStatusHelp(false)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                 {Object.entries(STATUS_EXPLANATIONS).map(([status, config]) => (
                   <div key={status} className="flex items-start gap-4 p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group">
                      <div className={cn("w-3 h-3 rounded-full mt-1.5 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]", 
                        config.dotColor
                      )} />
                      <div className="space-y-1">
                         <span className={cn("text-[12px] font-black uppercase tracking-[0.1em]", 
                           config.badgeColor.split(' ').find(c => c.startsWith('text-'))
                         )}>{status}</span>
                         <p className="text-[11px] text-theme-secondary font-medium leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{config.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
              <div className="p-4 bg-white/[0.02] border-t border-white/10">
                 <button onClick={() => setShowStatusHelp(false)} className="w-full py-4 bg-theme-accent text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-theme-accent/20">Acknowledge</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </Tooltip.Provider>
  );
};

export default WorkflowRegistry;
