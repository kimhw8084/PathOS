import React, { useMemo, useState } from 'react';
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
  ShieldAlert,
  CheckCircle2,
  Circle,
  MoreHorizontal,
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
  const [isFilterBarOpen, setFilterBarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  
  // Per-column filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Helper to calculate weekly times
  const calculateWeeklyTimes = (w: any) => {
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

    return {
      manual: (totalManualMinutes * freqMultiplier) / 60, // hours
      auto: (totalAutoMinutes * freqMultiplier) / 60 // hours
    };
  };

  // Filtering Logic
  const filteredWorkflows = useMemo(() => {
    let result = workflows || [];

    // Ribbon Filtering
    if (activeRibbon === 'Personal Drafts') result = result.filter(w => w.status === 'DRAFT' || w.status === 'Created');
    else if (activeRibbon === 'Submitted Requests') result = result.filter(w => w.status !== 'DRAFT' && w.created_by === 'system_user');
    else if (activeRibbon === 'Standard Operations') result = result.filter(w => w.status === 'PROD' || w.status === 'Fully Automated');

    // Column Filtering
    Object.keys(columnFilters).forEach(key => {
      const filterVal = columnFilters[key].toLowerCase();
      if (!filterVal) return;
      
      result = result.filter(w => {
        let val = '';
        if (key === 'name') val = w.name;
        else if (key === 'prc') val = w.prc;
        else if (key === 'tool_family') val = w.tool_family;
        else if (key === 'workflow_type') val = w.workflow_type;
        else if (key === 'status') val = w.status;
        else if (key === 'created_by') val = w.created_by;
        
        return String(val || '').toLowerCase().includes(filterVal);
      });
    });

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
        
        if (sortConfig.key === 'manual_time') {
          aValue = calculateWeeklyTimes(a).manual;
          bValue = calculateWeeklyTimes(b).manual;
        } else if (sortConfig.key === 'auto_time') {
          aValue = calculateWeeklyTimes(a).auto;
          bValue = calculateWeeklyTimes(b).auto;
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
        return aValue < bValue ? -1 * multiplier : 1 * multiplier;
      });
    }

    return result;
  }, [workflows, activeRibbon, searchText, sortConfig, columnFilters]);

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
    setColumnFilters({});
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

      {/* Horizontal Filter Bar (Pops out between ribbon and table) */}
      <AnimatePresence>
        {isFilterBarOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-x border-theme-border bg-white/[0.02]"
          >
            <div className="p-4 flex flex-wrap gap-4 border-b border-theme-border items-end">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Workflow Name</label>
                <input 
                  className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" 
                  value={columnFilters.name || ''} 
                  onChange={e => setColumnFilters({...columnFilters, name: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-24">
                <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">PRC</label>
                <input 
                  className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" 
                  value={columnFilters.prc || ''} 
                  onChange={e => setColumnFilters({...columnFilters, prc: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Tool Family</label>
                <input 
                  className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent" 
                  value={columnFilters.tool_family || ''} 
                  onChange={e => setColumnFilters({...columnFilters, tool_family: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-32">
                <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Status</label>
                <select 
                   className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-theme-accent"
                   value={columnFilters.status || ''}
                   onChange={e => setColumnFilters({...columnFilters, status: e.target.value})}
                >
                  <option value="">All</option>
                  <option value="Created">Created</option>
                  <option value="Fully Automated">Fully Automated</option>
                  <option value="In Automation">In Automation</option>
                </select>
              </div>
              <button 
                onClick={() => setColumnFilters({})}
                className="px-4 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold uppercase text-theme-muted hover:text-white"
              >
                Clear Filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Table Container */}
      <div className="flex-1 overflow-hidden border-x border-b border-theme-border bg-[#0a1120] relative">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[2000px] table-fixed">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#1e293b] border-b border-theme-border">
                <th className="p-2 w-10 text-center sticky left-0 bg-[#1e293b] border-r border-theme-border shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  <button onClick={toggleSelectAll} className="w-5 h-5 flex items-center justify-center rounded border border-theme-border bg-white/[0.05] mx-auto">
                    {selectedIds.size === filteredWorkflows.length && filteredWorkflows.length > 0 ? <CheckCircle2 size={12} className="text-theme-accent" /> : <Circle size={12} className="text-white/10" />}
                  </button>
                </th>
                
                <th className="px-3 py-2.5 w-[300px] text-[10px] font-black text-theme-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors border-r border-theme-border" onClick={() => handleSort('name')}>
                  Workflow {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>

                <th className="px-3 py-2.5 w-[100px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('prc')}>
                  PRC
                </th>

                <th className="px-3 py-2.5 w-[180px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('tool_family')}>
                  Tool Family
                </th>

                <th className="px-3 py-2.5 w-[140px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('workflow_type')}>
                  Type
                </th>

                <th className="px-3 py-2.5 w-[150px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border">
                  Trigger
                </th>

                <th className="px-3 py-2.5 w-[150px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border">
                  Output
                </th>

                <th className="px-3 py-2.5 w-[120px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-right border-r border-theme-border" onClick={() => handleSort('manual_time')}>
                  Manual (W)
                </th>

                <th className="px-3 py-2.5 w-[120px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-right border-r border-theme-border" onClick={() => handleSort('auto_time')}>
                  Auto (W)
                </th>

                <th className="px-3 py-2.5 w-[100px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border" onClick={() => handleSort('blockers')}>
                  Blockers
                </th>

                <th className="px-3 py-2.5 w-[100px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border" onClick={() => handleSort('errors')}>
                  Errors
                </th>

                <th className="px-3 py-2.5 w-[140px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('status')}>
                  Status
                </th>

                <th className="px-3 py-2.5 w-[140px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('created_by')}>
                  Creator
                </th>

                <th className="px-3 py-2.5 w-[140px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('updated_by')}>
                  Last Editor
                </th>

                <th className="px-3 py-2.5 w-[150px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('created_at')}>
                  Created
                </th>

                <th className="px-3 py-2.5 w-[150px] text-[10px] font-black text-theme-muted uppercase tracking-widest border-r border-theme-border" onClick={() => handleSort('updated_at')}>
                  Modified
                </th>

                <th className="px-3 py-2.5 w-[80px] text-[10px] font-black text-theme-muted uppercase tracking-widest text-center border-r border-theme-border">
                  Ver
                </th>

                <th className="px-3 py-2.5 w-[60px] bg-[#1e293b] sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((w) => {
                  const blockerCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
                  const errorCount = w.tasks?.reduce((acc: number, t: any) => acc + (t.errors?.length || 0), 0) || 0;
                  const times = calculateWeeklyTimes(w);
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
                          onClick={() => toggleSelectRow(w.id)}
                          className={cn(
                            "w-5 h-5 flex items-center justify-center rounded border transition-colors mx-auto",
                            selectedIds.has(w.id) ? "border-theme-accent bg-theme-accent/20" : "border-theme-border bg-white/[0.02]"
                          )}
                        >
                          {selectedIds.has(w.id) && <CheckCircle2 size={12} className="text-theme-accent" />}
                        </button>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <PeekTooltip data={w} />
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <span className="text-[11px] font-mono font-black text-blue-400">{w.prc || '--'}</span>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">
                          {familyDisplay || 'Generic'}
                        </span>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{w.workflow_type || 'STANDARD'}</span>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <span className="text-[10px] text-theme-muted truncate block">{w.trigger_type}</span>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <span className="text-[10px] text-theme-muted truncate block">{w.output_type}</span>
                      </td>

                      <td className="px-3 py-2 text-right border-r border-theme-border">
                        <span className="text-[12px] font-black text-theme-accent">{times.manual.toFixed(1)}h</span>
                      </td>

                      <td className="px-3 py-2 text-right border-r border-theme-border">
                        <span className="text-[12px] font-black text-emerald-400">{times.auto.toFixed(1)}h</span>
                      </td>

                      <td className="px-3 py-2 text-center border-r border-theme-border">
                        <span className={cn("text-[10px] font-bold", blockerCount > 0 ? "text-status-error" : "text-white/20")}>{blockerCount}</span>
                      </td>

                      <td className="px-3 py-2 text-center border-r border-theme-border">
                        <span className={cn("text-[10px] font-bold", errorCount > 0 ? "text-status-warning" : "text-white/20")}>{errorCount}</span>
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border">
                        <StatusBadge status={w.status} />
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border text-[10px] font-bold text-theme-secondary">
                        {w.created_by?.split('_')[0] || 'System'}
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border text-[10px] font-bold text-theme-secondary">
                        {w.updated_by?.split('_')[0] || 'System'}
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border text-[10px] text-theme-muted font-mono">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-3 py-2 border-r border-theme-border text-[10px] text-theme-muted font-mono">
                         {new Date(w.updated_at || w.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-3 py-2 text-center border-r border-theme-border">
                         <span className="text-[11px] font-black text-theme-muted">{w.version}</span>
                      </td>

                      <td className="px-3 py-2 text-right sticky right-0 bg-[#0a1120] group-hover:bg-[#151d2e] shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
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
