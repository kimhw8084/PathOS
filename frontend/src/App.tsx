import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  History, 
  Workflow as WorkflowIcon,
  Search,
  Menu,
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { workflowsApi, taxonomyApi } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';

const queryClient = new QueryClient();

// Sidebar Item Component
const SidebarItem = ({ icon: Icon, label, active, onClick, open }: { icon: any, label: string, active?: boolean, onClick: () => void, open: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full sidebar-item ${active ? 'sidebar-item-active' : ''} ${!open ? 'justify-center px-0' : ''}`}
  >
    <Icon size={20} className={active ? 'text-theme-accent' : 'text-theme-secondary'} />
    {open && <span className="font-medium truncate text-sm">{label}</span>}
  </button>
);

const PathOSApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Queries
  const { data: workflows = [] } = useQuery({ 
    queryKey: ['workflows'], 
    queryFn: workflowsApi.list 
  });
  
  const { data: taxonomy = [] } = useQuery({ 
    queryKey: ['taxonomy'], 
    queryFn: taxonomyApi.list 
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Initiative Initialized!");
      setSelectedWorkflow(data);
      setActiveTab('builder');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create workflow.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow archived.");
    }
  });

  const handleIntakeSuccess = (data: any) => {
    createMutation.mutate(data);
  };

  const handleSelectWorkflow = (wf: any) => {
    setSelectedWorkflow(wf);
    setActiveTab('builder');
  };

  return (
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden font-sans">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#0c0c0c', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', borderRadius: '14px' }
      }} />

      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-60' : 'w-20'} 
        bg-theme-sidebar/50 backdrop-blur-xl border-r border-theme-border flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25, 1, 0.5, 1)]
      `}>
        <div className="p-6 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-theme-accent to-[#64d2ff] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-theme-accent/20 shrink-0">
            P
          </div>
          {isSidebarOpen && <span className="text-xl font-bold tracking-tight text-gradient">PathOS</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1.5 py-6">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} open={isSidebarOpen} />
          <SidebarItem icon={PlusCircle} label="New Intake" active={activeTab === 'intake'} onClick={() => { setSelectedWorkflow(null); setActiveTab('intake'); }} open={isSidebarOpen} />
          <SidebarItem icon={WorkflowIcon} label="Registry" active={activeTab === 'registry'} onClick={() => setActiveTab('registry')} open={isSidebarOpen} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} open={isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-theme-border/50">
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} open={isSidebarOpen} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-theme-bg/60 backdrop-blur-md border-b border-theme-border/50 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-full text-theme-secondary transition-all">
              <Menu size={18} />
            </button>
            <h1 className="text-sm font-semibold tracking-wide uppercase text-theme-secondary opacity-80">{activeTab === 'builder' ? `Workflow Builder` : activeTab}</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted group-focus-within:text-theme-accent transition-colors" size={15} />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="bg-white/5 border border-theme-border rounded-full pl-10 pr-4 py-1.5 text-xs focus:outline-none focus:border-theme-accent/40 w-56 transition-all focus:w-72"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 border border-theme-border flex items-center justify-center text-[10px] font-bold text-theme-secondary hover:text-theme-primary hover:border-theme-border-bright cursor-pointer transition-all">
              HK
            </div>
          </div>
        </header>

        {/* Content Region */}
        <div className="flex-1 overflow-auto custom-scrollbar p-10">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-2">
                  <h2 className="text-4xl font-bold tracking-tight text-white mb-2">Operations Hub</h2>
                  <p className="text-theme-secondary text-lg font-medium opacity-60">Metrology Automation Lifecycle & Prioritization</p>
                </div>
                <ROIDashboard workflows={workflows} />
                <div className="mt-14 space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-lg font-bold text-white tracking-tight">Recent Initiatives</h3>
                    <button onClick={() => setActiveTab('registry')} className="text-xs font-semibold text-theme-accent hover:underline">View All Registry</button>
                  </div>
                  <WorkflowRegistry workflows={workflows.slice(0, 5)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
                </div>
              </div>
            )}

            {activeTab === 'intake' && (
              <IntakeGatekeeper taxonomy={taxonomy} onSuccess={handleIntakeSuccess} />
            )}

            {activeTab === 'registry' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Automation Registry</h2>
                  <button onClick={() => setActiveTab('intake')} className="btn-primary flex items-center gap-2">
                    <PlusCircle size={18} /> New Workflow
                  </button>
                </div>
                <WorkflowRegistry workflows={workflows} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
              </div>
            )}

            {activeTab === 'builder' && selectedWorkflow && (
              <WorkflowBuilder 
                initialTasks={selectedWorkflow.tasks || []} 
                onSave={(tasks) => workflowsApi.updateTasks(selectedWorkflow.id, tasks).then(() => toast.success("Workflow Saved!"))} 
              />
            )}
          </div>
        </div>
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
