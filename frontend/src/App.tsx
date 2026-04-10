import React, { useState, useEffect } from 'react';
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
  X,
  Zap,
  Activity,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { workflowsApi, taxonomyApi, client } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';
import SettingsView from './components/SettingsView';

const queryClient = new QueryClient();

// --- Connection Health Component ---
const ConnectionStatus = () => {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    const checkHealth = async () => {
      const start = performance.now();
      try {
        await client.get('/');
        setLatency(Math.round(performance.now() - start));
        setStatus('connected');
      } catch (err) {
        setStatus('disconnected');
      }
    };

    const interval = setInterval(checkHealth, 5000);
    checkHealth();
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white/[0.03] backdrop-blur-md rounded-full border border-theme-border group transition-all hover:bg-white/[0.06]">
      <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-status-success animate-pulse' : 'bg-status-error'}`} />
      <span className="text-hint text-theme-secondary group-hover:text-theme-primary transition-colors">
        {status === 'connected' ? `Synced • ${latency}ms` : 'Offline'}
      </span>
    </div>
  );
};

// --- Sidebar Component ---
const GlobalSidebar = ({ isOpen, setOpen, activeTab, setActiveTab }: { isOpen: boolean, setOpen: (v: boolean) => void, activeTab: string, setActiveTab: (v: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workflows', label: 'Workflow Repository', icon: Database },
    { id: 'board', label: 'Automation Board', icon: Kanban },
    { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help & Docs', icon: HelpCircle },
  ];

  return (
    <aside className={`relative flex flex-col transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? 'w-72' : 'w-20'} bg-theme-sidebar border-r border-theme-border z-30`}>
      <div 
        className="h-16 flex items-center px-6 mb-4 cursor-pointer group"
        onClick={() => setActiveTab('dashboard')}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-theme-accent flex items-center justify-center text-white shadow-lg shadow-theme-accent/20 group-hover:scale-110 transition-transform duration-300">
            <Zap size={18} fill="currentColor" />
          </div>
          {isOpen && (
            <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-theme-accent transition-colors duration-300">
              Path<span className="text-theme-accent group-hover:text-white">OS</span>
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1.5">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}
          >
            <item.icon size={20} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-nav">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="px-3 py-6 space-y-1.5 border-t border-theme-border/50">
        {bottomItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}
          >
            <item.icon size={20} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-nav">{item.label}</span>}
          </button>
        ))}
        
        <div className="pt-6 mt-4 border-t border-theme-border/50">
          <div className={`flex items-center gap-3.5 px-4 py-2 ${!isOpen && 'justify-center'}`}>
            <div className="w-9 h-9 rounded-full bg-theme-active border border-theme-border/50 overflow-hidden shadow-inner">
               <img src={`https://ui-avatars.com/api/?name=HK&background=007AFF&color=fff`} alt="HK" className="w-full h-full object-cover" />
            </div>
            {isOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-[13px] font-bold text-white truncate leading-none mb-1">Haewon Kim</p>
                <p className="text-hint text-theme-muted leading-none">System Administrator</p>
              </div>
            )}
            {isOpen && <LogOut size={16} className="text-theme-muted hover:text-status-error transition-colors cursor-pointer" />}
          </div>
        </div>
      </div>

      <button 
        onClick={() => setOpen(!isOpen)}
        className="h-12 border-t border-theme-border/50 flex items-center justify-center text-theme-muted hover:text-white transition-colors"
      >
        {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
    </aside>
  );
};

// --- Header Component ---
const GlobalHeader = ({ activeTab }: { activeTab: string }) => {
  return (
    <header className="h-16 bg-theme-header backdrop-blur-xl border-b border-theme-border flex items-center justify-between px-8 z-20 sticky top-0">
      <div className="flex items-center gap-8">
        <h2 className="text-hint text-theme-muted flex items-center gap-2">
          PathOS <span className="opacity-30">/</span> <span className="text-white font-black">{activeTab}</span>
        </h2>
        
        <ConnectionStatus />
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Search commands or data..." 
            className="bg-white/[0.04] border border-theme-border rounded-full pl-10 pr-12 py-2 text-[13px] font-medium focus:outline-none focus:border-theme-accent/50 w-72 transition-all focus:bg-white/[0.08] focus:ring-1 focus:ring-theme-accent/20"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-theme-muted bg-white/[0.05] border border-theme-border rounded px-1.5 py-0.5 pointer-events-none">⌘K</div>
        </div>
        
        <div className="flex items-center gap-4 border-l border-theme-border/50 pl-6">
          <button className="text-theme-secondary hover:text-theme-primary transition-all relative p-2 hover:bg-white/[0.05] rounded-full">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-theme-accent rounded-full border-2 border-theme-header shadow-[0_0_8px_rgba(0,122,255,0.6)]" />
          </button>
          <button className="btn-apple-primary flex items-center gap-2 ml-2">
            <RefreshCw size={14} /> Sync Status
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
          className: 'apple-glass border-theme-border text-white text-[13px] font-semibold rounded-2xl shadow-2xl',
          duration: 4000,
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
          <div className="max-w-[1400px] mx-auto p-8 lg:p-12 animate-apple-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-10">
                <ROIDashboard workflows={workflows} />
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
                    <h3 className="text-header-sub flex items-center gap-2.5">
                      <Database size={18} className="text-theme-accent" /> Recent Automation Nodes
                    </h3>
                    <button onClick={() => setActiveTab('workflows')} className="text-hint text-theme-accent hover:text-white transition-colors flex items-center gap-1.5">
                      View Full Registry <ChevronRight size={14} />
                    </button>
                  </div>
                  <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
                </div>
              </div>
            )}

            {activeTab === 'workflows' && (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-header-main mb-2">Workflow Registry</h2>
                    <p className="text-subtext">Master database of all active and pending metrology sequences.</p>
                  </div>
                  <button onClick={() => setActiveTab('intake')} className="btn-apple-primary flex items-center gap-2">
                    <Database size={16} /> Map New Workflow
                  </button>
                </div>
                
                {/* Ribbon Filters */}
                <div className="flex items-center gap-3">
                  <button className="btn-apple-primary">My Submissions</button>
                  <button className="btn-apple-secondary">Team Queue</button>
                  <button className="btn-apple-secondary">Global Master</button>
                  <button className="btn-apple-secondary">Archive</button>
                </div>

                <WorkflowRegistry workflows={workflows} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
              </div>
            )}

            {activeTab === 'intake' && (
              <div className="max-w-4xl mx-auto">
                <IntakeGatekeeper taxonomy={taxonomy} onSuccess={(data) => createMutation.mutate(data)} />
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}

            {activeTab === 'builder' && selectedWorkflow && (
              <div className="h-[calc(100vh-180px)]">
                <WorkflowBuilder 
                  initialTasks={selectedWorkflow.tasks || []} 
                  onSave={(tasks) => workflowsApi.updateTasks(selectedWorkflow.id, tasks).then(() => {
                    toast.success("Strategy Synchronized");
                    queryClient.invalidateQueries({ queryKey: ['workflows'] });
                  })} 
                />
              </div>
            )}
            
            {(activeTab === 'board' || activeTab === 'analytics') && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-white/[0.03] border border-theme-border rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                  <Database size={32} className="text-theme-muted" />
                </div>
                <h3 className="text-header-sub mb-2">Module Under Construction</h3>
                <p className="text-subtext max-w-sm">This system module is currently being optimized for high-density metrology management.</p>
                <button onClick={() => setActiveTab('dashboard')} className="btn-apple-secondary mt-8">Return to Dashboard</button>
              </div>
            )}
          </div>
        </div>

        {/* Help Sliding Modal Overlay */}
        {showHelp && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500" onClick={() => setShowHelp(false)} />
            <div className="w-[450px] apple-glass border-l h-full relative animate-in slide-in-from-right duration-500 flex flex-col shadow-2xl">
              <div className="h-16 flex items-center justify-between px-8 border-b border-theme-border bg-black/10">
                <h3 className="text-hint flex items-center gap-2.5 text-theme-accent">
                  <HelpCircle size={18} /> System Documentation
                </h3>
                <button onClick={() => setShowHelp(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-theme-muted hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-10">
                <section className="space-y-4">
                  <div className="status-badge bg-theme-accent/10 text-theme-accent inline-block">Workflow Rubric</div>
                  <h4 className="text-header-sub">Validation Standards</h4>
                  <p className="text-main-content">
                    Every workflow must pass the core integrity rubric to ensure data quality. We prioritize repeatable, measurable, and standardized metrology tasks that drive direct operational value.
                  </p>
                </section>
                <section className="space-y-4">
                  <div className="status-badge bg-status-success/10 text-status-success inline-block">ROI Engine</div>
                  <h4 className="text-header-sub">Formula v1.2.6</h4>
                  <p className="text-main-content">
                    ROI is computed by isolating human touch-time from machine cycle-time. This ensures automation efforts are targeted at reducing labor bottlenecks rather than just accelerating hardware.
                  </p>
                  <div className="apple-card-inset text-[13px] font-mono text-theme-secondary">
                    Total ROI = ((Touch Time * Occurrences) + Σ(Error % * Recovery Time)) * Frequency / 60
                  </div>
                </section>
              </div>
              <div className="p-8 border-t border-theme-border bg-black/10 text-hint text-theme-muted flex items-center justify-between">
                <span className="opacity-50">Docs v1.2.6</span>
                <span className="text-theme-accent font-black tracking-normal">PathOS Core System</span>
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
