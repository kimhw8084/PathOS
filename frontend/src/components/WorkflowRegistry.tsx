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
      headerName: 'NODE_ID', 
      flex: 2,
      cellRenderer: (p: any) => (
        <div className="flex items-center gap-2 h-full">
          <div className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
          <span className="font-bold text-white text-[11px] truncate uppercase">{p.value}</span>
        </div>
      )
    },
    { 
      field: 'status', 
      headerName: 'LIFECYCLE', 
      flex: 1.2,
      cellRenderer: (p: any) => (
        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
          p.value.includes('Automated') ? 'text-status-success border-status-success/20 bg-status-success/5' : 
          p.value.includes('Automation') ? 'text-theme-accent border-theme-accent/20 bg-theme-accent/5' : 
          'text-theme-muted border-theme-border bg-white/5'
        }`}>
          {p.value}
        </span>
      )
    },
    { 
      field: 'total_roi_saved_hours', 
      headerName: 'YIELD_H/MO', 
      flex: 0.8,
      type: 'numericColumn',
      cellRenderer: (p: any) => (
        <span className="font-mono font-black text-theme-accent text-[11px]">
          {p.value?.toFixed(1)}h
        </span>
      )
    },
    {
      headerName: 'OPS',
      flex: 0.8,
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => (
        <div className="flex items-center justify-end gap-1 h-full">
          <button onClick={() => onSelect(p.data)} className="p-1 hover:text-theme-accent transition-colors"><Zap size={12} /></button>
          <button className="p-1 hover:text-theme-primary transition-colors"><FileText size={12} /></button>
          <button onClick={() => onDelete(p.data.id)} className="p-1 hover:text-status-error transition-colors"><Trash2 size={12} /></button>
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
    <div className="ag-theme-quartz-dark h-[400px] w-full ag-grid-apple">
      <AgGridReact
        rowData={workflows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={false}
        rowSelection="multiple"
        headerHeight={32}
        rowHeight={36}
        suppressCellFocus={true}
      />
    </div>
  );
};

export default WorkflowRegistry;
