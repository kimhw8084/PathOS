import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  AlertOctagon, X, Copy, Terminal, ShieldAlert, 
  Bug, RefreshCw, Server
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PathOSError {
  message: string;
  type?: string;
  traceback?: string;
  timestamp: string;
  source: 'frontend' | 'backend';
  path?: string;
  method?: string;
}

interface ErrorContextType {
  reportError: (err: any, source: 'frontend' | 'backend') => void;
  errors: PathOSError[];
  clearErrors: () => void;
  setIsOpen: (open: boolean) => void;
  isOpen: boolean;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useErrorFortress = () => {
  const context = useContext(ErrorContext);
  if (!context) throw new Error("useErrorFortress must be used within Provider");
  return context;
};

export const ErrorFortressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<PathOSError[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const reportError = (err: any, source: 'frontend' | 'backend') => {
    const newError: PathOSError = {
      message: err.detail || err.message || "Unknown System Failure",
      type: err.type || err.name || "SystemError",
      traceback: err.traceback || err.stack || "No traceback available",
      timestamp: new Date().toISOString(),
      source,
      path: err.path,
      method: err.method
    };

    setErrors(prev => [newError, ...prev].slice(0, 50)); // Keep last 50
    
    // Auto-open if critical? Or just toast
    toast.error((t) => (
      <div className="flex flex-col gap-2">
        <span className="font-bold">System Exception Detected</span>
        <button 
          onClick={() => {
            setIsOpen(true);
            toast.dismiss(t.id);
          }}
          className="text-[11px] underline text-left opacity-80 hover:opacity-100"
        >
          Inspect full traceback in Fortress Console
        </button>
      </div>
    ), { duration: 6000 });
  };

  const clearErrors = () => setErrors([]);

  // Listen for global window errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.error) reportError(event.error, 'frontend');
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  return (
    <ErrorContext.Provider value={{ reportError, errors, clearErrors, setIsOpen, isOpen }}>
      {children}
      
      {/* The Fortress Console Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-5xl h-[85vh] apple-glass border-status-error/30 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(255,59,48,0.2)]">
            <div className="h-16 flex items-center justify-between px-8 bg-status-error/10 border-b border-status-error/20">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-status-error/20 rounded-xl">
                   <AlertOctagon size={24} className="text-status-error" />
                </div>
                <div>
                   <h2 className="text-header-sub text-white">PathOS Error Fortress</h2>
                   <span className="text-hint normal-case text-status-error font-bold tracking-widest">Diagnostic Level: Verbose</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={clearErrors} 
                  className="px-4 py-2 text-hint normal-case text-white/50 hover:text-white transition-colors"
                >
                  Clear Console
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Error List */}
              <div className="w-80 border-r border-white/10 overflow-auto custom-scrollbar bg-black/20">
                {errors.length === 0 ? (
                  <div className="p-10 text-center opacity-30">
                    <ShieldAlert size={48} className="mx-auto mb-4" />
                    <p className="text-hint">No active violations</p>
                  </div>
                ) : (
                  errors.map((e, i) => (
                    <button 
                      key={i}
                      className="w-full p-5 border-b border-white/5 text-left hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-2">
                         <span className={`status-badge !py-0.5 !px-2 !text-[9px] ${e.source === 'backend' ? 'bg-theme-accent/20 text-theme-accent' : 'bg-status-success/20 text-status-success'}`}>
                           {e.source.toUpperCase()}
                         </span>
                         <span className="text-[10px] text-white/30">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[12px] font-bold text-white mb-2 leading-snug">{e.message}</p>
                      <p className="text-hint normal-case opacity-40 font-mono text-[9px]">{e.type}</p>
                    </button>
                  ))
                )}
              </div>

              {/* Traceback Viewer */}
              <div className="flex-1 flex flex-col bg-black/40">
                {errors[0] ? (
                  <>
                    <div className="p-8 border-b border-white/5 space-y-6">
                       <div className="flex items-start justify-between gap-6">
                         <div className="space-y-2 flex-1">
                           <h3 className="text-header-sub text-status-error font-mono">{errors[0].type}</h3>
                           <p className="text-[15px] font-bold text-white leading-relaxed">{errors[0].message}</p>
                         </div>
                         <button 
                           onClick={() => {
                             navigator.clipboard.writeText(`System: PathOS Diagnostic\nType: ${errors[0].type}\nMessage: ${errors[0].message}\nTraceback:\n${errors[0].traceback}`);
                             toast.success("Traceback copied to clipboard");
                           }}
                           className="btn-apple-secondary flex items-center gap-2 flex-shrink-0"
                         >
                           <Copy size={14} /> Copy for Developer
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-4">
                          <div className="apple-card-inset !p-3 bg-white/[0.03] flex items-center gap-3">
                             <Server size={14} className="text-theme-muted" />
                             <div>
                               <p className="text-hint opacity-40">Environment</p>
                               <p className="text-[11px] font-mono">{errors[0].source === 'backend' ? 'Python / FastAPI' : 'React / Client'}</p>
                             </div>
                          </div>
                          <div className="apple-card-inset !p-3 bg-white/[0.03] flex items-center gap-3">
                             <Terminal size={14} className="text-theme-muted" />
                             <div>
                               <p className="text-hint opacity-40">Entry Point</p>
                               <p className="text-[11px] font-mono">{errors[0].method || 'UI'} {errors[0].path || 'Local-Thread'}</p>
                             </div>
                          </div>
                          <div className="apple-card-inset !p-3 bg-white/[0.03] flex items-center gap-3">
                             <RefreshCw size={14} className="text-theme-muted" />
                             <div>
                               <p className="text-hint opacity-40">Timestamp</p>
                               <p className="text-[11px] font-mono">{errors[0].timestamp}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex-1 overflow-auto p-8 font-mono text-[12px] leading-relaxed text-theme-secondary/80 bg-black/60 custom-scrollbar whitespace-pre-wrap">
                       {errors[0].traceback}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                     <Bug size={64} className="mb-4" />
                     <p className="text-header-sub">System Integrity Nominal</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="h-12 bg-black/40 border-t border-white/5 px-8 flex items-center gap-6">
               <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-status-success shadow-[0_0_8px_#34C759]" />
                  <span className="text-white/40">Fortress Core Online</span>
               </div>
               <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-status-error shadow-[0_0_8px_#FF3B30]" />
                  <span className="text-white/40">{errors.length} Violations Logged</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
};
