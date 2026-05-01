import React from 'react';
import { Bell, Clock3, GitBranch, ShieldCheck, Users } from 'lucide-react';
import { canActOnReviewRequest } from '../utils/governance';

const toneClass = (tone: 'accent' | 'warning' | 'success' | 'neutral' = 'neutral') => ({
  accent: 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-white/10 bg-white/5 text-white/60',
}[tone]);

const Pill = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'accent' | 'warning' | 'success' | 'neutral' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${toneClass(tone)}`}>
    {children}
  </span>
);

const CollaborationDrawer = ({
  isOpen,
  onClose,
  inbox,
  governance,
  currentUser,
  activeSessions,
  onOpenWorkflow,
  onGovernanceAction,
  onMarkNotificationRead,
}: {
  isOpen: boolean;
  onClose: () => void;
  inbox: any;
  governance: any;
  currentUser?: any;
  activeSessions: any[];
  onOpenWorkflow: (workflowId: number) => void;
  onGovernanceAction: (workflowId: number, action: string, requestId?: string) => void;
  onMarkNotificationRead: (workflowId: number, notificationId: string) => void;
}) => {
  if (!isOpen) return null;
  const inboxItems = inbox?.items || [];
  const reviewQueue = governance?.review_queue || [];
  const staleQueue = governance?.stale_workflows || [];
  const approvalQueue = governance?.approval_queue || [];

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-[540px] border-l border-white/10 bg-[#08101d]/98 shadow-2xl animate-apple-in overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#08101d]/96 px-6 py-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-theme-accent">Collaboration Hub</p>
              <h3 className="mt-2 text-[22px] font-black uppercase tracking-tight text-white">Inbox, review, and active presence</h3>
              <p className="mt-2 text-[12px] font-bold text-white/55">{currentUser?.full_name || 'Current user'} can act on workflow review, approval, and notification pressure from one place.</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 hover:text-white hover:bg-white/10 transition-all">
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-theme-accent" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Active Sessions</p>
              </div>
              <Pill tone="accent">{activeSessions.length}</Pill>
            </div>
            <div className="mt-4 space-y-2">
              {activeSessions.length === 0 && <p className="text-[11px] font-bold text-white/45">No other active authoring sessions detected in this browser context.</p>}
              {activeSessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{session.name || 'Company User'}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">{session.viewLabel || session.route} • {session.workflowName || 'General app work'}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={16} className="text-theme-accent" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Workflow Inbox</p>
              </div>
              <Pill tone="warning">{inbox?.unread_count || 0} unread</Pill>
            </div>
            <div className="mt-4 space-y-3">
              {inboxItems.length === 0 && <p className="text-[11px] font-bold text-white/45">No inbox items are waiting on this user.</p>}
              {inboxItems.slice(0, 10).map((item: any) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.title}</p>
                    <Pill tone={item.status === 'read' ? 'neutral' : 'warning'}>{item.status || item.kind}</Pill>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-white/55">{item.detail || 'No detail attached.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.workflow_id && (
                      <button onClick={() => onOpenWorkflow(item.workflow_id)} className="rounded-lg border border-theme-accent/20 bg-theme-accent/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent hover:bg-theme-accent hover:text-white transition-all">
                        Open Workflow
                      </button>
                    )}
                    {item.kind === 'review_request' && item.workflow_id && canActOnReviewRequest(currentUser, item.role) && (
                      <>
                        <button onClick={() => onGovernanceAction(item.workflow_id, 'approve_review', item.request_id)} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">
                          Approve Review
                        </button>
                        <button onClick={() => onGovernanceAction(item.workflow_id, 'request_changes', item.request_id)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500 hover:text-white transition-all">
                          Request Changes
                        </button>
                      </>
                    )}
                    {String(item.id).startsWith('notif-') && item.workflow_id && (
                      <button onClick={() => onMarkNotificationRead(item.workflow_id, String(item.id))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/65 hover:bg-white/10 hover:text-white transition-all">
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4">
            {[
              { title: 'Review Queue', icon: GitBranch, items: reviewQueue, tone: 'accent' as const },
              { title: 'Approval Queue', icon: ShieldCheck, items: approvalQueue, tone: 'warning' as const },
              { title: 'Stale Workflows', icon: Clock3, items: staleQueue, tone: 'neutral' as const },
            ].map((section) => (
              <div key={section.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <section.icon size={16} className="text-theme-accent" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{section.title}</p>
                  </div>
                  <Pill tone={section.tone}>{section.items.length}</Pill>
                </div>
                <div className="mt-4 space-y-2">
                  {section.items.slice(0, 4).map((item: any) => (
                    <button key={item.id || item.workflow_id} onClick={() => onOpenWorkflow(item.id || item.workflow_id)} className="block w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-white/[0.05] transition-all">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.name}</p>
                      <p className="mt-1 text-[11px] font-bold text-white/55">{item.review_state || item.approval_state || item.owner || item.summary || 'Needs attention'}</p>
                    </button>
                  ))}
                  {!section.items.length && <p className="text-[11px] font-bold text-white/45">No items in this queue.</p>}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

export default CollaborationDrawer;
