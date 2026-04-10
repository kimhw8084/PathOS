import React, { useState, useEffect, useMemo } from 'react';
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
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { 
  Save, Trash2, 
  ChevronDown, Workflow as LucideWorkflow, 
  ShieldAlert, Timer, Database, Box, AlertTriangle, 
  Layers, FileText, X, Zap,
  Terminal, FileCode, Cpu, Activity, Info, Link as LinkIcon,
  Clock
} from 'lucide-react';

interface Blocker {
  id?: string | number;
  blocking_entity: string;
  reason: string;
  probability_percent: number;
  average_delay_minutes: number;
  standard_mitigation: string;
}

interface TaskError {
  id?: string | number;
  error_type: string;
  description: string;
  probability_percent: number;
  recovery_time_minutes: number;
}

interface Task {
  id: string | number;
  name: string;
  description: string;
  target_system: string;
  interface_type: string;
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
  media?: any[];
  order_index: number;
  blockers?: Blocker[];
  errors?: TaskError[];
}

interface WorkflowBuilderProps {
  initialTasks: Task[];
  workflowMetadata: {
    cadence_count: number;
    cadence_unit: string;
  };
  onSave: (tasks: Task[], metadata: any) => void;
}

// --- High-Density Matrix Node ---
const MatrixNode = ({ data }: { data: { label: string, system: string, touch: number, wait: number, risks: boolean, blockers: number } }) => (
  <div className={`apple-glass !bg-theme-card/90 !rounded-2xl px-5 py-4 min-w-[240px] shadow-2xl hover:border-theme-accent/50 transition-all duration-300 group relative border ${data.risks ? 'border-status-error/40' : 'border-theme-border'}`}>
    {data.risks && (
      <div className="absolute -top-2.5 -right-2.5 bg-status-error text-white rounded-full p-1.5 shadow-lg shadow-status-error/30 border-2 border-[#05070a]">
        <AlertTriangle size={12} />
      </div>
    )}
    {data.blockers > 0 && (
      <div className="absolute -top-2.5 -left-2.5 bg-status-warning text-black font-black text-[10px] px-2.5 py-1 rounded-full shadow-lg border-2 border-[#05070a] uppercase tracking-tighter">
        {data.blockers} Blockers
      </div>
    )}
    
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-theme-accent uppercase tracking-widest">{data.system || "System Alpha"}</span>
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
          <span className="text-white">{data.touch}m</span>
          <span className="text-theme-muted opacity-30">|</span>
          <span className="text-theme-secondary">{data.wait}m</span>
        </div>
      </div>
      <h4 className="text-[14px] font-black text-white tracking-tight group-hover:text-theme-accent transition-colors truncate">{data.label}</h4>
      <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden border border-white/5">
        <div 
          className="h-full bg-theme-accent shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-700 ease-out" 
          style={{ width: `${Math.min(100, (data.touch / (data.touch + data.wait + 0.1)) * 100)}%` }} 
        />
      </div>
    </div>
    <Handle type="target" position={Position.Top} className="!bg-theme-border !w-2.5 !h-2.5 border-2 border-[#05070a]" />
    <Handle type="source" position={Position.Bottom} className="!bg-theme-accent !w-2.5 !h-2.5 border-2 border-[#05070a]" />
  </div>
);

