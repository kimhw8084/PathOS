import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/client';

export const FALLBACK_RUNTIME_CONFIG = {
  profile: { name: 'base', version: 1, warnings: [] as string[] },
  app: {
    name: 'PathOS',
    short_name: 'PathOS',
    description: 'Workflow operations platform.',
    version: '1.0.0',
  },
  network: {
    api_prefix: '/api',
    uploads_base_url: '/uploads',
  },
  organization: {
    name: 'PathOS Workspace',
    auth_mode: 'Local',
    default_workspace: 'Collaborative Workflows',
    default_visibility: 'workspace',
    workspace_options: ['Personal Drafts', 'Submitted Requests', 'Collaborative Workflows', 'Standard Operations'],
    lifecycle_options: ['Draft', 'In Review', 'Changes Requested', 'Approved', 'Active'],
    mention_directory: ['Primary Owner', 'Automation Team', 'Process SME'],
    mention_groups: ['Automation Team', 'Process SME'],
    reviewer_role_options: ['Process SME', 'Automation Team', 'Process Owner'],
    site_options: ['HQ', 'Site A', 'Site B'],
    team_options: ['Operations', 'Automation', 'Yield Engineering', 'Process Control'],
    org_options: ['Operations', 'Engineering', 'Quality'],
  },
  governance: {
    certification_states: ['Draft', 'Pending Review', 'Certified', 'Needs Recertification'],
    review_states: ['Draft', 'Requested', 'Changes Requested', 'Approved'],
    approval_states: ['Draft', 'Pending Review', 'Approved', 'Certified', 'Needs Recertification'],
    lifecycle_stages: ['Draft', 'In Review', 'Approved', 'Active'],
    status_categories: {
      STANDARD: ['Partially Automated', 'Fully Automated'],
      REVIEW: ['Created', 'Workflow Review', 'Verification'],
      PENDING: ['Backlog', 'Automation Planned', 'In Automation'],
    },
    required_roles_by_workflow_type: {},
  },
  project_governance: {
    columns: ['Scoping', 'Planned', 'In Progress', 'Validation', 'Deployed'],
    priorities: ['High', 'Medium', 'Low'],
    health_states: ['On Track', 'At Risk', 'Blocked'],
  },
  workflow_defaults: {
    access_control: { visibility: 'private', viewers: [], editors: [], mention_groups: [], owner: 'Primary Owner' },
    ownership: { owner: 'Primary Owner', smes: [], backup_owners: [], automation_owner: '', reviewers: [] },
    governance: { lifecycle_stage: 'Draft', review_state: 'Draft', approval_state: 'Draft', required_reviewer_roles: [], standards_flags: [], stale_after_days: 90, review_due_at: '', last_reviewed_at: '' },
  },
  roles: [],
  parameters: {
    keys: {
      tool_id: 'TOOL_ID',
      hardware_family: 'HARDWARE_FAMILY',
      workflow_type: 'WORKFLOW_TYPE',
      prc: 'PRC',
      trigger_architecture: 'TRIGGER_ARCHITECTURE',
      output_classification: 'OUTPUT_CLASSIFICATION',
    },
    defaults: [],
  },
  templates: [],
  integrations: {},
  features: {},
  current_member: null as any,
};

export function useRuntimeConfig() {
  return useQuery({
    queryKey: ['runtime-config'],
    queryFn: settingsApi.runtimeConfig,
    staleTime: 60_000,
  });
}

export function resolvedRuntimeConfig(runtimeConfig: any) {
  return runtimeConfig || FALLBACK_RUNTIME_CONFIG;
}

export function buildWorkflowDefaults(runtimeConfig: any, activeOwner?: string) {
  const resolved = resolvedRuntimeConfig(runtimeConfig);
  const owner = activeOwner || resolved.current_member?.full_name || resolved.workflow_defaults?.ownership?.owner || 'system_user';
  return {
    access_control: {
      ...resolved.workflow_defaults.access_control,
      owner,
    },
    ownership: {
      ...resolved.workflow_defaults.ownership,
      owner,
    },
    governance: {
      ...resolved.workflow_defaults.governance,
    },
  };
}
