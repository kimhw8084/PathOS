import React from 'react';

const colors: any = {
  // Common
  Active: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5',
  Running: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5',
  Online: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5',
  Maintenance: 'text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5',
  Decommissioned: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  Deleted: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  Purged: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  Critical: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  Planned: 'text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5',
  Scheduled: 'text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5',
  Stopped: 'text-slate-600 dark:text-slate-400 border-slate-500/20 bg-slate-500/10 dark:bg-slate-500/5',
  Standby: 'text-sky-600 dark:text-sky-400 border-sky-500/20 bg-sky-500/10 dark:bg-sky-500/5',
  Offline: 'text-slate-600 dark:text-slate-400 border-slate-500/20 bg-slate-500/10 dark:bg-slate-500/5',
  Completed: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5',
  Cancelled: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  
  // Incident specific
  Investigating: 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5',
  Identified: 'text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5',
  Monitoring: 'text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5',
  Resolved: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5',
  Prevented: 'text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10 dark:bg-indigo-500/5',
  
  // Severity
  Major: 'text-orange-600 dark:text-orange-400 border-orange-500/20 bg-orange-500/10 dark:bg-orange-500/5',
  Minor: 'text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5',
}

export const StatusPill = ({ value }: { value: string }) => {
  return (
    <span className={`inline-flex items-center justify-center w-24 h-5 rounded text-[8px] font-black uppercase border tracking-tighter transition-colors duration-500 ${colors[value] || 'text-slate-600 dark:text-slate-400 border-slate-500/20 bg-slate-500/10 dark:bg-slate-500/5'}`}>
      {value}
    </span>
  )
}
