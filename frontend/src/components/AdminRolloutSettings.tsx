import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Code2, History, Play, Save, ShieldCheck, Users, Workflow as WorkflowIcon } from 'lucide-react';
import { settingsApi } from '../api/client';
import { toast } from 'react-hot-toast';

const AdminRolloutSettings: React.FC<{ overview: any; identitySource?: any; onRefresh: () => Promise<void> }> = ({ overview, identitySource, onRefresh }) => {
  const configs = overview?.configs || [];
  const [activeTab, setActiveTab] = useState<'identity' | 'members' | 'source' | 'views' | 'policy' | 'projects'>('identity');
  const [members, setMembers] = useState<any[]>(overview?.members || []);
  const [savedViews, setSavedViews] = useState<any[]>(overview?.saved_views || []);
  const [companyRolloutDraft, setCompanyRolloutDraft] = useState<any>({});
  const [governanceDraft, setGovernanceDraft] = useState<any>({});
  const [projectDraft, setProjectDraft] = useState<any>({});
  const [identityDraft, setIdentityDraft] = useState<any>({});
  const [identitySnapshots, setIdentitySnapshots] = useState<any[]>([]);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<number | null>(null);

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
    setIdentityDraft(identitySource?.source || {});
    setIdentitySnapshots(identitySource?.snapshots || []);
  }, [overview, companyRollout.value, governancePolicy.value, projectGovernance.value, identitySource]);

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

  const saveIdentitySource = async () => {
    try {
      await settingsApi.updateIdentitySource(identityDraft);
      toast.success('Identity source updated');
      await onRefresh();
    } catch (err) {
      toast.error('Failed to save identity source');
    }
  };

  const syncIdentitySource = async () => {
    try {
      const result = await settingsApi.syncIdentitySource();
      toast.success(result?.message || 'Identity source synchronized');
      await onRefresh();
    } catch (err) {
      toast.error('Failed to run identity sync');
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identity', icon: Building2 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'source', label: 'Identity Source', icon: Code2 },
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
            <div key={member.id || index} className="apple-card space-y-4">
              <div className="grid gap-3 lg:grid-cols-4">
                <input className="input-apple !bg-black/60" value={member.full_name || ''} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, full_name: e.target.value } : item))} />
                <input className="input-apple !bg-black/60" value={member.email || ''} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, email: e.target.value } : item))} />
                <input className="input-apple !bg-black/60" value={member.employee_id || ''} placeholder="Employee ID" onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, employee_id: e.target.value } : item))} />
                <select className="input-apple !bg-black/60" value={member.status || 'active'} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, status: e.target.value } : item))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <input className="input-apple !bg-black/60" value={member.title || ''} placeholder="Title" onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, title: e.target.value } : item))} />
                <input className="input-apple !bg-black/60" value={member.team || ''} placeholder="Team" onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, team: e.target.value } : item))} />
                <input className="input-apple !bg-black/60" value={member.site || ''} placeholder="Site" onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, site: e.target.value } : item))} />
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <textarea className="input-apple !bg-black/60 !h-24" value={(member.roles || []).join('\n')} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, roles: e.target.value.split('\n').filter(Boolean) } : item))} />
                <textarea className="input-apple !bg-black/60 !h-24" value={(member.permissions || []).join('\n')} onChange={(e) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, permissions: e.target.value.split('\n').filter(Boolean) } : item))} />
                <button onClick={() => saveMember(member)} className="btn-apple-primary flex items-center justify-center gap-2 self-start"><Save size={14} /> Save Member</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'source' && (
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="apple-card space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-hint text-theme-secondary font-black">Identity Source</p>
                <p className="text-[11px] text-white/45">Python script, venv, and working directory used to materialize the roster.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={syncIdentitySource} className="btn-apple-secondary flex items-center gap-2"><Play size={14} /> Sync Now</button>
                <button onClick={saveIdentitySource} className="btn-apple-primary flex items-center gap-2"><Save size={14} /> Save Source</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Source Name</span>
                <input className="input-apple !bg-black/60" value={identityDraft.name || ''} onChange={(e) => setIdentityDraft({ ...identityDraft, name: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Provider</span>
                <input className="input-apple !bg-black/60" value={identityDraft.provider || 'python_script'} onChange={(e) => setIdentityDraft({ ...identityDraft, provider: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Working Directory</span>
                <input className="input-apple !bg-black/60" value={identityDraft.working_dir || ''} onChange={(e) => setIdentityDraft({ ...identityDraft, working_dir: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Project Venv Path</span>
                <input className="input-apple !bg-black/60" value={identityDraft.venv_path || ''} onChange={(e) => setIdentityDraft({ ...identityDraft, venv_path: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Script Path</span>
                <input className="input-apple !bg-black/60" value={identityDraft.script_path || ''} onChange={(e) => setIdentityDraft({ ...identityDraft, script_path: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Schedule</span>
                <input className="input-apple !bg-black/60" value={identityDraft.schedule || ''} onChange={(e) => setIdentityDraft({ ...identityDraft, schedule: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Schema Version</span>
                <input className="input-apple !bg-black/60" value={identityDraft.schema_version || '1'} onChange={(e) => setIdentityDraft({ ...identityDraft, schema_version: e.target.value })} />
              </label>
              <label className="block space-y-2">
                <span className="text-hint text-theme-secondary font-black">Active</span>
                <select className="input-apple !bg-black/60" value={identityDraft.is_active ? 'true' : 'false'} onChange={(e) => setIdentityDraft({ ...identityDraft, is_active: e.target.value === 'true' })}>
                  <option value="true">Active</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-hint text-theme-secondary font-black">Python Script</span>
              <textarea
                className="input-apple !bg-black/60 !h-[28rem] font-mono text-[11px] leading-relaxed"
                value={identityDraft.script_content || ''}
                onChange={(e) => setIdentityDraft({ ...identityDraft, script_content: e.target.value })}
              />
            </label>
          </div>

          <div className="space-y-6">
            <div className="apple-card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-hint text-theme-secondary font-black">Roster Status</p>
                <History size={16} className="text-theme-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Current Version</p>
                  <p className="mt-2 text-[22px] font-black text-white">{identityDraft.current_version || 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Last Run</p>
                  <p className="mt-2 text-[11px] font-bold text-white/70">{identityDraft.last_run_at ? new Date(identityDraft.last_run_at).toLocaleString() : 'Never'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Rows</p>
                  <p className="mt-2 text-[22px] font-black text-theme-accent">{identityDraft.last_run_row_count || 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Status</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-white">{identityDraft.last_run_status || 'never'}</p>
                </div>
              </div>
              <p className="text-[11px] font-bold text-white/55">{identityDraft.last_run_message || 'Run the script to materialize the current roster and create a versioned snapshot.'}</p>
            </div>

            <div className="apple-card space-y-4">
              <p className="text-hint text-theme-secondary font-black">Current Active Members</p>
              <div className="space-y-3 max-h-[18rem] overflow-auto custom-scrollbar pr-1">
                {(identitySource?.members || []).map((member: any) => (
                  <div key={member.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-white">{member.full_name}</p>
                        <p className="text-[10px] font-bold text-white/45">{member.email}</p>
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">{member.status}</p>
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-white/45">{member.title || 'No title'} • {member.team || 'No team'} • {member.site || 'No site'}</p>
                  </div>
                ))}
                {(identitySource?.members || []).length === 0 && <p className="text-[11px] font-bold text-white/40">No active roster rows yet. Run the identity source to populate the table.</p>}
              </div>
            </div>

            <div className="apple-card space-y-4">
              <p className="text-hint text-theme-secondary font-black">Version History</p>
              <div className="space-y-3 max-h-[24rem] overflow-auto custom-scrollbar pr-1">
                {identitySnapshots.map((snapshot: any) => (
                  <button
                    key={snapshot.id}
                    onClick={() => setExpandedSnapshotId(expandedSnapshotId === snapshot.id ? null : snapshot.id)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-theme-accent/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Version {snapshot.version}</p>
                        <p className="mt-1 text-[11px] font-bold text-white/55">{snapshot.message || 'Roster snapshot'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-theme-accent">{snapshot.status}</p>
                        <p className="mt-1 text-[10px] font-bold text-white/45">{snapshot.row_count} rows</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">+{snapshot.added_count}</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">~{snapshot.updated_count}</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">-{snapshot.removed_count}</span>
                    </div>
                    {expandedSnapshotId === snapshot.id && (
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                        {(snapshot.rows || []).slice(0, 8).map((row: any) => (
                          <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{row.full_name}</p>
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-theme-accent">{row.row_state}</p>
                            </div>
                            <p className="mt-1 text-[10px] font-bold text-white/50">{row.email} • {row.team || 'No team'} • {row.status}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
                {identitySnapshots.length === 0 && <p className="text-[11px] font-bold text-white/40">No roster snapshots yet. Save and sync the source to create version history.</p>}
              </div>
            </div>
          </div>
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
