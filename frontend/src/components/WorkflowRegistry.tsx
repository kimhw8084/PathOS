import React, { useMemo, useState } from 'react';
import { 
  Trash2, 
  Zap, 
  AlertTriangle, 
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
  Archive
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
    'status', 'name', 'tool_family', 'flow', 'roi', 'health', 'author', 'actions'
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
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
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
  const StatusBadge = ({ status, version }: { status: string, version: string }) => {
    const isProd = status === 'PROD' || status === 'Fully Automated';
    const isDraft = status === 'DRAFT' || status === 'Created';
    
    return (
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border",
          isProd ? "bg-status-success/10 text-status-success border-status-success/20" :
          isDraft ? "bg-white/5 text-theme-secondary border-theme-border" :
          "bg-theme-accent/10 text-theme-accent border-theme-accent/20"
        )}>
          {status}
        </span>
        <span className="text-[11px] font-black text-theme-muted uppercase bg-white/5 px-1.5 py-0.5 rounded border border-theme-border">
          {version || 'v1.0'}
        </span>
      </div>
    );
  };

  const ActionMenu = ({ data }: { data: any }) => (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="w-9 h-9 flex items-center justify-center bg-white/[0.03] hover:bg-theme-accent/20 hover:text-white transition-all rounded-lg border border-theme-border group">
          <MoreHorizontal size={16} className="text-theme-muted group-hover:text-white" />
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
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-theme-secondary hover:bg-white/[0.08] hover:text-white transition-all text-[12px] font-semibold"
              >
                <item.icon size={14} /> {item.label}
              </button>
            ))}
            <div className="h-[1px] bg-theme-border my-1 mx-1" />
            <button 
              onClick={() => onDelete(data.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-status-error hover:bg-status-error/10 transition-all text-[12px] font-semibold"
            >
              <Trash2 size={14} /> Delete Record
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
            <span className="font-bold text-white text-[14px] group-hover:text-theme-accent transition-colors truncate max-w-[240px]">
              {data.name}
            </span>
            <span className="text-[11px] text-theme-muted font-mono uppercase tracking-widest">
              {data.id_prefix || 'WF'}-{data.id} • {data.trigger_type}
            </span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content 
            className="w-80 bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl p-5 z-50 animate-apple-in backdrop-blur-xl"
            sideOffset={8}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-theme-border pb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-theme-accent">Process Analytics</span>
                <span className="text-[11px] font-bold text-theme-muted">{taskCount} Operations</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-theme-border">
                  <span className="text-[10px] text-theme-muted block uppercase mb-1">Health Status</span>
                  <span className={cn(
                    "text-[12px] font-bold flex items-center gap-1.5",
                    blockerCount > 0 ? 'text-status-error' : 'text-status-success'
                  )}>
                    {blockerCount > 0 ? <ShieldAlert size={12} /> : <Zap size={12} />}
                    {blockerCount > 0 ? `${blockerCount} Issues` : 'Optimal'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-theme-border">
                  <span className="text-[10px] text-theme-muted block uppercase mb-1">ROI Impact</span>
                  <span className="text-[12px] font-bold text-theme-accent flex items-center gap-1.5">
                    <Clock size={12} /> +{data.total_roi_saved_hours?.toFixed(1)}h/wk
                  </span>
                </div>
              </div>
              <div className="text-[12px] text-theme-secondary italic line-clamp-2 leading-relaxed">
                {data.description || "No description provided for this process sequence."}
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
    <div className="space-y-6 animate-apple-in relative pb-20">
      {/* Top Action Bar & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-xl relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search workflows, tools, or authors..." 
            className="w-full bg-white/[0.03] border border-theme-border focus:border-theme-accent outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-theme-muted/40 transition-all font-medium text-[14px] backdrop-blur-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setFilterDrawerOpen(true)}
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-xl text-theme-secondary group"
            title="Advanced Filters"
          >
            <Filter size={18} className="group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => setHelpOpen(true)}
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-xl text-theme-secondary"
          >
            <HelpCircle size={18} />
          </button>
          <div className="w-[1px] h-8 bg-theme-border mx-1" />
          <button 
            onClick={onCreateNew}
            className="btn-apple-primary h-12 !px-8 flex items-center gap-2"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="text-[13px]">Create New</span>
          </button>
        </div>
      </div>

      {/* Workspace Ribbon & Views */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-0.5">
        <div className="flex items-center gap-0.5">
          {['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'].map((ribbon) => (
            <button
              key={ribbon}
              onClick={() => setActiveRibbon(ribbon)}
              className={cn(
                "px-6 py-4 text-[11px] font-bold uppercase tracking-widest transition-all relative",
                activeRibbon === ribbon 
                  ? 'text-theme-accent' 
                  : 'text-theme-muted hover:text-theme-secondary'
              )}
            >
              {ribbon}
              {activeRibbon === ribbon && (
                <motion.div 
                  layoutId="activeRibbon"
                  className="absolute bottom-0 left-4 right-4 h-0.5 bg-theme-accent rounded-full shadow-[0_0_10px_var(--color-theme-accent)]" 
                />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4">
           <button onClick={onClearFilters} className="text-[11px] font-bold text-theme-muted hover:text-white flex items-center gap-1.5 transition-all uppercase tracking-wider">
             <FilterX size={14} /> Clear
           </button>
           <Popover.Root>
             <Popover.Trigger asChild>
                <button className="text-[11px] font-bold text-theme-secondary hover:text-theme-accent flex items-center gap-1.5 transition-all uppercase tracking-wider">
                  <Columns size={14} /> Layout
                </button>
             </Popover.Trigger>
             <Popover.Content className="w-56 bg-theme-sidebar border border-theme-border rounded-xl p-3 shadow-2xl z-50 animate-apple-in">
                <div className="text-[11px] font-bold text-theme-muted uppercase mb-3 px-2">Visible Columns</div>
                <div className="space-y-1.5">
                  {[
                    { id: 'status', label: 'Status' },
                    { id: 'name', label: 'Workflow' },
                    { id: 'tool_family', label: 'Tool Family' },
                    { id: 'flow', label: 'Flow Info' },
                    { id: 'roi', label: 'ROI' },
                    { id: 'health', label: 'Health' },
                    { id: 'author', label: 'Author' },
                  ].map(col => (
                    <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.includes(col.id)}
                        onChange={(e) => {
                          if (e.target.checked) setVisibleColumns([...visibleColumns, col.id]);
                          else setVisibleColumns(visibleColumns.filter(c => c !== col.id));
                        }}
                        className="w-4 h-4 rounded border-theme-border bg-transparent accent-theme-accent"
                      />
                      <span className="text-[13px] font-medium text-theme-secondary">{col.label}</span>
                    </label>
                  ))}
                </div>
             </Popover.Content>
           </Popover.Root>
        </div>
      </div>
      
      {/* Table Container */}
      <div className="relative overflow-hidden rounded-2xl border border-theme-border bg-theme-sidebar/40 backdrop-blur-md shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-white/[0.03] border-b border-theme-border">
                <th className="p-5 w-14 text-center">
                  <button 
                    onClick={toggleSelectAll}
                    className="w-6 h-6 flex items-center justify-center rounded border border-theme-border bg-white/[0.05] hover:border-theme-accent transition-colors mx-auto"
                  >
                    {selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0 ? (
                      <CheckCircle2 size={16} className="text-theme-accent" />
                    ) : selectedIds.size > 0 ? (
                      <div className="w-3 h-0.5 bg-theme-accent rounded-full" />
                    ) : (
                      <Circle size={16} className="text-white/10" />
                    )}
                  </button>
                </th>
                
                {visibleColumns.includes('status') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('name') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">
                      Workflow {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('tool_family') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('tool_family')}>
                    <div className="flex items-center gap-2">
                      Tool Group {sortConfig.key === 'tool_family' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('flow') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest">
                    Execution Summary
                  </th>
                )}

                {visibleColumns.includes('roi') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('total_roi_saved_hours')}>
                    <div className="flex items-center justify-end gap-2">
                      ROI {sortConfig.key === 'total_roi_saved_hours' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}

                {visibleColumns.includes('health') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest">
                    Integrity
                  </th>
                )}

                {visibleColumns.includes('author') && (
                  <th className="px-5 py-4 text-[11px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('created_by')}>
                    <div className="flex items-center gap-2">
                      Author {sortConfig.key === 'created_by' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={12} className="opacity-30" />}
                    </div>
                  </th>
                )}

                <th className="px-5 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((w) => (
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
                    <td className="p-5 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleSelectRow(w.id); }}
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded border transition-colors mx-auto",
                          selectedIds.has(w.id) ? "border-theme-accent bg-theme-accent/20" : "border-theme-border bg-white/[0.02] hover:border-theme-muted"
                        )}
                      >
                        {selectedIds.has(w.id) && <CheckCircle2 size={16} className="text-theme-accent" />}
                      </button>
                    </td>

                    {visibleColumns.includes('status') && (
                      <td className="px-5 py-3.5">
                        <StatusBadge status={w.status} version={w.version} />
                      </td>
                    )}

                    {visibleColumns.includes('name') && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center border transition-all shrink-0",
                            "bg-theme-accent/10 border-theme-accent/20 text-theme-accent group-hover:border-theme-accent/40"
                          )}>
                            <Zap size={18} />
                          </div>
                          <PeekTooltip data={w} />
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('tool_family') && (
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-bold text-theme-secondary bg-white/5 border border-theme-border px-3 py-1 rounded-md uppercase tracking-wider">
                          {w.tool_family || 'Generic'}
                        </span>
                      </td>
                    )}

                    {visibleColumns.includes('flow') && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 text-[11px] font-medium text-theme-muted">
                          <span className="text-theme-secondary">{w.trigger_type}</span>
                          <span className="text-theme-accent/40">→</span>
                          {w.tasks?.some((t: any) => t.interface_type === 'DECISION') && (
                            <div className="flex items-center gap-1 text-blue-400 font-bold bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                              <GitBranch size={10} />
                              <span className="text-[9px] uppercase">IF/THEN</span>
                            </div>
                          )}
                          <span>{w.output_type}</span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('roi') && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[14px] font-black text-theme-accent tracking-tighter">
                            +{w.total_roi_saved_hours?.toFixed(1)}h
                          </span>
                          <span className="text-[10px] text-theme-muted font-bold uppercase tracking-widest leading-none">Weekly</span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('health') && (
                      <td className="px-5 py-3.5">
                        {w.tasks?.some((t: any) => t.blockers?.length > 0) ? (
                          <div className="flex items-center gap-2 text-status-error">
                            <ShieldAlert size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-tight">Issues</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-status-success/80">
                            <CheckCircle2 size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-tight">Stable</span>
                          </div>
                        )}
                      </td>
                    )}

                    {visibleColumns.includes('author') && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-white/5 border border-theme-border flex items-center justify-center">
                            <User size={12} className="text-theme-muted" />
                          </div>
                          <span className="text-[11px] font-bold text-theme-secondary">{w.created_by?.split('_')[0] || 'System'}</span>
                        </div>
                      </td>
                    )}

                    <td className="px-5 py-3.5 text-right">
                      <ActionMenu data={w} />
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-theme-muted/20">
                        <FilterX size={40} />
                      </div>
                      <div>
                        <p className="text-white font-bold text-[16px]">No records found</p>
                        <p className="text-theme-muted text-[13px] mt-1">Try adjusting your filters or search terms.</p>
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-theme-sidebar/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 flex items-center gap-8 z-50 min-w-[600px]"
          >
            <div className="flex items-center gap-4 px-6 border-r border-white/10">
              <div className="w-10 h-10 rounded-xl bg-theme-accent flex items-center justify-center text-white font-black text-[14px]">
                {selectedIds.size}
              </div>
              <span className="text-[12px] font-bold text-white uppercase tracking-widest">Selected Items</span>
            </div>

            <div className="flex items-center gap-4 flex-1">
              <button className="flex-1 flex items-center justify-center gap-3 py-3 rounded-xl hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[12px] font-bold uppercase tracking-wider">
                <Archive size={16} /> Archive
              </button>
              <button className="flex-1 flex items-center justify-center gap-3 py-3 rounded-xl hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[12px] font-bold uppercase tracking-wider">
                <Download size={16} /> Export Data
              </button>
              <button className="flex-1 flex items-center justify-center gap-3 py-3 rounded-xl hover:bg-white/5 text-theme-secondary hover:text-white transition-all text-[12px] font-bold uppercase tracking-wider">
                <Share2 size={16} /> Share
              </button>
            </div>

            <button 
              onClick={() => setSelectedIds(new Set())}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all text-theme-muted hover:text-white"
            >
              <X size={20} />
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
            className="fixed top-0 right-0 h-full w-96 bg-theme-sidebar border-l border-theme-border shadow-2xl z-[70] p-10 flex flex-col"
          >
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-theme-accent/20 flex items-center justify-center text-theme-accent">
                  <Filter size={24} />
                </div>
                <h3 className="text-[18px] font-black text-white uppercase tracking-tighter">Refine Selection</h3>
              </div>
              <button onClick={() => setFilterDrawerOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 space-y-12 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-6">
                <label className="text-[11px] text-theme-muted font-black uppercase tracking-widest block">Hardware Cluster</label>
                <div className="grid grid-cols-2 gap-3">
                  {['CD-SEM', 'Overlay', 'Defect', 'Thin Film'].map(tag => (
                    <button key={tag} className="px-5 py-4 rounded-xl border border-theme-border bg-white/[0.02] text-[12px] font-bold text-theme-secondary hover:border-theme-accent hover:text-white transition-all text-left">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[11px] text-theme-muted font-black uppercase tracking-widest block">Operational Status</label>
                <div className="space-y-3">
                  {['Under Review', 'Verified', 'Production Ready', 'Standard Operation'].map(s => (
                    <label key={s} className="flex items-center justify-between p-5 rounded-xl border border-theme-border bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                      <span className="text-[13px] font-bold text-theme-secondary">{s}</span>
                      <input type="checkbox" className="w-5 h-5 rounded border-theme-border bg-transparent accent-theme-accent" />
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-status-error/5 border border-status-error/20 space-y-4">
                <div className="flex items-center gap-3 text-status-error">
                  <AlertTriangle size={20} />
                  <span className="text-[12px] font-black uppercase tracking-wider">Critical Priority</span>
                </div>
                <p className="text-[11px] text-theme-secondary/80 leading-relaxed">Filter workflows that are currently flagged with high yield risk or critical path blockers.</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[12px] font-bold text-white">Enable Risk Filter</span>
                  <div className="w-12 h-6 bg-white/10 rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white/20 rounded-full" />
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-10 border-t border-theme-border grid grid-cols-2 gap-5">
              <button className="btn-apple-secondary w-full py-4" onClick={() => setFilterDrawerOpen(false)}>Reset</button>
              <button className="btn-apple-primary w-full py-4" onClick={() => setFilterDrawerOpen(false)}>Apply</button>
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] bg-theme-sidebar border border-white/10 rounded-[40px] shadow-2xl z-[90] p-12"
          >
            <div className="flex flex-col items-center text-center gap-8">
              <div className="w-24 h-24 rounded-[32px] bg-theme-accent/20 flex items-center justify-center text-theme-accent">
                <HelpCircle size={48} />
              </div>
              <div className="space-y-3">
                <h3 className="text-[28px] font-black text-white tracking-tight">System Intelligence</h3>
                <p className="text-theme-muted text-[15px] leading-relaxed max-w-md">
                  The Workflow Repository is the centralized control system for all semiconductor process automation. 
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-5 w-full mt-6">
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-theme-border text-left">
                  <Zap size={22} className="text-theme-accent mb-4" />
                  <h4 className="text-[14px] font-black text-white uppercase tracking-widest mb-2">Performance Tracking</h4>
                  <p className="text-[12px] text-theme-muted">Real-time monitoring of operational efficiency and ROI impact.</p>
                </div>
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-theme-border text-left">
                  <LayoutGrid size={22} className="text-theme-accent mb-4" />
                  <h4 className="text-[14px] font-black text-white uppercase tracking-widest mb-2">Standardization</h4>
                  <p className="text-[12px] text-theme-muted">Ensure all process sequences adhere to global manufacturing standards.</p>
                </div>
              </div>

              <button className="btn-apple-primary w-full mt-8 py-5 text-[14px]" onClick={() => setHelpOpen(false)}>
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
