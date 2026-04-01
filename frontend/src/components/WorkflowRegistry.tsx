import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import React, { useMemo } from 'react';
import { FileText, Trash2, Zap } from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
}

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete }) => {
  const columnDefs: ColDef[] = useMemo(() => [
    { 
      field: 'name', 
      headerName: 'Initiative Name', 
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-theme-accent shadow-[0_0_8px_rgba(0,113,227,0.5)]" />
          <span className="font-semibold text-theme-primary">{p.value}</span>
        </div>
      )
    },
    { 
      field: 'status', 
      headerName: 'Lifecycle Status', 
      flex: 1.5,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            p.value.includes('Automated') ? 'bg-status-success/10 text-status-success border border-status-success/20' : 
            p.value.includes('Automation') ? 'bg-theme-accent/10 text-theme-accent border border-theme-accent/20' : 
            'bg-theme-muted/10 text-theme-secondary border border-theme-border'
          }`}>
            {p.value}
          </span>
        </div>
      )
    },
    { 
      field: 'frequency_per_month', 
      headerName: 'Freq/Mo', 
      flex: 0.8,
      type: 'numericColumn',
      valueFormatter: (p: any) => `${p.value}x`
    },
    { 
      field: 'total_roi_saved_hours', 
      headerName: 'ROI (Hrs/Mo)', 
      flex: 1,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <span className="font-mono font-bold text-theme-accent">
          {p.value?.toFixed(1)}h
        </span>
      )
    },
    {
      headerName: 'Actions',
      flex: 1,
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full py-1">
          <button 
            onClick={() => onSelect(p.data)}
            className="p-2 hover:bg-theme-accent/10 text-theme-secondary hover:text-theme-accent rounded-lg transition-all"
            title="Edit Workflow"
          >
            <Zap size={15} />
          </button>
          <button 
            className="p-2 hover:bg-white/5 text-theme-secondary hover:text-theme-primary rounded-lg transition-all"
            title="Download Report"
          >
            <FileText size={15} />
          </button>
          <button 
            onClick={() => onDelete(p.data.id)}
            className="p-2 hover:bg-status-error/10 text-theme-secondary hover:text-status-error rounded-lg transition-all"
            title="Archive"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ], [onSelect, onDelete]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className="apple-card overflow-hidden !p-0 border border-theme-border/50 shadow-2xl">
      <div className="ag-theme-quartz-dark h-[500px] w-full ag-grid-apple">
        <AgGridReact
          rowData={workflows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowSelection="multiple"
          headerHeight={48}
          rowHeight={60}
          suppressCellFocus={true}
        />
      </div>
    </div>
  );
};

export default WorkflowRegistry;
