import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import React, { useMemo } from 'react';
import { FileText, Trash2, Zap, AlertTriangle, User, GitBranch } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
}

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete }) => {
  const columnDefs: ColDef[] = useMemo(() => [
    { 
      headerName: 'STATUS_CORE',
      flex: 1.2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full">
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
            p.data.status?.includes('Automated') ? 'text-status-success border-status-success/20 bg-status-success/5' : 
            p.data.status?.includes('Automation') ? 'text-theme-accent border-theme-accent/20 bg-theme-accent/5' : 
            'text-theme-muted border-theme-border bg-white/5'
          }`}>
            {p.data.status}
          </span>
          <span className="text-[8px] font-mono font-bold text-theme-muted bg-white/5 border border-theme-border px-1 rounded uppercase">
            {p.data.version || 'v1'}
          </span>
        </div>
      )
    },
    { 
      field: 'name', 
      headerName: 'WORKFLOW_IDENTIFIER', 
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full group cursor-pointer" onClick={() => onSelect(p.data)}>
          <span className="font-black text-white text-[11px] truncate uppercase tracking-tight group-hover:text-theme-accent transition-colors">
            {p.value}
          </span>
        </div>
      )
    },
    { 
      field: 'tool_family', 
      headerName: 'HARDWARE_FAM', 
      flex: 1,
      cellRenderer: (p: any) => (
        <span className="text-[9px] font-bold text-theme-secondary bg-white/5 border border-theme-border px-2 py-0.5 rounded uppercase tracking-tighter">
          {p.value || '[GENERAL]'}
        </span>
      )
    },
    { 
      headerName: 'FLOW_SUMMARY', 
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="text-[10px] font-medium text-theme-muted truncate uppercase flex items-center gap-1.5 h-full">
          <span className="text-theme-secondary font-bold">{p.data.trigger_type}</span>
          <span className="opacity-30">➡️</span>
          <span className="text-theme-secondary font-bold">{p.data.output_type}</span>
        </div>
      )
    },
    { 
      field: 'total_roi_saved_hours', 
      headerName: 'ROI_SAVED_H/WK', 
      flex: 1,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 justify-end h-full">
          {p.data.yield_risk && <AlertTriangle size={12} className="text-status-error animate-pulse" />}
          <span className="font-mono font-black text-theme-accent text-[11px]">
            {p.value?.toFixed(1)}h
          </span>
        </div>
      )
    },
    {
      headerName: 'HEALTH_BLOCKS',
      flex: 0.8,
      cellRenderer: (p: any) => {
        const blockerCount = p.data.tasks?.reduce((acc: number, t: any) => acc + (t.blockers?.length || 0), 0) || 0;
        return (
          <div className="flex items-center gap-1.5 h-full">
            {blockerCount > 0 ? (
              <span className="text-[9px] font-black text-status-error bg-status-error/10 border border-status-error/20 px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                🛑 {blockerCount}
              </span>
            ) : (
              <span className="text-[9px] font-black text-status-success opacity-40 uppercase tracking-widest">Stable</span>
            )}
          </div>
        );
      }
    },
    {
      field: 'created_by',
      headerName: 'SME_AUTHOR',
      flex: 1,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full opacity-60">
          <User size={10} className="text-theme-muted" />
          <span className="text-[9px] font-bold text-theme-secondary uppercase truncate">
            {p.value?.split('@')[0]}
          </span>
        </div>
      )
    },
    {
      headerName: 'OPS',
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-end gap-1 h-full">
          <button onClick={() => onSelect(p.data)} title="Open Architect" className="p-1.5 hover:text-theme-accent transition-colors hover:bg-white/5 rounded"><Zap size={12} /></button>
          <button title="Clone to Draft" className="p-1.5 hover:text-theme-primary transition-colors hover:bg-white/5 rounded"><GitBranch size={12} /></button>
          <button title="Export SOP" className="p-1.5 hover:text-theme-secondary transition-colors hover:bg-white/5 rounded"><FileText size={12} /></button>
          <button onClick={() => onDelete(p.data.id)} title="Archive Node" className="p-1.5 hover:text-status-error transition-colors hover:bg-white/5 rounded"><Trash2 size={12} /></button>
        </div>
      )
    }
  ], [onSelect, onDelete]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    headerClass: 'ag-header-cell-apple'
  }), []);

  return (
    <div className="ag-theme-quartz-dark h-[500px] w-full ag-grid-apple">
      <AgGridReact
        rowData={workflows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={false}
        rowSelection="multiple"
        headerHeight={32}
        rowHeight={38}
        suppressCellFocus={true}
        enableCellTextSelection={true}
      />
    </div>
  );
};

export default WorkflowRegistry;
