import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  type Node, 
  type Edge, 
  Position,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  BackgroundVariant,
  Panel,
  addEdge,
  type Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, Trash2, 
  Workflow as LucideWorkflow, 
  FileText, X, Zap,
  Activity, Layers, Database, AlertCircle,
  Play, Shield, Settings,
  GitFork, Merge, Link2, Plus, AlertTriangle,
  History, MessageSquare, Diff
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { type ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// --- TYPES & INTERFACES ---

interface Blocker {
  id: string;
  blocking_entity: string;
  reason: string;
  probability_percent: number;
  average_delay_minutes: number;
  standard_mitigation: string;
}

interface TaskError {
  id: string;
  error_type: string;
  description: string;
  probability_percent: number;
  recovery_time_minutes: number;
}

interface TaskMedia {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  label: string;
}

interface Task {
  id: string;
  name: string;
  description: string;
  target_system: string;
  interface_type: 'GUI' | 'CLI' | 'API' | 'DECISION' | 'FORK' | 'JOIN';
  active_touch_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrences_per_cycle: number;
  shadow_it_used: boolean;
  shadow_it_link?: string;
  source_data?: string;
  output_format_example?: string;
  post_task_verification?: string;
  risks_yield_scrap: boolean;
  tribal_knowledge?: string;
  media: TaskMedia[];
  order_index: number;
  blockers: Blocker[];
  errors: TaskError[];
  
  // Operational Matrix
  tool_id: string;
  hardware_family: string;
  trigger_architecture: string;
  output_classification: string;

  // I/O Lineage
  upstream_links: string[]; // IDs of parent tasks
  io_variables: string[]; // @Variables
}

interface WorkflowMetadata {
  cadence_count: number;
  cadence_unit: 'day' | 'week' | 'month' | 'year';
  equipment_state: 'READY' | 'MAINTENANCE' | 'ERROR';
  cleanroom_class: 'ISO5' | 'ISO7' | 'UNCONTROLLED';
  status: 'DRAFT' | 'PROD' | 'ARCHIVED';
}

interface WorkflowBuilderProps {
  initialTasks: Task[];
  workflowMetadata: WorkflowMetadata;
  onSave: (tasks: Task[], metadata: WorkflowMetadata) => void;
}

// --- SYSTEM MECHANICS UTILS ---

const nomenclatureLinter = (text: string): { sanitized: string, variables: string[] } => {
  const variableRegex = /@([a-zA-Z0-9_]+)/g;
  const variables = Array.from(text.matchAll(variableRegex)).map(match => match[1]);
  return { sanitized: text, variables };
};

const detectCycles = (nodes: Node[], edges: Edge[]): boolean => {
  const adjList = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adjList.has(e.source)) adjList.set(e.source, []);
    adjList.get(e.source)!.push(e.target);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  const isCyclic = (v: string): boolean => {
    if (!visited.has(v)) {
      visited.add(v);
      recStack.add(v);
      const neighbors = adjList.get(v) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && isCyclic(neighbor)) return true;
        else if (recStack.has(neighbor)) return true;
      }
    }
    recStack.delete(v);
    return false;
  };

  for (const node of nodes) {
    if (isCyclic(node.id)) return true;
  }
  return false;
};

// --- CUSTOM NODES ---

const MatrixNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`apple-glass !bg-black !rounded-xl px-5 py-4 min-w-[220px] shadow-2xl transition-all duration-300 group relative border-2 ${selected ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/10 hover:border-white/40'}`}>
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{data.system || "OP"}</span>
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-white">
          <Activity size={10} className="text-white/40" />
          <span>{data.touch}m</span>
        </div>
      </div>
      <h4 className="text-[12px] font-black text-white tracking-tight leading-tight uppercase truncate">{data.label}</h4>
    </div>
    <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2 border border-black" />
    <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2 border border-black" />
  </div>
);

const LogicNode = ({ selected, type }: { selected: boolean, type: string }) => (
  <div className={`apple-glass !bg-black !rounded-full p-6 w-24 h-24 flex flex-col items-center justify-center shadow-2xl transition-all duration-300 border-2 ${selected ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/10 hover:border-white/40'}`}>
    {type === 'FORK' && <GitFork size={20} className="text-white mb-1" />}
    {type === 'JOIN' && <Merge size={20} className="text-white mb-1" />}
    {type === 'DECISION' && <Zap size={20} className="text-white mb-1" />}
    <span className="text-[9px] font-black text-white uppercase tracking-tighter">{type}</span>
    <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2 border border-black" />
    <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2 border border-black" />
  </div>
);

