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
  Play, Shield, Plus, AlertTriangle,
  Monitor, Cpu, Terminal, Link2
} from 'lucide-react';

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
  interface_type: 'GUI' | 'CLI' | 'API' | 'DECISION';
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
  <div className={`apple-glass !bg-[#1e293b]/90 !rounded-xl px-6 py-5 min-w-[280px] shadow-2xl transition-all duration-300 group relative border ${selected ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/10 hover:border-white/30'}`}>
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {data.interface === 'GUI' && <Monitor size={14} className="text-blue-400" />}
          {data.interface === 'CLI' && <Terminal size={14} className="text-emerald-400" />}
          {data.interface === 'API' && <Cpu size={14} className="text-purple-400" />}
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{data.system || "SYSTEM"}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-white/80">
          <Activity size={12} className="text-white/40" />
          <span>{data.touch}m</span>
        </div>
      </div>
      <h4 className="text-[14px] font-bold text-white tracking-tight leading-tight uppercase truncate">{data.label || "Untitled Operation"}</h4>
      {data.risks && (
        <div className="flex items-center gap-1.5 mt-1">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest">Yield Risk</span>
        </div>
      )}
    </div>
    <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-left-2 shadow-lg" />
    <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-right-2 shadow-lg" />
  </div>
);

const DiamondNode = ({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`relative w-28 h-28 flex items-center justify-center transition-all duration-300 group ${selected ? 'scale-110' : ''}`}>
    <div className={`absolute inset-0 rotate-45 border-2 transition-all duration-300 bg-[#1e293b]/90 ${selected ? 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'border-white/20 group-hover:border-white/40'}`} />
    <div className="relative z-10 flex flex-col items-center p-4">
      <Zap size={22} className="text-blue-400 mb-1.5" />
      <span className="text-[10px] font-black text-white uppercase tracking-tighter text-center leading-tight">{data.label || "DECISION"}</span>
    </div>
    <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-left-2 shadow-lg" />
    <Handle type="source" position={Position.Right} className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-right-2 shadow-lg" />
  </div>
);

const nodeTypes = {
  matrix: MatrixNode,
  DECISION: DiamondNode,
};

