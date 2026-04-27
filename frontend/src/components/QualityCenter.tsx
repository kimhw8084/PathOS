import { Activity, Bell, Bug, CheckCircle2, RefreshCw, ShieldCheck, TerminalSquare } from 'lucide-react';

const QualityCenter = ({ overview, bugReports = [] }: { overview: any; bugReports?: any[] }) => {
  const quality = overview?.quality || {};
  const portfolio = overview?.portfolio || {};
  const logs = overview?.parameter_runs || [];
  const commands = overview?.developer_commands || {};
  const activeReports = bugReports.filter((report) => !report.acknowledged);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: 'Workflows', value: portfolio.workflow_count || 0, hint: 'Active workflow definitions', tone: 'text-theme-accent' },
          { label: 'Executions', value: portfolio.execution_count || 0, hint: 'Measured run records', tone: 'text-cyan-300' },
          { label: 'Projects', value: portfolio.project_count || 0, hint: 'Automation delivery records', tone: 'text-violet-300' },
          { label: 'Open Reviews', value: quality.open_review_count || 0, hint: 'Governance queue pressure', tone: 'text-amber-300' },
          { label: 'Active Bugs', value: activeReports.length, hint: 'Current Buganizer reports', tone: 'text-rose-300' },
        ].map((card) => (
          <div key={card.label} className="apple-card !p-4 !bg-[#111827]/40 border-white/10">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className={`mt-3 text-[28px] font-black ${card.tone}`}>{card.value}</p>
            <p className="mt-2 text-[11px] font-bold text-white/55">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <ShieldCheck size={16} className="text-theme-accent" />
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Quality Health</h3>
              <p className="mt-1 text-[11px] font-bold text-white/55">Runtime and governance signals that can erode trust if left unresolved.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Stale Workflows', value: quality.stale_workflow_count || 0, icon: RefreshCw },
              { label: 'Unread Notifications', value: quality.unread_notification_count || 0, icon: Bell },
              { label: 'Parameter Discrepancies', value: quality.parameter_discrepancy_count || 0, icon: Activity },
              { label: 'Project Risk Flags', value: quality.active_project_risk_count || 0, icon: Bug },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-white/35">
                  <item.icon size={14} className="text-theme-accent" />
                  <span className="text-[9px] font-black uppercase tracking-[0.18em]">{item.label}</span>
                </div>
                <p className="mt-3 text-[26px] font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <TerminalSquare size={16} className="text-theme-accent" />
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Developer Verification</h3>
              <p className="mt-1 text-[11px] font-bold text-white/55">Manual commands and checks for keeping the app production-safe without forcing CI.</p>
            </div>
          </div>
          <div className="space-y-3">
            {Object.entries(commands).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{key.replaceAll('_', ' ')}</p>
                <code className="mt-3 block text-[12px] font-bold text-theme-accent">{String(value)}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <CheckCircle2 size={16} className="text-theme-accent" />
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Latest Parameter Engine Runs</h3>
              <p className="mt-1 text-[11px] font-bold text-white/55">Recent dynamic-parameter outcomes that can affect intake defaults and governance behavior.</p>
            </div>
          </div>
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={`${log.parameter_key}-${log.timestamp}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{log.parameter_key}</p>
                  <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${log.status === 'SUCCESS' ? 'text-emerald-300' : log.status === 'DISCREPANCY' ? 'text-amber-300' : 'text-rose-300'}`}>{log.status}</span>
                </div>
                <p className="mt-2 text-[11px] font-bold text-white/55">{log.message || 'No issues recorded.'}</p>
              </div>
            ))}
            {!logs.length && <p className="text-[11px] font-bold text-white/45">No parameter execution history is available yet.</p>}
          </div>
        </div>

        <div className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Bug size={16} className="text-theme-accent" />
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">Buganizer Snapshot</h3>
              <p className="mt-1 text-[11px] font-bold text-white/55">Local runtime issues stay developer-only but visible here for triage and hardening.</p>
            </div>
          </div>
          <div className="space-y-3">
            {activeReports.slice(0, 8).map((report) => (
              <div key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{report.title}</p>
                  <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${report.status === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{report.status}</span>
                </div>
                <p className="mt-2 text-[11px] font-bold text-white/55">{report.category} • {report.view}</p>
              </div>
            ))}
            {!activeReports.length && <p className="text-[11px] font-bold text-white/45">No active local runtime issues are currently reported.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityCenter;
