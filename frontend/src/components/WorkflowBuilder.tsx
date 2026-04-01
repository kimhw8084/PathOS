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
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { List, GitGraph, Plus, Save, Trash2, ChevronUp, ChevronDown, AlertCircle, Workflow as LucideWorkflow } from 'lucide-react';

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
  workflow: any;
  initialTasks: Task[];
  onSave: (tasks: Task[]) => void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 50, marginy: 50 });

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
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync tasks to ReactFlow
  useEffect(() => {
    const newNodes: Node[] = tasks.map((task) => ({
      id: `${task.id}`,
      data: { label: (
        <div className="flex flex-col text-left">
          <span className="font-bold text-xs truncate">{task.name}</span>
          <span className="text-[10px] opacity-60">{task.target_system}</span>
          <span className="text-[10px] text-theme-accent mt-1">{task.tat_minutes}m</span>
        </div>
      )},
      position: { x: 0, y: 0 }, // Dagre will layout
      className: 'glass-card border-none text-theme-primary w-[200px] !p-3 !rounded-xl text-xs',
      style: { border: '1px solid var(--glass-border)' }
    }));

    const newEdges: Edge[] = [];
    for (let i = 0; i < tasks.length - 1; i++) {
      newEdges.push({
        id: `e${tasks[i].id}-${tasks[i+1].id}`,
        source: `${tasks[i].id}`,
        target: `${tasks[i+1].id}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#7aa2f7' },
        style: { stroke: '#7aa2f7', strokeWidth: 2 }
      });
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [tasks]);

  const addTask = () => {
    const newTask: Task = {
      id: `new-${Date.now()}`,
      name: 'New Task',
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
    <div className="flex flex-col h-[700px] glass-panel rounded-2xl overflow-hidden border-none">
      <div className="h-14 border-b border-theme-border flex items-center justify-between px-6 bg-white/5">
        <div className="flex items-center gap-2">
          <LucideWorkflow size={18} className="text-theme-accent" />
          <h3 className="font-bold text-sm tracking-wide">TASK SEQUENCE BUILDER</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-theme-input border border-theme-border rounded-lg p-0.5">
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-3 py-1 text-xs rounded-md transition-all ${view === 'list' ? 'bg-theme-accent text-white' : 'text-theme-secondary hover:text-theme-primary'}`}
            >
              <List size={14} /> List
            </button>
            <button 
              onClick={() => setView('flow')}
              className={`flex items-center gap-2 px-3 py-1 text-xs rounded-md transition-all ${view === 'flow' ? 'bg-theme-accent text-white' : 'text-theme-secondary hover:text-theme-primary'}`}
            >
              <GitGraph size={14} /> Flow
            </button>
          </div>
          <button onClick={() => onSave(tasks)} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2 shadow-sm">
            <Save size={14} /> Sync to Hub
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'list' ? (
          <div className="flex-1 flex flex-col p-6 overflow-auto custom-scrollbar bg-black/10">
            <div className="space-y-3 mb-6">
              {tasks.map((task, index) => (
                <div key={task.id} className="glass-card flex items-start gap-4 hover:bg-white/10 group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="flex flex-col gap-1 items-center justify-center p-1 bg-white/5 rounded border border-theme-border mt-1">
                    <button onClick={() => moveTask(index, 'up')} className="hover:text-theme-accent disabled:opacity-20" disabled={index === 0}><ChevronUp size={16} /></button>
                    <span className="text-[10px] font-bold opacity-30">{index + 1}</span>
                    <button onClick={() => moveTask(index, 'down')} className="hover:text-theme-accent disabled:opacity-20" disabled={index === tasks.length - 1}><ChevronDown size={16} /></button>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <input 
                        className="w-full bg-transparent border-b border-theme-border p-1 text-sm font-bold focus:border-theme-accent outline-none" 
                        value={task.name} 
                        onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                        placeholder="Task Name"
                      />
                      <input 
                        className="w-full bg-transparent border-b border-white/5 p-1 text-[10px] text-theme-muted focus:border-theme-accent outline-none mt-1" 
                        value={task.target_system} 
                        onChange={(e) => updateTask(task.id, 'target_system', e.target.value)}
                        placeholder="System/Software"
                      />
                    </div>
                    <div className="col-span-2">
                       <textarea 
                        className="w-full bg-transparent border border-white/5 rounded-lg p-2 text-xs text-theme-secondary focus:border-theme-accent outline-none min-h-[60px]" 
                        value={task.description} 
                        onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                        placeholder="Detailed steps..."
                      />
                    </div>
                    <div className="col-span-1 grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-theme-muted uppercase font-bold px-1">TAT (m)</span>
                        <input 
                          type="number" 
                          className="w-full bg-white/5 rounded px-2 py-1 text-xs text-theme-accent outline-none" 
                          value={task.tat_minutes} 
                          onChange={(e) => updateTask(task.id, 'tat_minutes', parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-theme-muted uppercase font-bold px-1">Error %</span>
                        <input 
                          type="number" 
                          className="w-full bg-white/5 rounded px-2 py-1 text-xs text-red-400 outline-none" 
                          value={task.error_probability} 
                          onChange={(e) => updateTask(task.id, 'error_probability', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeTask(task.id)}
                    className="p-2 text-theme-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all self-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={addTask}
              className="w-full py-4 border-2 border-dashed border-theme-border rounded-2xl flex items-center justify-center gap-2 text-theme-muted hover:border-theme-accent/50 hover:text-theme-accent transition-all group"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-medium">Append New Task Node</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 bg-black/20 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              className="bg-transparent"
            >
              <Background color="#292e42" gap={20} />
              <Controls className="bg-theme-header border-theme-border fill-theme-primary" />
            </ReactFlow>
            <div className="absolute top-4 right-4 bg-theme-header/80 backdrop-blur rounded-lg p-3 border border-theme-border shadow-xl pointer-events-none z-10 max-w-[200px]">
              <div className="flex gap-2 items-center text-xs font-bold text-theme-secondary mb-2 uppercase tracking-widest">
                <AlertCircle size={14} className="text-theme-accent" /> Node Strategy
              </div>
              <p className="text-[10px] text-theme-muted leading-tight">
                PathOS auto-relocates nodes using Dagre logic to prevent overlaps and maintain readability. Changes are synced bi-directionally.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrap in provider for ReactFlow use
const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (props) => (
  <ReactFlowProvider>
    <WorkflowBuilder {...props} />
  </ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
