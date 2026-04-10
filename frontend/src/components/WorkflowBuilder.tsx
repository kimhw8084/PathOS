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
import { 
  Save, Trash2, 
  Workflow as LucideWorkflow, 
  Box, 
  FileText, X, Zap,
  Cpu, Activity
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
  
  // Locked Operational Parameters
  tool_id?: string;
  hardware_family?: string;
  trigger_architecture?: string;
  output_classification?: string;
}

interface WorkflowBuilderProps {
  initialTasks: Task[];
  workflowMetadata: {
    cadence_count: number;
    cadence_unit: string;
  };
  onSave: (tasks: Task[], metadata: any) => void;
}

// --- High-Density Matrix Node (Task) ---
const MatrixNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`apple-glass !bg-black !rounded-xl px-5 py-4 min-w-[220px] shadow-2xl transition-all duration-300 group relative border-2 ${selected ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/10 hover:border-white/40'}`}>
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{data.system || "ALPHA"}</span>
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-white">
          <span>{data.touch}m</span>
        </div>
      </div>
      <h4 className="text-[13px] font-black text-white tracking-tight leading-tight uppercase">{data.label}</h4>
    </div>
    <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2 border border-black" />
    <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2 border border-black" />
  </div>
);

// --- Decision Node (Diamond) ---
const DecisionNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`relative flex items-center justify-center w-[120px] h-[120px] transition-all duration-300 ${selected ? 'scale-110' : ''}`}>
    <div className={`absolute inset-0 rotate-45 border-2 transition-colors duration-300 ${selected ? 'bg-white border-white' : 'bg-black border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]'}`} />
    <div className="relative z-10 text-center p-4">
      <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${selected ? 'text-black' : 'text-white'}`}>
        {data.label || 'DECISION'}
      </span>
    </div>
    <Handle type="target" position={Position.Top} style={{ top: 0, left: '50%' }} className="!bg-white !w-2 !h-2 !z-20 border border-black" />
    <Handle type="source" position={Position.Bottom} style={{ bottom: 0, left: '50%' }} className="!bg-white !w-2 !h-2 !z-20 border border-black" />
    <Handle type="source" position={Position.Left} style={{ left: 0, top: '50%' }} id="false" className="!bg-white !w-2 !h-2 !z-20 border border-black" />
    <Handle type="source" position={Position.Right} style={{ right: 0, top: '50%' }} id="true" className="!bg-white !w-2 !h-2 !z-20 border border-black" />
  </div>
);

const nodeTypes = {
  matrix: MatrixNode,
  decision: DecisionNode
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, workflowMetadata, onSave }) => {

  const [view, setView] = useState<'table' | 'flow'>('flow');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [metadata, setMetadata] = useState(workflowMetadata);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (nodes.length > 0) return;

    const newNodes: Node[] = tasks.map((t) => ({
      id: `${t.id}`,
      type: t.interface_type === 'DECISION' ? 'decision' : 'matrix',
      data: { 
        label: t.name, 
        system: t.target_system, 
        touch: t.active_touch_time_minutes, 
        wait: t.machine_wait_time_minutes,
        risks: t.risks_yield_scrap,
        blockers: t.blockers?.length || 0
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    }));
    
    const newEdges: Edge[] = [];
    if (tasks.length > 1) {
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: `${tasks[i].id}`,
          target: `${tasks[i+1].id}`,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' },
          style: { stroke: '#ffffff', strokeWidth: 2, opacity: 0.2 }
        });
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks]);

  const onConnect = (params: any) => {
    setEdges((eds) => [
      ...eds, 
      { ...params, id: `e${Date.now()}`, markerEnd: { type: MarkerType.ArrowClosed, color: '#ffffff' }, style: { stroke: '#ffffff', strokeWidth: 2, opacity: 0.3 } }
    ]);
  };

  const addNewNode = (type: 'matrix' | 'decision') => {
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 100, y: 100 },
      data: { 
        label: type === 'decision' ? 'NEW DECISION' : 'NEW OPERATION',
        system: 'LOCAL',
        touch: 0,
        wait: 0
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    
    const newTask: Task = {
      id,
      name: type === 'decision' ? 'NEW DECISION' : 'NEW OPERATION',
      description: '',
      target_system: 'LOCAL',
      interface_type: type === 'decision' ? 'DECISION' : 'GUI',
      active_touch_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrences_per_cycle: 1,
      shadow_it_used: false,
      risks_yield_scrap: false,
      order_index: tasks.length,
      blockers: [],
      errors: [],
      tool_id: '',
      hardware_family: '',
      trigger_architecture: '',
      output_classification: ''
    };
    setTasks([...tasks, newTask]);
    setSelectedTaskId(id);
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const updateTask = (id: string | number, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    setNodes(nds => nds.map(n => n.id === String(id) ? { ...n, data: { ...n.data, [field === 'name' ? 'label' : (field === 'active_touch_time_minutes' ? 'touch' : field)]: value } } : n));
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
    
    let scale = 1.0;
    if (metadata.cadence_unit === 'day') scale = 30.44;
    else if (metadata.cadence_unit === 'week') scale = 4.34;
    else if (metadata.cadence_unit === 'year') scale = 1/12;
    
    return (taskROI * metadata.cadence_count * scale / 60).toFixed(1);
  }, [tasks, metadata]);

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-white/10 bg-[#050505]">
      {/* Black Precision Toolbar */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black z-20">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
            <LucideWorkflow size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-black text-white tracking-tighter uppercase">Strategy Architect</span>
            <span className="text-[9px] text-white/40 font-bold uppercase tracking-[0.3em]">Precision Matrix v2.0</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
            {['flow', 'table'].map((v) => (
              <button 
                key={v}
                onClick={() => setView(v as any)} 
                className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks, metadata)} className="px-8 py-2.5 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center gap-2">
            <Save size={14} /> Synchronize
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {view === 'table' ? (
            <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-3 bg-black">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`border transition-all duration-300 rounded-xl group ${selectedTaskId === task.id ? 'border-white bg-white/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-8 px-8 py-4 cursor-pointer">
                    <span className="text-[10px] font-black text-white/20 group-hover:text-white transition-colors w-8">{String(index + 1).padStart(2, '0')}</span>
                    <div className="flex-1 flex items-center gap-12">
                      <div className="flex flex-col min-w-[280px]">
                        <span className="text-[14px] font-black text-white tracking-tight uppercase">{task.name || "UNNAMED NODE"}</span>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{task.target_system || "LOCAL"}</span>
                          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{task.interface_type || "GUI"}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="text-white/20 hover:text-white transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => addNewNode('matrix')} className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl text-[11px] font-black text-white/40 hover:text-white hover:border-white/40 transition-all uppercase tracking-widest flex items-center justify-center gap-4">
                <Zap size={16} /> Register New Sequence Node
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#020202] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={() => setSelectedTaskId(null)}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.03)" gap={50} size={1} />
                <Controls className="!bg-black !border-white/10" />
              </ReactFlow>
              
              {/* Floating Action Menu */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 bg-black border border-white/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50">
                <button onClick={() => addNewNode('matrix')} className="flex items-center gap-3 px-6 py-3 bg-white text-black rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-transform">
                  <Box size={14} /> Add Task
                </button>
                <button onClick={() => addNewNode('decision')} className="flex items-center gap-3 px-6 py-3 bg-black border border-white/20 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                  <Zap size={14} /> Add Decision
                </button>
              </div>
            </div>
          )}
        </div>

        {/* High-Contrast White-on-Black Inspector */}
        <div className="w-[500px] border-l border-white/10 bg-black flex flex-col z-30 shadow-2xl overflow-hidden">
          <div className="h-16 flex items-center justify-between px-8 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <Cpu size={18} className="text-white" />
              </div>
              <span className="text-[12px] font-black text-white uppercase tracking-widest">
                {selectedTask ? "Node Parameters" : "Workflow Identity"}
              </span>
            </div>
            {selectedTaskId && (
              <button onClick={() => setSelectedTaskId(null)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-10">
            {selectedTask ? (
              <>
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Core Identity</label>
                  <div className="space-y-4">
                    <input 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[15px] font-black text-white uppercase focus:border-white transition-colors outline-none" 
                      placeholder="NODE NAME"
                      value={selectedTask.name} 
                      onChange={e => updateTask(selectedTask.id, 'name', e.target.value)} 
                    />
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[13px] font-medium text-white/80 h-24 focus:border-white transition-colors outline-none resize-none" 
                      placeholder="Operational Description..."
                      value={selectedTask.description} 
                      onChange={e => updateTask(selectedTask.id, 'description', e.target.value)} 
                    />
                  </div>
                </div>

                {/* THE 4 LOCKED PARAMETERS */}
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Operational Matrix</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/60 uppercase ml-1">Tool ID</span>
                      <input className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-white" value={selectedTask.tool_id} onChange={e => updateTask(selectedTask.id, 'tool_id', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/60 uppercase ml-1">Hardware Family</span>
                      <input className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-white" value={selectedTask.hardware_family} onChange={e => updateTask(selectedTask.id, 'hardware_family', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/60 uppercase ml-1">Trigger Arch</span>
                      <input className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-white" value={selectedTask.trigger_architecture} onChange={e => updateTask(selectedTask.id, 'trigger_architecture', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-white/60 uppercase ml-1">Output Class</span>
                      <input className="w-full bg-black border border-white/20 rounded-lg px-4 py-3 text-[12px] font-black text-white outline-none focus:border-white" value={selectedTask.output_classification} onChange={e => updateTask(selectedTask.id, 'output_classification', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Effort Metrics</label>
                  <div className="grid grid-cols-2 gap-6 bg-white/[0.03] p-6 rounded-2xl border border-white/5">
                    <div className="text-center space-y-3">
                      <span className="text-[9px] font-black text-white/40 uppercase">Touch (Min)</span>
                      <input type="number" className="bg-transparent text-3xl font-black text-white text-center w-full outline-none" value={selectedTask.active_touch_time_minutes} onChange={e => updateTask(selectedTask.id, 'active_touch_time_minutes', parseFloat(e.target.value))} />
                    </div>
                    <div className="text-center space-y-3 border-l border-white/10">
                      <span className="text-[9px] font-black text-white/40 uppercase">Wait (Min)</span>
                      <input type="number" className="bg-transparent text-3xl font-black text-white text-center w-full outline-none opacity-40" value={selectedTask.machine_wait_time_minutes} onChange={e => updateTask(selectedTask.id, 'machine_wait_time_minutes', parseFloat(e.target.value))} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-10">
                <div className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center space-y-4">
                  <Activity size={32} className="mx-auto text-white/20" />
                  <p className="text-[12px] font-medium text-white/60">Select a node to modulate parameters or adjust the global cadence below.</p>
                </div>
                
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Execution Cadence</label>
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
                      onChange={e => setMetadata({...metadata, cadence_unit: e.target.value})}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-10 border-t border-white/10 bg-black flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Total Monthly Savings</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{totalWorkflowROI}</span>
                <span className="text-[11px] font-black text-white/40 uppercase">Hours</span>
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
