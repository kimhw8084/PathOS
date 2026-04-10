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
  Layers, FileText, Image, X, Zap,
  Terminal, FileCode
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
  <div className={`apple-glass !bg-theme-card/80 !rounded-2xl px-4 py-3 min-w-[220px] shadow-2xl hover:border-theme-accent/50 transition-all duration-300 group relative border ${data.risks ? 'border-status-error/30' : 'border-theme-border'}`}>
    {data.risks && (
      <div className="absolute -top-2 -right-2 bg-status-error text-white rounded-full p-1 shadow-lg shadow-status-error/20 border-2 border-theme-bg">
        <AlertTriangle size={10} />
      </div>
    )}
    {data.blockers > 0 && (
      <div className="absolute -top-2 -left-2 bg-status-warning text-black font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-lg border-2 border-theme-bg">
        {data.blockers} Issues
      </div>
    )}
    
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between opacity-50">
        <span className="text-hint text-theme-secondary">{data.system || "System Alpha"}</span>
        <div className="flex items-center gap-2 font-mono text-hint">
          <span className="text-theme-accent">{data.touch}m</span>
          <span className="text-theme-muted opacity-30">•</span>
          <span className="text-theme-secondary">{data.wait}m</span>
        </div>
      </div>
      <h4 className="text-subtext font-bold text-white tracking-tight group-hover:text-theme-accent transition-colors truncate">{data.label}</h4>
      <div className="h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
        <div 
          className="h-full bg-theme-accent shadow-[0_0_8px_rgba(0,122,255,0.4)] transition-all duration-500" 
          style={{ width: `${Math.min(100, (data.touch / (data.touch + data.wait + 0.1)) * 100)}%` }} 
        />
      </div>
    </div>
    <Handle type="target" position={Position.Top} className="!bg-theme-border !w-2 !h-2 border-2 border-theme-bg" />
    <Handle type="source" position={Position.Bottom} className="!bg-theme-accent !w-2 !h-2 border-2 border-theme-bg" />
  </div>
);

