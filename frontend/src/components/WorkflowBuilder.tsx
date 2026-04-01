import React, { useState, useEffect } from 'react';
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
  ShieldAlert, Timer
} from 'lucide-react';

interface Blocker {
  id?: string | number;
  blocking_entity: string;
  reason: string;
  average_delay_minutes: number;
  standard_mitigation: string;
}

interface Task {
  id: string | number;
  name: string;
  description: string;
  target_system: string;
  tat_minutes: number;
  occurrences_per_cycle: number;
  potential_mistakes: string;
  error_probability: number;
  recovery_time_minutes: number;
  order_index: number;
  blockers?: Blocker[];
}

interface WorkflowBuilderProps {
  initialTasks: Task[];
  onSave: (tasks: Task[]) => void;
}

// --- High-Density Matrix Node ---
const MatrixNode = ({ data }: { data: { label: string, system: string, tat: number, risk: number } }) => (
  <div className="bg-theme-card border border-theme-border rounded px-3 py-2 min-w-[180px] shadow-lg hover:border-theme-accent transition-colors">
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between border-b border-theme-border pb-1 opacity-60">
        <span className="text-[8px] font-black text-theme-secondary uppercase tracking-tighter">{data.system || "LOCAL"}</span>
        <span className="text-[8px] font-mono font-bold text-theme-accent">{data.tat}m</span>
      </div>
      <h4 className="text-[11px] font-bold text-white truncate uppercase tracking-tight">{data.label}</h4>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full ${data.risk > 15 ? 'bg-status-error' : 'bg-status-success'}`} style={{ width: `${Math.min(100, data.risk)}%` }} />
        </div>
        <span className="text-[8px] font-mono text-theme-muted">{data.risk}%</span>
      </div>
    </div>
    <Handle type="target" position={Position.Top} className="!bg-theme-border !w-1.5 !h-1.5" />
    <Handle type="source" position={Position.Bottom} className="!bg-theme-accent !w-1.5 !h-1.5" />
  </div>
);

const nodeTypes = { matrix: MatrixNode };

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 40, marginy: 40, nodesep: 40, ranksep: 60 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 180, height: 60 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const n = dagreGraph.node(node.id);
    node.position = { x: n.x - 90, y: n.y - 30 };
  });
  return { nodes, edges };
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, onSave }) => {
  const [view, setView] = useState<'list' | 'flow'>('list');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTask, setExpandedTask] = useState<string | number | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const newNodes: Node[] = tasks.map((t) => ({
      id: `${t.id}`,
      type: 'matrix',
      data: { label: t.name, system: t.target_system, tat: t.tat_minutes, risk: t.error_probability },
      position: { x: 0, y: 0 },
    }));
    const newEdges: Edge[] = [];
    for (let i = 0; i < tasks.length - 1; i++) {
      newEdges.push({
        id: `e${tasks[i].id}-${tasks[i+1].id}`,
        source: `${tasks[i].id}`,
        target: `${tasks[i+1].id}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252', width: 14, height: 14 },
        style: { stroke: '#525252', strokeWidth: 2 }
      });
    }
    const { nodes: ln, edges: le } = getLayoutedElements(newNodes, newEdges);
    setNodes(ln);
    setEdges(le);
  }, [tasks]);

  const updateTask = (id: string | number, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addBlocker = (taskId: string | number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, blockers: [...(t.blockers || []), { blocking_entity: 'PIE', reason: '', average_delay_minutes: 0, standard_mitigation: '' }] } : t));
  };

  return (
    <div className="bg-theme-card border border-theme-border flex flex-col h-[700px] rounded overflow-hidden">
      {/* Precision Toolbar */}
      <div className="h-10 border-b border-theme-border flex items-center justify-between px-4 bg-theme-header">
        <div className="flex items-center gap-3">
          <LucideWorkflow size={14} className="text-theme-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-theme-secondary opacity-80">Logic_Architect_Mode</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 border border-theme-border p-0.5 rounded">
            <button onClick={() => setView('list')} className={`px-3 py-1 text-[9px] font-black uppercase rounded ${view === 'list' ? 'bg-theme-primary text-black' : 'text-theme-secondary hover:text-white'}`}>Matrix</button>
            <button onClick={() => setView('flow')} className={`px-3 py-1 text-[9px] font-black uppercase rounded ${view === 'flow' ? 'bg-theme-primary text-black' : 'text-theme-secondary hover:text-white'}`}>Graph</button>
          </div>
          <button onClick={() => onSave(tasks)} className="bg-theme-accent text-white px-4 py-1 text-[9px] font-black uppercase rounded flex items-center gap-2 hover:opacity-90">
            <Save size={12} /> Commit_State
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'list' ? (
          <div className="flex-1 overflow-auto p-4 custom-scrollbar space-y-1.5">
            {tasks.map((task, index) => (
              <div key={task.id} className="border border-theme-border bg-white/[0.01] rounded-sm">
                <div 
                  className="flex items-center gap-4 px-3 py-1.5 cursor-pointer hover:bg-white/[0.03]"
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                >
                  <span className="text-[10px] font-mono text-theme-muted font-bold">{String(index + 1).padStart(2, '0')}</span>
                  <div className="flex-1 flex items-center gap-4">
                    <span className="text-[11px] font-bold text-theme-primary uppercase truncate max-w-[250px]">{task.name || "UNNAMED_NODE"}</span>
                    <span className="text-[9px] font-mono text-theme-accent bg-theme-accent/5 border border-theme-accent/10 px-1.5 rounded">{task.target_system || "LOCAL"}</span>
                    <div className="flex items-center gap-3 opacity-40">
                      <span className="text-[9px] font-mono flex items-center gap-1"><Timer size={10} /> {task.tat_minutes}m</span>
                      <span className="text-[9px] font-mono flex items-center gap-1"><ShieldAlert size={10} /> {task.error_probability}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="text-theme-muted hover:text-status-error"><Trash2 size={12} /></button>
                    <ChevronDown size={14} className={`text-theme-muted transition-transform ${expandedTask === task.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {expandedTask === task.id && (
                  <div className="p-4 border-t border-theme-border grid grid-cols-1 md:grid-cols-3 gap-6 bg-black/40">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Identification</label>
                        <input className="input-apple font-bold uppercase" value={task.name} onChange={e => updateTask(task.id, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Environment</label>
                        <input className="input-apple font-mono" value={task.target_system} onChange={e => updateTask(task.id, 'target_system', e.target.value)} />
                      </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">TAT_MIN</label>
                            <input type="number" className="input-apple font-mono" value={task.tat_minutes} onChange={e => updateTask(task.id, 'tat_minutes', parseFloat(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">RISK_%</label>
                            <input type="number" className="input-apple font-mono text-status-error" value={task.error_probability} onChange={e => updateTask(task.id, 'error_probability', parseFloat(e.target.value))} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Technical_SOP</label>
                          <textarea className="input-apple h-20 resize-none leading-tight" value={task.description} onChange={e => updateTask(task.id, 'description', e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2 border-l border-theme-border pl-6">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black text-status-error uppercase tracking-widest">Structural_Blockers</span>
                          <button onClick={() => addBlocker(task.id)} className="text-[9px] font-bold text-theme-accent hover:underline">+ REGISTER</button>
                        </div>
                        <div className="space-y-2 overflow-auto max-h-[140px] custom-scrollbar pr-1">
                          {task.blockers?.map((b, bi) => (
                            <div key={bi} className="bg-white/5 p-2 rounded-sm border border-white/5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <select className="bg-theme-bg text-[9px] font-bold text-theme-accent border-none outline-none" value={b.blocking_entity} onChange={e => {
                                  const nb = [...(task.blockers || [])];
                                  nb[bi] = { ...nb[bi], blocking_entity: e.target.value };
                                  updateTask(task.id, 'blockers', nb);
                                }}>
                                  <option value="PIE">PIE</option><option value="YE">YE</option><option value="IT">IT</option><option value="VENDOR">VENDOR</option>
                                </select>
                                <button className="text-theme-muted hover:text-status-error" onClick={() => {
                                  const nb = [...(task.blockers || [])];
                                  nb.splice(bi, 1);
                                  updateTask(task.id, 'blockers', nb);
                                }}><Trash2 size={10} /></button>
                              </div>
                              <input className="bg-transparent border-b border-white/5 text-[9px] text-white w-full outline-none py-0.5" placeholder="ROOT_REASON..." value={b.reason} onChange={e => {
                                const nb = [...(task.blockers || [])];
                                nb[bi] = { ...nb[bi], reason: e.target.value };
                                updateTask(task.id, 'blockers', nb);
                              }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setTasks([...tasks, { id: `new-${Date.now()}`, name: 'NEW_OP_NODE', description: '', target_system: '', tat_minutes: 0, occurrences_per_cycle: 1, potential_mistakes: '', error_probability: 0, recovery_time_minutes: 0, order_index: tasks.length, blockers: [] }])} 
              className="w-full py-3 border border-dashed border-theme-border rounded hover:border-theme-accent text-[9px] font-black uppercase tracking-widest text-theme-muted hover:text-theme-accent transition-all">+ Register_Operation_Node</button>
          </div>
        ) : (
          <div className="flex-1 bg-[#050505] relative">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView className="bg-transparent">
              <Background variant={BackgroundVariant.Lines} color="#111" gap={20} />
              <Controls />
            </ReactFlow>
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
