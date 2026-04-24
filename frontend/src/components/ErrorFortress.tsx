import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  X, Copy, Terminal,
  Bug, MousePointer2, Database,
  Trash2, TerminalSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BugReport {
  id: string;
  title: string;
  timestamp: string;
  view: string;
  category: 'frontend' | 'backend';
  status: 'error' | 'warning';
  acknowledged: boolean;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  type?: string;
  platform: string;
  userAgent: string;
  traceback?: string;
  payload?: any;
}

interface BuganizerContextType {
  reportBug: (title: string, category: 'frontend' | 'backend', status: 'error' | 'warning', extras?: Partial<BugReport>) => void;
  reports: BugReport[];
  clearReports: () => void;
  acknowledgeReport: (id: string) => void;
  deleteReport: (id: string) => void;
  setIsOpen: (open: boolean) => void;
  isOpen: boolean;
}

const BuganizerContext = createContext<BuganizerContextType | undefined>(undefined);

export const useBuganizer = () => {
  const context = useContext(BuganizerContext);
  if (!context) throw new Error("useBuganizer must be used within BuganizerProvider");
  return context;
};

// For backward compatibility with ErrorFortress usages
export const useErrorFortress = () => {
  const context = useContext(BuganizerContext);
  if (!context) throw new Error("useErrorFortress must be used within BuganizerProvider");
  return {
    reportError: (err: any, source: 'frontend' | 'backend') => {
      const title = err.detail || err.message || "Unknown System Failure";
      context.reportBug(title, source, 'error', {
        type: err.type || err.name || "SystemError",
        traceback: err.traceback || err.stack || "No traceback available",
        endpoint: err.path,
        method: err.method
      });
    },
    errors: context.reports.filter(r => r.status === 'error'),
    clearErrors: context.clearReports,
    setIsOpen: context.setIsOpen,
    isOpen: context.isOpen
  };
};