const nodeTypes = { matrix: MatrixNode };

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 40, marginy: 40, nodesep: 60, ranksep: 80 });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 220, height: 80 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const n = dagreGraph.node(node.id);
    node.position = { x: n.x - 110, y: n.y - 40 };
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
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155', width: 14, height: 14 },
        style: { stroke: '#334155', strokeWidth: 2.5 }
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
    <div className="apple-card !p-0 flex flex-col h-[850px] overflow-hidden relative shadow-2xl animate-apple-in">
      {/* Precision Toolbar */}
      <div className="h-16 border-b border-theme-border flex items-center justify-between px-8 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-theme-accent/10 rounded-xl">
            <LucideWorkflow size={18} className="text-theme-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-nav text-white">Strategy Architect</span>
            <span className="text-hint text-theme-muted opacity-60">Logic Engine v1.2.6</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-white/[0.04] p-1 rounded-full border border-theme-border">
            {['table', 'flow', 'grid'].map((v) => (
              <button 
                key={v}
                onClick={() => setView(v as any)} 
                className={`px-6 py-1.5 text-hint rounded-full transition-all duration-300 ${view === v ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks)} className="btn-apple-primary flex items-center gap-2.5 px-6">
            <Save size={16} /> Sync Changes
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {view === 'table' ? (
            <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-3 bg-black/10">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`border transition-all duration-300 rounded-2xl ${selectedTaskId === task.id ? 'border-theme-accent/50 bg-theme-accent/[0.03] shadow-[0_0_20px_rgba(0,122,255,0.05)]' : 'border-theme-border bg-white/[0.01] hover:bg-white/[0.03] hover:border-theme-border-bright'}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-8 px-6 py-4 cursor-pointer">
                    <span className="text-hint text-theme-muted w-6">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 flex items-center gap-10">
                      <div className="flex flex-col min-w-[240px]">
                        <span className="text-subtext font-bold text-white tracking-tight truncate">{task.name || "Untitled Operation"}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-hint text-theme-accent">{task.target_system || "Local"}</span>
                          <span className="w-1 h-1 rounded-full bg-theme-border" />
                          <span className="text-hint text-theme-secondary opacity-60">{task.interface_type || "GUI"}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-10 border-l border-theme-border/50 pl-10">
                        <div className="flex flex-col">
                          <span className="text-hint text-theme-muted opacity-50 mb-1.5">Touch Time</span>
                          <span className="text-subtext font-extrabold text-theme-accent">{task.active_touch_time_minutes}m</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-hint text-theme-muted opacity-50 mb-1.5">Wait Time</span>
                          <span className="text-subtext font-extrabold text-theme-secondary">{task.machine_wait_time_minutes}m</span>
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-4">
                        {task.risks_yield_scrap && (
                          <div className="p-1.5 bg-status-error/10 rounded-lg text-status-error">
                            <AlertTriangle size={14} />
                          </div>
                        )}
                        {task.blockers && task.blockers.length > 0 && (
                          <span className="status-badge bg-status-warning/10 text-status-warning flex items-center gap-1.5">
                            <ShieldAlert size={12} /> {task.blockers.length} Blockers
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="w-8 h-8 flex items-center justify-center rounded-xl text-theme-muted hover:bg-status-error/10 hover:text-status-error transition-all"><Trash2 size={16} /></button>
                      <ChevronDown size={20} className={`text-theme-muted transition-transform duration-300 ${selectedTaskId === task.id ? 'rotate-180 text-theme-accent' : ''}`} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setTasks([...tasks, { id: `new-${Date.now()}`, name: 'New Operation Node', description: '', target_system: 'SME_LOCAL', interface_type: 'GUI', active_touch_time_minutes: 0, machine_wait_time_minutes: 0, occurrences_per_cycle: 1, shadow_it_used: false, risks_yield_scrap: false, order_index: tasks.length, blockers: [], errors: [] }])} 
                className="w-full py-6 border-2 border-dashed border-theme-border rounded-2xl hover:border-theme-accent/50 hover:bg-theme-accent/[0.02] text-hint text-theme-muted hover:text-theme-accent transition-all group flex items-center justify-center gap-3">
                <Zap size={16} className="group-hover:scale-125 transition-transform" /> Register New Operation Node
              </button>
            </div>
          ) : view === 'flow' ? (
            <div className="flex-1 bg-black/20 relative">
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
                <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.05)" gap={30} size={1} />
                <Controls />
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
              <Layers size={64} className="text-theme-muted mb-6" />
              <p className="text-xl font-bold uppercase tracking-[0.5em]">Grid Mode Offline</p>
            </div>
          )}
        </div>

        {/* Right-Side Property Inspector */}
        {selectedTaskId && selectedTask && (
          <div className="w-[480px] border-l border-theme-border apple-glass flex flex-col animate-in slide-in-from-right duration-500 z-10 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-8 border-b border-theme-border bg-black/10">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-theme-accent/10 rounded-xl">
                  <Box size={18} className="text-theme-accent" />
                </div>
                <div className="flex flex-col">
                  <span className="text-nav text-white">Node Properties</span>
                  <span className="text-hint text-theme-muted truncate max-w-[240px] normal-case tracking-tight">{selectedTask.name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTaskId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-theme-muted hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-2 gap-1 bg-black/20">
              {['execution', 'data', 'risks'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)} 
                  className={`flex-1 py-2 text-hint rounded-xl transition-all ${activeTab === tab ? 'bg-white/[0.08] text-theme-accent shadow-inner' : 'text-theme-secondary hover:text-white hover:bg-white/[0.03]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-8 space-y-8">
              {activeTab === 'execution' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <label className="text-hint text-theme-secondary flex items-center gap-2">Operation Name</label>
                      <input className="input-apple !bg-black/40 font-bold" value={selectedTask.name} onChange={e => updateTask(selectedTask.id, 'name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2.5">
                        <label className="text-hint text-theme-secondary flex items-center gap-2">Target System</label>
                        <input className="input-apple !bg-black/40 font-bold text-theme-accent" value={selectedTask.target_system} onChange={e => updateTask(selectedTask.id, 'target_system', e.target.value)} />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-hint text-theme-secondary flex items-center gap-2">Interface</label>
                        <select className="input-apple !bg-black/40 font-bold text-theme-secondary appearance-none" value={selectedTask.interface_type} onChange={e => updateTask(selectedTask.id, 'interface_type', e.target.value)}>
                          <option value="GUI">GUI (User Interface)</option><option value="API">API (REST/SOAP)</option><option value="DB">Database (SQL)</option><option value="File">Local File (CSV/XML)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="apple-card-inset !bg-white/[0.02] !p-6 space-y-6">
                    <div className="flex items-center gap-3 text-theme-accent border-b border-theme-border/50 pb-3">
                      <Timer size={18} />
                      <span className="text-hint text-theme-accent">Performance Metrics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2.5">
                        <label className="text-hint text-theme-muted">Human Touch (m)</label>
                        <input type="number" className="input-apple !bg-black/60 font-black text-lg text-theme-accent" value={selectedTask.active_touch_time_minutes} onChange={e => updateTask(selectedTask.id, 'active_touch_time_minutes', parseFloat(e.target.value))} />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-hint text-theme-muted">Machine Wait (m)</label>
                        <input type="number" className="input-apple !bg-black/60 font-black text-lg text-theme-secondary" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTask.id, 'machine_wait_time_minutes', parseFloat(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-hint text-theme-muted">Occurrences / Cycle</label>
                      <input type="number" className="input-apple !bg-black/60 font-black text-lg" value={selectedTask.occurrences_per_cycle} onChange={e => updateTask(selectedTask.id, 'occurrences_per_cycle', parseInt(e.target.value))} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group p-3 rounded-2xl bg-white/[0.03] border border-theme-border transition-all hover:bg-white/[0.06]">
                      <span className="text-subtext font-bold text-theme-secondary flex items-center gap-3">
                        <Terminal size={18} className="text-theme-accent" /> Shadow IT Redundancy
                      </span>
                      <input type="checkbox" className="w-5 h-5 accent-theme-accent rounded-lg" checked={selectedTask.shadow_it_used} onChange={e => updateTask(selectedTask.id, 'shadow_it_used', e.target.checked)} />
                    </label>
                    {selectedTask.shadow_it_used && (
                      <div className="space-y-2 animate-in slide-in-from-top duration-300">
                        <input className="input-apple font-mono text-xs text-theme-accent" placeholder="https://internal-repo.samsung.net/..." value={selectedTask.shadow_it_link} onChange={e => updateTask(selectedTask.id, 'shadow_it_link', e.target.value)} />
                        <p className="text-hint text-theme-muted normal-case tracking-tight px-2">Link to existing scripts or macros being used for this task.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="space-y-2.5">
                    <label className="text-hint text-theme-secondary flex items-center gap-2"><Database size={16} /> Data Inputs</label>
                    <textarea className="input-apple !bg-black/40 h-32 resize-none leading-relaxed font-mono text-main-content" placeholder="Define origin of inputs or link upstream..." value={selectedTask.source_data} onChange={e => updateTask(selectedTask.id, 'source_data', e.target.value)} />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-hint text-theme-secondary flex items-center gap-2"><FileCode size={16} /> Output Specification</label>
                    <textarea className="input-apple !bg-black/40 h-32 resize-none leading-relaxed font-mono text-main-content" placeholder="Paste sample return value or format..." value={selectedTask.output_format_example} onChange={e => updateTask(selectedTask.id, 'output_format_example', e.target.value)} />
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-hint text-theme-secondary flex items-center gap-2"><Image size={16} /> Visual Assets</label>
                    <div className="border-2 border-dashed border-theme-border rounded-3xl p-12 flex flex-col items-center justify-center gap-3 hover:border-theme-accent/50 hover:bg-theme-accent/[0.03] transition-all cursor-pointer group">
                      <div className="p-4 bg-white/[0.03] rounded-2xl group-hover:scale-110 transition-transform">
                        <Image size={32} className="text-theme-muted group-hover:text-theme-accent" />
                      </div>
                      <span className="text-hint text-theme-muted">Attach UI Screenshots</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'risks' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="apple-card-inset !bg-status-error/[0.02] border-status-error/10 !p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-status-error/10 pb-4">
                      <span className="text-hint text-status-error flex items-center gap-2"><AlertTriangle size={18} /> Scrap Risk Analysis</span>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-hint text-theme-muted">Yield Impact</span>
                        <input type="checkbox" className="w-5 h-5 accent-status-error rounded-lg" checked={selectedTask.risks_yield_scrap} onChange={e => updateTask(selectedTask.id, 'risks_yield_scrap', e.target.checked)} />
                      </label>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-hint text-theme-secondary">Tribal Knowledge & Quirks</label>
                      <textarea className="input-apple !bg-black/40 h-24 resize-none leading-relaxed text-main-content" placeholder="Undocumented system quirks or module folklore..." value={selectedTask.tribal_knowledge} onChange={e => updateTask(selectedTask.id, 'tribal_knowledge', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-subtext font-bold text-white tracking-tight flex items-center gap-2">
                         Structural Blockers
                      </h4>
                      <button onClick={() => addBlocker(selectedTask.id)} className="text-hint text-theme-accent hover:text-white transition-colors tracking-normal normal-case">+ REGISTER</button>
                    </div>
                    <div className="space-y-3">
                      {selectedTask.blockers?.map((b, bi) => (
                        <div key={bi} className="bg-white/[0.02] border border-theme-border p-5 rounded-2xl space-y-4 relative group hover:border-theme-border-bright transition-all">
                          <button onClick={() => {
                            const nb = [...(selectedTask.blockers || [])];
                            nb.splice(bi, 1);
                            updateTask(selectedTask.id, 'blockers', nb);
                          }} className="absolute top-4 right-4 text-theme-muted hover:text-status-error transition-all"><Trash2 size={16} /></button>
                          
                          <div className="flex items-center gap-4">
                            <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-theme-border">
                              <select className="bg-transparent text-hint text-theme-accent outline-none" value={b.blocking_entity} onChange={e => {
                                const nb = [...(selectedTask.blockers || [])];
                                nb[bi] = { ...nb[bi], blocking_entity: e.target.value };
                                updateTask(selectedTask.id, 'blockers', nb);
                              }}>
                                <option value="PIE">PIE</option><option value="YE">YE</option><option value="MODULE">Module</option><option value="IT">IT/Network</option><option value="VENDOR">Vendor</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 text-hint text-theme-muted">
                              Delay: 
                              <input type="number" className="bg-black/40 border border-theme-border rounded-lg w-16 px-2 py-1 text-white outline-none focus:border-theme-accent" value={b.average_delay_minutes} onChange={e => {
                                const nb = [...(selectedTask.blockers || [])];
                                nb[bi] = { ...nb[bi], average_delay_minutes: parseFloat(e.target.value) };
                                updateTask(selectedTask.id, 'blockers', nb);
                              }} />
                              min
                            </div>
                          </div>
                          <input className="input-apple !bg-black/40 text-main-content" placeholder="Root Reason..." value={b.reason} onChange={e => {
                            const nb = [...(selectedTask.blockers || [])];
                            nb[bi] = { ...nb[bi], reason: e.target.value };
                            updateTask(selectedTask.id, 'blockers', nb);
                          }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-theme-border bg-black/10 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-hint text-theme-muted mb-1">Projected ROI Reclaimed</span>
                <span className="text-2xl font-black text-theme-accent tracking-tighter">
                  {((selectedTask.active_touch_time_minutes * selectedTask.occurrences_per_cycle) + (selectedTask.errors?.reduce((acc, e) => acc + (e.probability_percent / 100 * e.recovery_time_minutes), 0) || 0)).toFixed(1)}<span className="text-hint ml-1 opacity-60 normal-case tracking-tight">min / cycle</span>
                </span>
              </div>
              <button className="btn-apple-secondary !px-6 flex items-center gap-2.5">
                <FileText size={16} /> Export SOP
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
