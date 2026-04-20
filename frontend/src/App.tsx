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
  Bug,
  AlertTriangle
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useLocation,
  Link
} from 'react-router-dom';
import { workflowsApi, taxonomyApi, apiClient as client, setGlobalReporter } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';
import SettingsView from './components/SettingsView';
import { ErrorFortressProvider, useErrorFortress } from './components/ErrorFortress';
import * as Tooltip from '@radix-ui/react-tooltip';

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

const ConfirmationDialog = ({ isOpen, onConfirm, onCancel, title, message }: { 
  isOpen: boolean, 
  onConfirm: () => void, 
  onCancel: () => void, 
  title: string, 
  message: string 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-apple-in">
      <div className="apple-glass w-[400px] p-8 border border-white/10 rounded-3xl shadow-2xl flex flex-col gap-6 text-center">
        <div className="w-16 h-16 bg-status-warning/10 rounded-full flex items-center justify-center mx-auto border border-status-warning/20">
          <AlertTriangle size={32} className="text-status-warning" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h3>
          <p className="text-[13px] font-bold text-white/40 leading-relaxed uppercase">{message}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
            Stay Here
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-status-error text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-status-error/20 hover:bg-rose-600 transition-all">
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const GlobalSidebar = ({ isOpen, setOpen, onNavigateRequested }: { 
  isOpen: boolean, 
  setOpen: (v: boolean) => void, 
  onNavigateRequested: (path: string) => void
}) => {
  const location = useLocation();
  const currentTab = location.pathname.split('/')[1] || 'dashboard';

  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'workflows', label: 'Workflow Repository', icon: Database, path: '/workflows' },
    { id: 'board', label: 'Operational Board', icon: Kanban, path: '/board' },
    { id: 'analytics', label: 'Performance Analytics', icon: BarChart3, path: '/analytics' },
  ];
  const bottomItems = [
    { id: 'settings', label: 'System Settings', icon: Settings, path: '/settings' },
    { id: 'help', label: 'Documentation', icon: HelpCircle, path: '/help' },
  ];

  const handleNav = (path: string) => {
    onNavigateRequested(path);
  };

  return (
    <aside className={`relative flex flex-col transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? 'w-64' : 'w-16'} bg-theme-sidebar border-r border-theme-border z-30`}>
      <div className="h-14 flex items-center px-5 mb-2 cursor-pointer group" onClick={() => handleNav('/dashboard')}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-theme-accent flex items-center justify-center text-white shadow-lg shadow-theme-accent/20 group-hover:scale-110 transition-transform duration-300">
            <Layers size={16} fill="currentColor" />
          </div>
          {isOpen && <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-theme-accent transition-colors duration-300">Path<span className="text-theme-accent group-hover:text-white">OS</span></span>}
        </div>
      </div>
      <nav className="flex-1 px-2.5 space-y-1">
        {menuItems.map(item => (
          <button key={item.id} onClick={() => handleNav(item.path)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${currentTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}>
            <item.icon size={18} className={currentTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
            {isOpen && <span className="text-nav">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="px-2.5 py-4 space-y-1 border-t border-theme-border/50">
        {bottomItems.map(item => (
          <button key={item.id} onClick={() => handleNav(item.path)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${currentTab === item.id ? 'sidebar-item-active text-theme-accent' : 'text-theme-secondary hover:bg-white/[0.04] hover:text-white'}`}>
            <item.icon size={18} className={currentTab === item.id ? 'text-theme-accent' : 'text-theme-muted group-hover:text-theme-secondary'} />
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

const GlobalHeader = () => {
  const { setIsOpen, isOpen, errors } = useErrorFortress();
  const location = useLocation();
  const currentTab = location.pathname.split('/')[1] || 'dashboard';
  
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
        <h2 className="text-hint text-theme-muted flex items-center gap-2">PathOS <span className="opacity-30">/</span> <span className="text-white font-black uppercase tracking-[0.1em]">{getTabLabel(currentTab)}</span></h2>
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
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reportError } = useErrorFortress();

  useEffect(() => {
    setGlobalReporter(reportError);
  }, [reportError]);

  const { data: workflows = [] } = useQuery({ 
    queryKey: ['workflows'], 
    queryFn: () => workflowsApi.list(true) 
  });
  const { data: taxonomy = [] } = useQuery({ queryKey: ['taxonomy'], queryFn: taxonomyApi.list });

  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow Created");
      setSelectedWorkflow(data);
      navigate('/workflows/builder');
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
      toast.success("Workflow archived.");
    }
  });

  const restoreMutation = useMutation({
    mutationFn: workflowsApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow restored.");
    }
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSelectWorkflow = (wf: any) => {
    if (isDirty) {
      setPendingNavPath(`/workflows/builder`);
      setShowConfirm(true);
      // We don't actually navigate yet, just set the pending path
      // but we need the workflow data. Better to just block.
      return;
    }
    setSelectedWorkflow(wf);
    navigate('/workflows/builder');
  };

  const handleNavigateRequest = (path: string) => {
    if (isDirty) {
      setPendingNavPath(path);
      setShowConfirm(true);
    } else {
      if (['/workflows', '/dashboard', '/board', '/analytics', '/settings'].includes(path)) {
        setSelectedWorkflow(null);
      }
      navigate(path);
    }
  };

  const confirmDiscard = () => {
    setIsDirty(false);
    setShowConfirm(false);
    if (pendingNavPath) {
      if (['/workflows', '/dashboard', '/board', '/analytics', '/settings'].includes(pendingNavPath)) {
        setSelectedWorkflow(null);
      }
      navigate(pendingNavPath);
      setPendingNavPath(null);
    }
  };

  return (
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden font-sans selection:bg-theme-accent selection:text-white">
      <Toaster position="bottom-right" toastOptions={{ className: 'apple-glass border-theme-border text-white text-[13px] font-semibold rounded-xl shadow-2xl', duration: 4000 }} />
      <GlobalSidebar 
        isOpen={isSidebarOpen} 
        setOpen={setSidebarOpen} 
        onNavigateRequested={handleNavigateRequest}
      />
      <ConfirmationDialog 
        isOpen={showConfirm}
        onConfirm={confirmDiscard}
        onCancel={() => setShowConfirm(false)}
        title="Discard Unsaved Changes?"
        message="You have unsaved process configurations. Moving to a different view will permanently lose these modifications."
      />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <GlobalHeader />
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <div className="mx-auto p-4 lg:p-6 animate-apple-in max-w-full h-full">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <div className="space-y-6 max-w-[1400px] mx-auto">
                  <ROIDashboard workflows={workflows.filter((w: any) => !w.is_deleted)} />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-theme-border/50 pb-2">
                      <h3 className="text-header-sub flex items-center gap-2"><Database size={16} className="text-theme-accent" /> Recent Workflows</h3>
                      <Link to="/workflows" className="text-hint text-theme-accent hover:text-white transition-colors flex items-center gap-1">View Repository <ChevronRight size={12} /></Link>
                    </div>
                    <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} onRestore={restoreMutation.mutate} />
                  </div>
                </div>
              } />
              <Route path="/workflows" element={
                <WorkflowRegistry 
                  workflows={workflows} 
                  onSelect={handleSelectWorkflow} 
                  onDelete={deleteMutation.mutate} 
                  onRestore={restoreMutation.mutate}
                  onCreateNew={() => {
                    setSelectedWorkflow(null);
                    navigate('/workflows/intake');
                  }}
                />
              } />
              <Route path="/workflows/intake" element={
                <div className="max-w-4xl mx-auto">
                  <IntakeGatekeeper 
                    key={selectedWorkflow?.id || 'new'}
                    initialData={selectedWorkflow} 
                    taxonomy={taxonomy} 
                    onSuccess={(data) => { 
                      if (selectedWorkflow) { 
                        workflowsApi.update(selectedWorkflow.id, data).then((updated) => { 
                          setSelectedWorkflow(updated); 
                          navigate('/workflows/builder'); 
                        }); 
                      } else { 
                        createMutation.mutate(data); 
                      } 
                    }} 
                    onCancel={() => handleNavigateRequest('/workflows')} 
                    onRestart={() => setSelectedWorkflow(null)}
                  />
                </div>
              } />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/workflows/builder" element={
                selectedWorkflow ? (
                  <div className="h-[calc(100vh-140px)]">
                    <WorkflowBuilder 
                      key={selectedWorkflow.id}
                      workflow={selectedWorkflow}
                      taxonomy={taxonomy}
                      onSave={(data) => workflowsApi.update(selectedWorkflow.id, data).then(() => {
                        toast.success("Configuration Saved");
                        queryClient.invalidateQueries({ queryKey: ['workflows'] });
                        setIsDirty(false);
                      })} 
                      onBack={() => navigate('/workflows/intake')}
                      onExit={() => handleNavigateRequest('/workflows')}
                      setIsDirty={setIsDirty}
                    />
                  </div>
                ) : <Navigate to="/workflows" replace />
              } />
              <Route path="*" element={<div className="flex flex-col items-center justify-center h-full text-theme-muted uppercase font-black tracking-widest gap-4 opacity-20"><Layers size={64} /> <span>Under Development</span></div>} />
            </Routes>
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
        <Router>
          <PathOSApp />
        </Router>
      </ErrorFortressProvider>
    </Tooltip.Provider>
  </QueryClientProvider>
);

export default App;