const nodeTypes = { matrix: MatrixNode };

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 60, marginy: 60, nodesep: 80, ranksep: 100 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 240, height: 90 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const n = dagreGraph.node(node.id);
    node.position = { x: n.x - 120, y: n.y - 45 };
  });
  return { nodes, edges };
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, workflowMetadata, onSave }) => {
  const [view, setView] = useState<'table' | 'flow'>('flow');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [metadata, setMetadata] = useState(workflowMetadata);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const newNodes: Node[] = tasks.map((t) => ({
      id: `${t.id}`,
      type: 'matrix',
      data: { 
        label: t.name, 
        system: t.target_system, 
        touch: t.active_touch_time_minutes, 
        wait: t.machine_wait_time_minutes,
        risks: t.risks_yield_scrap,
        blockers: t.blockers?.length || 0
      },
      position: { x: 0, y: 0 },
    }));
    const newEdges: Edge[] = [];
    for (let i = 0; i < tasks.length - 1; i++) {
      newEdges.push({
        id: `e${tasks[i].id}-${tasks[i+1].id}`,
        source: `${tasks[i].id}`,
        target: `${tasks[i+1].id}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 20, height: 20 },
        style: { stroke: '#1e293b', strokeWidth: 3, opacity: 0.6 }
      });
    }
    const { nodes: ln, edges: le } = getLayoutedElements(newNodes, newEdges);
    setNodes(ln);
    setEdges(le);
  }, [tasks]);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const updateTask = (id: string | number, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addBlocker = (taskId: string | number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, blockers: [...(t.blockers || []), { blocking_entity: 'PIE', reason: '', probability_percent: 0, average_delay_minutes: 0, standard_mitigation: '' }] } : t));
  };

  const onNodeClick = (_: any, node: Node) => {
    setSelectedTaskId(node.id);
  };

  const totalWorkflowROI = useMemo(() => {
    const taskROI = tasks.reduce((acc, t) => {
      const touchTotal = t.active_touch_time_minutes * t.occurrences_per_cycle;
      const errorBuffer = t.errors?.reduce((eAcc, e) => eAcc + (e.probability_percent / 100 * e.recovery_time_minutes), 0) || 0;
      return acc + touchTotal + errorBuffer;
    }, 0);
    
    // Scale by cadence
    let scale = 1.0;
    if (metadata.cadence_unit === 'day') scale = 30.44;
    else if (metadata.cadence_unit === 'week') scale = 4.34;
    else if (metadata.cadence_unit === 'year') scale = 1/12;
    
    return (taskROI * metadata.cadence_count * scale / 60).toFixed(1);
  }, [tasks, metadata]);

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-theme-border bg-[#0a1120]">
      {/* Precision Toolbar */}
      <div className="h-16 border-b border-theme-border flex items-center justify-between px-8 bg-white/[0.02] backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-theme-accent/10 rounded-xl border border-theme-accent/20">
            <LucideWorkflow size={18} className="text-theme-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-black text-white tracking-tight">Strategy Architect</span>
            <span className="text-[10px] text-theme-muted font-bold uppercase tracking-[0.2em] opacity-40">PathOS Core v1.3.0</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-black/40 p-1 rounded-full border border-theme-border">
            {['flow', 'table'].map((v) => (
              <button 
                key={v}
                onClick={() => setView(v as any)} 
                className={`px-6 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${view === v ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks, metadata)} className="btn-apple-primary flex items-center gap-2.5 px-8 !py-2.5 !text-[12px] font-bold shadow-theme-accent/20 shadow-lg">
            <Save size={16} /> Sync Changes
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {view === 'table' ? (
            <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-4 bg-black/10">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`border transition-all duration-300 rounded-2xl group ${selectedTaskId === task.id ? 'border-theme-accent bg-theme-accent/[0.04]' : 'border-theme-border bg-white/[0.01] hover:bg-white/[0.03]'}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-8 px-8 py-5 cursor-pointer">
                    <span className="text-[11px] font-black text-theme-muted group-hover:text-theme-accent transition-colors w-8">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 flex items-center gap-12">
                      <div className="flex flex-col min-w-[280px]">
                        <span className="text-[15px] font-black text-white tracking-tight group-hover:text-theme-accent transition-colors truncate">{task.name || "Untitled Node"}</span>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest">{task.target_system || "SYSTEM"}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest">{task.interface_type || "GUI"}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-12 border-l border-white/5 pl-12">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 opacity-50">Touch</span>
                          <span className="text-[16px] font-black text-white">{task.active_touch_time_minutes}<span className="text-[10px] ml-1 text-theme-muted">m</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 opacity-50">Wait</span>
                          <span className="text-[16px] font-black text-theme-secondary">{task.machine_wait_time_minutes}<span className="text-[10px] ml-1 text-theme-muted">m</span></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="w-9 h-9 flex items-center justify-center rounded-xl text-theme-muted hover:bg-status-error/10 hover:text-status-error transition-all border border-transparent hover:border-status-error/20"><Trash2 size={16} /></button>
                      <ChevronDown size={22} className={`text-theme-muted transition-transform duration-500 ${selectedTaskId === task.id ? 'rotate-180 text-theme-accent' : 'group-hover:text-white'}`} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setTasks([...tasks, { id: `new-${Date.now()}`, name: 'New Operation Node', description: '', target_system: 'SYSTEM', interface_type: 'GUI', active_touch_time_minutes: 0, machine_wait_time_minutes: 0, occurrences_per_cycle: 1, shadow_it_used: false, risks_yield_scrap: false, order_index: tasks.length, blockers: [], errors: [] }])} 
                className="w-full py-8 border-2 border-dashed border-theme-border rounded-2xl hover:border-theme-accent/50 hover:bg-theme-accent/[0.03] text-[12px] font-black text-theme-muted hover:text-theme-accent transition-all group flex items-center justify-center gap-4 uppercase tracking-[0.2em]">
                <Zap size={18} className="group-hover:scale-125 transition-transform text-theme-accent" /> Register New Node
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#050b18] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onNodeClick={onNodeClick}
                onPaneClick={() => setSelectedTaskId(null)}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Dots} color="rgba(59,130,246,0.1)" gap={40} size={1} />
                <Controls className="!bg-[#0a1120] !border-theme-border !shadow-2xl" />
              </ReactFlow>
            </div>
          )}
        </div>

        {/* Right-Side Property Inspector */}
        <div className="w-[520px] border-l border-theme-border bg-[#0a1120]/90 backdrop-blur-3xl flex flex-col z-30 shadow-2xl overflow-hidden">
          <div className="h-16 flex items-center justify-between px-8 border-b border-theme-border bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-theme-accent/10 rounded-xl border border-theme-accent/20">
                {selectedTaskId ? <Cpu size={20} className="text-theme-accent" /> : <Layers size={20} className="text-theme-accent" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-black text-white">{selectedTaskId ? "Node Inspector" : "Workflow Context"}</span>
                <span className="text-[10px] text-theme-muted font-bold uppercase tracking-widest opacity-40">{selectedTaskId ? "Property Matrix" : "Global Settings"}</span>
              </div>
            </div>
            {selectedTaskId && (
              <button onClick={() => setSelectedTaskId(null)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-theme-muted hover:text-white transition-all">
                <X size={22} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-12 pb-20">
            {selectedTask ? (
              <>
                {/* Task-specific settings */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-theme-accent font-bold px-2">
                    <Layers size={16} />
                    <span className="text-[11px] tracking-[0.2em] uppercase">Core Identity</span>
                  </div>
                  <div className="space-y-6 bg-white/[0.02] border border-theme-border p-6 rounded-2xl">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Node Label</label>
                      <input className="input-apple !bg-black/60 font-black text-[15px] text-white" value={selectedTask.name} onChange={e => updateTask(selectedTask.id, 'name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">System</label>
                        <input className="input-apple !bg-black/60 font-black text-[13px] text-theme-accent" value={selectedTask.target_system} onChange={e => updateTask(selectedTask.id, 'target_system', e.target.value)} />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Protocol</label>
                        <select className="input-apple !bg-black/60 font-black text-[13px] text-white" value={selectedTask.interface_type} onChange={e => updateTask(selectedTask.id, 'interface_type', e.target.value)}>
                          <option value="GUI">GUI</option><option value="API">API</option><option value="DB">DB</option><option value="File">File</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-status-success font-bold px-2">
                    <Timer size={16} />
                    <span className="text-[11px] tracking-[0.2em] uppercase">Task Effort</span>
                  </div>
                  <div className="bg-theme-accent/[0.03] border border-theme-accent/20 p-8 rounded-2xl space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3 text-center">
                        <label className="text-[10px] font-black text-theme-accent uppercase tracking-widest">Touch</label>
                        <input type="number" className="input-apple !bg-black/80 font-black text-2xl text-white text-center h-20" value={selectedTask.active_touch_time_minutes} onChange={e => updateTask(selectedTask.id, 'active_touch_time_minutes', parseFloat(e.target.value))} />
                      </div>
                      <div className="space-y-3 text-center">
                        <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest">Wait</label>
                        <input type="number" className="input-apple !bg-black/80 font-black text-2xl text-theme-secondary text-center h-20" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTask.id, 'machine_wait_time_minutes', parseFloat(e.target.value))} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Global Workflow settings */}
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex flex-col items-center text-center p-8 bg-theme-accent/5 border border-theme-accent/10 rounded-3xl">
                    <div className="w-16 h-16 bg-theme-accent/10 rounded-2xl flex items-center justify-center text-theme-accent mb-6">
                      <Activity size={32} />
                    </div>
                    <h3 className="text-header-sub text-white">Operational Cadence</h3>
                    <p className="text-subtext mt-2">Adjust the execution frequency to recalculate total ROI yield.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-theme-accent font-bold px-2">
                      <Clock size={16} />
                      <span className="text-[11px] tracking-[0.2em] uppercase">Frequency Matrix</span>
                    </div>
                    
                    <div className="apple-card space-y-8 !bg-black/20 border-theme-border p-8">
                      <div className="flex items-center gap-6">
                        <div className="flex-1 space-y-3">
                          <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest">Executions</label>
                          <input 
                            type="number" 
                            step="0.1"
                            className="input-apple !bg-black/60 font-black text-3xl text-white text-center h-24 border-theme-accent/20 focus:border-theme-accent" 
                            value={metadata.cadence_count}
                            onChange={e => setMetadata({ ...metadata, cadence_count: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="w-32 space-y-3">
                          <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest">Unit</label>
                          <div className="h-24 bg-black/60 border border-theme-border rounded-2xl flex items-center justify-center">
                            <select 
                              className="bg-transparent text-white font-black text-center w-full h-full appearance-none cursor-pointer uppercase text-[12px]"
                              value={metadata.cadence_unit}
                              onChange={e => setMetadata({ ...metadata, cadence_unit: e.target.value })}
                            >
                              <option value="day">Day</option>
                              <option value="week">Week</option>
                              <option value="month">Month</option>
                              <option value="year">Year</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="apple-card !bg-status-success/5 border-status-success/20 p-8 space-y-4">
                    <div className="flex items-center gap-3 text-status-success font-black text-[11px] uppercase tracking-widest">
                      <Zap size={14} /> Efficiency Summary
                    </div>
                    <p className="text-main-content opacity-70">
                      Based on current {tasks.length} node(s) and {metadata.cadence_count}/{metadata.cadence_unit} execution cadence.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-8 border-t border-theme-border bg-white/[0.03] backdrop-blur-3xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2">Total Monthly ROI</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tracking-tighter">
                  {totalWorkflowROI}
                </span>
                <span className="text-[12px] font-black text-theme-accent uppercase tracking-widest">Hours</span>
              </div>
            </div>
            <button className="btn-apple-secondary !px-8 !py-4 flex items-center gap-3 font-bold text-[13px] hover:bg-white/10 hover:border-white/20 group">
              <FileText size={18} className="group-hover:text-theme-accent transition-colors" /> SOP Export
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
