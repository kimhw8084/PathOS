import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Play, FileText, Trash2, Zap } from 'lucide-react';

interface WorkflowRegistryProps {
  workflows: any[];
  onSelect: (workflow: any) => void;
  onDelete: (id: number) => void;
}

const WorkflowRegistry: React.FC<WorkflowRegistryProps> = ({ workflows, onSelect, onDelete }) => {
  const columnDefs = useMemo(() => [
    { 
      field: 'name', 
      headerName: 'Initiative Name',
      flex: 2,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-3">
          <WorkflowIcon status={params.data.status} />
          <span className="font-semibold text-theme-primary">{params.value}</span>
        </div>
      )
    },
    { 
      field: 'status', 
      headerName: 'Lifecycle Status',
      flex: 1.5,
      cellRenderer: (params: any) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${getStatusColor(params.value)}`}>
          {params.value}
        </span>
      )
    },
    { 
      field: 'frequency', 
      headerName: 'Freq/Mo',
      width: 100,
      valueFormatter: (params: any) => `${params.value}x` 
    },
    { 
      field: 'total_roi_saved_hours', 
      headerName: 'ROI (Hrs/Mo)',
      width: 140,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-2 text-theme-accent font-bold">
          <Zap size={14} />
          {params.value.toFixed(1)}
        </div>
      )
    },
    {
      headerName: 'Actions',
      width: 120,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-2 h-full">
          <button 
            onClick={() => onSelect(params.data)}
            className="p-1.5 hover:bg-theme-accent/20 rounded-md text-theme-secondary hover:text-theme-accent transition-all"
            title="Edit Workflow"
          >
            <FileText size={16} />
          </button>
          <button 
            onClick={() => onDelete(params.data.id)}
            className="p-1.5 hover:bg-red-500/10 rounded-md text-theme-muted hover:text-red-400 transition-all"
            title="Archive"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className="ag-theme-alpine-dark h-[500px] w-full rounded-xl overflow-hidden border border-theme-border shadow-2xl">
      <AgGridReact
        rowData={workflows}
        columnDefs={columnDefs as any}
        defaultColDef={defaultColDef}
        animateRows={true}
        headerHeight={48}
        rowHeight={56}
        onRowClicked={(p) => onSelect(p.data)}
      />
    </div>
  );
};

const WorkflowIcon = ({ status }: { status: string }) => {
  const isDone = status === 'Fully Automated' || status === 'Partially Automated';
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDone ? 'bg-green-500/20 text-green-400' : 'bg-theme-accent/20 text-theme-accent'}`}>
      <Play size={16} className={isDone ? '' : 'fill-current'} />
    </div>
  );
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Created': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    case 'In Automation': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Fully Automated': return 'bg-green-500/10 text-green-400 border-green-500/20';
    default: return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
};

export default WorkflowRegistry;
