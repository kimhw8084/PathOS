import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Save, ShieldCheck, Users, Workflow as WorkflowIcon } from 'lucide-react';
import { settingsApi } from '../api/client';
import { toast } from 'react-hot-toast';

const AdminRolloutSettings: React.FC<{ overview: any; onRefresh: () => Promise<void> }> = ({ overview, onRefresh }) => {
  const configs = overview?.configs || [];
  const [activeTab, setActiveTab] = useState<'identity' | 'members' | 'views' | 'policy' | 'projects'>('identity');
  const [members, setMembers] = useState<any[]>(overview?.members || []);
  const [savedViews, setSavedViews] = useState<any[]>(overview?.saved_views || []);
  const [companyRolloutDraft, setCompanyRolloutDraft] = useState<any>({});
  const [governanceDraft, setGovernanceDraft] = useState<any>({});
  const [projectDraft, setProjectDraft] = useState<any>({});

  const configByKey = useMemo(
    () => Object.fromEntries(configs.map((config: any) => [config.key, config])),
    [configs]
  );

  const companyRollout = configByKey.company_rollout || { label: 'Company Rollout', description: '', value: {} };
  const governancePolicy = configByKey.governance_policy || { label: 'Governance Policy', description: '', value: {} };
  const roleCatalog = configByKey.role_catalog || { label: 'Role Catalog', description: '', value: { roles: [] } };
  const projectGovernance = configByKey.project_governance || { label: 'Project Governance', description: '', value: {} };

  useEffect(() => {
    setMembers(overview?.members || []);
    setSavedViews(overview?.saved_views || []);
    setCompanyRolloutDraft(companyRollout.value || {});
    setGovernanceDraft(governancePolicy.value || {});
    setProjectDraft(projectGovernance.value || {});
  }, [overview, companyRollout.value, governancePolicy.value, projectGovernance.value]);

  const saveConfig = async (key: string, config: any) => {
    await settingsApi.updateAppConfig(key, config);
    toast.success('Rollout configuration updated');
    await onRefresh();
  };

  const saveMember = async (member: any) => {
    if (member.id) {
      await settingsApi.updateMember(member.id, member);
    } else {
      await settingsApi.createMember(member);
    }
    toast.success('Member directory updated');
    await onRefresh();
  };

  const saveView = async (view: any) => {
    if (view.id) {
      await settingsApi.updateSavedView(view.id, view);
    } else {
      await settingsApi.createSavedView(view);
    }
    toast.success('Saved view synchronized');
    await onRefresh();
  };

  const tabs = [
    { id: 'identity', label: 'Identity', icon: Building2 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'views', label: 'Saved Views', icon: WorkflowIcon },
    { id: 'policy', label: 'Governance', icon: ShieldCheck },
    { id: 'projects', label: 'Projects', icon: WorkflowIcon },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-theme-border/50 pb-6">
        <div>
          <h3 className="text-header-sub !text-white">Company Rollout Administration</h3>
          <p className="text-subtext">Manage identity simulation, reviewer roles, shared discovery, and certification policy from one admin console.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${activeTab === tab.id ? 'border-theme-accent/20 bg-theme-accent/10 text-theme-accent' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}
          >
            <span className="inline-flex items-center gap-2"><tab.icon size={14} /> {tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'identity' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="apple-card space-y-4">
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Organization Name</span>
              <input className="input-apple !bg-black/60" value={companyRolloutDraft.organization_name || ''} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, organization_name: e.target.value })} />
            </label>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Authentication Mode</span>
              <input className="input-apple !bg-black/60" value={companyRolloutDraft.auth_mode || ''} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, auth_mode: e.target.value })} />
            </label>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Active Member Email</span>
              <select className="input-apple !bg-black/60" value={companyRolloutDraft.active_member_email || ''} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, active_member_email: e.target.value })}>
                {members.map((member) => <option key={member.email} value={member.email}>{member.full_name} • {member.email}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Site Options</span>
                <textarea className="input-apple !bg-black/60 !h-24" value={(companyRolloutDraft.site_options || []).join('\n')} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, site_options: e.target.value.split('\n').filter(Boolean) })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Team Options</span>
                <textarea className="input-apple !bg-black/60 !h-24" value={(companyRolloutDraft.team_options || []).join('\n')} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, team_options: e.target.value.split('\n').filter(Boolean) })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Org Options</span>
                <textarea className="input-apple !bg-black/60 !h-24" value={(companyRolloutDraft.org_options || []).join('\n')} onChange={(e) => setCompanyRolloutDraft({ ...companyRolloutDraft, org_options: e.target.value.split('\n').filter(Boolean) })} />
              </label>
            </div>
            <button onClick={() => saveConfig('company_rollout', { ...companyRollout, value: companyRolloutDraft })} className="btn-apple-primary w-fit flex items-center gap-2"><Save size={14} /> Save Identity Config</button>
          </div>
          <div className="apple-card space-y-4">
            <div>
              <p className="text-hint text-theme-secondary font-black">Role Catalog</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(roleCatalog.value?.roles || []).map((role: any) => (
                  <span key={role.key} className="rounded-full border border-theme-accent/20 bg-theme-accent/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">
                    {role.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Current Company Defaults</p>
              <p className="mt-2 text-[12px] font-bold text-white/65">Workspace: {companyRolloutDraft.default_workspace || 'Collaborative Workflows'}</p>
              <p className="mt-1 text-[12px] font-bold text-white/65">Visibility: {companyRolloutDraft.default_visibility || 'workspace'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-4">
          {members.map((member, index) => (
            <div key={member.id || index} className="apple-card grid gap-4 lg:grid-cols-5">
              <input className="input-apple !bg-black/60" value={member.full_name} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, full_name: e.target.value } : item))} />
              <input className="input-apple !bg-black/60" value={member.email} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, email: e.target.value } : item))} />
              <input className="input-apple !bg-black/60" value={member.team || ''} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, team: e.target.value } : item))} />
              <input className="input-apple !bg-black/60" value={member.site || ''} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, site: e.target.value } : item))} />
              <button onClick={() => saveMember(member)} className="btn-apple-primary flex items-center justify-center gap-2"><Save size={14} /> Save Member</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'views' && (
        <div className="space-y-4">
          {savedViews.map((view, index) => (
            <div key={view.id || index} className="apple-card grid gap-4 lg:grid-cols-4">
              <input className="input-apple !bg-black/60" value={view.name} onChange={(e) => setSavedViews(savedViews.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} />
              <input className="input-apple !bg-black/60" value={view.search_text || ''} onChange={(e) => setSavedViews(savedViews.map((item, itemIndex) => itemIndex === index ? { ...item, search_text: e.target.value } : item))} />
              <select className="input-apple !bg-black/60" value={view.scope || 'personal'} onChange={(e) => setSavedViews(savedViews.map((item, itemIndex) => itemIndex === index ? { ...item, scope: e.target.value } : item))}>
                {['personal', 'shared', 'org'].map((scope) => <option key={scope} value={scope}>{scope}</option>)}
              </select>
              <button onClick={() => saveView(view)} className="btn-apple-primary flex items-center justify-center gap-2"><Save size={14} /> Save View</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="apple-card space-y-4">
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Default Stale Window (days)</span>
              <input
                type="number"
                className="input-apple !bg-black/60"
                value={governanceDraft.stale_after_days || 90}
                onChange={(e) => setGovernanceDraft({ ...governanceDraft, stale_after_days: Number(e.target.value) })}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Certification States</span>
              <textarea
                className="input-apple !bg-black/60 !h-32"
                value={(governanceDraft.certification_states || []).join('\n')}
                onChange={(e) => setGovernanceDraft({ ...governanceDraft, certification_states: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
            <div className="space-y-4 pt-4 border-t border-white/5">
              <p className="text-hint text-theme-secondary font-black">Status Categories (JSON)</p>
              <textarea
                className="input-apple !bg-black/60 !h-48 font-mono text-[11px]"
                value={JSON.stringify(governanceDraft.status_categories || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setGovernanceDraft({ ...governanceDraft, status_categories: parsed });
                  } catch (err) {
                    // silent fail while typing
                  }
                }}
              />
            </div>
            <button onClick={() => saveConfig('governance_policy', { ...governancePolicy, value: governanceDraft })} className="btn-apple-primary w-fit flex items-center gap-2"><Save size={14} /> Save Governance Policy</button>
          </div>
          <div className="apple-card space-y-4">
            <p className="text-hint text-theme-secondary font-black">Required Reviewer Roles by Workflow Type</p>
            {Object.entries(governanceDraft.required_roles_by_workflow_type || {}).map(([workflowType, roles]: [string, any]) => (
              <div key={workflowType} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{workflowType}</p>
                <p className="mt-2 text-[11px] font-bold text-white/60">{Array.isArray(roles) ? roles.join(', ') : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="apple-card space-y-4">
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Project Pipeline Columns</span>
              <textarea
                className="input-apple !bg-black/60 !h-32"
                value={(projectDraft.columns || []).join('\n')}
                onChange={(e) => setProjectDraft({ ...projectDraft, columns: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Priority Options</span>
              <textarea
                className="input-apple !bg-black/60 !h-24"
                value={(projectDraft.priorities || []).join('\n')}
                onChange={(e) => setProjectDraft({ ...projectDraft, priorities: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Health States</span>
              <textarea
                className="input-apple !bg-black/60 !h-24"
                value={(projectDraft.health_states || []).join('\n')}
                onChange={(e) => setProjectDraft({ ...projectDraft, health_states: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
            <button onClick={() => saveConfig('project_governance', { ...projectGovernance, value: projectDraft })} className="btn-apple-primary w-fit flex items-center gap-2"><Save size={14} /> Save Project Governance</button>
          </div>
          <div className="apple-card space-y-4">
            <p className="text-hint text-theme-secondary font-black">Project Preview</p>
            <div className="flex flex-wrap gap-2">
              {(projectDraft.columns || []).map((col: string) => (
                <div key={col} className="rounded-xl border border-white/10 bg-black/40 px-3 py-4 min-w-[120px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-theme-accent">{col}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRolloutSettings;
