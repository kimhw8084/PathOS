import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import React, { useMemo, useCallback, useRef } from 'react';
import { Trash2, Zap, AlertTriangle, User, GitBranch, Download, FilterX } from 'lucide-react';

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
      minWidth: 300,
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-4 h-full group cursor-pointer" onClick={() => onSelect(p.data)}>
          <div className="w-10 h-10 rounded-xl bg-theme-accent/5 border border-theme-border flex items-center justify-center group-hover:bg-theme-accent/10 group-hover:border-theme-accent/30 transition-all">
            <Zap size={16} className="text-theme-muted group-hover:text-theme-accent transition-colors" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-bold text-white text-[13px] tracking-tight group-hover:text-theme-accent transition-colors leading-tight">
              {p.value}
            </span>
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider mt-0.5">
              {p.data.version || 'v1.0.0'} • {p.data.trigger_type?.replace('_', ' ')}
            </span>
          </div>
        </div>
      )
    },
    { 
      field: 'tool_family', 
      headerName: 'Family', 
      minWidth: 140,
      cellRenderer: (p: any) => (
        <div className="flex items-center h-full">
          <span className="text-[11px] font-bold bg-white/[0.03] border border-theme-border px-3 py-1 rounded-lg text-theme-secondary uppercase tracking-tight">
            {p.value?.replace('_', '-') || 'System'}
          </span>
        </div>
      )
    },
    { 
      headerName: 'ROI Yield', 
      field: 'total_roi_saved_hours',
      minWidth: 140,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-3 justify-end h-full">
          {p.data.yield_risk && (
            <div className="w-6 h-6 rounded-lg bg-status-error/10 flex items-center justify-center text-status-error">
              <AlertTriangle size={12} />
            </div>
          )}
          <div className="text-right">
            <span className="font-black text-theme-accent text-[14px] tracking-tighter">
              +{p.data.total_roi_saved_hours?.toFixed(1)}h
            </span>
            <span className="text-[9px] text-theme-muted font-bold uppercase block tracking-widest leading-none mt-0.5">Reclaimed</span>
          </div>
        </div>
      )
    },
    {
      headerName: 'Operational State',
      minWidth: 180,
      cellRenderer: (p: any) => {
        const isAuto = p.data.status?.includes('Automated');
        const isInProgress = p.data.status?.includes('Automation') || p.data.status?.includes('Verification');
        
        return (
          <div className="flex items-center h-full">
            <span className={`status-badge flex items-center gap-2 !py-1.5 !px-3 border ${
              isAuto ? 'bg-status-success/5 text-status-success border-status-success/20' : 
              isInProgress ? 'bg-theme-accent/5 text-theme-accent border-theme-accent/20' : 
              'bg-white/5 text-theme-muted border-theme-border'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                isAuto ? 'bg-status-success shadow-[0_0_8px_rgba(52,199,89,0.5)]' : 
                isInProgress ? 'bg-theme-accent animate-pulse shadow-[0_0_8px_rgba(0,122,255,0.5)]' : 
                'bg-theme-muted'
              }`} />
              {p.data.status}
            </span>
          </div>
        );
      }
    },
    {
      headerName: '',
      width: 120,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-end gap-2 h-full">
          <button onClick={() => onSelect(p.data)} title="Edit Logic" className="w-9 h-9 flex items-center justify-center bg-white/[0.03] hover:bg-theme-accent/10 hover:text-theme-accent transition-all rounded-xl border border-theme-border"><Zap size={14} /></button>
          <button onClick={() => onDelete(p.data.id)} title="Archive" className="w-9 h-9 flex items-center justify-center bg-white/[0.03] hover:bg-status-error/10 hover:text-status-error transition-all rounded-xl border border-theme-border"><Trash2 size={14} /></button>
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

