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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-theme-accent text-white shadow-lg shadow-theme-accent/20' 
        : 'text-theme-secondary hover:bg-white/5 hover:text-theme-primary'
    }`}
  >
    <Icon size={20} />
    {open && <span className="font-medium truncate">{label}</span>}
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
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1a1b26', color: '#c0caf5', border: '1px solid #292e42' }
      }} />

      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-theme-sidebar border-r border-theme-border flex flex-col transition-all duration-300 ease-in-out
      `}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl system-gradient flex items-center justify-center text-white font-bold text-xl shadow-lg shrink-0">
            P
          </div>
          {isSidebarOpen && <span className="text-xl font-bold tracking-tighter">PathOS</span>}
        </div>

        <nav className="flex-1 px-3 space-y-2 py-4">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} open={isSidebarOpen} />
          <SidebarItem icon={PlusCircle} label="New Intake" active={activeTab === 'intake'} onClick={() => { setSelectedWorkflow(null); setActiveTab('intake'); }} open={isSidebarOpen} />
          <SidebarItem icon={WorkflowIcon} label="Registry" active={activeTab === 'registry'} onClick={() => setActiveTab('registry')} open={isSidebarOpen} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} open={isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-theme-border">
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} open={isSidebarOpen} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-theme-header backdrop-blur-md border-b border-theme-border flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-theme-secondary transition-all">
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold capitalize tracking-wide">{activeTab === 'builder' ? `Building: ${selectedWorkflow?.name}` : activeTab}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
              <input 
                type="text" 
                placeholder="Search registry..." 
                className="bg-theme-input border border-theme-border rounded-full pl-10 pr-4 py-1.5 text-xs focus:outline-none focus:border-theme-accent/50 w-64 transition-all"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-theme-accent/20 border border-theme-accent/30 flex items-center justify-center text-xs font-bold text-theme-accent">
              HK
            </div>
          </div>
        </header>

        {/* Content Region */}
        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight">Metrology Operations Hub</h2>
                  <p className="text-theme-secondary mt-1">ROI Tracking & Automation Backlog Priority</p>
                </div>
                <ROIDashboard workflows={workflows} />
                <div className="mt-12">
                  <h3 className="text-lg font-bold mb-4">Latest Active Initiatives</h3>
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
                workflow={selectedWorkflow} 
                initialTasks={selectedWorkflow.tasks || []} 
                onSave={() => toast.success("Workflow saved & ROI updated.")}
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
