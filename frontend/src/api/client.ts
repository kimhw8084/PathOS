import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let reportErrorGlobal: any = null;
export const setGlobalReporter = (fn: any) => { reportErrorGlobal = fn; };

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (reportErrorGlobal) {
      if (error.response?.data) {
        reportErrorGlobal(error.response.data, 'backend');
      } else {
        reportErrorGlobal({ 
          message: error.message || "Network or Server unreachable", 
          type: error.code || "CONNECTION_FAILURE",
          traceback: error.stack 
        }, 'backend');
      }
    }
    return Promise.reject(error);
  }
);

export const workflowsApi = {
  list: (includeDeleted = false) => apiClient.get('/workflows', { params: { include_deleted: includeDeleted } }).then(res => res.data),
  search: (q: string, includeDeleted = false) => apiClient.get('/workflows/search', { params: { q, include_deleted: includeDeleted } }).then(res => res.data),
  globalSearch: (q: string, limit = 8) => apiClient.get('/workflows/global-search', { params: { q, limit } }).then(res => res.data),
  inbox: (memberEmail?: string) => apiClient.get('/workflows/inbox', { params: { member_email: memberEmail } }).then(res => res.data),
  governanceCenter: () => apiClient.get('/workflows/governance-center').then(res => res.data),
  insights: () => apiClient.get('/workflows/insights/overview').then(res => res.data),
  presidentInsights: () => apiClient.get('/workflows/insights/president').then(res => res.data),
  standardsLibrary: () => apiClient.get('/workflows/standards/library').then(res => res.data),
  discovery: (id: number) => apiClient.get(`/workflows/discovery/${id}`).then(res => res.data),
  policyOverlay: (id: number) => apiClient.get(`/workflows/policy-overlays/${id}`).then(res => res.data),
  rollbackPreview: (id: number) => apiClient.get(`/workflows/${id}/rollback-preview`).then(res => res.data),
  get: (id: number) => apiClient.get(`/workflows/${id}`).then(res => res.data),
  create: (data: any) => apiClient.post('/workflows', data).then(res => res.data),
  update: (id: number, data: any) => apiClient.put(`/workflows/${id}`, data).then(res => res.data),
  clone: (id: number, mode: 'clone' | 'version', workspace?: string) => apiClient.post(`/workflows/${id}/clone`, null, { params: { mode, workspace } }).then(res => res.data),
  rollbackDraft: (id: number, workspace?: string) => apiClient.post(`/workflows/${id}/rollback-draft`, null, { params: { workspace } }).then(res => res.data),
  governanceAction: (id: number, data: any) => apiClient.post(`/workflows/${id}/governance-action`, data).then(res => res.data),
  markNotificationRead: (workflowId: number, notificationId: string, actor?: string) =>
    apiClient.post(`/workflows/${workflowId}/notifications/${notificationId}/read`, { actor }).then(res => res.data),
  delete: (id: number) => apiClient.delete(`/workflows/${id}`).then(res => res.data),
  restore: (id: number) => apiClient.post(`/workflows/${id}/restore`).then(res => res.data),
  updateTasks: (id: number, tasks: any[]) => apiClient.put(`/tasks/workflow/${id}/sync`, tasks).then(res => res.data),
};

export const taxonomyApi = {
  list: () => apiClient.get('/taxonomy').then(res => res.data),
};

export const settingsApi = {
  listParameters: () => apiClient.get('/settings/parameters').then(res => res.data),
  adminOverview: () => apiClient.get('/settings/admin-overview').then(res => res.data),
  qualityOverview: () => apiClient.get('/settings/quality-overview').then(res => res.data),
  runtimeConfig: () => apiClient.get('/settings/runtime-config').then(res => res.data),
  getIdentitySource: () => apiClient.get('/settings/identity-source').then(res => res.data),
  updateIdentitySource: (data: any) => apiClient.put('/settings/identity-source', data).then(res => res.data),
  syncIdentitySource: (actor?: string) => apiClient.post('/settings/identity-source/sync', null, { params: { actor } }).then(res => res.data),
  getEnvironmentConfig: () => apiClient.get('/settings/environment-config').then(res => res.data),
  updateEnvironmentConfig: (data: any) => apiClient.put('/settings/environment-config', data).then(res => res.data),
  exportRuntimeConfig: () => apiClient.get('/settings/runtime-config/export').then(res => res.data),
  importRuntimeConfig: (data: any) => apiClient.post('/settings/runtime-config/import', data).then(res => res.data),
  getAppConfig: (key: string) => apiClient.get(`/settings/app-config/${key}`).then(res => res.data),
  updateAppConfig: (key: string, data: any) => apiClient.put(`/settings/app-config/${key}`, data).then(res => res.data),
  listMembers: () => apiClient.get('/settings/members').then(res => res.data),
  createMember: (data: any) => apiClient.post('/settings/members', data).then(res => res.data),
  updateMember: (id: number, data: any) => apiClient.put(`/settings/members/${id}`, data).then(res => res.data),
  listSavedViews: (entityType?: string) => apiClient.get('/settings/saved-views', { params: { entity_type: entityType } }).then(res => res.data),
  createSavedView: (data: any) => apiClient.post('/settings/saved-views', data).then(res => res.data),
  updateSavedView: (id: number, data: any) => apiClient.put(`/settings/saved-views/${id}`, data).then(res => res.data),
  updateParameter: (key: string, data: any) => apiClient.put(`/settings/parameters/${key}`, data).then(res => res.data),
  executeParameter: (key: string) => apiClient.post(`/settings/parameters/${key}/execute`).then(res => res.data),
  getParameterLogs: (key: string) => apiClient.get(`/settings/parameters/${key}/logs`).then(res => res.data),
  resolveDiscrepancy: (key: string, action: string) => apiClient.post(`/settings/parameters/${key}/resolve`, null, { params: { action } }).then(res => res.data),
};

export const mediaApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },
};

export const executionsApi = {
  list: () => apiClient.get('/executions').then(res => res.data),
  create: (data: any) => apiClient.post('/executions', data).then(res => res.data),
  update: (id: number, data: any) => apiClient.put(`/executions/${id}`, data).then(res => res.data),
};

export const projectsApi = {
  list: () => apiClient.get('/projects').then(res => res.data),
  create: (data: any) => apiClient.post('/projects', data).then(res => res.data),
  update: (id: number, data: any) => apiClient.put(`/projects/${id}`, data).then(res => res.data),
};
