import React from 'react';
import { BookOpen, BriefcaseBusiness, GitBranch, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';

const HelpCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section className="apple-card !bg-[#111827]/40 border-white/10 p-6 space-y-4">
    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
      {icon}
      <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-white">{title}</h3>
    </div>
    {children}
  </section>
);

const HelpCenter: React.FC = () => {
  return (
    <div className="max-w-[1480px] mx-auto space-y-6 animate-apple-in">
      <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(10,17,32,0.95))] p-6 shadow-2xl">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-theme-accent">Help and Onboarding</p>
        <h1 className="mt-3 text-[30px] font-black uppercase tracking-tight text-white">How PathOS should be used across the company</h1>
        <p className="mt-3 max-w-[72rem] text-[13px] font-bold leading-relaxed text-white/65">
          PathOS is the department operating system for workflow capture, review, execution tracking, automation delivery, and measurable business impact. This guide keeps operators, reviewers, managers, and automation engineers aligned on how to use the app without adding process confusion.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <HelpCard title="Operator Path" icon={<Users size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>1. Start in `Workflow Repository` and search before creating anything new.</p>
            <p>2. If a workflow does not exist, use intake and capture the minimal valid definition first.</p>
            <p>3. Log real executions in `Operational Board` so the app learns actual burden and benefit.</p>
            <p>4. Use comments and review requests instead of side-channeling approval over chat or email.</p>
          </div>
        </HelpCard>

        <HelpCard title="Reviewer Path" icon={<ShieldCheck size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>1. Open the collaboration inbox and review queue first.</p>
            <p>2. Use the workflow summary to inspect certification, diagnostics, policy overlays, and traceability.</p>
            <p>3. Approve, request changes, or certify only after the workflow is readable end to end.</p>
            <p>4. Use review state and comments to make change rationale visible to the next reviewer.</p>
          </div>
        </HelpCard>

        <HelpCard title="Automation Engineer Path" icon={<BriefcaseBusiness size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>1. Use automation candidates and bottleneck analysis to prioritize work.</p>
            <p>2. Create projects from workflow gaps so traceability stays attached to the source process.</p>
            <p>3. Compare projected benefit to execution evidence after deployment.</p>
            <p>4. Keep post-deployment versions current so the workflow remains a trustworthy standard.</p>
          </div>
        </HelpCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <HelpCard title="Workflow Authoring Standards" icon={<GitBranch size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>Use trigger-to-outcome routing with no disconnected steps, no malformed decision branches, and enough detail for another person to execute the work safely.</p>
            <p>Always include owners, review roles, timing assumptions, exception burden, and validation steps for high-value workflows.</p>
            <p>Prefer reusable templates, reuse patterns, and related workflows before inventing new structures.</p>
          </div>
        </HelpCard>

        <HelpCard title="Search and Reuse" icon={<Search size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>Use global search for workflows, projects, executions, and saved views.</p>
            <p>Use discovery, duplicates, and cross-department patterns to standardize instead of fragmenting documentation.</p>
            <p>When intake suggests similar workflows, treat that as a standardization opportunity, not an annoyance.</p>
          </div>
        </HelpCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <HelpCard title="Executive Readout" icon={<Sparkles size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>The dashboard and analytics surfaces are meant to answer three questions clearly:</p>
            <p>1. Where is the department still spending manual time?</p>
            <p>2. Which workflows should be automated next?</p>
            <p>3. Are delivered projects actually realizing the value they promised?</p>
          </div>
        </HelpCard>

        <HelpCard title="Developer / Admin Notes" icon={<BookOpen size={16} className="text-theme-accent" />}>
          <div className="space-y-3 text-[12px] font-bold text-white/65">
            <p>Testing, telemetry, and seeded data are developer-side only. They should never interrupt normal end-user operation.</p>
            <p>Use `System Settings` for rollout simulation, quality health, parameter integrity, and saved-view administration.</p>
            <p>Use Playwright and manual verification only when needed. The production UI should never look like a test harness.</p>
          </div>
        </HelpCard>
      </div>
    </div>
  );
};

export default HelpCenter;
