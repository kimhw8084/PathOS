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
  ShieldAlert, Timer, Database, Box, Cpu, AlertTriangle, 
  Layers, Link2, FileText, Image, Info, X, Zap,
  Network, Terminal, FileCode
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
  <div className={`bg-theme-card border ${data.risks ? 'border-status-error/40 shadow-[0_0_10px_rgba(var(--status-error-rgb),0.1)]' : 'border-theme-border'} rounded px-3 py-2 min-w-[200px] shadow-lg hover:border-theme-accent transition-all group relative`}>
    {data.risks && <div className="absolute -top-1.5 -right-1.5 bg-status-error text-white rounded-full p-0.5"><AlertTriangle size={8} /></div>}
    {data.blockers > 0 && <div className="absolute -top-1.5 -left-1.5 bg-status-warning text-black font-black text-[8px] px-1 rounded-sm border border-black/10">🛑 {data.blockers}</div>}
    
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between border-b border-theme-border pb-1 opacity-60">
        <span className="text-[8px] font-black text-theme-secondary uppercase tracking-tighter">{data.system || "LOCAL"}</span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono font-bold text-theme-accent">{data.touch}m</span>
          <span className="text-[8px] font-mono font-bold text-theme-muted">{data.wait}m</span>
        </div>
      </div>
      <h4 className="text-[11px] font-bold text-white truncate uppercase tracking-tight group-hover:text-theme-accent transition-colors">{data.label}</h4>
      <div className="flex items-center gap-1">
        <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-theme-accent" style={{ width: `${Math.min(100, (data.touch / (data.touch + data.wait + 0.1)) * 100)}%` }} />
        </div>
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
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 40, marginy: 40, nodesep: 50, ranksep: 70 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 200, height: 70 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const n = dagreGraph.node(node.id);
    node.position = { x: n.x - 100, y: n.y - 35 };
  });
  return { nodes, edges };
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, onSave }) => {
  const [view, setView] = useState<'table' | 'flow' | 'grid'>('table');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState('execution');
  
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
        markerEnd: { type: MarkerType.ArrowClosed, color: '#444', width: 14, height: 14 },
        style: { stroke: '#444', strokeWidth: 2 }
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

  const addError = (taskId: string | number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, errors: [...(t.errors || []), { error_type: 'Human Error', description: '', probability_percent: 5, recovery_time_minutes: 10 }] } : t));
  };

  const onNodeClick = (_: any, node: Node) => {
    setSelectedTaskId(node.id);
  };

  return (
    <div className="bg-theme-card border border-theme-border flex flex-col h-[800px] rounded-lg overflow-hidden shadow-2xl relative">
      {/* Precision Toolbar */}
      <div className="h-12 border-b border-theme-border flex items-center justify-between px-6 bg-theme-header">
        <div className="flex items-center gap-4">
          <LucideWorkflow size={16} className="text-theme-accent" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Strategy_Architect</span>
            <span className="text-[8px] font-mono text-theme-muted uppercase tracking-widest">v1.2.6_Engine_Active</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 border border-theme-border p-1 rounded-sm gap-1">
            <button onClick={() => setView('table')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-xs transition-all ${view === 'table' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}>Table</button>
            <button onClick={() => setView('flow')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-xs transition-all ${view === 'flow' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}>Diagram</button>
            <button onClick={() => setView('grid')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-xs transition-all ${view === 'grid' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}>Grid</button>
          </div>
          <button onClick={() => onSave(tasks)} className="bg-theme-accent text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.2)] hover:scale-[1.02] transition-all flex items-center gap-2">
            <Save size={14} /> Commit_Strategy
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'table' ? (
            <div className="flex-1 overflow-auto p-6 custom-scrollbar space-y-2 bg-[#050505]/50">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`border transition-all ${selectedTaskId === task.id ? 'border-theme-accent bg-theme-accent/5' : 'border-theme-border bg-white/[0.01] hover:border-theme-border-bright hover:bg-white/[0.03]'} rounded-md`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-6 px-4 py-3 cursor-pointer">
                    <span className="text-[11px] font-black font-mono text-theme-muted">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 flex items-center gap-6">
                      <div className="flex flex-col min-w-[200px]">
                        <span className="text-[12px] font-black text-white uppercase tracking-tight truncate">{task.name || "UNNAMED_OPERATION"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-theme-accent uppercase tracking-widest opacity-80">{task.target_system || "LOCAL"}</span>
                          <span className="text-[9px] font-mono text-theme-muted opacity-40">/</span>
                          <span className="text-[9px] font-black text-theme-secondary uppercase tracking-tighter opacity-60">{task.interface_type || "GUI"}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8 border-l border-theme-border pl-8 h-8">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">Touch_T</span>
                          <span className="text-[11px] font-mono font-bold text-theme-accent">{task.active_touch_time_minutes}m</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">Wait_T</span>
                          <span className="text-[11px] font-mono font-bold text-theme-secondary">{task.machine_wait_time_minutes}m</span>
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-3">
                        {task.risks_yield_scrap && <AlertTriangle size={14} className="text-status-error" />}
                        {task.blockers && task.blockers.length > 0 && (
                          <span className="text-[9px] font-black text-status-warning bg-status-warning/10 border border-status-warning/20 px-2 py-0.5 rounded">🛑 {task.blockers.length} BLOCKERS</span>
                        )}
                        {task.shadow_it_used && <Link2 size={14} className="text-theme-accent" />}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="p-2 text-theme-muted hover:text-status-error transition-colors"><Trash2 size={14} /></button>
                      <ChevronDown size={18} className={`text-theme-muted transition-transform ${selectedTaskId === task.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setTasks([...tasks, { id: `new-${Date.now()}`, name: 'NEW_OP_NODE', description: '', target_system: 'SME_LOCAL', interface_type: 'GUI', active_touch_time_minutes: 0, machine_wait_time_minutes: 0, occurrences_per_cycle: 1, shadow_it_used: false, risks_yield_scrap: false, order_index: tasks.length, blockers: [], errors: [] }])} 
                className="w-full py-4 border border-dashed border-theme-border rounded-lg hover:border-theme-accent hover:bg-theme-accent/5 text-[11px] font-black uppercase tracking-[0.2em] text-theme-muted hover:text-theme-accent transition-all group flex items-center justify-center gap-2">
                <Zap size={14} className="group-hover:animate-pulse" /> Register_New_Operation_Node
              </button>
            </div>
          ) : view === 'flow' ? (
            <div className="flex-1 bg-[#050505] relative">
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
                <Background variant={BackgroundVariant.Dots} color="#222" gap={24} size={1} />
                <Controls />
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center opacity-20">
              <Layers size={48} className="text-theme-muted mb-4" />
              <p className="text-xl font-black uppercase tracking-[0.5em]">Grid_Engine_Offline</p>
            </div>
          )}
        </div>

        {/* Right-Side Data Drawer (Task Node Drawer) */}
        {selectedTaskId && selectedTask && (
          <div className="w-[450px] border-l border-theme-border bg-theme-sidebar flex flex-col animate-in slide-in-from-right duration-300 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            <div className="h-14 flex items-center justify-between px-6 border-b border-theme-border bg-theme-header">
              <div className="flex items-center gap-3">
                <Box size={16} className="text-theme-accent" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Node_Property_Inspector</span>
                  <span className="text-[8px] font-mono text-theme-muted uppercase tracking-tighter truncate max-w-[200px]">{selectedTask.name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTaskId(null)} className="text-theme-muted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-theme-border p-1 bg-black/20">
              <button onClick={() => setActiveTab('execution')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded transition-all ${activeTab === 'execution' ? 'bg-white/10 text-theme-accent shadow-inner' : 'text-theme-muted hover:text-theme-secondary'}`}>Execution & ROI</button>
              <button onClick={() => setActiveTab('data')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded transition-all ${activeTab === 'data' ? 'bg-white/10 text-theme-accent shadow-inner' : 'text-theme-muted hover:text-theme-secondary'}`}>Data & Lineage</button>
              <button onClick={() => setActiveTab('corner')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded transition-all ${activeTab === 'corner' ? 'bg-white/10 text-theme-accent shadow-inner' : 'text-theme-muted hover:text-theme-secondary'}`}>Corners & Risks</button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-6">
              {activeTab === 'execution' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Info size={10} /> Task_Identity</label>
                      <input className="input-apple font-bold uppercase tracking-tight" value={selectedTask.name} onChange={e => updateTask(selectedTask.id, 'name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Cpu size={10} /> Target_System</label>
                        <input className="input-apple font-bold text-theme-accent uppercase" value={selectedTask.target_system} onChange={e => updateTask(selectedTask.id, 'target_system', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Network size={10} /> Interface</label>
                        <select className="input-apple font-bold text-theme-secondary uppercase bg-theme-card" value={selectedTask.interface_type} onChange={e => updateTask(selectedTask.id, 'interface_type', e.target.value)}>
                          <option value="GUI">GUI</option><option value="API">API</option><option value="DB">Database</option><option value="File">Local File</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-theme-border p-4 rounded-md space-y-4">
                    <div className="flex items-center justify-between border-b border-theme-border pb-2">
                      <span className="text-[10px] font-black text-theme-accent uppercase tracking-widest flex items-center gap-2"><Timer size={14} /> Metric_Analysis</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Active_Touch_Min</label>
                        <input type="number" className="input-apple font-mono text-theme-accent font-black text-lg" value={selectedTask.active_touch_time_minutes} onChange={e => updateTask(selectedTask.id, 'active_touch_time_minutes', parseFloat(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Machine_Wait_Min</label>
                        <input type="number" className="input-apple font-mono text-theme-secondary font-black text-lg" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTask.id, 'machine_wait_time_minutes', parseFloat(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest">Occurrences_Per_Cycle</label>
                      <input type="number" className="input-apple font-mono font-black" value={selectedTask.occurrences_per_cycle} onChange={e => updateTask(selectedTask.id, 'occurrences_per_cycle', parseInt(e.target.value))} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[10px] font-black text-theme-secondary uppercase tracking-widest flex items-center gap-2 group-hover:text-theme-accent transition-colors">
                        <Terminal size={14} /> Shadow_IT_Redundancy
                      </span>
                      <input type="checkbox" className="w-4 h-4 accent-theme-accent" checked={selectedTask.shadow_it_used} onChange={e => updateTask(selectedTask.id, 'shadow_it_used', e.target.checked)} />
                    </label>
                    {selectedTask.shadow_it_used && (
                      <div className="space-y-1.5 animate-in slide-in-from-top duration-200">
                        <input className="input-apple font-mono text-[10px] text-theme-accent" placeholder="https://s2github.samsungds.net/..." value={selectedTask.shadow_it_link} onChange={e => updateTask(selectedTask.id, 'shadow_it_link', e.target.value)} />
                        <p className="text-[8px] text-theme-muted uppercase font-bold tracking-tighter">Enter repository or file path for existing scripts/macros</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Database size={10} /> Source_Data_Input</label>
                    <textarea className="input-apple h-24 resize-none leading-tight font-mono text-[11px]" placeholder="Define origin of inputs or link to upstream task..." value={selectedTask.source_data} onChange={e => updateTask(selectedTask.id, 'source_data', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><FileCode size={10} /> Output_Format_Example</label>
                    <textarea className="input-apple h-24 resize-none leading-tight font-mono text-[11px]" placeholder="Paste sample return value or format..." value={selectedTask.output_format_example} onChange={e => updateTask(selectedTask.id, 'output_format_example', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={10} /> Post-Task_Verification</label>
                    <textarea className="input-apple h-20 resize-none leading-tight text-[11px]" placeholder="The human unit test to confirm success..." value={selectedTask.post_task_verification} onChange={e => updateTask(selectedTask.id, 'post_task_verification', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Image size={10} /> Media_Assets</label>
                    <div className="border-2 border-dashed border-theme-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:border-theme-accent hover:bg-theme-accent/5 transition-all cursor-pointer">
                      <Image size={24} className="text-theme-muted" />
                      <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Drop_UI_Screenshots</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'corner' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-theme-border pb-2">
                      <span className="text-[10px] font-black text-status-error uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14} /> Risk_Assessment</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[9px] font-black text-theme-muted uppercase">Yield_Risk</span>
                        <input type="checkbox" className="accent-status-error" checked={selectedTask.risks_yield_scrap} onChange={e => updateTask(selectedTask.id, 'risks_yield_scrap', e.target.checked)} />
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest flex items-center gap-2"><Info size={10} /> Tribal_Knowledge</label>
                      <textarea className="input-apple h-20 resize-none leading-tight text-[11px] border-status-error/10 bg-status-error/[0.01]" placeholder="Undocumented system quirks or module folklore..." value={selectedTask.tribal_knowledge} onChange={e => updateTask(selectedTask.id, 'tribal_knowledge', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-status-error uppercase tracking-widest">Structural_Blockers</h4>
                      <button onClick={() => addBlocker(selectedTask.id)} className="text-[9px] font-black text-theme-accent hover:underline">+ REGISTER</button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                      {selectedTask.blockers?.map((b, bi) => (
                        <div key={bi} className="bg-white/5 border border-theme-border p-3 rounded-md space-y-2 relative group">
                          <button onClick={() => {
                            const nb = [...(selectedTask.blockers || [])];
                            nb.splice(bi, 1);
                            updateTask(selectedTask.id, 'blockers', nb);
                          }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-theme-muted hover:text-status-error transition-all"><Trash2 size={12} /></button>
                          
                          <div className="flex items-center gap-2">
                            <select className="bg-transparent text-[10px] font-black text-theme-accent uppercase outline-none" value={b.blocking_entity} onChange={e => {
                              const nb = [...(selectedTask.blockers || [])];
                              nb[bi] = { ...nb[bi], blocking_entity: e.target.value };
                              updateTask(selectedTask.id, 'blockers', nb);
                            }}>
                              <option value="PIE">PIE</option><option value="YE">YE</option><option value="MODULE">Module</option><option value="IT">IT/Network</option><option value="VENDOR">Vendor</option>
                            </select>
                            <span className="text-[9px] font-mono text-theme-muted">/</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-black text-theme-muted uppercase">Delay:</span>
                              <input type="number" className="bg-transparent border-b border-white/10 w-8 text-[9px] font-mono text-white outline-none" value={b.average_delay_minutes} onChange={e => {
                                const nb = [...(selectedTask.blockers || [])];
                                nb[bi] = { ...nb[bi], average_delay_minutes: parseFloat(e.target.value) };
                                updateTask(selectedTask.id, 'blockers', nb);
                              }} />
                              <span className="text-[8px] font-mono text-theme-muted">min</span>
                            </div>
                          </div>
                          <input className="bg-transparent border-b border-white/5 text-[10px] text-white w-full outline-none py-1" placeholder="Root Reason..." value={b.reason} onChange={e => {
                            const nb = [...(selectedTask.blockers || [])];
                            nb[bi] = { ...nb[bi], reason: e.target.value };
                            updateTask(selectedTask.id, 'blockers', nb);
                          }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-theme-border">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-theme-secondary uppercase tracking-widest">Process_Errors</h4>
                      <button onClick={() => addError(selectedTask.id)} className="text-[9px] font-black text-theme-accent hover:underline">+ REGISTER</button>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-auto custom-scrollbar pr-2">
                      {selectedTask.errors?.map((err, ei) => (
                        <div key={ei} className="bg-white/5 border border-theme-border p-3 rounded-md space-y-2 relative group">
                          <button onClick={() => {
                            const ne = [...(selectedTask.errors || [])];
                            ne.splice(ei, 1);
                            updateTask(selectedTask.id, 'errors', ne);
                          }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-theme-muted hover:text-status-error transition-all"><Trash2 size={12} /></button>
                          
                          <div className="flex items-center gap-4">
                            <input className="bg-transparent border-b border-white/10 text-[10px] font-black text-white uppercase outline-none flex-1" value={err.error_type} onChange={e => {
                              const ne = [...(selectedTask.errors || [])];
                              ne[ei] = { ...ne[ei], error_type: e.target.value };
                              updateTask(selectedTask.id, 'errors', ne);
                            }} />
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-black text-theme-muted uppercase">Prob:</span>
                              <input type="number" className="bg-transparent border-b border-white/10 w-8 text-[9px] font-mono text-status-error outline-none text-right" value={err.probability_percent} onChange={e => {
                                const ne = [...(selectedTask.errors || [])];
                                ne[ei] = { ...ne[ei], probability_percent: parseFloat(e.target.value) };
                                updateTask(selectedTask.id, 'errors', ne);
                              }} />
                              <span className="text-[8px] font-mono text-theme-muted">%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-theme-muted uppercase">Recovery:</span>
                            <input type="number" className="bg-transparent border-b border-white/10 w-12 text-[9px] font-mono text-white outline-none" value={err.recovery_time_minutes} onChange={e => {
                              const ne = [...(selectedTask.errors || [])];
                              ne[ei] = { ...ne[ei], recovery_time_minutes: parseFloat(e.target.value) };
                              updateTask(selectedTask.id, 'errors', ne);
                            }} />
                            <span className="text-[8px] font-mono text-theme-muted">min</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-theme-border bg-theme-header flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-theme-muted uppercase tracking-widest leading-none mb-1">Calculated_ROI_Saved</span>
                <span className="text-[14px] font-black text-theme-accent tracking-tighter">
                  {((selectedTask.active_touch_time_minutes * selectedTask.occurrences_per_cycle) + (selectedTask.errors?.reduce((acc, e) => acc + (e.probability_percent / 100 * e.recovery_time_minutes), 0) || 0)).toFixed(1)}m / Cycle
                </span>
              </div>
              <button className="bg-white/5 border border-theme-border px-4 py-2 text-[9px] font-black uppercase rounded hover:bg-white/10 transition-all flex items-center gap-2">
                <FileText size={12} /> View_SOP
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
