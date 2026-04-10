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
  Terminal, FileCode, Cpu, Activity, Info, Link as LinkIcon
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
  onSave: (tasks: Task[]) => void;
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
          className="h-full bg-theme-accent shadow-[0_0_12px_rgba(0,122,255,0.6)] transition-all duration-700 ease-out" 
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

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, onSave }) => {
  const [view, setView] = useState<'table' | 'flow' | 'grid'>('table');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
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

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-theme-border bg-[#05070a]">
      {/* Precision Toolbar */}
      <div className="h-16 border-b border-theme-border flex items-center justify-between px-8 bg-white/[0.02] backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-theme-accent/10 rounded-xl border border-theme-accent/20">
            <LucideWorkflow size={18} className="text-theme-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-black text-white tracking-tight">Strategy Architect</span>
            <span className="text-[10px] text-theme-muted font-bold uppercase tracking-[0.2em] opacity-40">Logic Engine v1.2.6</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-black/40 p-1 rounded-full border border-theme-border">
            {['table', 'flow'].map((v) => (
              <button 
                key={v}
                onClick={() => setView(v as any)} 
                className={`px-6 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${view === v ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks)} className="btn-apple-primary flex items-center gap-2.5 px-8 !py-2.5 !text-[12px] font-bold shadow-theme-accent/20 shadow-lg">
            <Save size={16} /> Sync Changes
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {view === 'table' ? (
            <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-4 bg-black/20">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`border transition-all duration-300 rounded-2xl group ${selectedTaskId === task.id ? 'border-theme-accent bg-theme-accent/[0.04] shadow-[0_0_30px_rgba(0,122,255,0.1)] scale-[1.01]' : 'border-theme-border bg-white/[0.01] hover:bg-white/[0.03] hover:border-theme-border-bright'}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-8 px-8 py-5 cursor-pointer">
                    <span className="text-[11px] font-black text-theme-muted group-hover:text-theme-accent transition-colors w-8">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 flex items-center gap-12">
                      <div className="flex flex-col min-w-[280px]">
                        <span className="text-[15px] font-black text-white tracking-tight group-hover:text-theme-accent transition-colors truncate">{task.name || "Untitled Operation"}</span>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest">{task.target_system || "Local"}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest">{task.interface_type || "GUI"}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-12 border-l border-white/5 pl-12">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 opacity-50">Touch Time</span>
                          <span className="text-[16px] font-black text-white">{task.active_touch_time_minutes}<span className="text-[10px] ml-1 text-theme-muted">m</span></span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2 opacity-50">Wait Time</span>
                          <span className="text-[16px] font-black text-theme-secondary">{task.machine_wait_time_minutes}<span className="text-[10px] ml-1 text-theme-muted">m</span></span>
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-4 justify-end pr-8">
                        {task.risks_yield_scrap && (
                          <div className="p-2 bg-status-error/10 rounded-xl text-status-error border border-status-error/20 animate-pulse">
                            <AlertTriangle size={16} />
                          </div>
                        )}
                        {task.blockers && task.blockers.length > 0 && (
                          <span className="px-3 py-1 bg-status-warning/10 text-status-warning text-[10px] font-black rounded-lg border border-status-warning/20 flex items-center gap-2">
                            <ShieldAlert size={12} /> {task.blockers.length} ISSUES
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="w-9 h-9 flex items-center justify-center rounded-xl text-theme-muted hover:bg-status-error/10 hover:text-status-error transition-all border border-transparent hover:border-status-error/20"><Trash2 size={16} /></button>
                      <ChevronDown size={22} className={`text-theme-muted transition-transform duration-500 ${selectedTaskId === task.id ? 'rotate-180 text-theme-accent' : 'group-hover:text-white'}`} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setTasks([...tasks, { id: `new-${Date.now()}`, name: 'New Operation Node', description: '', target_system: 'SME_LOCAL', interface_type: 'GUI', active_touch_time_minutes: 0, machine_wait_time_minutes: 0, occurrences_per_cycle: 1, shadow_it_used: false, risks_yield_scrap: false, order_index: tasks.length, blockers: [], errors: [] }])} 
                className="w-full py-8 border-2 border-dashed border-theme-border rounded-2xl hover:border-theme-accent/50 hover:bg-theme-accent/[0.03] text-[12px] font-black text-theme-muted hover:text-theme-accent transition-all group flex items-center justify-center gap-4 uppercase tracking-[0.2em]">
                <Zap size={18} className="group-hover:scale-125 transition-transform text-theme-accent" /> Register New Operation Node
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#020305] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onNodeClick={onNodeClick}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Dots} color="rgba(0,122,255,0.1)" gap={40} size={1} />
                <Controls className="!bg-[#05070a] !border-theme-border !shadow-2xl" />
              </ReactFlow>
            </div>
          )}
        </div>

        {/* Right-Side Property Inspector (Linear Overhaul) */}
        {selectedTaskId && selectedTask && (
          <div className="w-[520px] border-l border-theme-border bg-[#0a0c10]/80 backdrop-blur-3xl flex flex-col animate-in slide-in-from-right duration-500 z-30 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-8 border-b border-theme-border bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-theme-accent/10 rounded-xl border border-theme-accent/20">
                  <Cpu size={20} className="text-theme-accent" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-black text-white">Node Inspector</span>
                  <span className="text-[10px] text-theme-muted font-bold uppercase tracking-widest opacity-40">Property Matrix</span>
                </div>
              </div>
              <button onClick={() => setSelectedTaskId(null)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-theme-muted hover:text-white transition-all">
                <X size={22} />
              </button>
            </div>

            {/* Linear Property List */}
            <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-12 pb-20">
              
              {/* Section: Core Identity */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-theme-accent font-bold px-2">
                  <Layers size={16} />
                  <span className="text-[11px] tracking-[0.2em] uppercase">Core Identity</span>
                </div>
                <div className="space-y-6 bg-white/[0.02] border border-theme-border p-6 rounded-2xl shadow-inner">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Operation Label</label>
                    <input className="input-apple !bg-black/60 font-black text-[15px] text-white focus:border-theme-accent" value={selectedTask.name} onChange={e => updateTask(selectedTask.id, 'name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Target Infrastructure</label>
                      <input className="input-apple !bg-black/60 font-black text-[13px] text-theme-accent" value={selectedTask.target_system} onChange={e => updateTask(selectedTask.id, 'target_system', e.target.value)} />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Interface Protocol</label>
                      <div className="relative">
                        <select className="input-apple !bg-black/60 font-black text-[13px] text-white appearance-none pr-10 focus:border-theme-accent" value={selectedTask.interface_type} onChange={e => updateTask(selectedTask.id, 'interface_type', e.target.value)}>
                          <option value="GUI">GUI (User Interface)</option>
                          <option value="API">API (REST/SOAP)</option>
                          <option value="DB">Database (SQL)</option>
                          <option value="File">Local File (CSV/XML)</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Operational Cadence */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-status-success font-bold px-2">
                  <Timer size={16} />
                  <span className="text-[11px] tracking-[0.2em] uppercase">Operational Cadence</span>
                </div>
                <div className="bg-theme-accent/[0.03] border border-theme-accent/20 p-8 rounded-2xl shadow-inner space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-theme-accent uppercase tracking-widest px-1">Active Touch</label>
                      <div className="relative">
                        <input type="number" className="input-apple !bg-black/80 font-black text-2xl text-white text-center h-20 !pt-6 border-theme-accent/30 focus:border-theme-accent" value={selectedTask.active_touch_time_minutes} onChange={e => updateTask(selectedTask.id, 'active_touch_time_minutes', parseFloat(e.target.value))} />
                        <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-black text-theme-accent uppercase tracking-widest opacity-40">MINUTES</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Machine Wait</label>
                      <div className="relative">
                        <input type="number" className="input-apple !bg-black/80 font-black text-2xl text-theme-secondary text-center h-20 !pt-6 border-white/5 focus:border-theme-secondary" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTask.id, 'machine_wait_time_minutes', parseFloat(e.target.value))} />
                        <span className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-black text-theme-secondary uppercase tracking-widest opacity-40">MINUTES</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest px-1 flex items-center justify-between">
                      <span>Occurrences Per Cycle</span>
                      <span className="text-theme-accent opacity-60">Linear Scaling</span>
                    </label>
                    <input type="number" className="input-apple !bg-black/80 font-black text-xl text-center h-16 border-white/5" value={selectedTask.occurrences_per_cycle} onChange={e => updateTask(selectedTask.id, 'occurrences_per_cycle', parseInt(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Section: Data Pipeline */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-theme-secondary font-bold px-2">
                  <Database size={16} />
                  <span className="text-[11px] tracking-[0.2em] uppercase">Data Pipeline</span>
                </div>
                <div className="space-y-8 bg-white/[0.01] border border-theme-border p-6 rounded-2xl">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1 flex items-center gap-2">
                      <Activity size={12} className="text-theme-accent" /> Source Inputs
                    </label>
                    <textarea className="input-apple !bg-black/60 h-32 resize-none leading-relaxed font-mono text-[12px] text-white focus:border-theme-accent placeholder:text-white/5" placeholder="Define origin of inputs or link upstream..." value={selectedTask.source_data} onChange={e => updateTask(selectedTask.id, 'source_data', e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1 flex items-center gap-2">
                      <FileCode size={12} className="text-theme-accent" /> Output Schema Example
                    </label>
                    <textarea className="input-apple !bg-black/60 h-32 resize-none leading-relaxed font-mono text-[12px] text-white focus:border-theme-accent placeholder:text-white/5" placeholder="Paste sample return value or format..." value={selectedTask.output_format_example} onChange={e => updateTask(selectedTask.id, 'output_format_example', e.target.value)} />
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="flex items-center justify-between cursor-pointer group p-4 rounded-2xl bg-white/[0.02] border border-theme-border transition-all hover:bg-white/[0.04] hover:border-theme-accent/30">
                      <span className="text-[12px] font-black text-white flex items-center gap-3">
                        <Terminal size={18} className="text-theme-accent" /> Shadow IT Redundancy
                      </span>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={selectedTask.shadow_it_used} onChange={e => updateTask(selectedTask.id, 'shadow_it_used', e.target.checked)} />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                      </div>
                    </label>
                    {selectedTask.shadow_it_used && (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <input className="input-apple !bg-black/80 font-mono text-[11px] text-theme-accent pl-10 border-theme-accent/20" placeholder="https://internal-repo.samsung.net/..." value={selectedTask.shadow_it_link} onChange={e => updateTask(selectedTask.id, 'shadow_it_link', e.target.value)} />
                          <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-accent/50" size={14} />
                        </div>
                        <p className="text-[10px] text-theme-muted font-bold normal-case px-2 opacity-50">Link to existing scripts or macros currently handling this logic.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Scrap Risk & Blockers */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-status-error font-bold px-2">
                  <ShieldAlert size={16} />
                  <span className="text-[11px] tracking-[0.2em] uppercase">Security & Risk</span>
                </div>
                
                <div className="space-y-8">
                  <div className="bg-status-error/[0.03] border border-status-error/20 p-8 rounded-2xl shadow-inner space-y-8">
                    <div className="flex items-center justify-between border-b border-status-error/10 pb-6">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-black text-white flex items-center gap-2"><AlertTriangle size={16} className="text-status-error" /> Yield Scrap Risk</span>
                        <span className="text-[10px] text-theme-muted font-bold normal-case mt-1 opacity-60">Does failure result in hardware loss?</span>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={selectedTask.risks_yield_scrap} onChange={e => updateTask(selectedTask.id, 'risks_yield_scrap', e.target.checked)} />
                        <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-status-error"></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-theme-secondary uppercase tracking-widest px-1">Tribal Knowledge & System Quirks</label>
                      <textarea className="input-apple !bg-black/80 h-32 resize-none leading-relaxed text-[13px] text-white focus:border-status-error placeholder:text-white/5" placeholder="Undocumented system quirks or module folklore..." value={selectedTask.tribal_knowledge} onChange={e => updateTask(selectedTask.id, 'tribal_knowledge', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-6 bg-white/[0.01] border border-theme-border p-6 rounded-2xl">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-[11px] font-black text-white tracking-[0.2em] uppercase flex items-center gap-3">
                         <Box size={14} className="text-status-warning" /> Structural Blockers
                      </h4>
                      <button onClick={() => addBlocker(selectedTask.id)} className="text-[10px] font-black text-theme-accent hover:text-white transition-all bg-theme-accent/10 px-3 py-1.5 rounded-lg border border-theme-accent/20">+ REGISTER</button>
                    </div>
                    <div className="space-y-4">
                      {selectedTask.blockers?.map((b, bi) => (
                        <div key={bi} className="bg-black/60 border border-theme-border p-5 rounded-2xl space-y-5 relative group hover:border-status-warning/40 transition-all shadow-xl animate-in slide-in-from-right-4">
                          <button onClick={() => {
                            const nb = [...(selectedTask.blockers || [])];
                            nb.splice(bi, 1);
                            updateTask(selectedTask.id, 'blockers', nb);
                          }} className="absolute top-4 right-4 text-theme-muted hover:text-status-error transition-all p-1.5 hover:bg-status-error/10 rounded-lg"><Trash2 size={16} /></button>
                          
                          <div className="flex items-center gap-5">
                            <div className="flex-1 space-y-2.5">
                              <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Entity</label>
                              <div className="relative">
                                <select className="input-apple !bg-black font-black text-[12px] text-status-warning appearance-none pr-10 border-status-warning/20" value={b.blocking_entity} onChange={e => {
                                  const nb = [...(selectedTask.blockers || [])];
                                  nb[bi] = { ...nb[bi], blocking_entity: e.target.value };
                                  updateTask(selectedTask.id, 'blockers', nb);
                                }}>
                                  <option value="PIE">PIE</option><option value="YE">YE</option><option value="MODULE">Module</option><option value="IT">IT/Network</option><option value="VENDOR">Vendor</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-status-warning/50" size={12} />
                              </div>
                            </div>
                            <div className="flex-1 space-y-2.5">
                              <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Avg Delay</label>
                              <div className="relative">
                                <input type="number" className="input-apple !bg-black font-black text-[13px] text-white pr-10 border-white/5" value={b.average_delay_minutes} onChange={e => {
                                  const nb = [...(selectedTask.blockers || [])];
                                  nb[bi] = { ...nb[bi], average_delay_minutes: parseFloat(e.target.value) };
                                  updateTask(selectedTask.id, 'blockers', nb);
                                }} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-theme-muted uppercase">min</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                             <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Root Cause Reason</label>
                             <input className="input-apple !bg-black text-[13px] text-white border-white/5 focus:border-status-warning/50" placeholder="Describe the structural bottleneck..." value={b.reason} onChange={e => {
                              const nb = [...(selectedTask.blockers || [])];
                              nb[bi] = { ...nb[bi], reason: e.target.value };
                              updateTask(selectedTask.id, 'blockers', nb);
                            }} />
                          </div>
                        </div>
                      ))}
                      {(!selectedTask.blockers || selectedTask.blockers.length === 0) && (
                        <div className="py-10 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-20">
                          <Info size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">No Active Blockers</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Footer (Enhanced) */}
            <div className="p-8 border-t border-theme-border bg-white/[0.03] backdrop-blur-3xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-theme-muted uppercase tracking-[0.2em] mb-2">Projected ROI Reclaimed</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tighter">
                    {((selectedTask.active_touch_time_minutes * selectedTask.occurrences_per_cycle) + (selectedTask.errors?.reduce((acc, e) => acc + (e.probability_percent / 100 * e.recovery_time_minutes), 0) || 0)).toFixed(1)}
                  </span>
                  <span className="text-[12px] font-black text-theme-accent uppercase tracking-widest">min / cycle</span>
                </div>
              </div>
              <button className="btn-apple-secondary !px-8 !py-4 flex items-center gap-3 font-bold text-[13px] hover:bg-white/10 hover:border-white/20 group">
                <FileText size={18} className="group-hover:text-theme-accent transition-colors" /> Export SOP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (
  <ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
