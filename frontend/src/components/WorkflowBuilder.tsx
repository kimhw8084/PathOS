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
import { List, GitGraph, Plus, Save, Trash2, ChevronUp, ChevronDown, Workflow as LucideWorkflow, Cpu, Clock } from 'lucide-react';

interface Task {
  id: string | number;
  name: string;
  description: string;
  target_system: string;
  tat_minutes: number;
  occurrences_per_cycle: number;
  error_probability: number;
  recovery_time_minutes: number;
  order_index: number;
}

interface WorkflowBuilderProps {
  initialTasks: Task[];
  onSave: (tasks: Task[]) => void;
}

// --- Custom Apple Node Component ---
const AppleNode = ({ data }: { data: { label: string, system: string, tat: number } }) => (
  <div className="apple-glass rounded-2xl min-w-[220px] p-4 shadow-2xl relative overflow-hidden group border border-white/10 hover:border-white/20 transition-all duration-300">
    <div className="absolute top-0 left-0 w-1 h-full bg-theme-accent shadow-[0_0_10px_rgba(0,113,227,0.5)]" />
    
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest flex items-center gap-1">
          <Cpu size={10} /> {data.system || "System"}
        </span>
        <span className="text-[10px] font-bold text-theme-accent flex items-center gap-1">
          <Clock size={10} /> {data.tat}m
        </span>
      </div>
      
      <h4 className="text-sm font-semibold text-white tracking-tight leading-snug truncate">
        {data.label}
      </h4>
    </div>
    
    <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-theme-border !border-none" />
    <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-theme-accent !border-none" />
  </div>
);

const nodeTypes = {
  apple: AppleNode,
};