const nodeTypes = {
  matrix: MatrixNode,
  DECISION: (p: any) => <LogicNode {...p} type="DECISION" />,
  FORK: (p: any) => <LogicNode {...p} type="FORK" />,
  JOIN: (p: any) => <LogicNode {...p} type="JOIN" />,
};

// --- MAIN BUILDER ---

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, workflowMetadata, onSave }) => {
  const [view, setView] = useState<'flow' | 'table' | 'grid'>('flow');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [metadata, setMetadata] = useState<WorkflowMetadata>(workflowMetadata);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'execution' | 'lineage' | 'corners'>('execution');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [linterErrors, setLinterErrors] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState({ best: 0, worst: 0, total_roi: 0 });

  // Sync tasks to nodes on load
  useEffect(() => {
    const newNodes: Node[] = tasks.map((t, idx) => ({
      id: t.id,
      type: (t.interface_type === 'DECISION' || t.interface_type === 'FORK' || t.interface_type === 'JOIN') ? t.interface_type : 'matrix',
      data: { 
        label: t.name, 
        system: t.target_system, 
        touch: t.active_touch_time_minutes,
        wait: t.machine_wait_time_minutes,
        risks: t.risks_yield_scrap
      },
      position: { x: 100, y: idx * 150 },
    }));
    
    // Create edges based on order if no edges exist
    const newEdges: Edge[] = [];
    if (tasks.length > 1) {
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: tasks[i].id,
          target: tasks[i+1].id,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' },
          style: { stroke: '#ffffff', strokeWidth: 2, opacity: 0.2 }
        });
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [initialTasks]);

  // Dry-Run Simulator & Linter
  const runDiagnostics = useCallback(() => {
    let totalROI = 0;
    let minTime = 0;
    let maxTime = 0;
    const errors: string[] = [];

    tasks.forEach(t => {
      // ROI Logic: ((Touch * Occurrences) + (Error% * Recovery)) * Frequency / 60
      const touchTotal = t.active_touch_time_minutes * t.occurrences_per_cycle;
      const errorBuffer = t.errors.reduce((acc, e) => acc + (e.probability_percent / 100 * e.recovery_time_minutes), 0);
      const taskBaseTime = touchTotal + errorBuffer;
      
      let scale = 1.0;
      if (metadata.cadence_unit === 'day') scale = 30.44;
      else if (metadata.cadence_unit === 'week') scale = 4.34;
      else if (metadata.cadence_unit === 'year') scale = 1/12;
      
      totalROI += (taskBaseTime * metadata.cadence_count * scale / 60);
      minTime += touchTotal;
      maxTime += touchTotal + t.machine_wait_time_minutes + (t.errors.length > 0 ? Math.max(...t.errors.map(e => e.recovery_time_minutes)) : 0);

      // Linter
      if (t.name === '') errors.push(`Task ${t.id} has no name.`);
    });

    if (detectCycles(nodes, edges)) errors.push("INFINITE LOOP DETECTED in diagram logic.");

    setSimulationResult({ total_roi: totalROI, best: minTime, worst: maxTime });
    setLinterErrors(errors);
  }, [tasks, nodes, edges, metadata]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, 
      style: { stroke: '#ffffff', strokeWidth: 2, opacity: 0.3 } 
    }, eds));
  }, [setEdges]);

  const addNewNode = (type: Task['interface_type']) => {
    const id = `node-${Date.now()}`;
    const newTask: Task = {
      id,
      name: `NEW ${type}`,
      description: '',
      target_system: 'ERP',
      interface_type: type,
      active_touch_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrences_per_cycle: 1,
      shadow_it_used: false,
      risks_yield_scrap: false,
      media: [],
      order_index: tasks.length,
      blockers: [],
      errors: [],
      tool_id: 'LOCAL',
      hardware_family: 'VIRTUAL',
      trigger_architecture: 'MANUAL',
      output_classification: 'INTERNAL',
      upstream_links: [],
      io_variables: []
    };
    
    setTasks([...tasks, newTask]);
    setNodes(nds => [...nds, {
      id,
      type: (type === 'DECISION' || type === 'FORK' || type === 'JOIN') ? type : 'matrix',
      data: { label: newTask.name, system: newTask.target_system, touch: 0 },
      position: { x: 400, y: 400 }
    }]);
    setSelectedTaskId(id);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    // Also sync node data if name changes
    if (updates.name || updates.active_touch_time_minutes || updates.target_system) {
      setNodes(nds => nds.map(n => n.id === id ? { 
        ...n, 
        data: { 
          ...n.data, 
          label: updates.name ?? n.data.label,
          touch: updates.active_touch_time_minutes ?? n.data.touch,
          system: updates.target_system ?? n.data.system
        } 
      } : n));
    }
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  // --- GRID VIEW CONFIG ---
  const gridColDefs: ColDef<Task>[] = [
    { field: 'name', editable: true, flex: 1 },
    { field: 'target_system', editable: true, width: 120 },
    { field: 'interface_type', editable: true, width: 120 },
    { field: 'active_touch_time_minutes', headerName: 'Touch (Min)', editable: true, width: 120 },
    { field: 'machine_wait_time_minutes', headerName: 'Machine (Min)', editable: true, width: 120 },
    { field: 'risks_yield_scrap', headerName: 'Scrap Risk', editable: true, width: 120, cellRenderer: (p: any) => p.value ? '⚠️ YES' : 'NO' },
  ];

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-white/10 bg-[#050505]">
      
      {/* --- UNIFIED HEADER (GATEKEEPER) --- */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black z-40">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <LucideWorkflow size={18} className="text-white" />
              <span className="text-[14px] font-black text-white tracking-tighter uppercase">PathOS Engine v4.0</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${metadata.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {metadata.status}
              </span>
              <div className="h-1 w-1 bg-white/20 rounded-full" />
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em]">Strategy Architect</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10 mx-2" />

          {/* Cleanroom & Equipment State */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">Environment</label>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                {(['ISO5', 'ISO7', 'UNCONTROLLED'] as const).map(c => (
                  <button 
                    key={c}
                    onClick={() => setMetadata({...metadata, cleanroom_class: c})}
                    className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${metadata.cleanroom_class === c ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-widest">Equip State</label>
              <button 
                onClick={() => {
                  const states: WorkflowMetadata['equipment_state'][] = ['READY', 'MAINTENANCE', 'ERROR'];
                  const next = states[(states.indexOf(metadata.equipment_state) + 1) % states.length];
                  setMetadata({...metadata, equipment_state: next});
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-black transition-all ${
                  metadata.equipment_state === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 
                  metadata.equipment_state === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  metadata.equipment_state === 'READY' ? 'bg-emerald-400' : 
                  metadata.equipment_state === 'MAINTENANCE' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                {metadata.equipment_state}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
            {[
              { id: 'flow', icon: <Layers size={14} />, label: 'Diagram' },
              { id: 'table', icon: <Database size={14} />, label: 'Logic' },
              { id: 'grid', icon: <Settings size={14} />, label: 'Bulk' }
            ].map((v) => (
              <button 
                key={v.id}
                onClick={() => setView(v.id as any)} 
                className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v.id ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks, metadata)} className="px-8 py-3 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <Save size={14} /> Synchronize
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* --- MAIN CANVAS AREA --- */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Linter Warning Ribbon */}
          {linterErrors.length > 0 && (
            <div className="absolute top-4 left-4 right-4 z-30 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-xl flex items-center justify-between shadow-2xl border border-red-400/50">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">{linterErrors[0]} {linterErrors.length > 1 && `(+${linterErrors.length - 1} more)`}</span>
              </div>
              <button className="text-white/60 hover:text-white" onClick={() => setLinterErrors([])}><X size={16} /></button>
            </div>
          )}

          {view === 'flow' ? (
            <div className="flex-1 bg-[#020202] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect}
                onNodeClick={(_, node) => setSelectedTaskId(node.id)}
                onPaneClick={() => setSelectedTaskId(null)}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.03)" gap={50} size={1} />
                <Controls className="!bg-black !border-white/10" />
                <Panel position="bottom-center" className="mb-10">
                   <div className="flex items-center gap-3 p-2 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                    <button onClick={() => addNewNode('GUI')} className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">
                      <Plus size={14} /> Task
                    </button>
                    <button onClick={() => addNewNode('DECISION')} className="flex items-center gap-2 px-5 py-3 bg-black border border-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                      <Zap size={14} /> Decision
                    </button>
                    <button onClick={() => addNewNode('FORK')} className="flex items-center gap-2 px-5 py-3 bg-black border border-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                      <GitFork size={14} /> Fork
                    </button>
                    <button onClick={() => addNewNode('JOIN')} className="flex items-center gap-2 px-5 py-3 bg-black border border-white/20 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                      <Merge size={14} /> Join
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          ) : view === 'table' ? (
            <div className="flex-1 overflow-auto p-12 custom-scrollbar space-y-4 bg-black">
              {tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`border transition-all duration-300 rounded-2xl group cursor-pointer ${selectedTaskId === task.id ? 'border-white bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.05)]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-8 px-10 py-6">
                    <span className="text-[12px] font-black text-white/10 group-hover:text-white/40 w-8">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 grid grid-cols-4 gap-12">
                      <div className="flex flex-col col-span-2">
                        <span className="text-[15px] font-black text-white uppercase tracking-tight">{task.name}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[9px] font-black rounded uppercase">{task.target_system}</span>
                          <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">{task.interface_type}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-white/30 uppercase mb-1">Touch Time</span>
                        <span className="text-[16px] font-black text-white">{task.active_touch_time_minutes}m</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-white/30 uppercase mb-1">Occurrences</span>
                        <span className="text-[16px] font-black text-white">x{task.occurrences_per_cycle}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="p-3 text-white/20 hover:text-white hover:bg-red-500/20 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => addNewNode('GUI')} className="w-full py-12 border-2 border-dashed border-white/5 rounded-2xl text-[11px] font-black text-white/20 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.01] transition-all uppercase tracking-[0.4em] flex items-center justify-center gap-6">
                <Plus size={20} /> Register New Sequential Node
              </button>
            </div>
          ) : (
            <div className="flex-1 ag-theme-alpine-dark bg-black">
              <AgGridReact
                rowData={tasks}
                columnDefs={gridColDefs}
                onCellValueChanged={(params) => updateTask(params.data.id, params.data)}
                theme="legacy"
                className="h-full w-full"
              />
            </div>
          )}
        </div>

        {/* --- 3-TAB TASK NODE DRAWER (INSPECTOR) --- */}
        <div className="w-[500px] border-l border-white/10 bg-black flex flex-col z-40 shadow-2xl overflow-hidden">
          {selectedTaskId && selectedTask ? (
            <>
              {/* Tab Selector */}
              <div className="h-16 flex border-b border-white/10 bg-black/50 backdrop-blur-xl">
                {[
                  { id: 'execution', label: 'ROI / Execution', icon: <Activity size={14} /> },
                  { id: 'lineage', label: 'I/O Lineage', icon: <Link2 size={14} /> },
                  { id: 'corners', label: 'Corner Cases', icon: <AlertCircle size={14} /> }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setInspectorTab(t.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all border-b-2 ${inspectorTab === t.id ? 'border-white bg-white/5 text-white' : 'border-transparent text-white/40 hover:text-white'}`}
                  >
                    {t.icon}
                    <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-10">
                {/* Core Header for selected task */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">Node Identity</span>
                    <button onClick={() => setSelectedTaskId(null)} className="text-white/20 hover:text-white"><X size={18} /></button>
                  </div>
                  <input 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[16px] font-black text-white uppercase focus:border-white transition-colors outline-none" 
                    value={selectedTask.name} 
                    onChange={e => updateTask(selectedTaskId, { name: e.target.value })}
                  />
                </div>

                {inspectorTab === 'execution' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="grid grid-cols-2 gap-6 bg-white/[0.03] p-8 rounded-2xl border border-white/5">
                      <div className="text-center space-y-3">
                        <span className="text-[9px] font-black text-white/40 uppercase">Touch (Min)</span>
                        <input 
                          type="number" 
                          className="bg-transparent text-4xl font-black text-white text-center w-full outline-none" 
                          value={selectedTask.active_touch_time_minutes} 
                          onChange={e => updateTask(selectedTaskId, { active_touch_time_minutes: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="text-center space-y-3 border-l border-white/10">
                        <span className="text-[9px] font-black text-white/40 uppercase">Wait (Min)</span>
                        <input 
                          type="number" 
                          className="bg-transparent text-4xl font-black text-white text-center w-full outline-none opacity-40" 
                          value={selectedTask.machine_wait_time_minutes} 
                          onChange={e => updateTask(selectedTaskId, { machine_wait_time_minutes: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Operational Matrix</label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Tool ID', key: 'tool_id' },
                          { label: 'Hardware', key: 'hardware_family' },
                          { label: 'Trigger', key: 'trigger_architecture' },
                          { label: 'Output', key: 'output_classification' }
                        ].map(f => (
                          <div key={f.key} className="space-y-2">
                            <span className="text-[9px] font-black text-white/60 uppercase ml-1">{f.label}</span>
                            <input 
                              className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-white" 
                              value={(selectedTask as any)?.[f.key]} 
                              onChange={e => updateTask(selectedTaskId, { [f.key]: e.target.value })} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'lineage' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Data Lineage (@Variables)</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[13px] font-mono text-emerald-400 h-32 focus:border-emerald-500/50 transition-colors outline-none resize-none" 
                        placeholder="Use @Variable to link data..."
                        value={selectedTask.description} 
                        onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                      />
                      <div className="flex flex-wrap gap-2">
                        {nomenclatureLinter(selectedTask.description || "").variables.map(v => (
                          <span key={v} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black rounded uppercase">@{v}</span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Media Assets</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-white/40 hover:bg-white/5 transition-all text-white/20 hover:text-white">
                          <Plus size={24} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Upload Reference</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'corners' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Blockers / Dependencies</label>
                        <button className="text-white/40 hover:text-white"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-3">
                        {selectedTask.blockers.map(b => (
                          <div key={b.id} className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[11px] font-black text-red-400 uppercase">{b.blocking_entity}</span>
                              <span className="text-[10px] font-bold text-red-400/60">{b.probability_percent}% Prob</span>
                            </div>
                            <p className="text-[10px] text-white/60">{b.reason}</p>
                          </div>
                        ))}
                        {selectedTask.blockers.length === 0 && <p className="text-[10px] text-white/20 italic">No blockers registered.</p>}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Yield Risk</label>
                      <button 
                        onClick={() => updateTask(selectedTaskId, { risks_yield_scrap: !selectedTask.risks_yield_scrap })}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-xl border transition-all ${selectedTask.risks_yield_scrap ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-widest">Risks Yield/Scrap</span>
                        <Shield size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Workflow Global Identity */}
              <div className="h-16 flex items-center px-8 border-b border-white/10">
                <span className="text-[12px] font-black text-white uppercase tracking-widest">Workflow Matrix</span>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Play size={24} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Dry-Run Simulator</span>
                      <span className="text-[14px] font-black text-white uppercase">Operational Projection</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block mb-2">Best Case</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">{simulationResult.best.toFixed(0)}</span>
                        <span className="text-[9px] font-black text-white/40 uppercase">Min</span>
                      </div>
                    </div>
                    <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block mb-2">Worst Case</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">{simulationResult.worst.toFixed(0)}</span>
                        <span className="text-[9px] font-black text-white/40 uppercase">Min</span>
                      </div>
                    </div>
                  </div>

                  {simulationResult.worst > 480 && (
                    <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl flex gap-3">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-500 uppercase leading-relaxed">Shift-Handoff Risk Detected: Cumulative execution exceeds 8-hour window.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                   <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Global Cadence</label>
                  <div className="flex gap-4">
                    <input 
                      type="number" 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-6 py-6 text-3xl font-black text-white outline-none focus:border-white transition-colors"
                      value={metadata.cadence_count}
                      onChange={e => setMetadata({...metadata, cadence_count: parseFloat(e.target.value)})}
                    />
                    <select 
                      className="w-32 bg-white/5 border border-white/10 rounded-xl px-4 text-[11px] font-black text-white uppercase outline-none appearance-none cursor-pointer"
                      value={metadata.cadence_unit}
                      onChange={e => setMetadata({...metadata, cadence_unit: e.target.value as any})}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t border-white/10">
                  <div className="flex items-center gap-3 text-white/40 uppercase font-black text-[9px] tracking-[0.3em]">
                    <History size={14} /> Version Control
                  </div>
                  <div className="space-y-3">
                    <button className="w-full flex items-center gap-3 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all">
                      <Diff size={14} /> Visual Diffing
                    </button>
                    <button className="w-full flex items-center gap-3 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase hover:bg-white/10 transition-all">
                      <MessageSquare size={14} /> Async Comments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-10 border-t border-white/10 bg-black flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Projected ROI</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{simulationResult.total_roi.toFixed(1)}</span>
                <span className="text-[11px] font-black text-white/40 uppercase">Hrs/Mo</span>
              </div>
            </div>
            <button className="flex items-center gap-3 px-6 py-4 border border-white/20 rounded-xl text-[11px] font-black text-white uppercase hover:bg-white/10 transition-colors">
              <FileText size={16} /> SOP Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (
  <ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
