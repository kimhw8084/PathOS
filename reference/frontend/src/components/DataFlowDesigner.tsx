import React, { useState, useCallback, useMemo } from 'react'
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Panel,
  useNodesState, 
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MiniMap
} from 'reactflow'
import 'reactflow/dist/style.css'
// import * as dagre from 'dagre'
import { 
  Save, 
  Plus, 
  Server, 
  Search,
  Database,
  Globe,
  Layout,
  Edit3,
  Network
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiFetch } from '../api/apiClient'

// --- Constants & Styles ---

const FLOW_TYPES = [
  { id: 'DATA', label: 'Data Flow', color: '#3b82f6', dash: false },
  { id: 'AUTH', label: 'Auth / Security', color: '#8b5cf6', dash: false },
  { id: 'SYNC', label: 'Replication', color: '#10b981', dash: [5, 5] },
  { id: 'MGMT', label: 'Control Plane', color: '#f59e0b', dash: [2, 2] },
  { id: 'CRITICAL', label: 'Heartbeat', color: '#ef4444', dash: false, weight: 4 },
]

// --- Custom Nodes ---

const DeviceNode = ({ data, selected }: any) => {
  return (
    <div className={`glass-panel min-w-[280px] min-h-[120px] rounded-[30px] border-2 transition-all duration-500 overflow-hidden ${selected ? 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)]' : 'border-white/10'}`}>
      <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center justify-between">
         <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
               {data.type === 'Switch' ? <Network size={16}/> : <Server size={16}/>}
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest leading-none">{data.name}</p>
               <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">{data.type} // {data.environment}</p>
            </div>
         </div>
         {data.status === 'Active' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
      </div>
      
      <div className="p-6">
         <div className="min-h-[40px] border border-dashed border-white/5 rounded-2xl bg-black/20 flex flex-col items-center justify-center relative">
            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest absolute top-2">Resident Services Matrix</span>
            <div className="pt-6 w-full flex flex-col space-y-2 px-2 pb-2">
            </div>
         </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-2 border-slate-900 !left-[-6px]" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900 !right-[-6px]" />
    </div>
  )
}

const ServiceNode = ({ data, selected }: any) => {
  return (
    <div className={`glass-panel px-4 py-2.5 rounded-xl border-2 transition-all duration-300 flex items-center space-x-3 w-full ${selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
       <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
          <Database size={12}/>
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase text-emerald-400 truncate tracking-tight">{data.name}</p>
          <p className="text-[7px] font-bold text-slate-500 uppercase truncate">{data.service_type}</p>
       </div>

       <Handle type="target" position={Position.Left} className="w-2 h-2 bg-emerald-500 border-2 border-slate-900 !left-[-4px]" />
       <Handle type="source" position={Position.Right} className="w-2 h-2 bg-emerald-500 border-2 border-slate-900 !right-[-4px]" />
    </div>
  )
}

const ExternalNode = ({ data, selected }: any) => {
  return (
    <div className={`glass-panel min-w-[220px] rounded-[30px] border-2 transition-all duration-500 p-4 border-dashed ${selected ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.2)] bg-indigo-500/5' : 'border-white/20'}`}>
       <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
             <Globe size={18}/>
          </div>
          <div>
             <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{data.name}</p>
             <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{data.owner_organization}</p>
          </div>
       </div>
       <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900 !left-[-6px]" />
       <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900 !right-[-6px]" />
    </div>
  )
}

const LabeledEdge = ({
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
  selected,
}: any) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  });

  const currentType = FLOW_TYPES.find(t => t.id === (data?.type || 'DATA')) || FLOW_TYPES[0];

  const onLabelChange = (val: string) => {
    setEdges((eds) => eds.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, label: val } } : edge)));
  };

  const onTypeChange = (typeId: string) => {
    setEdges((eds) => eds.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, type: typeId } } : edge)));
  };

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          stroke: currentType.color, 
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: Array.isArray(currentType.dash) ? currentType.dash.join(' ') : 'none',
          transition: 'all 0.3s ease',
          opacity: selected ? 1 : 0.6,
          filter: selected ? `drop-shadow(0 0 8px ${currentType.color})` : 'none'
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex flex-col items-center group"
        >
          <div 
            className={`px-3 py-1 rounded-full border transition-all duration-300 flex items-center space-x-2 ${selected ? 'bg-slate-900 border-white scale-110 shadow-xl' : 'bg-slate-950/90 border-white/10'}`}
            style={{ borderColor: selected ? '#ffffff' : `${currentType.color}80` }}
          >
             <span className="text-[9px] font-black uppercase text-white tracking-widest">
                {data?.label || currentType.label}
             </span>
             {selected && <Edit3 size={10} className="text-blue-400" />}
          </div>

          <AnimatePresence>
            {selected && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="mt-2 bg-slate-900 border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col space-y-3 min-w-[200px] z-[100]"
              >
                 <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Flow Label</label>
                    <input
                      autoFocus
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-white uppercase outline-none focus:border-blue-500"
                      value={data?.label || ''}
                      onChange={(e) => onLabelChange(e.target.value)}
                      placeholder="e.g. SQL Traffic"
                    />
                 </div>
                 <div className="grid grid-cols-1 gap-1">
                    {FLOW_TYPES.map(t => (
                       <button 
                         key={t.id}
                         onClick={() => onTypeChange(t.id)}
                         className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${data?.type === t.id ? 'bg-white/10 border border-white/10' : 'hover:bg-white/5'}`}
                       >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-[9px] font-black uppercase text-slate-300 tracking-tight">{t.label}</span>
                       </button>
                    ))}
                 </div>
                 <button 
                    onClick={() => setEdges(eds => eds.filter(e => e.id !== id))}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all"
                 >
                    Delete Vector
                 </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = {
  device: DeviceNode,
  service: ServiceNode,
  external: ExternalNode
};

const edgeTypes = {
  labeled: LabeledEdge
};

// --- Main Designer Component ---

const SidebarPalette = ({ onAddNode }: { onAddNode: (type: string, data: any) => void }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const { data: devices } = useQuery({ queryKey: ['devices-arch'], queryFn: async () => (await (await apiFetch('/api/v1/devices/')).json()) })
  const { data: externals } = useQuery({ queryKey: ['externals-arch'], queryFn: async () => (await (await apiFetch('/api/v1/intelligence/entities')).json()) })

  const filteredResources = useMemo(() => {
    if (!devices || !externals) return []
    const devList = devices.filter((d: any) => !d.is_deleted && d.name.toLowerCase().includes(searchTerm.toLowerCase())).map((d: any) => ({ ...d, rType: 'device' }))
    const extList = externals.filter((e: any) => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map((e: any) => ({ ...e, rType: 'external' }))
    return [...devList, ...extList]
  }, [devices, externals, searchTerm])

  return (
    <div className="w-80 glass-panel h-full border-r border-white/5 flex flex-col p-6 space-y-6">
       <div>
          <h2 className="text-[11px] font-black uppercase text-blue-400 tracking-[0.3em] mb-4">Resource Library</h2>
          <div className="relative">
             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
             <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search Assets / IQ..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50"
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
          {filteredResources.map((r: any) => (
             <div key={`${r.rType}-${r.id}`} className="group relative">
                <div className={`p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex flex-col space-y-2`}>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                         <div className={`p-2 rounded-lg ${r.rType === 'device' ? 'bg-blue-500/10 text-blue-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {r.rType === 'device' ? <Server size={14}/> : <Globe size={14}/>}
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-tight truncate max-w-[120px]">{r.name}</p>
                      </div>
                      <button 
                        onClick={() => onAddNode(r.rType, r)}
                        className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 transition-all opacity-0 group-hover:opacity-100"
                      >
                         <Plus size={14}/>
                      </button>
                   </div>
                   {r.rType === 'device' && r.logical_services?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                         {r.logical_services.map((s: any) => (
                            <span key={s.id} className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                               {s.name}
                            </span>
                         ))}
                      </div>
                   )}
                </div>
             </div>
          ))}
       </div>
    </div>
  )
}