// --- MAIN BUILDER ---

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ initialTasks, workflowMetadata, onSave }) => {
  const [view, setView] = useState<'flow' | 'table'>('flow');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [metadata, setMetadata] = useState<WorkflowMetadata>(workflowMetadata);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'execution' | 'lineage' | 'corners'>('execution');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [linterErrors, setLinterErrors] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState({ best: 0, worst: 0, total_roi: 0 });

  // Auto-Layout Logic
  const autoLayout = useCallback(() => {
    setNodes(nds => {
      const sorted = [...nds].sort((a, b) => a.position.x - b.position.x);
      return sorted.map((n, i) => ({
        ...n,
        position: { x: 100 + (i * 350), y: 250 + (i % 2 === 0 ? 0 : 80) }
      }));
    });
  }, [setNodes]);

  // Sync tasks to nodes on load
  useEffect(() => {
    const newNodes: Node[] = tasks.map((t, idx) => ({
      id: t.id,
      type: t.interface_type === 'DECISION' ? 'DECISION' : 'matrix',
      data: { 
        label: t.name, 
        system: t.target_system, 
        touch: t.active_touch_time_minutes,
        wait: t.machine_wait_time_minutes,
        risks: t.risks_yield_scrap,
        interface: t.interface_type
      },
      position: { x: 100 + (idx * 350), y: 250 + (idx % 2 === 0 ? 0 : 80) },
    }));
    
    // Create edges based on order if no edges exist
    const newEdges: Edge[] = [];
    if (tasks.length > 1) {
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: tasks[i].id,
          target: tasks[i+1].id,
          label: '',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
          style: { stroke: '#3b82f6', strokeWidth: 2, opacity: 0.4 }
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

      if (t.name === '') errors.push(`Operation ${t.id} has no name.`);
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
      label: '', // Placeholder for user-added detail
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, 
      style: { stroke: '#3b82f6', strokeWidth: 2, opacity: 0.6 } 
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
      type: type === 'DECISION' ? 'DECISION' : 'matrix',
      data: { label: newTask.name, system: newTask.target_system, touch: 0, interface: type },
      position: { x: 400 + (tasks.length * 50), y: 400 }
    }]);
    setSelectedTaskId(id);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (updates.name !== undefined || updates.active_touch_time_minutes !== undefined || updates.target_system !== undefined || updates.interface_type !== undefined) {
      setNodes(nds => nds.map(n => n.id === id ? { 
        ...n, 
        data: { 
          ...n.data, 
          label: updates.name ?? n.data.label,
          touch: updates.active_touch_time_minutes ?? n.data.touch,
          system: updates.target_system ?? n.data.system,
          interface: updates.interface_type ?? n.data.interface
        } 
      } : n));
    }
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-white/10 bg-[#0a1120]">
      
      {/* --- UNIFIED HEADER --- */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a1120]/80 backdrop-blur-xl z-40">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <LucideWorkflow size={18} className="text-blue-400" />
              <span className="text-[14px] font-black text-white tracking-tighter uppercase">Workflow System v4.2</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${metadata.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                {metadata.status}
              </span>
              <div className="h-1 w-1 bg-white/20 rounded-full" />
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">Process Configuration</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10 mx-2" />

          {/* Cleanroom & Equipment State */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Environment</label>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                {(['ISO5', 'ISO7', 'UNCONTROLLED'] as const).map(c => (
                  <button 
                    key={c}
                    onClick={() => setMetadata({...metadata, cleanroom_class: c})}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-all ${metadata.cleanroom_class === c ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Equip State</label>
              <button 
                onClick={() => {
                  const states: WorkflowMetadata['equipment_state'][] = ['READY', 'MAINTENANCE', 'ERROR'];
                  const next = states[(states.indexOf(metadata.equipment_state) + 1) % states.length];
                  setMetadata({...metadata, equipment_state: next});
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-black transition-all ${
                  metadata.equipment_state === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 
                  metadata.equipment_state === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  metadata.equipment_state === 'READY' ? 'bg-emerald-400' : 
                  metadata.equipment_state === 'MAINTENANCE' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                {metadata.equipment_state}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={autoLayout}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            title="Auto-order entities based on connections"
          >
            <Layers size={14} /> Auto-Layout
          </button>
          <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
            {[
              { id: 'flow', icon: <Layers size={14} />, label: 'Designer' },
              { id: 'table', icon: <Database size={14} />, label: 'List View' },
            ].map((v) => (
              <button 
                key={v.id}
                onClick={() => setView(v.id as any)} 
                className={`flex items-center gap-2 px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v.id ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => onSave(tasks, metadata)} className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <Save size={14} /> Save Changes
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
                <span className="text-[12px] font-black uppercase tracking-widest">{linterErrors[0]} {linterErrors.length > 1 && `(+${linterErrors.length - 1} more)`}</span>
              </div>
              <button className="text-white/60 hover:text-white" onClick={() => setLinterErrors([])}><X size={16} /></button>
            </div>
          )}

          {view === 'flow' ? (
            <div className="flex-1 bg-[#0a1120] relative">
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
                <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.05)" gap={40} size={1} />
                <Controls className="!bg-[#1e293b] !border-white/10" />
                <Panel position="bottom-center" className="mb-10">
                   <div className="flex items-center gap-3 p-3 bg-[#1e293b]/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <button onClick={() => addNewNode('GUI')} className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
                      <Plus size={16} /> Add Operation
                    </button>
                    <button onClick={() => addNewNode('DECISION')} className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/20 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                      <Zap size={16} /> Add Decision
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-12 custom-scrollbar space-y-4 bg-[#0a1120]">
              {tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`border transition-all duration-300 rounded-2xl group cursor-pointer ${selectedTaskId === task.id ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-8 px-10 py-6">
                    <span className="text-[14px] font-black text-white/10 group-hover:text-white/40 w-8">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 grid grid-cols-4 gap-12">
                      <div className="flex flex-col col-span-2">
                        <span className="text-[16px] font-black text-white uppercase tracking-tight">{task.name || "UNNAMED OPERATION"}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[10px] font-black rounded uppercase">{task.target_system}</span>
                          <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">{task.interface_type}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-white/30 uppercase mb-1">Execution Time</span>
                        <span className="text-[18px] font-black text-white">{task.active_touch_time_minutes}m</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-white/30 uppercase mb-1">Cycle Frequency</span>
                        <span className="text-[18px] font-black text-white">x{task.occurrences_per_cycle}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="p-3 text-white/20 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => addNewNode('GUI')} className="w-full py-16 border-2 border-dashed border-white/5 rounded-2xl text-[12px] font-black text-white/20 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.01] transition-all uppercase tracking-[0.4em] flex items-center justify-center gap-6">
                <Plus size={24} /> Register New Operation Node
              </button>
            </div>
          )}
        </div>

        {/* --- TASK INSPECTOR --- */}
        <div className="w-[500px] border-l border-white/10 bg-[#0a1120] flex flex-col z-40 shadow-2xl overflow-hidden">
          {selectedTaskId && selectedTask ? (
            <>
              {/* Tab Selector */}
              <div className="h-16 flex border-b border-white/10 bg-white/5 backdrop-blur-xl">
                {[
                  { id: 'execution', label: 'Operational Metrics', icon: <Activity size={14} /> },
                  { id: 'lineage', label: 'Data Interface', icon: <Link2 size={14} /> },
                  { id: 'corners', label: 'Risk Assessment', icon: <AlertCircle size={14} /> }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setInspectorTab(t.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all border-b-2 ${inspectorTab === t.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-transparent text-white/40 hover:text-white'}`}
                  >
                    {t.icon}
                    <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-10">
                {/* Core Header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Operation Identity</span>
                    <button onClick={() => setSelectedTaskId(null)} className="text-white/20 hover:text-white"><X size={18} /></button>
                  </div>
                  <div className="relative group">
                    <input 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-5 text-[18px] font-black text-white uppercase focus:border-blue-500 transition-colors outline-none" 
                      value={selectedTask.name} 
                      maxLength={60}
                      placeholder="Enter operation name..."
                      onChange={e => updateTask(selectedTaskId, { name: e.target.value })}
                    />
                    <span className="absolute right-4 bottom-2 text-[9px] font-bold text-white/20">{selectedTask.name.length} / 60</span>
                  </div>
                </div>

                {inspectorTab === 'execution' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="grid grid-cols-2 gap-6 bg-white/[0.03] p-10 rounded-2xl border border-white/5">
                      <div className="text-center space-y-4">
                        <span className="text-[10px] font-black text-white/40 uppercase">Touch (Min)</span>
                        <input 
                          type="number" 
                          className="bg-transparent text-5xl font-black text-white text-center w-full outline-none" 
                          value={selectedTask.active_touch_time_minutes} 
                          onChange={e => updateTask(selectedTaskId, { active_touch_time_minutes: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="text-center space-y-4 border-l border-white/10">
                        <span className="text-[10px] font-black text-white/40 uppercase">Machine (Min)</span>
                        <input 
                          type="number" 
                          className="bg-transparent text-5xl font-black text-white text-center w-full outline-none opacity-40" 
                          value={selectedTask.machine_wait_time_minutes} 
                          onChange={e => updateTask(selectedTaskId, { machine_wait_time_minutes: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Logistics Matrix</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-white/60 uppercase ml-1">Interface Type</span>
                          <select 
                            className="w-full bg-[#1e293b] border border-white/20 rounded-lg px-5 py-4 text-[13px] font-black text-white outline-none focus:border-blue-500 appearance-none"
                            value={selectedTask.interface_type}
                            onChange={e => updateTask(selectedTaskId, { interface_type: e.target.value as any })}
                          >
                            <option value="GUI">Graphical (GUI)</option>
                            <option value="CLI">Terminal (CLI)</option>
                            <option value="API">Headless (API)</option>
                            <option value="DECISION">Conditional</option>
                          </select>
                        </div>
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-white/60 uppercase ml-1">Cycle Frequency</span>
                          <input 
                            type="number"
                            className="w-full bg-black/40 border border-white/20 rounded-lg px-5 py-4 text-[14px] font-black text-white outline-none focus:border-blue-500" 
                            value={selectedTask.occurrences_per_cycle} 
                            onChange={e => updateTask(selectedTaskId, { occurrences_per_cycle: parseInt(e.target.value) })} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'lineage' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Technical Description</label>
                        <span className="text-[10px] text-white/20 font-mono">{selectedTask.description.length} / 500</span>
                      </div>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-5 text-[14px] font-mono text-emerald-400 h-64 focus:border-emerald-500/50 transition-colors outline-none resize-none" 
                        placeholder="Define operation steps and use @Variable for data tracking..."
                        value={selectedTask.description} 
                        maxLength={500}
                        onChange={e => updateTask(selectedTaskId, { description: e.target.value })} 
                      />
                      <div className="flex flex-wrap gap-2">
                        {nomenclatureLinter(selectedTask.description || "").variables.map(v => (
                          <span key={v} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">@{v}</span>
                        ))}
                        {nomenclatureLinter(selectedTask.description || "").variables.length === 0 && (
                          <span className="text-[10px] text-white/20 italic uppercase tracking-wider">No variables detected in description.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'corners' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Yield / Scrap Impact</label>
                        <Shield size={18} className={selectedTask.risks_yield_scrap ? "text-red-500" : "text-white/20"} />
                      </div>
                      <button 
                        onClick={() => updateTask(selectedTaskId, { risks_yield_scrap: !selectedTask.risks_yield_scrap })}
                        className={`w-full flex items-center justify-between px-8 py-6 rounded-2xl border transition-all ${selectedTask.risks_yield_scrap ? 'bg-red-500/10 border-red-500 text-red-500 shadow-lg shadow-red-500/10' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="text-[12px] font-black uppercase tracking-widest">Active Yield Risk</span>
                          <span className="text-[10px] font-bold opacity-60">This operation can produce defective output.</span>
                        </div>
                        <div className={`w-12 h-7 rounded-full relative transition-colors ${selectedTask.risks_yield_scrap ? 'bg-red-500' : 'bg-white/10'}`}>
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${selectedTask.risks_yield_scrap ? 'left-6' : 'left-1'}`} />
                        </div>
                      </button>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Error Modes</label>
                      {selectedTask.errors.length === 0 && (
                        <button className="w-full py-10 border-2 border-dashed border-white/5 rounded-2xl text-[11px] font-black text-white/20 hover:text-white/40 transition-all uppercase tracking-widest flex flex-col items-center gap-3">
                          <Plus size={20} /> Register Error Case
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="h-16 flex items-center px-8 border-b border-white/10">
                <span className="text-[13px] font-black text-white uppercase tracking-widest">Global Diagnostics</span>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-10 space-y-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-5">
                    <div className="p-5 bg-blue-600/20 rounded-2xl border border-blue-500/20">
                      <Play size={28} className="text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Execution Simulator</span>
                      <span className="text-[16px] font-black text-white uppercase">ROI Projection v4.2</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-3">Ideal Flow</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-white">{simulationResult.best.toFixed(0)}</span>
                        <span className="text-[10px] font-black text-white/40 uppercase">Min</span>
                      </div>
                    </div>
                    <div className="p-8 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-3">Degraded Flow</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-white">{simulationResult.worst.toFixed(0)}</span>
                        <span className="text-[10px] font-black text-white/40 uppercase">Min</span>
                      </div>
                    </div>
                  </div>

                  {simulationResult.worst > 480 && (
                    <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-4">
                      <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                      <p className="text-[11px] font-bold text-amber-500 uppercase leading-relaxed">Shift Overrun Risk: Execution exceeds 8-hour window.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                   <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Frequency Strategy</label>
                  <div className="flex gap-5">
                    <input 
                      type="number" 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-8 py-7 text-4xl font-black text-white outline-none focus:border-blue-500 transition-colors"
                      value={metadata.cadence_count}
                      onChange={e => setMetadata({...metadata, cadence_count: parseFloat(e.target.value)})}
                    />
                    <select 
                      className="w-40 bg-[#1e293b] border border-white/10 rounded-xl px-5 text-[12px] font-black text-white uppercase outline-none appearance-none cursor-pointer"
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
              </div>
            </div>
          )}

          <div className="p-10 border-t border-white/10 bg-[#0a1120] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Efficiency Gain</span>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-white">{simulationResult.total_roi.toFixed(1)}</span>
                <span className="text-[12px] font-black text-white/40 uppercase">Hrs/Mo</span>
              </div>
            </div>
            <button className="flex items-center gap-3 px-8 py-5 bg-white/5 border border-white/10 rounded-xl text-[12px] font-black text-white uppercase hover:bg-white/10 transition-all">
              <FileText size={18} /> Export SOP
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
