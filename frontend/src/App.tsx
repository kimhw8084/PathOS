import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  History, 
  Workflow as WorkflowIcon,
  Menu,
  ChevronLeft,
  Bell,
  Command,
  Database
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { workflowsApi, taxonomyApi } from './api/client';
import IntakeGatekeeper from './components/IntakeGatekeeper';
import WorkflowRegistry from './components/WorkflowRegistry';
import ROIDashboard from './components/ROIDashboard';
import WorkflowBuilder from './components/WorkflowBuilder';

const queryClient = new QueryClient();

const SidebarItem = ({ icon: Icon, label, active, onClick, open }: { icon: any, label: string, active?: boolean, onClick: () => void, open: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full sidebar-item ${active ? 'sidebar-item-active' : ''} ${!open ? 'justify-center' : 'px-3'} group`}
  >
    <Icon size={16} className={active ? 'text-theme-primary' : 'text-theme-secondary group-hover:text-theme-primary'} />
    {open && (
      <span className="font-medium text-[12px] tracking-tight">
        {label}
      </span>
    )}
  </button>
);

const PathOSApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  
  const queryClient = useQueryClient();

  const { data: workflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list });
  const { data: taxonomy = [] } = useQuery({ queryKey: ['taxonomy'], queryFn: taxonomyApi.list });

  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Protocol Initialized", { style: { background: '#0d0d0d', color: '#fff', border: '1px solid #1a1a1a', fontSize: '12px' } });
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

  return (
    <div className="flex h-screen bg-theme-bg text-theme-primary overflow-hidden font-sans">
      <Toaster position="bottom-right" />

      {/* Sidebar - Compact Professional */}
      <aside className={`${isSidebarOpen ? 'w-52' : 'w-14'} bg-theme-sidebar border-r border-theme-border flex flex-col transition-all duration-200 z-30`}>
        <div className="h-12 flex items-center px-4 border-b border-theme-border gap-2">
          <div className="w-6 h-6 rounded bg-theme-accent flex items-center justify-center text-white font-bold text-xs shrink-0">P</div>
          {isSidebarOpen && <span className="font-bold text-sm tracking-tight">PathOS <span className="text-[10px] text-theme-muted font-normal uppercase tracking-wider">v1.0</span></span>}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Operations" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} open={isSidebarOpen} />
          <SidebarItem icon={PlusCircle} label="New Intake" active={activeTab === 'intake'} onClick={() => { setSelectedWorkflow(null); setActiveTab('intake'); }} open={isSidebarOpen} />
          <SidebarItem icon={WorkflowIcon} label="Registry" active={activeTab === 'registry'} onClick={() => setActiveTab('registry')} open={isSidebarOpen} />
          <SidebarItem icon={History} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} open={isSidebarOpen} />
        </nav>

        <div className="p-2 border-t border-theme-border">
          <SidebarItem icon={Settings} label="System Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} open={isSidebarOpen} />
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Narrow Technical */}
        <header className="h-12 bg-theme-header border-b border-theme-border flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-theme-secondary hover:text-theme-primary transition-colors">
              {isSidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
            </button>
            <div className="h-4 w-px bg-theme-border" />
            <h1 className="text-[11px] font-bold tracking-widest uppercase text-theme-secondary">
              {activeTab === 'builder' ? `Architect / ${selectedWorkflow?.name}` : activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Command size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-white/5 border border-theme-border rounded px-8 py-1 text-[11px] focus:outline-none focus:border-theme-accent/50 w-48 transition-all"
              />
            </div>
            <button className="text-theme-secondary hover:text-theme-primary transition-colors relative">
              <Bell size={16} />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-status-error rounded-full" />
            </button>
            <div className="w-6 h-6 rounded bg-theme-active border border-theme-border flex items-center justify-center text-[9px] font-bold text-theme-secondary">HK</div>
          </div>
        </header>

        {/* Content - High Density */}
        <div className="flex-1 overflow-auto custom-scrollbar p-6">
          <div className="max-w-[1600px] mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <ROIDashboard workflows={workflows} />
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-theme-border pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-theme-secondary flex items-center gap-2">
                      <Database size={14} /> Active Automation Nodes
                    </h3>
                    <button onClick={() => setActiveTab('registry')} className="text-[10px] font-bold text-theme-accent hover:underline">Full Registry</button>
                  </div>
                  <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
                </div>
              </div>
            )}

            {activeTab === 'intake' && (
              <IntakeGatekeeper taxonomy={taxonomy} onSuccess={(data) => createMutation.mutate(data)} />
            )}

            {activeTab === 'registry' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-theme-border pb-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Automation Registry</h2>
                    <p className="text-[11px] text-theme-secondary uppercase tracking-wider">System-wide index of all metrology automation nodes</p>
                  </div>
                  <button onClick={() => setActiveTab('intake')} className="btn-apple-primary flex items-center gap-2">
                    <PlusCircle size={14} /> Register Node
                  </button>
                </div>
                <WorkflowRegistry workflows={workflows} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} />
              </div>
            )}

            {activeTab === 'builder' && selectedWorkflow && (
              <WorkflowBuilder 
                initialTasks={selectedWorkflow.tasks || []} 
                onSave={(tasks) => workflowsApi.updateTasks(selectedWorkflow.id, tasks).then(() => {
                  toast.success("Strategy Saved");
                  queryClient.invalidateQueries({ queryKey: ['workflows'] });
                })} 
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
