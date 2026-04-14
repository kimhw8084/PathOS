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
  type Connection,
  type EdgeProps,
  getBezierPath,
  EdgeLabelRenderer
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, Trash2, 
  Workflow as LucideWorkflow, 
  X, Zap,
  Activity, Layers, Database, AlertCircle,
  Plus, 
  Monitor, Cpu, Terminal, Link2, 
  Trash, 
  Image as ImageIcon, Paperclip,
  ChevronLeft,
  Building2,
  Users2,
  User,
  Info,
  ChevronDown
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

interface TargetSystem {
  id: string;
  name: string;
  purpose: string;
  access_method: string;
}

interface SourceData {
  id: string;
  is_manual: boolean;
  name: string;
  source_location: string;
  format: string;
  example: string;
  description: string;
  purpose: string;
  origin_node_id?: string;
}

interface OutputData {
  id: string;
  name: string;
  description: string;
  format: string;
  example: string;
  saved_location: string;
}

interface VerificationStep {
  id: string;
  step_number: number;
  instruction: string;
  expected_result: string;
}

interface TribalKnowledge {
  id: string;
  knowledge: string;
  captured_from: string;
}

interface ReferenceLink {
  id: string;
  url: string;
  description: string;
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
  target_systems: TargetSystem[];
  interface_type: 'GUI' | 'CLI' | 'API' | 'DECISION';
  tat_type: 'human' | 'automation';
  active_touch_time_minutes: number;
  machine_wait_time_minutes: number;
  occurrences_per_cycle: number;
  occurrence_condition?: string;
  
  // Data Tab
  source_data_list: SourceData[];
  output_data_list: OutputData[];
  verification_methods: VerificationStep[];

  // Exceptions Tab
  blockers: Blocker[];
  errors: TaskError[];
  tribal_knowledge: TribalKnowledge[];

  // Appendix Tab
  media: TaskMedia[];
  reference_links: ReferenceLink[];
  
  // Operational Matrix (Legacy/Internal)
  tool_id: string;
  hardware_family: string;
  trigger_architecture: string;
  output_classification: string;

  // I/O Lineage (Legacy/Internal)
  upstream_links: string[]; 
  io_variables: string[]; 
}

interface WorkflowMetadata {
  cadence_count: number;
  cadence_unit: 'day' | 'week' | 'month' | 'year';
  equipment_state: 'READY' | 'MAINTENANCE' | 'ERROR';
  cleanroom_class: 'ISO5' | 'ISO7' | 'UNCONTROLLED';
  status: 'DRAFT' | 'PROD' | 'ARCHIVED';
  // Extended fields
  prc: string;
  workflow_type: string;
  tool_family: string;
  tool_family_count: number;
  org: string;
  team: string;
  poc: string;
  forensic_description: string;
  trigger_type: string;
  trigger_description: string;
  output_type: string;
  output_description: string;
}

interface WorkflowBuilderProps {
  workflow: any;
  taxonomy: any[];
  onSave: (data: any) => void;
  onBack: () => void;
}

