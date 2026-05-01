import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { workflowsApi } from '../api/client';
import { canReviewWorkflow } from '../utils/governance';

const card = "apple-card !bg-[#111827]/40 border-white/10 p-6";

const chipTone = (tone: 'accent' | 'warning' | 'success' | 'neutral' = 'neutral') => ({
  accent: 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-white/10 bg-white/[0.04] text-white/65',
}[tone]);

const Pill = ({ label, tone = 'neutral' }: { label: string; tone?: 'accent' | 'warning' | 'success' | 'neutral' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${chipTone(tone)}`}>{label}</span>
);

interface CompanyRolloutCenterProps {
  currentUser?: any;
  inbox?: any;
  governance?: any;
  savedViews?: any[];
  onOpenWorkflow?: (workflowId: number) => void;
  onGovernanceAction?: (workflowId: number, action: string, requestId?: string) => void;
}

const CompanyRolloutCenter: React.FC<CompanyRolloutCenterProps> = ({
  currentUser,
  inbox = { items: [], unread_count: 0 },
  governance = { counts: {}, review_queue: [], approval_queue: [], stale_workflows: [], recertification_queue: [] },
  savedViews = [],
  onOpenWorkflow,
  onGovernanceAction,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({ workflows: [], projects: [], executions: [], saved_views: [] });
  const canReview = canReviewWorkflow(currentUser);

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setSearchResults({ workflows: [], projects: [], executions: [], saved_views: [] });
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const data = await workflowsApi.globalSearch(query.trim(), 6);
        if (!cancelled) setSearchResults(data);
      } catch {
        if (!cancelled) setSearchResults({ workflows: [], projects: [], executions: [], saved_views: [] });
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const actionableInbox = useMemo(
    () => (inbox.items || []).filter((item: any) => item.kind === 'review_request' || item.kind === 'notification'),
    [inbox]
  );

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <section className={card}>
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Company Command Center</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Identity, review load, certification risk, and company search in one surface</p>
            </div>
            <Sparkles size={18} className="text-theme-accent" />
          </div>

          <div className="mt-5 grid md:grid-cols-[1.05fr_0.95fr] gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-theme-accent/15 border border-theme-accent/20 flex items-center justify-center text-theme-accent font-black">
                  {currentUser?.avatar_initials || currentUser?.full_name?.split(' ').map((part: string) => part[0]).join('').slice(0, 2) || 'CU'}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">Active Identity</p>
                  <p className="text-[18px] font-black text-white">{currentUser?.full_name || 'Company User'}</p>
                  <p className="text-[11px] font-bold text-white/55">{currentUser?.title || 'Role pending'} • {currentUser?.team || 'Unassigned Team'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(currentUser?.roles || []).map((role: string) => <Pill key={role} label={role.replaceAll('_', ' ')} tone="accent" />)}
                {!(currentUser?.roles || []).length && <Pill label="role setup needed" tone="warning" />}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Inbox</p>
                  <p className="mt-2 text-[18px] font-black text-white">{inbox.unread_count || 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Review</p>
                  <p className="mt-2 text-[18px] font-black text-amber-300">{governance.counts?.review || 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Certified Risk</p>
                  <p className="mt-2 text-[18px] font-black text-rose-300">{governance.counts?.recertification || 0}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">Universal Search</p>
                  <p className="text-[11px] font-bold text-white/50">Workflows, projects, executions, and saved views</p>
                </div>
                <Search size={16} className="text-theme-accent" />
              </div>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] font-bold text-white outline-none focus:border-theme-accent"
                placeholder="Search company workflow intelligence..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="space-y-2 max-h-[16rem] overflow-auto custom-scrollbar pr-1">
                {[...(searchResults.workflows || []).map((item: any) => ({ ...item, kind: 'workflow' })), ...(searchResults.projects || []).map((item: any) => ({ ...item, kind: 'project' })), ...(searchResults.executions || []).map((item: any) => ({ ...item, kind: 'execution' })), ...(searchResults.saved_views || []).map((item: any) => ({ ...item, kind: 'saved_view' }))].slice(0, 8).map((item: any, index: number) => (
                  <button
                    key={`${item.kind}-${item.id}-${index}`}
                    onClick={() => item.kind === 'workflow' && onOpenWorkflow?.(item.id)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition-all hover:border-theme-accent/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name || item.workflow_name_snapshot || item.title}</p>
                      <Pill label={item.kind.replace('_', ' ')} tone="neutral" />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-white/55">{item.status || item.owner_email || item.executed_by || item.team || 'Search match'}</p>
                  </button>
                ))}
                {!query.trim() && <p className="text-[11px] font-bold text-white/40">Start typing to search across the company operating graph.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Inbox and Approvals</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Review requests, notifications, and certification actions that need attention</p>
            </div>
            <Bell size={18} className="text-theme-accent" />
          </div>
          <div className="mt-5 space-y-3 max-h-[27rem] overflow-auto custom-scrollbar pr-1">
            {actionableInbox.slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.title}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/55">{item.detail}</p>
                  </div>
                  <Pill label={item.status || 'open'} tone={item.status === 'approved' ? 'success' : item.status === 'read' ? 'neutral' : 'warning'} />
                </div>
                {item.workflow_id && onGovernanceAction && canReview && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => onGovernanceAction(item.workflow_id, 'approve_review')} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Approve Review</button>
                    <button onClick={() => onGovernanceAction(item.workflow_id, 'request_changes')} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Request Changes</button>
                    <button onClick={() => onOpenWorkflow?.(item.workflow_id)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Open Workflow</button>
                  </div>
                )}
              </div>
            ))}
            {actionableInbox.length === 0 && <p className="text-[11px] font-bold text-white/40">Inbox is clear. Review requests and governance reminders will appear here.</p>}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <section className={card}>
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Governance and Certification</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">What blocks company trust and standardization right now</p>
            </div>
            <ShieldCheck size={18} className="text-theme-accent" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Awaiting Review</p>
              <p className="mt-3 text-[26px] font-black text-amber-300">{governance.counts?.review || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Awaiting Approval</p>
              <p className="mt-3 text-[26px] font-black text-theme-accent">{governance.counts?.approval || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Stale Workflows</p>
              <p className="mt-3 text-[26px] font-black text-rose-300">{governance.counts?.stale || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Recertification</p>
              <p className="mt-3 text-[26px] font-black text-violet-300">{governance.counts?.recertification || 0}</p>
            </div>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Saved Views and Shared Discovery</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.18em] mt-1">Reusable company perspectives for search, triage, and operations</p>
            </div>
            <Users size={18} className="text-theme-accent" />
          </div>
          <div className="mt-5 grid md:grid-cols-2 gap-3">
            {savedViews.slice(0, 6).map((view: any) => (
              <div key={view.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{view.name}</p>
                  <Pill label={view.scope || 'personal'} tone={view.scope === 'shared' ? 'accent' : 'neutral'} />
                </div>
                <p className="mt-2 text-[11px] font-bold text-white/55">{view.search_text || 'No stored query'}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/30">{view.owner_email}</p>
              </div>
            ))}
            {savedViews.length === 0 && <p className="text-[11px] font-bold text-white/40">Create saved views in settings to standardize search and review queues across teams.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CompanyRolloutCenter;
