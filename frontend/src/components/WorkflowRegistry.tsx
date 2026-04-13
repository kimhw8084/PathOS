import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import React, { useMemo, useCallback, useRef, useState } from 'react';
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
  MoreVertical, 
  Copy, 
  GitBranch, 
  FileText, 
  Eye,
  Filter,
  X,
  User,
  ShieldAlert
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
  onCreateNew?: () => void;
}

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete, onCreateNew }) => {
  const gridRef = useRef<AgGridReact>(null);
  const [searchText, setSearchText] = useState('');
  const [activeRibbon, setActiveRibbon] = useState('Team Workflows');
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.autoSizeAllColumns();
  }, []);

  const onFirstDataRendered = useCallback((params: any) => {
    params.api.autoSizeAllColumns();
  }, []);

  const onExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv();
  }, []);

  const onClearFilters = useCallback(() => {
    gridRef.current?.api.setFilterModel(null);
    setSearchText('');
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    gridRef.current?.api.setGridOption('quickFilterText', e.target.value);
  };

  const filteredWorkflows = useMemo(() => {
    // In a real app, these would be filtered by current user and status
    if (activeRibbon === 'My Drafts') return workflows.filter(w => w.status === 'Created');
    if (activeRibbon === 'My Submitted') return workflows.filter(w => w.status !== 'Created' && w.created_by === 'system_user');
    if (activeRibbon === 'Global Master') return workflows.filter(w => w.status === 'Fully Automated');
    return workflows; // Team Workflows (All)
  }, [workflows, activeRibbon]);

  const ActionMenu = ({ data }: { data: any }) => (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="w-9 h-9 flex items-center justify-center bg-white/[0.05] hover:bg-theme-accent/20 hover:text-white transition-all rounded-xl border border-theme-border">
          <MoreVertical size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content 
          className="w-56 bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl p-2 z-50 animate-apple-in"
          sideOffset={5}
          align="end"
        >
          <div className="space-y-1">
            <button onClick={() => onSelect(data)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-secondary hover:bg-white/[0.06] hover:text-white transition-all text-[12px] font-semibold">
              <Eye size={14} /> View Details
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-secondary hover:bg-white/[0.06] hover:text-white transition-all text-[12px] font-semibold">
              <Copy size={14} /> Clone to Draft
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-secondary hover:bg-white/[0.06] hover:text-white transition-all text-[12px] font-semibold">
              <GitBranch size={14} /> Create New Version
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-theme-secondary hover:bg-white/[0.06] hover:text-white transition-all text-[12px] font-semibold">
              <FileText size={14} /> Export SOP (PDF)
            </button>
            <div className="h-[1px] bg-theme-border my-1 mx-2" />
            <button onClick={() => onDelete(data.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-status-error hover:bg-status-error/10 transition-all text-[12px] font-semibold">
              <Trash2 size={14} /> Archive Record
            </button>
          </div>
          <Popover.Arrow className="fill-theme-border" />
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
            <div className="flex flex-col justify-center cursor-help">
              <span className="font-bold text-white text-[13px] tracking-tight hover:text-theme-accent transition-colors leading-tight">
                {data.name}
              </span>
              <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider mt-0.5">
                {data.version || 'v1.0.0'} • {data.trigger_type?.replace('_', ' ')}
              </span>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content 
              className="w-80 bg-theme-sidebar border border-theme-border rounded-2xl shadow-2xl p-4 z-50 animate-apple-in backdrop-blur-xl"
              sideOffset={5}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-theme-border pb-3">
                  <span className="text-[11px] font-black uppercase tracking-widest text-theme-accent">DAG Preview</span>
                  <span className="text-[10px] font-bold text-theme-muted">{taskCount} Steps</span>
                </div>
                
                <div className="h-32 bg-black/40 rounded-xl border border-theme-border flex items-center justify-center overflow-hidden relative group">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--color-theme-accent)_0%,_transparent_70%)]" />
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-status-success/20 border border-status-success/30" />
                    <div className="w-12 h-8 rounded-lg bg-theme-accent/20 border border-theme-accent/30" />
                    <div className="w-12 h-8 rounded-lg bg-theme-accent/20 border border-theme-accent/30" />
                    <div className="w-8 h-8 rounded-full bg-status-info/20 border border-status-info/30" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-white">Open Architect for Full DAG</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-theme-border">
                    <span className="text-[9px] text-theme-muted block uppercase mb-1">Health</span>
                    <span className={`text-[11px] font-bold flex items-center gap-1.5 ${blockerCount > 0 ? 'text-status-error' : 'text-status-success'}`}>
                      {blockerCount > 0 ? <ShieldAlert size={10} /> : <Zap size={10} />}
                      {blockerCount > 0 ? `${blockerCount} Blockers` : 'Healthy'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-theme-border">
                    <span className="text-[9px] text-theme-muted block uppercase mb-1">ROI</span>
                    <span className="text-[11px] font-bold text-theme-accent flex items-center gap-1.5">
                      <Clock size={10} /> +{data.total_roi_saved_hours?.toFixed(1)}h/wk
                    </span>
                  </div>
                </div>
              </div>
              <Tooltip.Arrow className="fill-theme-border" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
    );
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: '',
      width: 50,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left',
      lockPosition: true,
      suppressMovable: true,
      filter: false,
      sortable: false,
    },
    { 
      headerName: 'Status & Version',
      field: 'status',
      minWidth: 160,
      cellRenderer: (p: any) => {
        const status = p.data.status;
        const version = p.data.version || 'v1';
        const isAuto = status?.includes('Automated') || status === 'Fully Automated';
        const isInProgress = status?.includes('In Automation') || status?.includes('Verification');
        
        return (
          <div className="flex items-center gap-2 h-full">
            <span className={`status-badge flex items-center gap-1.5 border ${
              isAuto ? 'bg-status-success/10 text-status-success border-status-success/20' : 
              isInProgress ? 'bg-theme-accent/10 text-theme-accent border-theme-accent/20' : 
              'bg-white/5 text-theme-secondary border-theme-border'
            }`}>
              {status}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-theme-border text-[9px] font-black text-theme-muted uppercase">
              {version}
            </span>
          </div>
        );
      }
    },
    { 
      field: 'name', 
      headerName: 'Workflow Title', 
      minWidth: 300,
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-4 h-full group">
          <div className="w-10 h-10 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center group-hover:bg-theme-accent/20 group-hover:border-theme-accent/40 transition-all">
            <Zap size={16} className="text-theme-accent" />
          </div>
          <PeekTooltip data={p.data} />
        </div>
      )
    },
    { 
      field: 'tool_family', 
      headerName: 'Tool Family', 
      minWidth: 140,
      cellRenderer: (p: any) => (
        <div className="flex items-center h-full">
          <span className="text-[10px] font-black bg-white/[0.05] border border-theme-border px-3 py-1 rounded-lg text-theme-secondary uppercase tracking-widest">
            {p.value || 'General'}
          </span>
        </div>
      )
    },
    { 
      headerName: 'Flow Summary',
      minWidth: 240,
      flex: 1,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full text-theme-secondary text-[11px] font-medium truncate italic">
          <span className="text-theme-muted font-bold not-italic">{p.data.trigger_type}</span>
          <span className="text-theme-accent opacity-50">→</span>
          <span>{p.data.output_type}</span>
        </div>
      )
    },
    { 
      headerName: 'ROI & Yield Risk', 
      field: 'total_roi_saved_hours',
      minWidth: 150,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-3 justify-end h-full">
          {p.data.yield_risk && (
            <div className="w-8 h-8 rounded-lg bg-status-error/10 flex items-center justify-center text-status-error animate-pulse border border-status-error/20" title="Yield Risk Flagged">
              <AlertTriangle size={14} />
            </div>
          )}
          <div className="text-right">
            <span className="font-black text-theme-accent text-[14px] tracking-tighter">
              +{p.data.total_roi_saved_hours?.toFixed(1)}h
            </span>
            <span className="text-[9px] text-theme-muted font-bold uppercase block tracking-widest leading-none mt-0.5">Weekly</span>
          </div>
        </div>
      )
    },
    { 
      headerName: 'Health / Blockers',
      minWidth: 140,
      cellRenderer: (p: any) => {
        const blockerCount = p.data.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
        return (
          <div className="flex items-center h-full">
            {blockerCount > 0 ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-status-error/10 text-status-error border border-status-error/20 text-[10px] font-bold uppercase">
                <ShieldAlert size={12} /> {blockerCount} Blockers
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-status-success/10 text-status-success border border-status-success/20 text-[10px] font-bold uppercase">
                <Zap size={12} /> Healthy
              </span>
            )}
          </div>
        );
      }
    },
    { 
      field: 'created_by', 
      headerName: 'Author', 
      minWidth: 120,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full text-theme-secondary">
          <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-theme-border flex items-center justify-center">
            <User size={12} className="text-theme-muted" />
          </div>
          <span className="text-[11px] font-bold">{p.value?.split('_')[0] || 'System'}</span>
        </div>
      )
    },
    {
      headerName: '',
      width: 80,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-end h-full">
          <ActionMenu data={p.data} />
        </div>
      )
    }
  ], [onSelect, onDelete]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 100,
  }), []);

  return (
    <div className="space-y-8 animate-apple-in relative">
      {/* Top Action Bar & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1 max-w-2xl relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search titles, @variables, hardware families..." 
            className="w-full bg-white/[0.03] border border-theme-border focus:border-theme-accent outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-theme-muted/50 transition-all font-medium text-[14px] backdrop-blur-sm"
            value={searchText}
            onChange={onSearchChange}
          />
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setFilterDrawerOpen(true)}
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-2xl text-theme-secondary"
          >
            <Filter size={18} />
          </button>
          <button 
            onClick={() => setHelpOpen(true)}
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] border border-theme-border hover:border-theme-accent hover:text-white transition-all rounded-2xl text-theme-secondary"
          >
            <HelpCircle size={18} />
          </button>
          <button 
            onClick={onCreateNew}
            className="btn-apple-primary h-12 !px-8 flex items-center gap-3"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="tracking-widest">Map New Workflow</span>
          </button>
        </div>
      </div>

      {/* Workspace Ribbon */}
      <div className="flex items-center justify-between border-b border-theme-border/50 pb-1">
        <div className="flex items-center gap-1">
          {['My Drafts', 'My Submitted', 'Team Workflows', 'Global Master'].map((ribbon) => (
            <button
              key={ribbon}
              onClick={() => setActiveRibbon(ribbon)}
              className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${
                activeRibbon === ribbon 
                  ? 'text-theme-accent' 
                  : 'text-theme-muted hover:text-theme-secondary'
              }`}
            >
              {ribbon}
              {activeRibbon === ribbon && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-theme-accent rounded-full shadow-[0_0_10px_var(--color-theme-accent)]" />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 pb-2">
           <button onClick={onClearFilters} className="text-[10px] font-bold text-theme-muted hover:text-white flex items-center gap-1.5 transition-all">
             <FilterX size={12} /> Reset View
           </button>
           <button 
            onClick={onExportCsv}
            className="text-[10px] font-bold text-theme-accent hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>
      
      {/* Master Data Grid */}
      <div className="ag-theme-quartz-dark h-[650px] w-full ag-grid-apple">
        <AgGridReact
          ref={gridRef}
          rowData={filteredWorkflows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowSelection="multiple"
          headerHeight={54}
          rowHeight={64}
          suppressCellFocus={true}
          enableCellTextSelection={true}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          rowMultiSelectWithClick={true}
          quickFilterText={searchText}
        />
      </div>

      {/* Advanced Filter Drawer */}
      {isFilterDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setFilterDrawerOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-theme-sidebar border-l border-theme-border shadow-2xl z-[70] animate-in slide-in-from-right duration-300 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-header-sub !text-white flex items-center gap-3">
                <Filter size={18} className="text-theme-accent" /> Advanced Filters
              </h3>
              <button onClick={() => setFilterDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                <label className="text-hint text-theme-secondary font-bold">Hardware Family</label>
                <select className="input-apple !bg-white/[0.03]">
                  <option value="">All Families</option>
                  <option value="CD-SEM">CD-SEM</option>
                  <option value="Overlay">Overlay</option>
                  <option value="Defect">Defect</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-hint text-theme-secondary font-bold">Automation Status</label>
                <div className="grid grid-cols-1 gap-2">
                  {['Backlog', 'In Automation', 'Verification', 'Fully Automated'].map(s => (
                    <label key={s} className="flex items-center gap-3 p-3 rounded-xl border border-theme-border bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                      <input type="checkbox" className="w-4 h-4 rounded border-theme-border bg-transparent accent-theme-accent" />
                      <span className="text-[12px] font-medium">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-hint text-theme-secondary font-bold">Risk Profile</label>
                <label className="flex items-center justify-between p-4 rounded-xl border border-theme-border bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                  <span className="text-[12px] font-medium flex items-center gap-2">
                    <AlertTriangle size={14} className="text-status-error" /> High Yield Risk Only
                  </span>
                  <input type="checkbox" className="w-4 h-4 rounded border-theme-border bg-transparent accent-theme-accent" />
                </label>
              </div>
            </div>

            <div className="pt-8 border-t border-theme-border grid grid-cols-2 gap-4">
              <button className="btn-apple-secondary w-full" onClick={() => setFilterDrawerOpen(false)}>Cancel</button>
              <button className="btn-apple-primary w-full" onClick={() => setFilterDrawerOpen(false)}>Apply Criteria</button>
            </div>
          </div>
        </>
      )}

      {/* Contextual Help Overlay */}
      {isHelpOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]" onClick={() => setHelpOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] max-h-[80vh] bg-theme-sidebar border border-theme-border rounded-[32px] shadow-2xl z-[70] animate-apple-in p-10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-theme-accent/20 flex items-center justify-center text-theme-accent">
                  <HelpCircle size={24} />
                </div>
                <div>
                  <h3 className="text-header-main !text-white leading-none">Contextual Guide</h3>
                  <p className="text-theme-muted text-[12px] mt-1">Understanding the Workflow Repository</p>
                </div>
              </div>
              <button onClick={() => setHelpOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-10">
              <section className="space-y-4">
                <h4 className="text-[14px] font-black uppercase tracking-widest text-theme-accent">Master Data Grid</h4>
                <p className="text-theme-secondary text-[13px] leading-relaxed">
                  The Workflow Repository centralizes all metrology sequences. Use the <strong>Workspace Ribbon</strong> to toggle between your private drafts and the global team master.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-theme-border">
                    <span className="text-[11px] font-black text-white block mb-2">ROI Forecast</span>
                    <p className="text-[11px] text-theme-muted">Calculated weekly hours saved based on touch time and frequency.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-theme-border">
                    <span className="text-[11px] font-black text-white block mb-2">Yield Risk</span>
                    <p className="text-[11px] text-theme-muted">Indicates processes with potential for material scrap or tool damage.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-[14px] font-black uppercase tracking-widest text-theme-accent">Quick Interactions</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-[12px] text-theme-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-theme-accent mt-1.5 shrink-0" />
                    <span><strong>Hover (Peek):</strong> See a miniature DAG preview and health metrics without opening the record.</span>
                  </li>
                  <li className="flex gap-3 text-[12px] text-theme-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-theme-accent mt-1.5 shrink-0" />
                    <span><strong>Action Menu:</strong> Clone existing workflows to drafts or create new versions for updates.</span>
                  </li>
                  <li className="flex gap-3 text-[12px] text-theme-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-theme-accent mt-1.5 shrink-0" />
                    <span><strong>Smart Search:</strong> Index workflows by title, @variables, hardware families, or authors.</span>
                  </li>
                </ul>
              </section>
            </div>
            
            <div className="mt-10 pt-8 border-t border-theme-border flex justify-end">
              <button className="btn-apple-primary !px-10" onClick={() => setHelpOpen(false)}>Understood</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkflowRegistry;