// --- CUSTOM NODES & EDGES ---

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
    <Handle type="source" position={Position.Top} id="top" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-top-2 shadow-lg" />
    <Handle type="source" position={Position.Right} id="right" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-right-2 shadow-lg" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-blue-400 !w-4 !h-4 !border-2 !border-[#0a1120] !-bottom-2 shadow-lg" />
  </div>
);

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: data?.color || style.stroke || '#3b82f6',
          strokeWidth: 2.5,
          strokeDasharray: data?.style === 'dashed' ? '5,5' : 'none',
        }}
        className="react-flow__edge-path transition-all duration-300"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {data?.label && (
            <div className="bg-[#1e293b]/90 backdrop-blur-md px-2 py-0.5 rounded border border-white/20 text-[9px] font-black text-white uppercase tracking-widest shadow-lg">
              {data.label}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = {
  matrix: MatrixNode,
  DECISION: DiamondNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

// --- MAIN BUILDER ---

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflow, taxonomy, onSave, onBack }) => {
  const [view, setView] = useState<'flow' | 'table'>('flow');
  
  // Task normalization to ensure all fields exist
  const normalizeTasks = useCallback((rawTasks: any[]): Task[] => {
    return rawTasks.map(t => ({
      id: t.id || `node-${Date.now()}-${Math.random()}`,
      name: t.name || 'Unnamed Operation',
      description: t.description || '',
      target_systems: t.target_systems || (t.target_system ? [{ id: 'default', name: t.target_system, purpose: 'Primary Interface', access_method: t.interface_type }] : []),
      interface_type: t.interface_type || 'GUI',
      tat_type: t.tat_type || 'human',
      active_touch_time_minutes: t.active_touch_time_minutes || 0,
      machine_wait_time_minutes: t.machine_wait_time_minutes || 0,
      occurrences_per_cycle: t.occurrences_per_cycle || 1,
      occurrence_condition: t.occurrence_condition || '',
      source_data_list: t.source_data_list || [],
      output_data_list: t.output_data_list || [],
      verification_methods: t.verification_methods || [],
      blockers: t.blockers || [],
      errors: t.errors || [],
      tribal_knowledge: t.tribal_knowledge || [],
      media: t.media || [],
      reference_links: t.reference_links || [],
      tool_id: t.tool_id || 'LOCAL',
      hardware_family: t.hardware_family || 'VIRTUAL',
      trigger_architecture: t.trigger_architecture || 'MANUAL',
      output_classification: t.output_classification || 'INTERNAL',
      upstream_links: t.upstream_links || [],
      io_variables: t.io_variables || []
    }));
  }, []);

  const [tasks, setTasks] = useState<Task[]>(() => normalizeTasks(workflow.tasks || []));

  // Get all available outputs from other nodes for source data selection
  const allAvailableOutputs = useMemo(() => {
    const outputs: { nodeId: string, nodeName: string, output: OutputData }[] = [];
    tasks.forEach(t => {
      t.output_data_list.forEach(o => {
        outputs.push({ nodeId: t.id, nodeName: t.name, output: o });
      });
    });
    return outputs;
  }, [tasks]);

  const [metadata, setMetadata] = useState<WorkflowMetadata>({
    cadence_count: workflow.cadence_count || 1,
    cadence_unit: workflow.cadence_unit || 'week',
    equipment_state: workflow.equipment_state || 'READY',
    cleanroom_class: workflow.cleanroom_class || 'UNCONTROLLED',
    status: workflow.status || 'DRAFT',
    prc: workflow.prc || '',
    workflow_type: workflow.workflow_type || '',
    tool_family: workflow.tool_family || '',
    tool_family_count: workflow.tool_family_count || 1,
    org: workflow.org || '',
    team: workflow.team || '',
    poc: workflow.poc || '',
    forensic_description: workflow.forensic_description || '',
    trigger_type: workflow.trigger_type || '',
    trigger_description: workflow.trigger_description || '',
    output_type: workflow.output_type || '',
    output_description: workflow.output_description || ''
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'execution' | 'data' | 'exceptions' | 'appendix' | 'org'>('execution');
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
        system: t.target_systems[0]?.name || 'ERP', 
        touch: t.active_touch_time_minutes,
        interface: t.interface_type
      },
      position: { x: 100 + (idx * 350), y: 250 + (idx % 2 === 0 ? 0 : 80) },
    }));
    
    // Default edges based on order if no edges exist
    const newEdges: Edge[] = [];
    if (tasks.length > 1) {
      for (let i = 0; i < tasks.length - 1; i++) {
        newEdges.push({
          id: `e${tasks[i].id}-${tasks[i+1].id}`,
          source: tasks[i].id,
          target: tasks[i+1].id,
          type: 'custom',
          data: { label: '', color: '#3b82f6', style: 'solid' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
        });
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [workflow.tasks]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'custom',
      data: { label: '', color: '#3b82f6', style: 'solid' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, 
    }, eds));
  }, [setEdges]);

  const addNewNode = (type: Task['interface_type']) => {
    const id = `node-${Date.now()}`;
    const newTask: Task = {
      id,
      name: `NEW ${type}`,
      description: '',
      target_systems: [],
      interface_type: type,
      tat_type: 'human',
      active_touch_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrences_per_cycle: 1,
      source_data_list: [],
      output_data_list: [],
      verification_methods: [],
      blockers: [],
      errors: [],
      tribal_knowledge: [],
      media: [],
      reference_links: [],
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
      data: { label: newTask.name, system: 'ERP', touch: 0, interface: type },
      position: { x: 400 + (tasks.length * 50), y: 400 }
    }]);
    setSelectedTaskId(id);
    setSelectedEdgeId(null);
    setInspectorTab('execution');
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (updates.name !== undefined || updates.active_touch_time_minutes !== undefined || updates.interface_type !== undefined) {
      setNodes(nds => nds.map(n => n.id === id ? { 
        ...n, 
        data: { 
          ...n.data, 
          label: updates.name ?? n.data.label,
          touch: updates.active_touch_time_minutes ?? n.data.touch,
          interface: updates.interface_type ?? n.data.interface
        } 
      } : n));
    }
  };

  const updateEdge = (id: string, updates: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...updates } } : e));
  };

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  return (
    <div className="apple-card !p-0 flex flex-col h-full overflow-hidden relative shadow-2xl border-white/10 bg-[#0a1120]">
      
      {/* --- UNIFIED HEADER --- */}
      <div className="border-b border-white/10 bg-[#0a1120]/80 backdrop-blur-xl z-40 flex flex-col">
        {/* Row 1: Nav & Basic Controls */}
        <div className="h-14 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-theme-muted hover:text-white transition-all group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-widest">Repository</span>
            </button>

            <div className="h-8 w-[1px] bg-white/10" />

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <LucideWorkflow size={14} className="text-blue-400" />
                <span className="text-[13px] font-black text-white tracking-tighter uppercase">{workflow.name}</span>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/10 mx-2" />

            {/* Org / Team / POC Context */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Building2 size={12} className="text-white/20" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.org || 'Unassigned Org'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users2 size={12} className="text-white/20" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.team || 'Unassigned Team'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={12} className="text-white/20" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{metadata.poc || 'No POC'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={autoLayout}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              <Layers size={12} /> Auto-Layout
            </button>
            <div className="flex bg-white/5 p-0.5 rounded-full border border-white/10">
              {[
                { id: 'flow', label: 'Designer' },
                { id: 'table', label: 'List View' },
              ].map((v) => (
                <button 
                  key={v.id}
                  onClick={() => setView(v.id as any)} 
                  className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${view === v.id ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => onSave({...metadata, tasks})} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Save size={12} /> Save
            </button>
          </div>
        </div>

        {/* Row 2: Forensic Description & Type/PRC */}
        <div className="h-10 flex items-center justify-between px-6 border-t border-white/5 bg-white/[0.02]">
           <div className="flex items-center gap-3 flex-1 overflow-hidden">
             <Info size={12} className="text-theme-accent shrink-0" />
             <input 
               className="bg-transparent text-[11px] font-bold text-white/60 outline-none w-full italic truncate"
               placeholder="Add forensic description for this industrial workflow..."
               value={metadata.forensic_description}
               onChange={e => setMetadata({...metadata, forensic_description: e.target.value})}
             />
           </div>

           <div className="flex items-center gap-4 border-l border-white/10 pl-6 shrink-0">
             <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Type</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase">{metadata.workflow_type || 'N/A'}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">PRC</span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-black text-white/60 uppercase">{metadata.prc || 'N/A'}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* --- MAIN CANVAS AREA --- */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {view === 'flow' ? (
            <div className="flex-1 bg-[#0a1120] relative">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect}
                onNodeClick={(_, node) => { setSelectedTaskId(node.id); setSelectedEdgeId(null); }}
                onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedTaskId(null); }}
                onPaneClick={() => { setSelectedTaskId(null); setSelectedEdgeId(null); }}
                fitView 
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.05)" gap={40} size={1} />
                <Controls className="!bg-[#1e293b] !border-white/10" />
                <Panel position="bottom-center" className="mb-6">
                   <div className="flex items-center gap-2 p-1.5 bg-[#1e293b]/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <button onClick={() => addNewNode('GUI')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">
                      <Plus size={14} /> Add Operation
                    </button>
                    <button onClick={() => addNewNode('DECISION')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                      <Zap size={14} /> Add Decision
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-2 bg-[#0a1120]">
              {tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`border transition-all duration-300 rounded-xl group cursor-pointer ${selectedTaskId === task.id ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-6 px-6 py-3">
                    <span className="text-[12px] font-black text-white/10 w-6">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 grid grid-cols-4 gap-6">
                      <div className="flex flex-col col-span-2">
                        <span className="text-[13px] font-black text-white uppercase truncate">{task.name || "UNNAMED"}</span>
                        <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">{task.interface_type}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[13px] font-black text-white">{task.active_touch_time_minutes}m</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[13px] font-black text-white">x{task.occurrences_per_cycle}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- INSPECTOR --- */}
        <div className="w-[450px] border-l border-white/10 bg-[#0a1120] flex flex-col z-40 shadow-2xl overflow-hidden">
          {selectedTaskId && selectedTask ? (
            <>
              {/* Tab Selector */}
              <div className="h-14 flex border-b border-white/10 bg-white/5 backdrop-blur-xl">
                {[
                  { id: 'execution', label: 'Execution', icon: <Activity size={12} /> },
                  { id: 'data', label: 'Data', icon: <Database size={12} /> },
                  { id: 'exceptions', label: 'Exceptions', icon: <AlertCircle size={12} /> },
                  { id: 'appendix', label: 'Appendix', icon: <Paperclip size={12} /> }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setInspectorTab(t.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2 ${inspectorTab === t.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-transparent text-white/40 hover:text-white'}`}
                  >
                    {t.icon}
                    <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-8">
                {/* Core Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Operation Identity</span>
                    <button onClick={() => setSelectedTaskId(null)} className="text-white/20 hover:text-white"><X size={14} /></button>
                  </div>
                  <input 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[14px] font-black text-white uppercase focus:border-blue-500 transition-colors outline-none" 
                    value={selectedTask.name} 
                    onChange={e => updateTask(selectedTaskId, { name: e.target.value })}
                  />
                </div>

                {inspectorTab === 'execution' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">TAT Type</label>
                        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                          {(['human', 'automation'] as const).map(t => (
                            <button 
                              key={t}
                              onClick={() => updateTask(selectedTaskId, { tat_type: t })}
                              className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded transition-all ${selectedTask.tat_type === t ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Interface</label>
                        <select 
                          className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-[11px] font-black text-white outline-none focus:border-blue-500 appearance-none"
                          value={selectedTask.interface_type}
                          onChange={e => updateTask(selectedTaskId, { interface_type: e.target.value as any })}
                        >
                          <option value="GUI">GUI</option>
                          <option value="CLI">CLI</option>
                          <option value="API">API</option>
                          <option value="DECISION">Conditional</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Occurrences</label>
                        <input 
                          type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[13px] font-black text-white outline-none" 
                          value={selectedTask.occurrences_per_cycle} 
                          onChange={e => updateTask(selectedTaskId, { occurrences_per_cycle: parseInt(e.target.value) })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Touch Time (Min)</label>
                        <input 
                          type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[13px] font-black text-white outline-none" 
                          value={selectedTask.active_touch_time_minutes} 
                          onChange={e => updateTask(selectedTaskId, { active_touch_time_minutes: parseFloat(e.target.value) })} 
                        />
                      </div>
                    </div>

                    {selectedTask.occurrences_per_cycle > 1 && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Repetition Condition</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[11px] font-bold text-white outline-none h-16" 
                          placeholder="e.g. Per Equipment, Per Step..."
                          value={selectedTask.occurrence_condition}
                          onChange={e => updateTask(selectedTaskId, { occurrence_condition: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Target Systems</label>
                        <button 
                          onClick={() => updateTask(selectedTaskId, { target_systems: [...selectedTask.target_systems, { id: Date.now().toString(), name: '', purpose: '', access_method: '' }] })}
                          className="p-1 hover:bg-blue-600/20 text-blue-400 rounded transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.target_systems.map(s => (
                          <div key={s.id} className="grid grid-cols-2 gap-2 p-3 bg-white/[0.03] border border-white/5 rounded-lg relative group">
                            <input 
                              placeholder="System Name"
                              className="bg-transparent text-[11px] font-black text-white outline-none border-b border-white/10 focus:border-blue-500"
                              value={s.name}
                              onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(ts => ts.id === s.id ? { ...ts, name: e.target.value } : ts) })}
                            />
                            <input 
                              placeholder="Purpose"
                              className="bg-transparent text-[11px] font-bold text-white/60 outline-none border-b border-white/10 focus:border-blue-500"
                              value={s.purpose}
                              onChange={e => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.map(ts => ts.id === s.id ? { ...ts, purpose: e.target.value } : ts) })}
                            />
                            <button 
                              onClick={() => updateTask(selectedTaskId, { target_systems: selectedTask.target_systems.filter(ts => ts.id !== s.id) })}
                              className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'data' && (
                  <div className="space-y-8">
                    {/* Source Data Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Source Data Interface</label>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => updateTask(selectedTaskId, { source_data_list: [...selectedTask.source_data_list, { id: Date.now().toString(), is_manual: true, name: '', source_location: '', format: '', example: '', description: '', purpose: '' }] })}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 text-white rounded text-[9px] font-black uppercase hover:bg-white/10"
                          >
                            <Plus size={12} /> Add Manual
                          </button>
                        </div>
                      </div>

                      {/* Output Select dropdown if outputs exist */}
                      {allAvailableOutputs.filter(o => o.nodeId !== selectedTaskId).length > 0 && (
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest">Available Outputs</label>
                           <select 
                            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
                            onChange={(e) => {
                              const selected = allAvailableOutputs.find(o => o.output.id === e.target.value);
                              if (selected) {
                                updateTask(selectedTaskId, { 
                                  source_data_list: [...selectedTask.source_data_list, { 
                                    id: Date.now().toString(), 
                                    is_manual: false, 
                                    name: selected.output.name, 
                                    source_location: selected.nodeName, 
                                    format: selected.output.format, 
                                    example: selected.output.example, 
                                    description: selected.output.description, 
                                    purpose: `Output from ${selected.nodeName}`,
                                    origin_node_id: selected.nodeId
                                  }] 
                                });
                              }
                            }}
                            value=""
                           >
                            <option value="">Select source from other nodes...</option>
                            {allAvailableOutputs.filter(o => o.nodeId !== selectedTaskId).map(o => (
                              <option key={o.output.id} value={o.output.id}>{o.nodeName}: {o.output.name}</option>
                            ))}
                           </select>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {selectedTask.source_data_list.map(sd => (
                          <div key={sd.id} className={`p-4 bg-white/[0.03] border rounded-xl space-y-3 relative group ${sd.is_manual ? 'border-white/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {!sd.is_manual && <Link2 size={12} className="text-blue-400" />}
                                <input 
                                  placeholder="Data Label"
                                  className="bg-transparent text-[12px] font-black text-white outline-none border-b border-white/10 w-full"
                                  value={sd.name}
                                  onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, name: e.target.value } : x) })}
                                />
                              </div>
                              {!sd.is_manual && <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">LINKED</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <input placeholder="Location" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/60" value={sd.source_location} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, source_location: e.target.value } : x) })} />
                              <input placeholder="Format" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/60" value={sd.format} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, format: e.target.value } : x) })} />
                            </div>
                            <textarea placeholder="Purpose / Context" className="w-full bg-black/20 rounded p-2 text-[10px] text-white/60 h-12 outline-none" value={sd.description} onChange={e => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.map(x => x.id === sd.id ? { ...x, description: e.target.value } : x) })} />
                            <button onClick={() => updateTask(selectedTaskId, { source_data_list: selectedTask.source_data_list.filter(x => x.id !== sd.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Output Data Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Output Generation</label>
                        <button 
                           onClick={() => updateTask(selectedTaskId, { output_data_list: [...selectedTask.output_data_list, { id: Date.now().toString(), name: '', description: '', format: '', example: '', saved_location: '' }] })}
                          className="p-1 hover:bg-blue-600/20 text-blue-400 rounded"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.output_data_list.map(od => (
                          <div key={od.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg space-y-2 group relative">
                             <input placeholder="Output Name" className="bg-transparent text-[11px] font-black text-white outline-none border-b border-white/10 w-full" value={od.name} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, name: e.target.value } : x) })} />
                             <div className="grid grid-cols-2 gap-2">
                               <input placeholder="Format" className="bg-transparent text-[9px] border-b border-white/10 outline-none text-white/40" value={od.format} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, format: e.target.value } : x) })} />
                               <input placeholder="Destination" className="bg-transparent text-[9px] border-b border-white/10 outline-none text-white/40" value={od.saved_location} onChange={e => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.map(x => x.id === od.id ? { ...x, saved_location: e.target.value } : x) })} />
                             </div>
                             <button onClick={() => updateTask(selectedTaskId, { output_data_list: selectedTask.output_data_list.filter(x => x.id !== od.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Verification Method Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Integrity Verification</label>
                        <button 
                          onClick={() => updateTask(selectedTaskId, { verification_methods: [...selectedTask.verification_methods, { id: Date.now().toString(), step_number: selectedTask.verification_methods.length + 1, instruction: '', expected_result: '' }] })}
                          className="p-1 hover:bg-emerald-600/20 text-emerald-400 rounded"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.verification_methods.map(vm => (
                          <div key={vm.id} className="flex gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg group relative">
                            <span className="text-[10px] font-black text-emerald-500/40">{vm.step_number}</span>
                            <div className="flex-1 space-y-2">
                              <input placeholder="Instruction" className="w-full bg-transparent text-[11px] font-bold text-white outline-none border-b border-white/5" value={vm.instruction} onChange={e => updateTask(selectedTaskId, { verification_methods: selectedTask.verification_methods.map(x => x.id === vm.id ? { ...x, instruction: e.target.value } : x) })} />
                              <input placeholder="Expected Result" className="w-full bg-transparent text-[10px] text-white/40 outline-none" value={vm.expected_result} onChange={e => updateTask(selectedTaskId, { verification_methods: selectedTask.verification_methods.map(x => x.id === vm.id ? { ...x, expected_result: e.target.value } : x) })} />
                            </div>
                            <button onClick={() => updateTask(selectedTaskId, { verification_methods: selectedTask.verification_methods.filter(x => x.id !== vm.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'exceptions' && (
                  <div className="space-y-10">
                    {/* Blocker Table */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest text-amber-500">System Blockers</label>
                        <button onClick={() => updateTask(selectedTaskId, { blockers: [...selectedTask.blockers, { id: Date.now().toString(), blocking_entity: '', reason: '', probability_percent: 0, average_delay_minutes: 0, standard_mitigation: '' }] })} className="p-1 text-amber-500 hover:bg-amber-500/10 rounded"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.blockers.map(b => (
                          <div key={b.id} className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg space-y-2 relative group">
                            <input placeholder="Blocking Entity" className="w-full bg-transparent text-[11px] font-black text-amber-500 outline-none" value={b.blocking_entity} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, blocking_entity: e.target.value } : x) })} />
                            <textarea placeholder="Reason" className="w-full bg-black/20 text-[10px] p-2 rounded h-10 outline-none text-white/60" value={b.reason} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, reason: e.target.value } : x) })} />
                            <div className="grid grid-cols-2 gap-2">
                               <input type="number" placeholder="Prob %" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/40" value={b.probability_percent} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, probability_percent: parseFloat(e.target.value) } : x) })} />
                               <input type="number" placeholder="Delay (m)" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/40" value={b.average_delay_minutes} onChange={e => updateTask(selectedTaskId, { blockers: selectedTask.blockers.map(x => x.id === b.id ? { ...x, average_delay_minutes: parseFloat(e.target.value) } : x) })} />
                            </div>
                            <button onClick={() => updateTask(selectedTaskId, { blockers: selectedTask.blockers.filter(x => x.id !== b.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Error Table */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest text-red-500">Human Process Errors</label>
                        <button onClick={() => updateTask(selectedTaskId, { errors: [...selectedTask.errors, { id: Date.now().toString(), error_type: '', description: '', probability_percent: 0, recovery_time_minutes: 0 }] })} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.errors.map(err => (
                          <div key={err.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-2 relative group">
                            <input placeholder="Error Type" className="w-full bg-transparent text-[11px] font-black text-red-500 outline-none" value={err.error_type} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, error_type: e.target.value } : x) })} />
                            <div className="grid grid-cols-2 gap-2">
                               <input type="number" placeholder="Prob %" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/40" value={err.probability_percent} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, probability_percent: parseFloat(e.target.value) } : x) })} />
                               <input type="number" placeholder="Recovery (m)" className="bg-transparent text-[10px] border-b border-white/10 outline-none text-white/40" value={err.recovery_time_minutes} onChange={e => updateTask(selectedTaskId, { errors: selectedTask.errors.map(x => x.id === err.id ? { ...x, recovery_time_minutes: parseFloat(e.target.value) } : x) })} />
                            </div>
                            <button onClick={() => updateTask(selectedTaskId, { errors: selectedTask.errors.filter(x => x.id !== err.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tribal Knowledge */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tribal Knowledge Repository</label>
                        <button onClick={() => updateTask(selectedTaskId, { tribal_knowledge: [...selectedTask.tribal_knowledge, { id: Date.now().toString(), knowledge: '', captured_from: '' }] })} className="p-1 hover:bg-white/10 rounded"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.tribal_knowledge.map(tk => (
                          <div key={tk.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg space-y-2 relative group">
                            <textarea placeholder="Undocumented Knowledge..." className="w-full bg-black/20 text-[10px] p-2 rounded h-16 outline-none text-white/60" value={tk.knowledge} onChange={e => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, knowledge: e.target.value } : x) })} />
                            <input placeholder="Source Team/Member" className="w-full bg-transparent text-[9px] font-black text-white/30 outline-none uppercase" value={tk.captured_from} onChange={e => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.map(x => x.id === tk.id ? { ...x, captured_from: e.target.value } : x) })} />
                            <button onClick={() => updateTask(selectedTaskId, { tribal_knowledge: selectedTask.tribal_knowledge.filter(x => x.id !== tk.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {inspectorTab === 'appendix' && (
                  <div className="space-y-8">
                    {/* Media Section */}
                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Visual Evidence / Figures</label>
                      <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group">
                        <ImageIcon size={24} className="text-white/20 group-hover:text-blue-400" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-white/40">Paste Figure / Image Here</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedTask.media.map(m => (
                          <div key={m.id} className="aspect-video bg-white/5 border border-white/10 rounded-lg relative overflow-hidden group">
                             <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/20">FIGURE</div>
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1">
                                <span className="text-[9px] text-white font-black truncate w-full text-center">{m.label}</span>
                                <button onClick={() => updateTask(selectedTaskId, { media: selectedTask.media.filter(x => x.id !== m.id) })} className="text-red-400 p-1 hover:bg-red-400/20 rounded"><Trash size={12} /></button>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reference Links */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Reference Documentation</label>
                        <button onClick={() => updateTask(selectedTaskId, { reference_links: [...selectedTask.reference_links, { id: Date.now().toString(), url: '', description: '' }] })} className="p-1 hover:bg-blue-600/20 text-blue-400 rounded"><Plus size={14} /></button>
                      </div>
                      <div className="space-y-2">
                        {selectedTask.reference_links.map(rl => (
                          <div key={rl.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-lg space-y-2 relative group">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-1">
                              <Link2 size={12} className="text-blue-400" />
                              <input placeholder="URL" className="bg-transparent text-[11px] font-bold text-blue-400 outline-none w-full" value={rl.url} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === rl.id ? { ...x, url: e.target.value } : x) })} />
                            </div>
                            <input placeholder="Description" className="bg-transparent text-[10px] text-white/60 outline-none w-full" value={rl.description} onChange={e => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.map(x => x.id === rl.id ? { ...x, description: e.target.value } : x) })} />
                            <button onClick={() => updateTask(selectedTaskId, { reference_links: selectedTask.reference_links.filter(x => x.id !== rl.id) })} className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : selectedEdgeId && selectedEdge ? (
            <div className="flex-1 flex flex-col p-6 space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">Connection Attributes</span>
                <button onClick={() => setSelectedEdgeId(null)} className="text-white/20 hover:text-white"><X size={14} /></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Edge Label</label>
                  <input 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13px] font-black text-white uppercase focus:border-blue-500 transition-colors outline-none" 
                    placeholder="e.g. YES, NO, ON ERROR..."
                    value={selectedEdge.data?.label || ''} 
                    onChange={e => updateEdge(selectedEdgeId, { label: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Visual Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'solid', label: 'Solid Line', icon: <div className="h-0.5 w-8 bg-current" /> },
                      { id: 'dashed', label: 'Dashed Line', icon: <div className="h-0.5 w-8 border-b-2 border-dashed border-current" /> }
                    ].map(s => (
                      <button 
                        key={s.id}
                        onClick={() => updateEdge(selectedEdgeId, { style: s.id })}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${selectedEdge.data?.style === s.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                      >
                        {s.icon}
                        <span className="text-[10px] font-black uppercase">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Edge Color</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(c => (
                      <button 
                        key={c}
                        onClick={() => updateEdge(selectedEdgeId, { color: c })}
                        className={`aspect-square rounded-lg border-2 transition-all ${selectedEdge.data?.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1" />
              <button 
                onClick={() => setEdges(eds => eds.filter(e => e.id !== selectedEdgeId))}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Sever Connection
              </button>
            </div>
          ) : (
             <div className="flex-1 flex flex-col overflow-auto custom-scrollbar bg-[#0a1120] animate-in fade-in zoom-in-95 duration-300">
               {/* Global Process Definition (Core Info) */}
               <div className="p-8 space-y-12">
                 <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                       <LucideWorkflow className="text-theme-accent" size={20} />
                       <h2 className="text-[16px] font-black text-white uppercase tracking-tighter">Process Definition</h2>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-8">
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">PRC Code</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                            value={metadata.prc}
                            onChange={e => setMetadata({...metadata, prc: e.target.value})}
                         >
                           <option value="">Select PRC...</option>
                           {taxonomy.find(t => t.key === 'PRC')?.cached_values.map((v: any) => <option key={v} value={v}>{v}</option>)}
                         </select>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Workflow Type</label>
                         <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                            value={metadata.workflow_type}
                            onChange={e => setMetadata({...metadata, workflow_type: e.target.value})}
                         >
                           <option value="">Select Type...</option>
                           {taxonomy.find(t => t.key === 'WORKFLOW_TYPE')?.cached_values.map((v: any) => <option key={v} value={v}>{v}</option>)}
                         </select>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Tool Family</label>
                         <div className="flex gap-2">
                           <select 
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                              value={metadata.tool_family}
                              onChange={e => setMetadata({...metadata, tool_family: e.target.value})}
                           >
                             <option value="">Select Family...</option>
                             {taxonomy.find(t => t.key === 'HARDWARE_FAMILY')?.cached_values.map((v: any) => <option key={v} value={v}>{v}</option>)}
                           </select>
                           <input 
                              type="number"
                              className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent"
                              value={metadata.tool_family_count}
                              onChange={e => setMetadata({...metadata, tool_family_count: parseInt(e.target.value)})}
                           />
                         </div>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                          <Zap className="text-theme-accent" size={18} />
                          <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Trigger Architecture</h2>
                       </div>
                       <div className="space-y-4">
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                            value={metadata.trigger_type}
                            onChange={e => setMetadata({...metadata, trigger_type: e.target.value})}
                          >
                            <option value="">Select Architecture...</option>
                            {taxonomy.find(t => t.key === 'TRIGGER_ARCHITECTURE')?.cached_values.map((v: any) => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <textarea 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/60 outline-none focus:border-theme-accent h-24"
                            placeholder="Detailed trigger conditions..."
                            value={metadata.trigger_description}
                            onChange={e => setMetadata({...metadata, trigger_description: e.target.value})}
                          />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                          <Layers className="text-theme-accent" size={18} />
                          <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Output Classification</h2>
                       </div>
                       <div className="space-y-4">
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-black text-white outline-none focus:border-theme-accent appearance-none transition-all"
                            value={metadata.output_type}
                            onChange={e => setMetadata({...metadata, output_type: e.target.value})}
                          >
                            <option value="">Select Classification...</option>
                            {taxonomy.find(t => t.key === 'OUTPUT_CLASSIFICATION')?.cached_values.map((v: any) => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <textarea 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white/60 outline-none focus:border-theme-accent h-24"
                            placeholder="Primary workflow outcome..."
                            value={metadata.output_description}
                            onChange={e => setMetadata({...metadata, output_description: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 {/* Organization & POCs (Compact) */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                       <Building2 className="text-theme-accent" size={18} />
                       <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Organization & POCs</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                       <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                          <Building2 size={14} className="text-white/20" />
                          <input 
                            className="bg-transparent text-[12px] font-black text-white outline-none w-full"
                            placeholder="Organization"
                            value={metadata.org}
                            onChange={e => setMetadata({...metadata, org: e.target.value})}
                          />
                       </div>
                       <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                          <Users2 size={14} className="text-white/20" />
                          <input 
                            className="bg-transparent text-[12px] font-black text-white outline-none w-full"
                            placeholder="Team"
                            value={metadata.team}
                            onChange={e => setMetadata({...metadata, team: e.target.value})}
                          />
                       </div>
                       <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                          <User size={14} className="text-white/20" />
                          <input 
                            className="bg-transparent text-[12px] font-black text-white outline-none w-full"
                            placeholder="POC Name / Email"
                            value={metadata.poc}
                            onChange={e => setMetadata({...metadata, poc: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="pt-8 text-center">
                    <button 
                      onClick={() => setView('flow')}
                      className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-white/10 transition-all inline-flex items-center gap-2"
                    >
                      Continue to Canvas <ChevronDown size={14} className="-rotate-90" />
                    </button>
                 </div>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WrappedWorkflowBuilder: React.FC<WorkflowBuilderProps> = (p) => (
  <ReactFlowProvider><WorkflowBuilder {...p} /></ReactFlowProvider>
);

export default WrappedWorkflowBuilder;