export const BuganizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const reportBug = useCallback((title: string, category: 'frontend' | 'backend', status: 'error' | 'warning', extras?: Partial<BugReport>) => {
    const newReport: BugReport = {
      id: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      timestamp: new Date().toLocaleString(),
      view: extras?.view || 'Global Scope',
      category,
      status,
      acknowledged: false,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      ...extras
    };

    setReports(prev => [newReport, ...prev].slice(0, 100)); // Keep last 100
    
    if (status === 'error') {
      toast.error((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-black uppercase tracking-tight text-[12px]">Exception Detected</span>
          <p className="text-[11px] font-bold opacity-60 line-clamp-2">{title}</p>
          <button 
            onClick={() => {
              setIsOpen(true);
              toast.dismiss(t.id);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors text-left"
          >
            Open Buganizer Console
          </button>
        </div>
      ), { duration: 6000 });
    }
  }, []);

  const acknowledgeReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, acknowledged: true } : r));
  };

  const deleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const clearReports = () => setReports([]);

  // Listen for global window errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.error) {
        reportBug(event.error.message || "Global Runtime Error", 'frontend', 'error', {
          traceback: event.error.stack,
          type: event.error.name
        });
      }
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, [reportBug]);

  const [filter, setFilter] = useState<'all' | 'frontend' | 'backend'>('all');
  const filtered = reports.filter(r => filter === 'all' || r.category === filter);

  return (
    <BuganizerContext.Provider value={{ reportBug, reports, clearReports, acknowledgeReport, deleteReport, setIsOpen, isOpen }}>
      {children}
      
      {/* Buganizer Console Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-3xl flex flex-col animate-apple-in font-sans">
          <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a1120]/80">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                <Bug size={24} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-[22px] font-black text-white uppercase tracking-tighter">Buganizer 2.0</h2>
                <div className="flex gap-4 mt-1">
                  {(['all', 'frontend', 'backend'] as const).map(f => (
                    <button 
                      key={f} 
                      onClick={() => setFilter(f)}
                      className={cn("text-[10px] font-black uppercase tracking-widest transition-all", filter === f ? "text-rose-500 scale-110" : "text-white/20 hover:text-white")}
                    >
                      {f} ({reports.filter(r => f === 'all' || r.category === f).length})
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearReports} className="px-6 py-2.5 bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase transition-all border border-white/10">Purge Session</button>
              <button onClick={() => setIsOpen(false)} className="p-3 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white border border-white/10"><X size={24} /></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar p-8 bg-[#050914]">
            <div className="max-w-7xl mx-auto space-y-6 pb-20">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-60 opacity-20">
                  <div className="w-32 h-32 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center mb-6">
                    <TerminalSquare size={48} />
                  </div>
                  <span className="text-[16px] font-black uppercase tracking-[0.3em]">Operational Readiness Confirmed</span>
                  <p className="text-[10px] mt-2 font-bold opacity-50 uppercase tracking-widest text-emerald-400">Zero active exceptions detected</p>
                </div>
              ) : filtered.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(report => (
                <div key={report.id} className={cn("apple-glass border rounded-3xl overflow-hidden transition-all duration-500", report.acknowledged ? "opacity-40 grayscale blur-[0.5px] border-white/5" : "border-rose-500/30 bg-rose-500/[0.03] shadow-2xl shadow-rose-500/5 hover:border-rose-500/50 hover:bg-rose-500/[0.05]")}>
                  <div className="p-8 flex items-start justify-between gap-10">
                    <div className="flex-1 space-y-6 min-w-0">
                      <div className="flex items-center gap-4">
                        <div className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-lg", report.status === 'error' ? "bg-rose-500 border-rose-400 text-white" : "bg-amber-500 border-amber-400 text-black")}>{report.status}</div>
                        <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">{report.category}</div>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="text-[11px] text-white/30 font-mono tracking-tight">{report.timestamp}</div>
                        <div className="flex items-center gap-2 text-[11px] text-theme-accent font-black uppercase tracking-[0.2em] bg-theme-accent/10 px-3 py-1 rounded-lg border border-theme-accent/20">
                          <MousePointer2 size={12} /> {report.view}
                        </div>
                      </div>
                      
                      <h3 className="text-[22px] font-black text-white uppercase tracking-tight leading-none truncate">{report.title}</h3>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 py-6 border-y border-white/5 bg-black/20 rounded-2xl px-6">
                        {report.endpoint && (
                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Network Context</span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black font-mono">{report.method}</span>
                              <span className="text-[12px] font-bold text-white font-mono truncate">{report.endpoint}</span>
                            </div>
                          </div>
                        )}
                        {report.statusCode && (
                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">HTTP Response</span>
                            <span className={cn("text-[16px] font-black font-mono", report.statusCode >= 500 ? "text-rose-500" : "text-amber-500")}>{report.statusCode}</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Architecture</span>
                          <span className="text-[12px] font-bold text-white/80 truncate block uppercase tracking-tight">{report.platform}</span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Agent Payload</span>
                          <span className="text-[12px] font-bold text-white/40 truncate block italic">{report.userAgent}</span>
                        </div>
                      </div>

                      {report.traceback && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2 text-rose-500">
                              <Terminal size={14} />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Full Diagnostic Traceback</span>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(report.traceback!); toast.success("Copied to clipboard"); }} className="text-[10px] font-black text-white/20 hover:text-white flex items-center gap-2 uppercase transition-colors group">
                              <Copy size={12} className="group-hover:scale-110 transition-transform" /> Copy to Clipboard
                            </button>
                          </div>
                          <div className="p-6 bg-black/60 rounded-3xl border border-white/5 text-[12px] text-rose-400/90 font-mono overflow-auto max-h-[400px] custom-scrollbar leading-relaxed">
                            {report.traceback}
                          </div>
                        </div>
                      )}

                      {report.payload && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-theme-accent px-2">
                            <Database size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transmission Payload</span>
                          </div>
                          <div className="p-6 bg-black/60 rounded-3xl border border-white/5 text-[12px] text-theme-accent/80 font-mono overflow-auto max-h-[300px] custom-scrollbar leading-relaxed">
                            {JSON.stringify(report.payload, null, 4)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {!report.acknowledged && (
                        <button 
                          onClick={() => acknowledgeReport(report.id)}
                          className="px-6 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 hover:scale-[1.05] transition-all"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button 
                        onClick={() => deleteReport(report.id)}
                        className="w-full h-12 flex items-center justify-center bg-white/5 hover:bg-rose-500/10 text-white/20 hover:text-rose-500 rounded-2xl transition-all border border-white/10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </BuganizerContext.Provider>
  );
};