function ArchDesignerInner() {
  const { fitView } = useReactFlow();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeFlowId, setActiveFlowId] = useState<number | null>(null);
  const [flowName, setFlowName] = useState('UNNAMED_ARCH_FLOW');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'labeled', 
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
    }, eds)),
    [setEdges]
  );

  const { data: savedFlows } = useQuery({ 
    queryKey: ['data-flows'], 
    queryFn: async () => (await (await apiFetch('/api/v1/data-flows/')).json()) 
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = activeFlowId ? `/api/v1/data-flows/${activeFlowId}` : '/api/v1/data-flows/';
      const method = activeFlowId ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['data-flows'] });
      setActiveFlowId(data.id);
      toast.success('Architecture Matrix Committed');
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      name: flowName,
      nodes_json: nodes,
      edges_json: edges,
      viewport_json: {}
    });
  };

  const handleLoad = (flow: any) => {
    setNodes(flow.nodes_json || []);
    setEdges(flow.edges_json || []);
    setFlowName(flow.name);
    setActiveFlowId(flow.id);
    setTimeout(() => fitView(), 100);
  };

  const onAddResource = (rType: string, data: any) => {
    const parentId = `node-${rType}-${data.id}`;
    const parentNode = {
      id: parentId,
      type: rType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { ...data },
      dragHandle: '.glass-panel'
    };

    let newNodes = [parentNode];

    if (rType === 'device' && data.logical_services) {
      data.logical_services.forEach((s: any, idx: number) => {
        newNodes.push({
          id: `node-service-${s.id}`,
          type: 'service',
          parentNode: parentId,
          position: { x: 20, y: 60 + (idx * 45) },
          data: { ...s },
          extent: 'parent' as any
        });
      });
    }

    setNodes((nds) => [...nds, ...newNodes]);
  };

  const onLayout = useCallback(() => {
    /*
    const dagreGraph = new (dagre as any).graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR' });

    nodes.forEach((node: any) => {
      dagreGraph.setNode(node.id, { width: 300, height: 150 });
    });

    edges.forEach((edge: any) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    (dagre as any).layout(dagreGraph);

    const newNodes = nodes.map((node: any) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        position: {
          x: nodeWithPosition.x - 150,
          y: nodeWithPosition.y - 75,
        },
      };
    });

    setNodes([...newNodes]);
    setEdges([...edges]);
    */
    setTimeout(() => fitView(), 200);
  }, [nodes, edges, setNodes, setEdges, fitView]);

  return (
    <div className="flex-1 relative flex h-full">
       <SidebarPalette onAddNode={onAddResource} />
       
       <div className="flex-1 bg-black/40 relative h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            className="arch-flow-canvas"
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="!bg-slate-900 !border-white/10 !rounded-xl overflow-hidden" />
            <MiniMap 
               className="!bg-slate-950 !border-white/10 !rounded-2xl" 
               nodeColor={(n: any) => n.type === 'service' ? '#10b981' : '#3b82f6'}
               maskColor="rgba(0,0,0,0.6)"
            />
            
            <Panel position="top-left" className="flex flex-col space-y-4">
               <div className="glass-panel p-2 rounded-2xl border border-white/10 flex items-center space-x-3">
                  <input 
                    value={flowName}
                    onChange={e => setFlowName(e.target.value)}
                    className="bg-transparent border-none text-[12px] font-black uppercase text-blue-400 outline-none px-4 w-64 tracking-widest"
                    placeholder="FLOW_MANIFEST_ID..."
                  />
                  <div className="h-6 w-px bg-white/10" />
                  <button onClick={handleSave} className="p-2 bg-blue-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                     <Save size={16}/>
                  </button>
                  <button onClick={onLayout} title="Auto-Hierarchical Layout" className="p-2 bg-emerald-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                     <Layout size={16}/>
                  </button>
               </div>
               
               <div className="flex space-x-2 overflow-x-auto pb-2 custom-scrollbar max-w-[60vw]">
                  <AnimatePresence>
                     {savedFlows?.map((f: any) => (
                        <motion.button
                          key={f.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleLoad(f)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${activeFlowId === f.id ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-500 border-white/10 hover:text-white hover:bg-white/10'}`}
                        >
                           {f.name}
                        </motion.button>
                     ))}
                  </AnimatePresence>
               </div>
            </Panel>

            <Panel position="top-right">
               <div className="glass-panel p-4 rounded-[30px] border border-white/5 flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                     <div className="w-2 h-2 rounded-full bg-blue-500" />
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Internal Asset</span>
                  </div>
                  <div className="flex items-center space-x-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Logical Service</span>
                  </div>
                  <div className="flex items-center space-x-2">
                     <div className="w-2 h-2 rounded-full bg-indigo-500" />
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Partner IQ System</span>
                  </div>
               </div>
            </Panel>
          </ReactFlow>
       </div>
    </div>
  )
}

export default function DataFlowDesigner() {
  return (
    <ReactFlowProvider>
       <ArchDesignerInner />
    </ReactFlowProvider>
  )
}
