type GovernanceMember = {
  email?: string;
  full_name?: string;
  roles?: string[];
  permissions?: string[];
  team?: string;
  title?: string;
};

type GovernanceWorkflow = {
  required_reviewer_roles?: string[];
  governance?: {
    required_reviewer_roles?: string[];
  };
};

const normalizeList = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  return [String(value).trim().toLowerCase()].filter(Boolean);
};

const normalizePermission = (value: string) => {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.replace(/:/g, '.');
};

export const getMemberRoleSet = (member?: GovernanceMember | null) => new Set(normalizeList(member?.roles));

export const getMemberPermissionSet = (member?: GovernanceMember | null) => {
  const normalized = new Set<string>();
  for (const permission of normalizeList(member?.permissions)) {
    if (!permission) continue;
    normalized.add(permission);
    normalized.add(normalizePermission(permission));
  }
  return normalized;
};

export const getWorkflowReviewerRoleSet = (workflow?: GovernanceWorkflow | null) => {
  const governanceRoles = normalizeList(workflow?.governance?.required_reviewer_roles);
  const workflowRoles = normalizeList(workflow?.required_reviewer_roles);
  return new Set([...governanceRoles, ...workflowRoles]);
};

export const canPerformGovernanceAction = (
  member?: GovernanceMember | null,
  workflow?: GovernanceWorkflow | null,
  action?: string
) => {
  if (!member) return false;
  const roles = getMemberRoleSet(member);
  const permissions = getMemberPermissionSet(member);
  const reviewerRoles = getWorkflowReviewerRoleSet(workflow);
  const isAdmin = roles.has('admin') || permissions.has('workflow.admin');
  const normalizedAction = String(action || '').trim().toLowerCase();

  if (normalizedAction === 'approve_review') {
    return isAdmin || permissions.has('workflow.review') || permissions.has('workflow.approve') || Boolean([...reviewerRoles].some((role) => roles.has(role)));
  }
  if (normalizedAction === 'approve_workflow' || normalizedAction === 'certify' || normalizedAction === 'request_recertification') {
    return isAdmin || permissions.has('workflow.approve') || Boolean([...reviewerRoles].some((role) => roles.has(role)));
  }
  if (normalizedAction === 'request_changes') {
    return isAdmin || permissions.has('workflow.review') || permissions.has('workflow.approve') || Boolean([...reviewerRoles].some((role) => roles.has(role)));
  }
  return false;
};

export const canApproveWorkflow = (member?: GovernanceMember | null, workflow?: GovernanceWorkflow | null) =>
  canPerformGovernanceAction(member, workflow, 'approve_workflow');

export const canReviewWorkflow = (member?: GovernanceMember | null, workflow?: GovernanceWorkflow | null) =>
  canPerformGovernanceAction(member, workflow, 'approve_review');

export const canActOnReviewRequest = (member?: GovernanceMember | null, requestRole?: string, workflow?: GovernanceWorkflow | null) => {
  if (canReviewWorkflow(member, workflow)) return true;
  const roles = getMemberRoleSet(member);
  const normalizedRole = String(requestRole || '').trim().toLowerCase();
  return normalizedRole ? roles.has(normalizedRole) : false;
};

export const canManageAutomationBoard = (member?: GovernanceMember | null) => {
  if (!member) return false;
  const roles = getMemberRoleSet(member);
  const permissions = getMemberPermissionSet(member);
  return roles.has('admin') || permissions.has('workflow.review') || permissions.has('workflow.approve') || permissions.has('workflow.admin');
};

export const canReviewAutomationBoard = (member?: GovernanceMember | null) => {
  if (!member) return false;
  const roles = getMemberRoleSet(member);
  const permissions = getMemberPermissionSet(member);
  return roles.has('admin') || permissions.has('workflow.review') || permissions.has('workflow.approve') || permissions.has('workflow.admin');
};

export const canApproveAutomationBoard = (member?: GovernanceMember | null) => {
  if (!member) return false;
  const roles = getMemberRoleSet(member);
  const permissions = getMemberPermissionSet(member);
  return roles.has('admin') || permissions.has('workflow.approve') || permissions.has('workflow.admin');
};

export const formatGovernanceActor = (member?: GovernanceMember | null) => {
  if (!member) return 'system_user';
  return member.email || member.full_name || 'system_user';
};
