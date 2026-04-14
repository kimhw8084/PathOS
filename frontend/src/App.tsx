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
  Layers,
  Terminal,
  Bug
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { workflowsApi, taxonomyApi, apiClient as client, setGlobalReporter } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';
import SettingsView from './components/SettingsView';
import { ErrorFortressProvider, useErrorFortress } from './components/ErrorFortress';
import * as Tooltip from '@radix-ui/react-tooltip';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const queryClient = new QueryClient();

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
        {status === 'connected' ? `Synchronized • ${latency}ms` : 'Offline'}
      </span>
    </div>
  );
};

const GlobalSidebar = ({ isOpen, setOpen, activeTab, setActiveTab }: { isOpen: boolean, setOpen: (v: boolean) => void, activeTab: string, setActiveTab: (v: string) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'workflows', label: 'Workflow Repository', icon: Database },
    { id: 'board', label: 'Operational Board', icon: Kanban },
    { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
  ];
  const bottomItems = [
    { id: 'settings', label: 'System Settings', icon: Settings },
    { id: 'help', label: 'Documentation', icon: HelpCircle },
  ];

  return (
    <aside className={`relative flex flex-col transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? 'w-64' : 'w-16'} bg-theme-sidebar border-r border-theme-border z-30`}>
      <div className="h-14 flex items-center px-5 mb-2 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-theme-accent flex items-center justify-center text-white shadow-lg shadow-theme-accent/20 group-hover:scale-110 transition-transform duration-300">
            <Layers size={16} fill="currentColor" />
          </div>
          {isOpen && <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-theme-accent transition-colors duration-300">Path<span className="text-theme-accent group-hover:text-white">OS</span></span>}
        </div>
      </div>
      <nav className="flex-1 px-2.5 space-y-1">
        {menuItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${activeTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}>
            <item.icon size={18} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-nav">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="px-2.5 py-4 space-y-1 border-t border-theme-border/50">
        {bottomItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${activeTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}>
            <item.icon size={18} className={activeTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-nav">{item.label}</span>}
          </button>
        ))}
        
        {/* Sidebar Footer */}
        <div className="pt-3 mt-1 border-t border-theme-border/30">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-theme-secondary hover:bg-white/[0.04] hover:text-white group">
            <div className="w-6 h-6 rounded-full bg-theme-accent/20 border border-theme-accent/30 flex items-center justify-center text-[11px] font-black text-theme-accent group-hover:scale-110 transition-transform">
              HK
            </div>
            {isOpen && (
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-[11px] font-bold truncate w-full text-left text-white">Haewon Kim</span>
                <span className="text-[9px] text-theme-muted font-bold uppercase tracking-widest leading-none">Metrology SME</span>
              </div>
            )}
          </button>
        </div>
      </div>
      <button onClick={() => setOpen(!isOpen)} className="h-10 border-t border-theme-border/50 flex items-center justify-center text-theme-muted hover:text-white transition-colors">
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </aside>
  );
};

const GlobalHeader = ({ activeTab }: { activeTab: string }) => {
  const { setIsOpen, isOpen, errors } = useErrorFortress();
  
  const getTabLabel = (id: string) => {
    const labels: Record<string, string> = {
      'dashboard': 'Executive Dashboard',
      'workflows': 'Workflow Repository',
      'board': 'Operational Board',
      'analytics': 'Advanced Analytics',
      'settings': 'System Settings',
      'help': 'Documentation',
      'intake': 'Initial Assessment',
      'builder': 'Process Configuration'
    };
    return labels[id] || id;
  };

  return (
    <header className="h-14 bg-theme-header backdrop-blur-xl border-b border-theme-border flex items-center justify-between px-6 z-20 sticky top-0">
      <div className="flex items-center gap-6">
        <h2 className="text-hint text-theme-muted flex items-center gap-2">PathOS <span className="opacity-30">/</span> <span className="text-white font-black uppercase tracking-[0.1em]">{getTabLabel(activeTab)}</span></h2>
        <ConnectionStatus />
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 ${errors.length > 0 ? 'bg-status-error/10 border-status-error/30 text-status-error animate-pulse' : 'bg-white/[0.03] border-theme-border text-theme-secondary hover:bg-white/[0.06] hover:text-white'}`}
        >
          {errors.length > 0 ? <Bug size={14} /> : <Terminal size={14} />}
          <span className="text-[11px] font-black uppercase tracking-widest">
            Logs {errors.length > 0 ? `(${errors.length})` : ''}
          </span>
        </button>
      </div>
    </header>
  );
};

const PathOSApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workflows'); // Default to Repository
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { reportError } = useErrorFortress();

  useEffect(() => {
    setGlobalReporter(reportError);
  }, [reportError]);

  const { data: workflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list });
  const { data: taxonomy = [] } = useQuery({ queryKey: ['taxonomy'], queryFn: taxonomyApi.list });

  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow Created");
      setSelectedWorkflow(data);
      setActiveTab('builder');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Creation failed.");
      reportError(error.response?.data || error, 'backend');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow deleted.");
    }
  });

  const handleSelectWorkflow = (wf: any) => {
    setSelectedWorkflow(wf);
    setActiveTab('builder');
  };

  return (
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden font-sans selection:bg-theme-accent selection:text-white">
      <Toaster position="bottom-right" toastOptions={{ className: 'apple-glass border-theme-border text-white text-[13px] font-semibold rounded-xl shadow-2xl', duration: 4000 }} />
      <GlobalSidebar isOpen={isSidebarOpen} setOpen={setSidebarOpen} activeTab={activeTab} setActiveTab={(t) => setActiveTab(t)} />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <GlobalHeader activeTab={activeTab} />
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <div className={cn(
            "mx-auto p-4 lg:p-6 animate-apple-in",
            activeTab === 'workflows' || activeTab === 'builder' ? "max-w-full h-full" : "max-w-[1400px]"
          )}>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <ROIDashboard workflows={workflows} />
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-theme-border/50 pb-2">
                    <h3 className="text-header-sub flex items-center gap-2"><Database size={16} className="text-theme-accent" /> Recent Workflows</h3>
                    <button onClick={() => setActiveTab('workflows')} className="text-hint text-theme-accent hover:text-white transition-colors flex items-center gap-1">View Repository <ChevronRight size={12} /></button>
                  </div>
                  <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
                </div>
              </div>
            )}
            {activeTab === 'workflows' && (
              <div className="space-y-6">
                <WorkflowRegistry 
                  workflows={workflows} 
                  onSelect={handleSelectWorkflow} 
                  onDelete={deleteMutation.mutate} 
                  onCreateNew={() => setActiveTab('intake')}
                />
              </div>
            )}
            {activeTab === 'intake' && <div className="max-w-4xl mx-auto"><IntakeGatekeeper taxonomy={taxonomy} onSuccess={(data) => createMutation.mutate(data)} /></div>}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'builder' && selectedWorkflow && (
              <div className="h-[calc(100vh-140px)]">
                <WorkflowBuilder 
                  initialTasks={selectedWorkflow.tasks || []} 
                  workflowMetadata={{ 
                    cadence_count: selectedWorkflow.cadence_count, 
                    cadence_unit: selectedWorkflow.cadence_unit as any,
                    equipment_state: 'READY',
                    cleanroom_class: 'ISO7',
                    status: 'DRAFT'
                  }}
                  onSave={(tasks, meta) => workflowsApi.update(selectedWorkflow.id, { ...selectedWorkflow, tasks, ...meta }).then(() => {
                    toast.success("Configuration Saved");
                    queryClient.invalidateQueries({ queryKey: ['workflows'] });
                  })} 
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <Tooltip.Provider delayDuration={400}>
      <ErrorFortressProvider>
        <PathOSApp />
      </ErrorFortressProvider>
    </Tooltip.Provider>
  </QueryClientProvider>
);

export default App;
