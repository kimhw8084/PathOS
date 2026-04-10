import axios from 'axios';

const API_BASE_URL = '/api';

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
    if (reportErrorGlobal && error.response?.data) {
      reportErrorGlobal(error.response.data, 'backend');
    }
    return Promise.reject(error);
  }
);

export const workflowsApi = {
  list: () => apiClient.get('/workflows').then(res => res.data),
  get: (id: number) => apiClient.get(`/workflows/${id}`).then(res => res.data),
  create: (data: any) => apiClient.post('/workflows', data).then(res => res.data),
  update: (id: number, data: any) => apiClient.put(`/workflows/${id}`, data).then(res => res.data),
  delete: (id: number) => apiClient.delete(`/workflows/${id}`).then(res => res.data),
  updateTasks: (id: number, tasks: any[]) => apiClient.put(`/tasks/workflow/${id}/sync`, tasks).then(res => res.data),
};

export const taxonomyApi = {
  list: () => apiClient.get('/taxonomy').then(res => res.data),
};

export const settingsApi = {
  listParameters: () => apiClient.get('/settings/parameters').then(res => res.data),
  updateParameter: (key: string, data: any) => apiClient.put(`/settings/parameters/${key}`, data).then(res => res.data),
  executeParameter: (key: string) => apiClient.post(`/settings/parameters/${key}/execute`).then(res => res.data),
  getParameterLogs: (key: string) => apiClient.get(`/settings/parameters/${key}/logs`).then(res => res.data),
  resolveDiscrepancy: (key: string, action: string) => apiClient.post(`/settings/parameters/${key}/resolve`, null, { params: { action } }).then(res => res.data),
};
