import React, { useMemo, useState } from 'react';
import { 
  Trash2, 
  Zap, 
  Download, 
  FilterX, 
  Clock, 
  Search, 
  Plus, 
  HelpCircle, 
  Copy, 
  GitBranch, 
  FileText, 
  Eye,
  Filter,
  X,
  User,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  ArrowUpDown,
  LayoutGrid,
  Columns,
  Share2,
  Archive,
  AlertOctagon
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete, onCreateNew }) => {
  // State for Table Features
  const [searchText, setSearchText] = useState('');
  const [activeRibbon, setActiveRibbon] = useState('Collaborative Workflows');
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name', 'tool_family', 'flow', 'roi', 'blockers', 'errors', 'author', 'status', 'version', 'actions'
  ]);

  // Filtering Logic
  const filteredWorkflows = useMemo(() => {
    let result = workflows || [];

    // Ribbon Filtering
    if (activeRibbon === 'Personal Drafts') result = result.filter(w => w.status === 'DRAFT');
    else if (activeRibbon === 'Submitted Requests') result = result.filter(w => w.status !== 'DRAFT' && w.created_by === 'system_user');
    else if (activeRibbon === 'Standard Operations') result = result.filter(w => w.status === 'PROD');

    // Search Filtering
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(w => 
        w.name?.toLowerCase().includes(lowerSearch) ||
        w.tool_family?.toLowerCase().includes(lowerSearch) ||
        w.created_by?.toLowerCase().includes(lowerSearch) ||
        w.status?.toLowerCase().includes(lowerSearch)
      );
    }

    // Sorting
    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Calculated columns sorting
        if (sortConfig.key === 'blockers') {
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
        
        return aValue < bValue ? -1 * multiplier : 1 * multiplier;
      });
    }

    return result;
  }, [workflows, activeRibbon, searchText, sortConfig]);

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWorkflows.map(w => w.id)));
    }
  };

  const toggleSelectRow = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const onClearFilters = () => {
    setSearchText('');
    setSortConfig({ key: 'name', direction: 'asc' });
  };

  // Components
  const StatusBadge = ({ status }: { status: string }) => {
    const isProd = status === 'PROD' || status === 'Fully Automated';
    const isDraft = status === 'DRAFT' || status === 'Created';
    
    return (
      <span className={cn(
        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap inline-block leading-tight",
        isProd ? "bg-status-success/10 text-status-success border-status-success/20" :
        isDraft ? "bg-white/5 text-theme-secondary border-theme-border" :
        "bg-theme-accent/10 text-theme-accent border-theme-accent/20"
      )}>
        {status}
      </span>
    );
  };

  const VersionBadge = ({ version }: { version: string }) => (
    <span className="text-[10px] font-black text-theme-muted uppercase bg-white/5 px-1.5 py-0.5 rounded border border-theme-border whitespace-nowrap">
      {version || 'v1.0'}
    </span>
  );

  const ActionMenu = ({ data }: { data: any }) => (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="w-7 h-7 flex items-center justify-center bg-white/[0.03] hover:bg-theme-accent/20 hover:text-white transition-all rounded border border-theme-border group">
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
    const taskCount = data.tasks?.length || 0;
    const blockerCount = data.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className="flex flex-col cursor-help group/title">
            <span className="font-bold text-white text-[13px] group-hover:text-theme-accent transition-colors truncate max-w-[200px] leading-tight">
              {data.name}
            </span>
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-widest leading-none mt-0.5">
              {data.id_prefix || 'WF'}-{data.id} • {data.trigger_type}
            </span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content 
            className="w-80 bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl p-4 z-50 animate-apple-in backdrop-blur-xl"
            sideOffset={8}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-theme-border pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-theme-accent">Process Analytics</span>
                <span className="text-[10px] font-bold text-theme-muted">{taskCount} Operations</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-theme-border">
                  <span className="text-[9px] text-theme-muted block uppercase mb-1">Blockers</span>
                  <span className={cn(
                    "text-[11px] font-bold flex items-center gap-1.5",
                    blockerCount > 0 ? 'text-status-error' : 'text-status-success'
                  )}>
                    {blockerCount > 0 ? <ShieldAlert size={10} /> : <Zap size={10} />}
                    {blockerCount > 0 ? `${blockerCount} Issues` : 'Optimal'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-theme-border">
                  <span className="text-[9px] text-theme-muted block uppercase mb-1">ROI Impact</span>
                  <span className="text-[11px] font-bold text-theme-accent flex items-center gap-1.5">
                    <Clock size={10} /> +{data.total_roi_saved_hours?.toFixed(1)}h/wk
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-theme-secondary italic line-clamp-2 leading-relaxed">
                {data.description || "No description provided."}
              </div>
            </div>
            <Tooltip.Arrow className="fill-theme-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  return (
    <Tooltip.Provider>
    <div className="space-y-4 animate-apple-in relative pb-16">
      {/* Top Action Bar & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 max-w-lg relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search workflows, tools, or authors..." 
            className="w-full bg-white/[0.03] border border-theme-border focus:border-theme-accent outline-none rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-theme-muted/40 transition-all font-medium text-[13px] backdrop-blur-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterDrawerOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-lg text-theme-secondary group"
            title="Advanced Filters"
          >
            <Filter size={16} className="group-hover:scale-110 transition-transform" />
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

      {/* Workspace Ribbon & Views */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-0">
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
        
        <div className="flex items-center gap-3">
           <button onClick={onClearFilters} className="text-[10px] font-bold text-theme-muted hover:text-white flex items-center gap-1.5 transition-all uppercase tracking-wider">
             <FilterX size={12} /> Clear
           </button>
           <Popover.Root>
             <Popover.Trigger asChild>
                <button className="text-[10px] font-bold text-theme-secondary hover:text-theme-accent flex items-center gap-1.5 transition-all uppercase tracking-wider">
                  <Columns size={12} /> Layout
                </button>
             </Popover.Trigger>
             <Popover.Content className="w-48 bg-theme-sidebar border border-theme-border rounded-lg p-2 shadow-2xl z-50 animate-apple-in">
                <div className="text-[10px] font-bold text-theme-muted uppercase mb-2 px-1">Columns</div>
                <div className="space-y-1">
                  {[
                    { id: 'name', label: 'Workflow' },
                    { id: 'tool_family', label: 'Tool Group' },
                    { id: 'flow', label: 'Execution' },
                    { id: 'roi', label: 'ROI' },
                    { id: 'blockers', label: 'Blockers' },
                    { id: 'errors', label: 'Errors' },
                    { id: 'author', label: 'Author' },
                    { id: 'status', label: 'Status' },
                    { id: 'version', label: 'Version' },
                  ].map(col => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-md cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.includes(col.id)}
                        onChange={(e) => {
                          if (e.target.checked) setVisibleColumns([...visibleColumns, col.id]);
                          else setVisibleColumns(visibleColumns.filter(c => c !== col.id));
                        }}
                        className="w-3.5 h-3.5 rounded border-theme-border bg-transparent accent-theme-accent"
                      />
                      <span className="text-[11px] font-medium text-theme-secondary">{col.label}</span>
                    </label>
                  ))}
                </div>
             </Popover.Content>
           </Popover.Root>
        </div>
      </div>
      
      {/* Table Container */}
      <div className="relative overflow-hidden rounded-xl border border-theme-border bg-theme-sidebar/40 backdrop-blur-md shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white/[0.03] border-b border-theme-border">
                <th className="p-2 w-10 text-center">
                  <button 
                    onClick={toggleSelectAll}
                    className="w-5 h-5 flex items-center justify-center rounded border border-theme-border bg-white/[0.05] hover:border-theme-accent transition-colors mx-auto"
                  >
                    {selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0 ? (
                      <CheckCircle2 size={12} className="text-theme-accent" />
                    ) : selectedIds.size > 0 ? (
                      <div className="w-2 h-0.5 bg-theme-accent rounded-full" />
                    ) : (
                      <Circle size={12} className="text-white/10" />
                    )}
                  </button>
                </th>
                
                {visibleColumns.includes('name') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      Workflow {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('tool_family') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('tool_family')}>
                    <div className="flex items-center gap-1.5">
                      Tool Group {sortConfig.key === 'tool_family' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('flow') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest">
                    Execution Summary
                  </th>
                )}

                {visibleColumns.includes('roi') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('total_roi_saved_hours')}>
                    <div className="flex items-center justify-end gap-1.5">
                      ROI {sortConfig.key === 'total_roi_saved_hours' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('blockers') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('blockers')}>
                    <div className="flex items-center justify-center gap-1.5">
                      Blockers {sortConfig.key === 'blockers' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('errors') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('errors')}>
                    <div className="flex items-center justify-center gap-1.5">
                      Errors {sortConfig.key === 'errors' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('author') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('created_by')}>
                    <div className="flex items-center gap-1.5">
                      Author {sortConfig.key === 'created_by' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('status') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1.5">
                      Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('version') && (
                  <th className="px-3 py-2.5 text-[10px] font-black text-theme-muted uppercase tracking-widest text-center">
                    Ver
                  </th>
                )}

                <th className="px-3 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((w) => {
                  const blockerCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
                  const errorCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;

                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={w.id}
                      className={cn(
                        "group hover:bg-white/[0.03] transition-all cursor-default",
                        selectedIds.has(w.id) ? "bg-theme-accent/5" : ""
                      )}
                    >
                      <td className="p-2 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSelectRow(w.id); }}
                          className={cn(
                            "w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto",
                            selectedIds.has(w.id) ? "border-theme-accent bg-theme-accent/20" : "border-theme-border bg-white/[0.02] hover:border-theme-muted"
                          )}
                        >
                          {selectedIds.has(w.id) && <CheckCircle2 size={12} className="text-theme-accent" />}
                        </button>
                      </td>

                      {visibleColumns.includes('name') && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border transition-all shrink-0",
                              "bg-theme-accent/10 border-theme-accent/20 text-theme-accent group-hover:border-theme-accent/40"
                            )}>
                              <Zap size={14} />
                            </div>
                            <PeekTooltip data={w} />
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('tool_family') && (
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-bold text-theme-secondary bg-white/5 border border-theme-border px-2 py-0.5 rounded uppercase tracking-wider">
                            {w.tool_family || 'Generic'}
                          </span>
                        </td>
                      )}

                      {visibleColumns.includes('flow') && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 text-[10px] font-medium text-theme-muted">
                            <span className="text-theme-secondary truncate max-w-[80px]">{w.trigger_type}</span>
                            <span className="text-theme-accent/40">→</span>
                            {w.tasks?.some((t: any) => t.interface_type === 'DECISION') && (
                              <div className="flex items-center gap-1 text-blue-400 font-bold bg-blue-400/10 px-1 py-0.5 rounded border border-blue-400/20">
                                <GitBranch size={8} />
                                <span className="text-[8px] uppercase">IF/THEN</span>
                              </div>
                            )}
                            <span className="truncate max-w-[80px]">{w.output_type}</span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('roi') && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[12px] font-black text-theme-accent tracking-tighter">
                              +{w.total_roi_saved_hours?.toFixed(1)}h
                            </span>
                            <span className="text-[8px] text-theme-muted font-bold uppercase tracking-widest leading-none">Weekly</span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('blockers') && (
                        <td className="px-3 py-2 text-center">
                          <div className={cn(
                            "inline-flex items-center gap-1 font-bold text-[10px]",
                            blockerCount > 0 ? "text-status-error" : "text-status-success/60"
                          )}>
                            {blockerCount > 0 ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}
                            {blockerCount}
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('errors') && (
                        <td className="px-3 py-2 text-center">
                          <div className={cn(
                            "inline-flex items-center gap-1 font-bold text-[10px]",
                            errorCount > 0 ? "text-status-warning" : "text-status-success/60"
                          )}>
                            {errorCount > 0 ? <AlertOctagon size={12} /> : <CheckCircle2 size={12} />}
                            {errorCount}
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('author') && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-white/5 border border-theme-border flex items-center justify-center">
                              <User size={10} className="text-theme-muted" />
                            </div>
                            <span className="text-[10px] font-bold text-theme-secondary">{w.created_by?.split('_')[0] || 'System'}</span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.includes('status') && (
                        <td className="px-3 py-2">
                          <StatusBadge status={w.status} />
                        </td>
                      )}

                      {visibleColumns.includes('version') && (
                        <td className="px-3 py-2 text-center">
                          <VersionBadge version={w.version} />
                        </td>
                      )}

                      <td className="px-3 py-2 text-right">
                        <ActionMenu data={w} />
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-theme-muted/20">
                        <FilterX size={32} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[14px]">No records found</p>
                        <p className="text-theme-muted text-[11px] mt-1">Try adjusting your filters or search terms.</p>
                      </div>
                      <button onClick={onClearFilters} className="btn-apple-secondary mt-2">Reset View</button>
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

      {/* Advanced Filter Drawer */}
      {isFilterDrawerOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" 
            onClick={() => setFilterDrawerOpen(false)} 
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="fixed top-0 right-0 h-full w-80 bg-theme-sidebar border-l border-theme-border shadow-2xl z-[70] p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-theme-accent/20 flex items-center justify-center text-theme-accent">
                  <Filter size={20} />
                </div>
                <h3 className="text-[16px] font-black text-white uppercase tracking-tighter">Refine Selection</h3>
              </div>
              <button onClick={() => setFilterDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] text-theme-muted font-black uppercase tracking-widest block">Hardware Cluster</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CD-SEM', 'Overlay', 'Defect', 'Thin Film'].map(tag => (
                    <button key={tag} className="px-3 py-3 rounded-lg border border-theme-border bg-white/[0.02] text-[11px] font-bold text-theme-secondary hover:border-theme-accent hover:text-white transition-all text-left">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] text-theme-muted font-black uppercase tracking-widest block">Operational Status</label>
                <div className="space-y-2">
                  {['Under Review', 'Verified', 'Production Ready', 'Standard Operation'].map(s => (
                    <label key={s} className="flex items-center justify-between p-4 rounded-lg border border-theme-border bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                      <span className="text-[11px] font-bold text-theme-secondary">{s}</span>
                      <input type="checkbox" className="w-4 h-4 rounded border-theme-border bg-transparent accent-theme-accent" />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-theme-border grid grid-cols-2 gap-4">
              <button className="btn-apple-secondary w-full py-3" onClick={() => setFilterDrawerOpen(false)}>Reset</button>
              <button className="btn-apple-primary w-full py-3" onClick={() => setFilterDrawerOpen(false)}>Apply</button>
            </div>
          </motion.div>
        </>
      )}

      {/* Help Overlay */}
      {isHelpOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80]" 
            onClick={() => setHelpOpen(false)} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] bg-theme-sidebar border border-white/10 rounded-[30px] shadow-2xl z-[90] p-10"
          >
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-[24px] bg-theme-accent/20 flex items-center justify-center text-theme-accent">
                <HelpCircle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[24px] font-black text-white tracking-tight">System Intelligence</h3>
                <p className="text-theme-muted text-[13px] leading-relaxed max-w-sm">
                  The Workflow Repository is the centralized control system for all semiconductor process automation. 
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full mt-4">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-theme-border text-left">
                  <Zap size={18} className="text-theme-accent mb-3" />
                  <h4 className="text-[12px] font-black text-white uppercase tracking-widest mb-1">Performance</h4>
                  <p className="text-[10px] text-theme-muted">Operational efficiency and ROI impact.</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-theme-border text-left">
                  <LayoutGrid size={18} className="text-theme-accent mb-3" />
                  <h4 className="text-[12px] font-black text-white uppercase tracking-widest mb-1">Standard</h4>
                  <p className="text-[10px] text-theme-muted">Manufacturing process standards.</p>
                </div>
              </div>

              <button className="btn-apple-primary w-full mt-6 py-4 text-[13px]" onClick={() => setHelpOpen(false)}>
                Confirm & Resume
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
    </Tooltip.Provider>
  );
};

export default WorkflowRegistry;
