import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import React, { useMemo, useCallback, useRef } from 'react';
import { FileText, Trash2, Zap, AlertTriangle, User, GitBranch, Download, FilterX } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
}

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete }) => {
  const gridRef = useRef<AgGridReact>(null);

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
  }, []);

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
      headerName: 'Status',
      field: 'status',
      minWidth: 160,
      cellRenderer: (p: any) => {
        const isAuto = p.data.status?.includes('Automated');
        const isInProgress = p.data.status?.includes('Automation') || p.data.status?.includes('Verification');
        
        return (
          <div className="flex items-center gap-2.5 h-full">
            <span className={`status-badge flex items-center gap-1.5 ${
              isAuto ? 'bg-status-success/10 text-status-success' : 
              isInProgress ? 'bg-theme-accent/10 text-theme-accent' : 
              'bg-white/5 text-theme-muted border border-theme-border'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                isAuto ? 'bg-status-success shadow-[0_0_8px_rgba(52,199,89,0.5)]' : 
                isInProgress ? 'bg-theme-accent animate-pulse shadow-[0_0_8px_rgba(0,122,255,0.5)]' : 
                'bg-theme-muted'
              }`} />
              {p.data.status}
            </span>
            <span className="text-hint bg-white/[0.03] border border-theme-border px-1.5 py-0.5 rounded-md">
              {p.data.version || 'v1.0'}
            </span>
          </div>
        );
      }
    },
    { 
      field: 'name', 
      headerName: 'Workflow Identifier', 
      minWidth: 250,
      flex: 1,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-3 h-full group cursor-pointer" onClick={() => onSelect(p.data)}>
          <div className="p-1.5 bg-theme-accent/5 rounded-lg border border-theme-border group-hover:border-theme-accent/30 transition-all">
            <Zap size={14} className="text-theme-muted group-hover:text-theme-accent transition-colors" />
          </div>
          <span className="font-bold text-white text-[13px] tracking-tight group-hover:text-theme-accent transition-colors">
            {p.value}
          </span>
        </div>
      )
    },
    { 
      field: 'tool_family', 
      headerName: 'Hardware', 
      minWidth: 120,
      cellRenderer: (p: any) => (
        <span className="text-hint bg-white/[0.03] border border-theme-border px-2.5 py-1 rounded-lg">
          {p.value || 'General'}
        </span>
      )
    },
    { 
      headerName: 'ROI Index', 
      field: 'total_roi_saved_hours',
      minWidth: 120,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 justify-end h-full">
          {p.data.yield_risk && <AlertTriangle size={14} className="text-status-warning" />}
          <div className="text-right">
            <span className="font-extrabold text-theme-accent text-[13px]">
              +{p.data.total_roi_saved_hours?.toFixed(1)}h
            </span>
            <span className="text-hint block leading-none">Monthly</span>
          </div>
        </div>
      )
    },
    {
      headerName: 'Stability',
      minWidth: 140,
      cellRenderer: (p: any) => {
        const blockerCount = p.data.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
        return (
          <div className="flex items-center gap-1.5 h-full">
            {blockerCount > 0 ? (
              <span className="status-badge bg-status-error/10 text-status-error flex items-center gap-1">
                 {blockerCount} Critical Issues
              </span>
            ) : (
              <span className="status-badge bg-status-success/10 text-status-success">Operational</span>
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
        <div className="flex items-center gap-2 h-full">
          <div className="w-6 h-6 rounded-full bg-theme-accent/10 border border-theme-border flex items-center justify-center">
            <User size={12} className="text-theme-accent" />
          </div>
          <span className="text-subtext truncate">
            {p.value?.split('@')[0]}
          </span>
        </div>
      )
    },
    {
      headerName: 'Actions',
      width: 150,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-end gap-2 h-full">
          <button onClick={() => onSelect(p.data)} title="Open Builder" className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-theme-accent/10 hover:text-theme-accent transition-all rounded-lg border border-theme-border"><Zap size={14} /></button>
          <button title="Clone Strategy" className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-theme-primary/10 hover:text-white transition-all rounded-lg border border-theme-border"><GitBranch size={14} /></button>
          <button onClick={() => onDelete(p.data.id)} title="Archive Strategy" className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-status-error/10 hover:text-status-error transition-all rounded-lg border border-theme-border"><Trash2 size={14} /></button>
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
    <div className="space-y-4 animate-apple-in">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
           <span className="text-hint">Grid Operations:</span>
           <button onClick={onClearFilters} className="text-[10px] font-bold text-theme-secondary hover:text-white flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded-md border border-theme-border transition-all">
             <FilterX size={12} /> Clear Filters
           </button>
        </div>
        <button 
          onClick={onExportCsv}
          className="text-[10px] font-bold text-theme-accent hover:text-white flex items-center gap-1.5 bg-theme-accent/5 px-3 py-1.5 rounded-md border border-theme-accent/20 transition-all"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>
      
      <div className="ag-theme-quartz-dark h-[600px] w-full ag-grid-apple">
        <AgGridReact
          ref={gridRef}
          rowData={workflows}
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
        />
      </div>
    </div>
  );
};

export default WorkflowRegistry;

