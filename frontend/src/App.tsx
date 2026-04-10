import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Kanban, 
  BarChart3, 
  Settings, 
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  LogOut,
  X
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { workflowsApi, taxonomyApi } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';

const queryClient = new QueryClient();

// --- Sidebar Component ---
const GlobalSidebar = ({ isOpen, setOpen, activeTab, setActiveTab }: { isOpen: boolean, setOpen: (v: boolean) => void, activeTab: string, setActiveTab: (v: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workflows', label: 'Workflow Repo', icon: Database },
    { id: 'board', label: 'Automation Board', icon: Kanban },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help / Docs', icon: HelpCircle },
  ];

  return (
    <aside className={`bg-theme-sidebar border-r border-theme-border flex flex-col transition-all duration-300 ${isOpen ? 'w-64' : 'w-16'} z-30`}>
      <div className="h-14 flex items-center px-4 border-b border-theme-border justify-between">
        {isOpen ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-theme-accent flex items-center justify-center text-white font-black text-sm">P</div>
            <span className="font-black text-base tracking-tighter uppercase italic">Path<span className="text-theme-accent">OS</span></span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded bg-theme-accent flex items-center justify-center text-white font-black text-sm mx-auto">P</div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group ${activeTab === item.id ? 'bg-theme-active text-theme-accent' : 'text-theme-secondary hover:bg-white/5 hover:text-white'}`}
          >
            <item.icon size={18} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-[13px] font-bold tracking-tight">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="px-2 py-4 space-y-1 border-t border-theme-border">
        {bottomItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group ${activeTab === item.id ? 'bg-theme-active text-theme-accent' : 'text-theme-secondary hover:bg-white/5 hover:text-white'}`}
          >
            <item.icon size={18} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-[13px] font-bold tracking-tight">{item.label}</span>}
          </button>
        ))}
        
        <div className="pt-4 mt-4 border-t border-theme-border">
          <div className={`flex items-center gap-3 px-3 py-2 ${!isOpen && 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-theme-active border border-theme-border flex items-center justify-center text-[10px] font-black text-theme-secondary">HK</div>
            {isOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter leading-none mb-0.5">Haewon Kim</p>
                <p className="text-[9px] font-bold text-theme-muted uppercase tracking-widest leading-none">Admin_Level_4</p>
              </div>
            )}
            {isOpen && <LogOut size={14} className="text-theme-muted hover:text-status-error cursor-pointer" />}
          </div>
        </div>
      </div>

      <button 
        onClick={() => setOpen(!isOpen)}
        className="h-10 border-t border-theme-border flex items-center justify-center text-theme-muted hover:text-white transition-colors"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </aside>
  );
};

// --- Header Component ---
const GlobalHeader = ({ activeTab }: { activeTab: string }) => {
  return (
    <header className="h-14 bg-theme-header border-b border-theme-border flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-muted flex items-center gap-2">
          System_Root / <span className="text-white opacity-100">{activeTab}</span>
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Search Global Index..." 
            className="bg-white/5 border border-theme-border rounded-full px-9 py-1.5 text-[11px] font-bold focus:outline-none focus:border-theme-accent/50 w-64 transition-all focus:bg-white/[0.08]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-theme-muted border border-theme-border rounded px-1 px-1 opacity-50">CMD+K</div>
        </div>
        
        <div className="flex items-center gap-3 border-l border-theme-border pl-6">
          <button className="text-theme-secondary hover:text-theme-primary transition-colors relative p-1.5 hover:bg-white/5 rounded-full">
            <Bell size={18} />
            <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-theme-accent rounded-full border-2 border-theme-header" />
          </button>
          <div className="h-4 w-px bg-theme-border mx-1" />
          <button className="text-[10px] font-black uppercase tracking-widest text-theme-accent bg-theme-accent/5 border border-theme-accent/20 px-3 py-1.5 rounded-sm hover:bg-theme-accent hover:text-white transition-all">
            Simulate_Load
          </button>
        </div>
      </div>
    </header>
  );
};

const PathOSApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: workflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list });
  const { data: taxonomy = [] } = useQuery({ queryKey: ['taxonomy'], queryFn: taxonomyApi.list });

  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Protocol Initialized");
      setSelectedWorkflow(data);
      setActiveTab('builder');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Intake failed.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Node archived.");
    }
  });

  const handleSelectWorkflow = (wf: any) => {
    setSelectedWorkflow(wf);
    setActiveTab('builder');
  };

  const currentTab = activeTab === 'help' ? 'workflows' : activeTab;

  return (
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden font-sans selection:bg-theme-accent selection:text-white">
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a0a0a',
            color: '#fff',
            border: '1px solid #1a1a1a',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }
        }}
      />

      <GlobalSidebar 
        isOpen={isSidebarOpen} 
        setOpen={setSidebarOpen} 
        activeTab={activeTab === 'help' ? 'help' : currentTab} 
        setActiveTab={(t) => t === 'help' ? setShowHelp(true) : setActiveTab(t)} 
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <GlobalHeader activeTab={activeTab} />

        {/* Content Area */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <div className="max-w-[1600px] mx-auto p-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <ROIDashboard workflows={workflows} />
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-theme-border pb-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-theme-secondary flex items-center gap-2">
                      <Database size={14} /> Active Automation Nodes
                    </h3>
                    <button onClick={() => setActiveTab('workflows')} className="text-[10px] font-black text-theme-accent hover:underline uppercase tracking-widest">Full_Registry</button>
                  </div>
                  <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
                </div>
              </div>
            )}

            {activeTab === 'workflows' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-theme-border pb-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">Workflow_Repo</h2>
                    <p className="text-[11px] text-theme-secondary uppercase tracking-widest font-bold">Master database of all departmental sequences</p>
                  </div>
                  <button onClick={() => setActiveTab('intake')} className="bg-theme-accent text-white px-5 py-2 text-[11px] font-black uppercase tracking-widest rounded shadow-[0_0_15px_rgba(var(--theme-accent-rgb),0.3)] hover:scale-[1.02] transition-all flex items-center gap-2">
                    <Database size={14} /> Map_New_Workflow
                  </button>
                </div>
                
                {/* Ribbon Filters */}
                <div className="flex items-center gap-2 pb-2">
                  <button className="px-4 py-1.5 bg-theme-accent text-white text-[10px] font-black uppercase rounded-sm shadow-lg">My Submitted</button>
                  <button className="px-4 py-1.5 bg-white/5 text-theme-secondary text-[10px] font-black uppercase rounded-sm border border-theme-border hover:border-theme-accent transition-colors">Team Workflows</button>
                  <button className="px-4 py-1.5 bg-white/5 text-theme-secondary text-[10px] font-black uppercase rounded-sm border border-theme-border hover:border-theme-accent transition-colors">Global Master</button>
                  <button className="px-4 py-1.5 bg-white/5 text-theme-secondary text-[10px] font-black uppercase rounded-sm border border-theme-border hover:border-theme-accent transition-colors">My Drafts</button>
                </div>

                <WorkflowRegistry workflows={workflows} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
              </div>
            )}

            {activeTab === 'intake' && (
              <IntakeGatekeeper taxonomy={taxonomy} onSuccess={(data) => createMutation.mutate(data)} />
            )}

            {activeTab === 'builder' && selectedWorkflow && (
              <WorkflowBuilder 
                initialTasks={selectedWorkflow.tasks || []} 
                onSave={(tasks) => workflowsApi.updateTasks(selectedWorkflow.id, tasks).then(() => {
                  toast.success("Strategy Synchronized");
                  queryClient.invalidateQueries({ queryKey: ['workflows'] });
                })} 
              />
            )}
            
            {(activeTab === 'board' || activeTab === 'analytics' || activeTab === 'settings') && (
              <div className="h-[60vh] flex flex-col items-center justify-center opacity-30">
                <Database size={48} className="text-theme-muted mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.3em]">Module_In_Deployment</p>
              </div>
            )}
          </div>
        </div>

        {/* Help Sliding Modal Overlay */}
        {showHelp && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
            <div className="w-1/3 bg-theme-sidebar border-l border-theme-border h-full relative animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="h-14 flex items-center justify-between px-6 border-b border-theme-border bg-theme-header">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-theme-accent">
                  <HelpCircle size={14} /> System_Documentation
                </h3>
                <button onClick={() => setShowHelp(false)} className="text-theme-muted hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-8">
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest bg-white/5 px-2 py-1 inline-block">Workflow_Rubric</h4>
                  <p className="text-xs text-theme-secondary leading-relaxed">
                    Every workflow must pass the 3-question rubric to ensure data integrity. We only automate repeatable, measurable, and standardized metrology tasks.
                  </p>
                </section>
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest bg-white/5 px-2 py-1 inline-block">ROI_Calculation</h4>
                  <p className="text-xs text-theme-secondary leading-relaxed">
                    ROI = ((Touch Time * Occurrences) + (Error % * Recovery Time)) * Frequency. 
                    Note that ROI is calculated strictly on human touch time, not equipment machine time.
                  </p>
                </section>
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest bg-white/5 px-2 py-1 inline-block">Version_Control</h4>
                  <p className="text-xs text-theme-secondary leading-relaxed">
                    Locked workflows can be versioned into v2 drafts. This allows for continuous process improvement without disrupting the active automation pipeline.
                  </p>
                </section>
              </div>
              <div className="p-6 border-t border-theme-border bg-theme-header text-[9px] font-black uppercase tracking-widest text-theme-muted flex items-center justify-between">
                <span>Documentation v1.2.6</span>
                <span className="text-theme-accent">PathOS Core</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <PathOSApp />
  </QueryClientProvider>
);

export default App;