// --- Dagre Layout Logic ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 240;
const nodeHeight = 100;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 100, marginy: 100, nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, onSave }) => {
  const [view, setView] = useState<'list' | 'flow'>('list');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const newNodes: Node[] = tasks.map((task) => ({
      id: `${task.id}`,
      type: 'apple',
      data: { 
        label: task.name,
        system: task.target_system,
        tat: task.tat_minutes
      },
      position: { x: 0, y: 0 },
    }));

    const newEdges: Edge[] = [];
    for (let i = 0; i < tasks.length - 1; i++) {
      newEdges.push({
        id: `e${tasks[i].id}-${tasks[i+1].id}`,
        source: `${tasks[i].id}`,
        target: `${tasks[i+1].id}`,
        animated: true,
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: '#424245',
          width: 20,
          height: 20
        },
        style: { stroke: '#424245', strokeWidth: 1.5 }
      });
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [tasks]);

  const addTask = () => {
    const newTask: Task = {
      id: `new-${Date.now()}`,
      name: 'New Operation Step',
      description: '',
      target_system: '',
      tat_minutes: 0,
      occurrences_per_cycle: 1,
      error_probability: 0,
      recovery_time_minutes: 0,
      order_index: tasks.length
    };
    setTasks([...tasks, newTask]);
  };

  const removeTask = (id: string | number) => {
    setTasks(tasks.filter(t => t.id !== id).map((t, i) => ({...t, order_index: i})));
  };

  const moveTask = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    const newTasks = [...tasks];
    const temp = newTasks[index];
    newTasks[index] = newTasks[newIndex];
    newTasks[newIndex] = temp;
    setTasks(newTasks.map((t, i) => ({...t, order_index: i})));
  };

  const updateTask = (id: string | number, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  return (
    <div className="apple-card !p-0 overflow-hidden border border-theme-border/50 shadow-2xl h-[750px] flex flex-col bg-theme-bg/40 backdrop-blur-3xl">
      {/* Builder Toolbar */}
      <div className="h-16 border-b border-theme-border/50 flex items-center justify-between px-8 bg-theme-header/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <LucideWorkflow size={20} className="text-theme-accent" />
          <h3 className="font-bold text-sm tracking-tight text-white uppercase">Automation Sequence</h3>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-white/5 border border-theme-border/50 rounded-full p-1">
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs rounded-full transition-all duration-300 font-semibold ${view === 'list' ? 'bg-theme-primary text-black' : 'text-theme-secondary hover:text-white'}`}
            >
              <List size={14} /> List
            </button>
            <button 
              onClick={() => setView('flow')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs rounded-full transition-all duration-300 font-semibold ${view === 'flow' ? 'bg-theme-primary text-black' : 'text-theme-secondary hover:text-white'}`}
            >
              <GitGraph size={14} /> Flow
            </button>
          </div>
          <button 
            onClick={() => onSave(tasks)} 
            className="btn-apple-primary text-xs py-2 shadow-lg shadow-theme-accent/10 flex items-center gap-2"
          >
            <Save size={14} /> Sync Strategy
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'list' ? (
          <div className="flex-1 flex flex-col p-10 overflow-auto custom-scrollbar bg-black/5">
            <div className="space-y-4 mb-8">
              {tasks.map((task, index) => (
                <div key={task.id} className="apple-card !p-5 flex items-start gap-6 hover:bg-white/5 group animate-in slide-in-from-left-4 duration-500 stagger" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="flex flex-col gap-2 items-center justify-center py-2 px-1 bg-white/5 rounded-xl border border-theme-border transition-all hover:border-theme-accent/50 w-10">
                    <button onClick={() => moveTask(index, 'up')} className="text-theme-secondary hover:text-theme-accent disabled:opacity-10" disabled={index === 0}><ChevronUp size={16} /></button>
                    <span className="text-[11px] font-bold text-theme-accent">{index + 1}</span>
                    <button onClick={() => moveTask(index, 'down')} className="text-theme-secondary hover:text-theme-accent disabled:opacity-10" disabled={index === tasks.length - 1}><ChevronDown size={16} /></button>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-4 flex flex-col gap-3">
                      <input 
                        className="w-full bg-transparent border-b border-theme-border/50 py-1 text-base font-bold text-white focus:border-theme-accent outline-none transition-all" 
                        value={task.name} 
                        onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                        placeholder="Step Action Target"
                      />
                      <div className="flex items-center gap-2">
                        <Cpu size={12} className="text-theme-muted" />
                        <input 
                          className="flex-1 bg-transparent border-b border-transparent py-1 text-xs text-theme-secondary focus:border-theme-accent/40 outline-none transition-all italic" 
                          value={task.target_system} 
                          onChange={(e) => updateTask(task.id, 'target_system', e.target.value)}
                          placeholder="Application / System Name"
                        />
                      </div>
                    </div>
                    
                    <div className="md:col-span-5">
                       <textarea 
                        className="w-full bg-white/5 border border-theme-border/30 rounded-xl p-3 text-xs text-theme-secondary focus:border-theme-accent/50 outline-none min-h-[70px] resize-none leading-relaxed transition-all" 
                        value={task.description} 
                        onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                        placeholder="Define the technical execution steps here..."
                      />
                    </div>
                    
                    <div className="md:col-span-3 grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-theme-muted uppercase font-bold tracking-widest px-1">TAT (min)</span>
                        <input 
                          type="number" 
                          className="w-full bg-white/5 border border-theme-border/50 rounded-lg px-3 py-2 text-sm text-theme-accent font-bold outline-none focus:border-theme-accent transition-all" 
                          value={task.tat_minutes} 
                          onChange={(e) => updateTask(task.id, 'tat_minutes', parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] text-theme-muted uppercase font-bold tracking-widest px-1">Fail Probability</span>
                        <input 
                          type="number" 
                          className="w-full bg-white/5 border border-theme-border/50 rounded-lg px-3 py-2 text-sm text-status-error font-bold outline-none focus:border-status-error transition-all" 
                          value={task.error_probability} 
                          onChange={(e) => updateTask(task.id, 'error_probability', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeTask(task.id)}
                    className="p-3 text-theme-muted opacity-0 group-hover:opacity-100 hover:text-status-error transform transition-all duration-300 hover:scale-110 self-center"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={addTask}
              className="w-full py-10 border border-dashed border-theme-border rounded-[22px] flex flex-col items-center justify-center gap-3 text-theme-secondary hover:border-theme-accent/40 hover:text-theme-primary transition-all duration-500 bg-white/[0.02] group"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-theme-accent/10 transition-all duration-300">
                <Plus size={24} className="text-theme-muted group-hover:text-theme-accent transition-colors" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Expand Automation Stack</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 relative bg-theme-bg/10">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              className="bg-transparent"
            >
              <Background variant={BackgroundVariant.Dots} color="#1f1f23" gap={25} size={1} />
              <Controls className="!bg-theme-card !border-theme-border !rounded-2xl !shadow-2xl overflow-hidden" />
            </ReactFlow>
            
            {/* Design Insight Overlay */}
            <div className="absolute bottom-8 right-8 apple-glass rounded-2xl p-4 max-w-[240px] pointer-events-none z-10 border border-white/10 shadow-3xl animate-in fade-in duration-1000">
              <div className="flex gap-2 items-center text-[10px] font-bold text-theme-accent mb-2 uppercase tracking-[0.2em]">
                System Intelligence
              </div>
              <p className="text-[11px] text-theme-secondary leading-relaxed opacity-80">
                Neural graph layout active. PathOS employs **Dagre-engine** positioning to optimize node distancing and sequence hierarchy.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (props) => (
  <ReactFlowProvider>
    <WorkflowBuilder {...props} />
  </ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
