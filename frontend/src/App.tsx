import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
  Bug,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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
import { workflowsApi, taxonomyApi, executionsApi, projectsApi, settingsApi, apiClient as client, setGlobalReporter } from './api/client';
import { BuganizerProvider, useBuganizer, useErrorFortress } from './components/ErrorFortress';
import * as Tooltip from '@radix-ui/react-tooltip';
import { buildWorkflowDefaults, resolvedRuntimeConfig, useRuntimeConfig } from './config/runtime';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const queryClient = new QueryClient();
const IntakeGatekeeper = lazy(() => import('./components/IntakeGatekeeper'));
const WorkflowRegistry = lazy(() => import('./components/WorkflowRegistry'));
const ROIDashboard = lazy(() => import('./components/ROIDashboard'));
const WorkflowBuilder = lazy(() => import('./components/WorkflowBuilder'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const OperationalBoard = lazy(() => import('./components/OperationalBoard'));
const PerformanceAnalytics = lazy(() => import('./components/PerformanceAnalytics'));
const WorkflowSummaryView = lazy(() => import('./components/WorkflowSummaryView'));
const CompanyRolloutCenter = lazy(() => import('./components/CompanyRolloutCenter'));
const CollaborationDrawer = lazy(() => import('./components/CollaborationDrawer'));
const HelpCenter = lazy(() => import('./components/HelpCenter'));

const RouteLoading = ({ label = 'Loading View' }: { label?: string }) => (
  <div className="flex items-center justify-center h-full min-h-[280px] text-theme-muted uppercase font-black tracking-widest gap-4 animate-pulse">
    <Layers size={28} />
    <span>{label}</span>
  </div>
);

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
      } catch {
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
      <div className="apple-glass w-[min(92vw,400px)] p-6 sm:p-8 border border-white/10 rounded-3xl shadow-2xl flex flex-col gap-6 text-center">
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

const GlobalSidebar = ({ isOpen, setOpen, onNavigateRequested, currentUser }: { 
  isOpen: boolean, 
  setOpen: (v: boolean) => void, 
  onNavigateRequested: (path: string) => void,
  currentUser?: any,
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
              {currentUser?.avatar_initials || currentUser?.full_name?.split(' ').map((part: string) => part[0]).join('').slice(0, 2) || 'CU'}
            </div>
            {isOpen && (
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-[11px] font-bold truncate w-full text-left text-white">{currentUser?.full_name || 'Company User'}</span>
                <span className="text-[9px] text-theme-muted font-bold uppercase tracking-widest leading-none">{currentUser?.title || currentUser?.team || 'Rollout Identity'}</span>
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

const GlobalHeader = ({
  currentUser,
  inboxCount = 0,
  activeSessionCount = 0,
  onOpenCollaboration,
}: {
  currentUser?: any;
  inboxCount?: number;
  activeSessionCount?: number;
  onOpenCollaboration: () => void;
}) => {
  const { setIsOpen, isOpen, reports } = useBuganizer();
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

  const activeReports = reports.filter(r => !r.acknowledged);

  return (
    <header className="min-h-14 bg-theme-header backdrop-blur-xl border-b border-theme-border flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 z-20 sticky top-0">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-hint text-theme-muted flex items-center gap-2 min-w-0">
          <span className="shrink-0">PathOS</span>
          <span className="opacity-30 shrink-0">/</span>
          <span className="text-white font-black uppercase tracking-[0.1em] truncate max-w-[42vw] sm:max-w-[28vw]">{getTabLabel(currentTab)}</span>
        </h2>
        <ConnectionStatus />
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white/[0.03] backdrop-blur-md rounded-full border border-theme-border max-w-full">
          <div className="w-7 h-7 rounded-full bg-theme-accent/15 border border-theme-accent/25 flex items-center justify-center text-[10px] font-black text-theme-accent">
            {currentUser?.avatar_initials || currentUser?.full_name?.split(' ').map((part: string) => part[0]).join('').slice(0, 2) || 'CU'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white truncate max-w-[34vw] sm:max-w-[16rem]">{currentUser?.full_name || 'Company User'}</span>
            <span className="text-[9px] font-bold text-white/45">{currentUser?.team || 'No team'} • {inboxCount} inbox • {activeSessionCount} live</span>
          </div>
        </div>
        <button onClick={onOpenCollaboration} className="flex items-center gap-2 px-4 py-1.5 rounded-full border bg-white/[0.03] border-theme-border text-theme-secondary hover:bg-white/[0.06] hover:text-white transition-all whitespace-nowrap">
          <Users size={14} />
          <span className="text-[11px] font-black uppercase tracking-widest">Collaboration</span>
        </button>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-300",
            activeReports.length > 0 
              ? "bg-status-error/10 border-status-error/30 text-status-error animate-pulse shadow-[0_0_15px_rgba(255,59,48,0.1)]" 
              : "bg-white/[0.03] border-theme-border text-theme-secondary hover:bg-white/[0.06] hover:text-white"
          )}
        >
          <Bug size={14} />
          <span className="text-[11px] font-black uppercase tracking-widest">
            Buganizer Console {activeReports.length > 0 ? `(${activeReports.length})` : ''}
          </span>
        </button>
      </div>
    </header>
  );
};

const PathOSApp: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [intakeSeed, setIntakeSeed] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [pendingWorkflow, setPendingWorkflow] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCollaborationOpen, setCollaborationOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { reportError } = useErrorFortress();

  useEffect(() => {
    setGlobalReporter(reportError);
  }, [reportError]);

  const { data: workflows = [] } = useQuery({ 
    queryKey: ['workflows'], 
    queryFn: () => workflowsApi.list(true) 
  });

  const lastSyncedId = useRef<number | null>(null);

  // URL State Recovery
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    if ((pathParts.includes('builder') || pathParts.includes('intake') || pathParts.includes('summary')) && pathParts.length > 3) {
      const id = parseInt(pathParts[3]);
      if (!isNaN(id) && workflows.length > 0 && id !== lastSyncedId.current) {
        const found = workflows.find((w: any) => w.id === id);
        if (found) {
          lastSyncedId.current = id;
          // Use a small timeout to move state update out of the render cycle and satisfy linter
          setTimeout(() => setSelectedWorkflow(found), 0);
        }
      }
    } else if (location.pathname === '/' || location.pathname === '/workflows') {
      if (lastSyncedId.current !== null) {
        lastSyncedId.current = null;
        setTimeout(() => setSelectedWorkflow(null), 0);
      }
    }
  }, [location.pathname, workflows]);

  const { data: taxonomy = [] } = useQuery({ queryKey: ['taxonomy'], queryFn: taxonomyApi.list });
  const { data: runtimeConfigData } = useRuntimeConfig();
  const runtimeConfig = resolvedRuntimeConfig(runtimeConfigData);
  const { data: executions = [] } = useQuery({ queryKey: ['executions'], queryFn: executionsApi.list });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const { data: workflowInsights = {} } = useQuery({ queryKey: ['workflow-insights'], queryFn: workflowsApi.insights });
  const { data: presidentInsights = {} } = useQuery({ queryKey: ['workflow-president-insights'], queryFn: workflowsApi.presidentInsights });
  const { data: workflowTemplates = [] } = useQuery({ queryKey: ['workflow-templates'], queryFn: workflowsApi.templates });
  const { data: standardsLibrary = [] } = useQuery({ queryKey: ['workflow-standards-library'], queryFn: workflowsApi.standardsLibrary });
  const { data: adminOverview = { configs: [], members: [], saved_views: [], active_member: null } } = useQuery({ queryKey: ['settings-admin-overview'], queryFn: settingsApi.adminOverview });
  const currentUser = runtimeConfig?.current_member || adminOverview?.active_member || null;
  const { data: workflowInbox = { items: [], unread_count: 0 } } = useQuery({
    queryKey: ['workflow-inbox', currentUser?.email],
    queryFn: () => workflowsApi.inbox(currentUser?.email),
    enabled: Boolean(currentUser?.email),
  });
  const { data: governanceCenter = { counts: {}, review_queue: [], approval_queue: [], stale_workflows: [], recertification_queue: [] } } = useQuery({
    queryKey: ['workflow-governance-center'],
    queryFn: workflowsApi.governanceCenter,
  });
  const { data: workflowDiscovery = { related: [], duplicates: [], cross_department: [] } } = useQuery({
    queryKey: ['workflow-discovery', selectedWorkflow?.id],
    queryFn: () => workflowsApi.discovery(selectedWorkflow.id),
    enabled: Boolean(selectedWorkflow?.id),
  });
  const { data: workflowPolicyOverlay = { rules: [], sites: [] } } = useQuery({
    queryKey: ['workflow-policy-overlay', selectedWorkflow?.id],
    queryFn: () => workflowsApi.policyOverlay(selectedWorkflow.id),
    enabled: Boolean(selectedWorkflow?.id),
  });
  const { data: workflowRollbackPreview = { available: false, guardrails: [] } } = useQuery({
    queryKey: ['workflow-rollback-preview', selectedWorkflow?.id],
    queryFn: () => workflowsApi.rollbackPreview(selectedWorkflow.id),
    enabled: Boolean(selectedWorkflow?.id),
  });

  const createMutation = useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: (data) => {
      queryClient.removeQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success("Workflow Created");
      setSelectedWorkflow(data);
      navigate(`/workflows/builder/${data.id}`);
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

  const cloneMutation = useMutation({
    mutationFn: ({ workflowId, mode, workspace }: { workflowId: number, mode: 'clone' | 'version', workspace?: string }) =>
      workflowsApi.clone(workflowId, mode, workspace),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSelectedWorkflow(data);
      setIntakeSeed(null);
      toast.success(variables.mode === 'version' ? 'Version draft created' : 'Workflow cloned');
      navigate(`/workflows/intake/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Workflow duplication failed.");
      reportError(error.response?.data || error, 'backend');
    }
  });

  const rollbackDraftMutation = useMutation({
    mutationFn: ({ workflowId, workspace }: { workflowId: number, workspace?: string }) =>
      workflowsApi.rollbackDraft(workflowId, workspace),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSelectedWorkflow(data);
      setIntakeSeed(null);
      toast.success('Rollback draft created');
      navigate(`/workflows/intake/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Rollback draft failed.');
      reportError(error.response?.data || error, 'backend');
    }
  });

  const createExecutionMutation = useMutation({
    mutationFn: executionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast.success('Execution logged');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Execution logging failed.');
      reportError(error.response?.data || error, 'backend');
    }
  });

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Automation project created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Project creation failed.');
      reportError(error.response?.data || error, 'backend');
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Project update failed.');
      reportError(error.response?.data || error, 'backend');
    }
  });

  const governanceActionMutation = useMutation({
    mutationFn: ({ workflowId, action, requestId }: { workflowId: number, action: string, requestId?: string }) =>
      workflowsApi.governanceAction(workflowId, { action, request_id: requestId, actor: currentUser?.email || currentUser?.full_name || 'system_user' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-governance-center'] });
      toast.success('Governance action applied');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Governance action failed.');
      reportError(error.response?.data || error, 'backend');
    }
  });

  const notificationReadMutation = useMutation({
    mutationFn: ({ workflowId, notificationId }: { workflowId: number; notificationId: string }) => {
      const normalizedId = String(notificationId).startsWith('notif-')
        ? String(notificationId).split('-').slice(2).join('-')
        : notificationId;
      return workflowsApi.markNotificationRead(workflowId, normalizedId, currentUser?.email || currentUser?.full_name || 'system_user');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Notification update failed.');
      reportError(error.response?.data || error, 'backend');
    },
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('pathos-collaboration') : null;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const publish = () => {
      const pathParts = location.pathname.split('/');
      const payload = {
        id: sessionId,
        name: currentUser?.full_name || 'Company User',
        route: location.pathname,
        viewLabel: pathParts[1] || 'dashboard',
        workflowId: selectedWorkflow?.id || null,
        workflowName: selectedWorkflow?.name || null,
        at: Date.now(),
      };
      window.localStorage.setItem(`pathos-presence-${sessionId}`, JSON.stringify(payload));
      channel?.postMessage({ type: 'presence', payload });
    };
    const collect = () => {
      const now = Date.now();
      const keys = Object.keys(window.localStorage).filter((key) => key.startsWith('pathos-presence-'));
      const sessions = keys
        .map((key) => {
          try {
            return JSON.parse(window.localStorage.getItem(key) || 'null');
          } catch {
            return null;
          }
        })
        .filter((item) => item && now - item.at < 45000);
      setActiveSessions(sessions);
    };
    publish();
    collect();
    const interval = window.setInterval(() => {
      publish();
      collect();
    }, 10000);
    const handleStorage = () => collect();
    const handleMessage = () => collect();
    window.addEventListener('storage', handleStorage);
    channel?.addEventListener('message', handleMessage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      window.localStorage.removeItem(`pathos-presence-${sessionId}`);
    };
  }, [location.pathname, currentUser?.full_name, selectedWorkflow?.id, selectedWorkflow?.name]);

  const handleSelectWorkflow = (wf: any) => {
    if (isDirty) {
      setPendingNavPath(`/workflows/builder/${wf.id}`);
      setPendingWorkflow(wf);
      setShowConfirm(true);
      return;
    }
    setSelectedWorkflow(wf);
    setIntakeSeed(null);
    navigate(`/workflows/builder/${wf.id}`);
  };

  const handleNavigateRequest = (path: string) => {
    if (isDirty) {
      setPendingNavPath(path);
      setPendingWorkflow(null);
      setShowConfirm(true);
    } else {
      if (['/workflows', '/dashboard', '/board', '/analytics', '/settings'].includes(path)) {
        setSelectedWorkflow(null);
        setIntakeSeed(null);
      }
      navigate(path);
    }
  };

  const confirmDiscard = () => {
    setIsDirty(false);
    setShowConfirm(false);
    if (pendingWorkflow) {
      setSelectedWorkflow(pendingWorkflow);
      setPendingWorkflow(null);
      setPendingNavPath(null);
      navigate(`/workflows/builder/${pendingWorkflow.id}`);
    } else if (pendingNavPath) {
      if (['/workflows', '/dashboard', '/board', '/analytics', '/settings'].includes(pendingNavPath)) {
        setSelectedWorkflow(null);
        setIntakeSeed(null);
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
        currentUser={currentUser}
      />
      <ConfirmationDialog 
        isOpen={showConfirm}
        onConfirm={confirmDiscard}
        onCancel={() => setShowConfirm(false)}
        title="Discard Unsaved Changes?"
        message="You have unsaved process configurations. Moving to a different view will permanently lose these modifications."
      />
      <Suspense fallback={null}>
        <CollaborationDrawer
          isOpen={isCollaborationOpen}
          onClose={() => setCollaborationOpen(false)}
          inbox={workflowInbox}
          governance={governanceCenter}
          currentUser={currentUser}
          activeSessions={activeSessions}
          onOpenWorkflow={(workflowId: number) => {
            const found = workflows.find((w: any) => w.id === workflowId);
            if (found) {
              setCollaborationOpen(false);
              handleSelectWorkflow(found);
            }
          }}
          onGovernanceAction={(workflowId: number, action: string, requestId?: string) =>
            governanceActionMutation.mutate({ workflowId, action, requestId })
          }
          onMarkNotificationRead={(workflowId: number, notificationId: string) =>
            notificationReadMutation.mutate({ workflowId, notificationId })
          }
        />
      </Suspense>
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <GlobalHeader currentUser={currentUser} inboxCount={workflowInbox?.unread_count || 0} activeSessionCount={activeSessions.length} onOpenCollaboration={() => setCollaborationOpen(true)} />
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <div className="mx-auto p-4 lg:p-6 animate-apple-in max-w-full h-full">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <Suspense fallback={<RouteLoading label="Loading Dashboard" />}>
                  <div className="space-y-6 max-w-[1400px] mx-auto">
                    <CompanyRolloutCenter
                      currentUser={currentUser}
                      inbox={workflowInbox}
                      governance={governanceCenter}
                      savedViews={adminOverview?.saved_views || []}
                      onOpenWorkflow={(workflowId) => {
                        const found = workflows.find((w: any) => w.id === workflowId);
                        if (found) handleSelectWorkflow(found);
                      }}
                      onGovernanceAction={(workflowId, action, requestId) => governanceActionMutation.mutate({ workflowId, action, requestId })}
                    />
                    <ROIDashboard 
                      workflows={workflows.filter((w: any) => !w.is_deleted)} 
                      executions={executions} 
                      projects={projects} 
                      insights={presidentInsights} 
                      runtimeConfig={runtimeConfig}
                    />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-theme-border/50 pb-2">
                        <h3 className="text-header-sub flex items-center gap-2"><Database size={16} className="text-theme-accent" /> Recent Workflows</h3>
                        <Link to="/workflows" className="text-hint text-theme-accent hover:text-white transition-colors flex items-center gap-1">View Repository <ChevronRight size={12} /></Link>
                      </div>
                      <WorkflowRegistry workflows={workflows.slice(0, 8)} onSelect={handleSelectWorkflow} onDelete={deleteMutation.mutate} onRestore={restoreMutation.mutate} onClone={(wf) => cloneMutation.mutate({ workflowId: wf.id, mode: 'clone', workspace: 'Personal Drafts' })} onCreateVersion={(wf) => cloneMutation.mutate({ workflowId: wf.id, mode: 'version', workspace: 'Personal Drafts' })} onOpenSummary={(wf) => { setSelectedWorkflow(wf); navigate(`/workflows/summary/${wf.id}`); }} runtimeConfig={runtimeConfig} />
                    </div>
                  </div>
                </Suspense>
              } />
              <Route path="/workflows" element={
                <Suspense fallback={<RouteLoading label="Loading Workflow Repository" />}>
                  <WorkflowRegistry 
                    workflows={workflows} 
                    onSelect={handleSelectWorkflow} 
                    onDelete={deleteMutation.mutate} 
                    onRestore={restoreMutation.mutate}
                    onClone={(wf) => cloneMutation.mutate({ workflowId: wf.id, mode: 'clone', workspace: 'Personal Drafts' })}
                    onCreateVersion={(wf) => cloneMutation.mutate({ workflowId: wf.id, mode: 'version', workspace: 'Personal Drafts' })}
                    onOpenSummary={(wf) => { setSelectedWorkflow(wf); navigate(`/workflows/summary/${wf.id}`); }}
                    onCreateNew={(workspace?: string) => {
                      const defaults = buildWorkflowDefaults(runtimeConfig, currentUser?.full_name);
                      setSelectedWorkflow(null);
                      setIntakeSeed({
                        workspace: workspace || runtimeConfig.organization.default_workspace || 'Personal Drafts',
                        access_control: {
                          ...defaults.access_control,
                          visibility: workspace === 'Collaborative Workflows' ? 'workspace' : workspace === 'Standard Operations' ? 'org' : defaults.access_control.visibility,
                        },
                        ownership: defaults.ownership,
                        governance: defaults.governance,
                      });
                      navigate('/workflows/intake/new');
                    }}
                    runtimeConfig={runtimeConfig}
                  />
                </Suspense>
              } />
              <Route path="/workflows/intake/new" element={
                <Suspense fallback={<RouteLoading label="Loading Intake" />}>
                  <div className="max-w-4xl mx-auto">
                    <IntakeGatekeeper 
                      key="intake-new"
                      initialData={intakeSeed} 
                      taxonomy={taxonomy} 
                      workflows={workflows.filter((w: any) => !w.is_deleted)}
                      templates={workflowTemplates}
                      runtimeConfig={runtimeConfig}
                      onSuccess={(data) => { 
                        createMutation.mutate(data); 
                      }} 
                      onCancel={() => handleNavigateRequest('/workflows')} 
                      onRestart={() => { setSelectedWorkflow(null); setIntakeSeed(null); }}
                    />
                  </div>
                </Suspense>
              } />
              <Route path="/workflows/intake/:workflowId" element={
                <Suspense fallback={<RouteLoading label="Loading Intake" />}>
                  <div className="max-w-4xl mx-auto">
                    <IntakeGatekeeper 
                      key={location.pathname}
                      initialData={selectedWorkflow} 
                      taxonomy={taxonomy} 
                      workflows={workflows.filter((w: any) => !w.is_deleted)}
                      templates={workflowTemplates}
                      runtimeConfig={runtimeConfig}
                      onSuccess={(data) => { 
                        if (selectedWorkflow?.id) { 
                          workflowsApi.update(selectedWorkflow.id, data).then((updated) => { 
                            setSelectedWorkflow(updated); 
                            setIntakeSeed(null);
                            navigate(`/workflows/builder/${updated.id}`); 
                          }).catch((error: any) => {
                            toast.error(error.response?.data?.detail || "Workflow update failed.");
                            reportError(error.response?.data || error, 'backend');
                          }); 
                        }
                      }} 
                      onCancel={() => handleNavigateRequest('/workflows')} 
                      onRestart={() => { setSelectedWorkflow(null); setIntakeSeed(null); }}
                    />
                  </div>
                </Suspense>
              } />
              <Route path="/settings" element={<Suspense fallback={<RouteLoading label="Loading Settings" />}><SettingsView /></Suspense>} />
              <Route path="/board" element={
                <Suspense fallback={<RouteLoading label="Loading Operational Board" />}>
                  <OperationalBoard
                    workflows={workflows.filter((w: any) => !w.is_deleted)}
                    executions={executions}
                    projects={projects}
                    insights={presidentInsights}
                    governance={governanceCenter}
                    inbox={workflowInbox}
                    currentUser={currentUser}
                    runtimeConfig={runtimeConfig}
                    onCreateExecution={createExecutionMutation.mutate}
                    onCreateProject={createProjectMutation.mutate}
                    onUpdateProject={(id, data) => updateProjectMutation.mutate({ id, data })}
                    onOpenWorkflow={handleSelectWorkflow}
                  />
                </Suspense>
              } />
              <Route path="/analytics" element={
                <Suspense fallback={<RouteLoading label="Loading Analytics" />}>
                  <PerformanceAnalytics
                    workflows={workflows.filter((w: any) => !w.is_deleted)}
                    executions={executions}
                    projects={projects}
                    insights={presidentInsights}
                    runtimeConfig={runtimeConfig}
                  />
                </Suspense>
              } />
              <Route path="/workflows/summary/:workflowId" element={
                selectedWorkflow ? (
                  <Suspense fallback={<RouteLoading label="Loading Workflow Summary" />}>
                    <WorkflowSummaryView
                      workflow={selectedWorkflow}
                      related={workflowDiscovery.related || []}
                      discovery={workflowDiscovery}
                      insights={workflowInsights}
                      presidentInsights={presidentInsights}
                      standardsLibrary={standardsLibrary}
                      policyOverlay={workflowPolicyOverlay}
                      rollbackPreview={workflowRollbackPreview}
                      runtimeConfig={runtimeConfig}
                      onCreateRollbackDraft={() => selectedWorkflow?.id && rollbackDraftMutation.mutate({ workflowId: selectedWorkflow.id, workspace: 'Personal Drafts' })}
                      onBack={() => handleNavigateRequest('/workflows')}
                      onOpenWorkflow={(wf) => handleSelectWorkflow(wf)}
                      currentUser={currentUser}
                      activeSessions={activeSessions}
                      onGovernanceAction={(action, requestId) => governanceActionMutation.mutate({ workflowId: selectedWorkflow.id, action, requestId })}
                      onMarkNotificationRead={(notificationId) => notificationReadMutation.mutate({ workflowId: selectedWorkflow.id, notificationId })}
                    />
                  </Suspense>
                ) : <div className="flex items-center justify-center h-full text-theme-muted uppercase font-black tracking-widest gap-4 animate-pulse"><Layers size={32} /> Loading Workflow Summary...</div>
              } />
      <Route path="/workflows/builder/:workflowId" element={
                selectedWorkflow ? (
                  <Suspense fallback={<RouteLoading label="Loading Workflow Builder" />}>
                    <div className="h-[calc(100dvh-140px)] overflow-hidden">
                      <WorkflowBuilder 
                        key={selectedWorkflow.id}
                        workflow={selectedWorkflow}
                        taxonomy={taxonomy}
                        templates={workflowTemplates}
                        relatedWorkflows={workflowDiscovery.related || []}
                        insights={workflowInsights}
                        policyOverlay={workflowPolicyOverlay}
                        rollbackPreview={workflowRollbackPreview}
                        runtimeConfig={runtimeConfig}
                        onSave={(data: any) => workflowsApi.update(selectedWorkflow.id, data).then((updated) => {
                          toast.success("Configuration Saved");
                          queryClient.invalidateQueries({ queryKey: ['workflows'] });
                          setSelectedWorkflow(updated);
                          setIsDirty(false);
                          return updated;
                        })} 
                        onBack={(currentData?: any) => {
                          if (currentData) {
                            setSelectedWorkflow({ ...selectedWorkflow, ...currentData });
                          }
                          navigate(`/workflows/intake/${selectedWorkflow.id}`);
                        }}
                        onExit={() => handleNavigateRequest('/workflows')}
                        onCreateRollbackDraft={() => selectedWorkflow?.id && rollbackDraftMutation.mutate({ workflowId: selectedWorkflow.id, workspace: 'Personal Drafts' })}
                        setIsDirty={setIsDirty}
                      />
                    </div>
                  </Suspense>
                ) : <div className="flex items-center justify-center h-full text-theme-muted uppercase font-black tracking-widest gap-4 animate-pulse"><Layers size={32} /> Loading Workflow State...</div>
              } />
              <Route path="/help" element={<Suspense fallback={<RouteLoading label="Loading Help Center" />}><HelpCenter /></Suspense>} />
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
      <BuganizerProvider>
        <Router>
          <PathOSApp />
        </Router>
      </BuganizerProvider>
    </Tooltip.Provider>
  </QueryClientProvider>
);

export default App;
