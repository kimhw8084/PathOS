import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const workflowsApi = {
  list: () => apiClient.get('/workflows').then(res => res.data),
  get: (id: number) => apiClient.get(`/workflows/${id}`).then(res => res.data),
  create: (data: any) => apiClient.post('/workflows', data).then(res => res.data),
  delete: (id: number) => apiClient.delete(`/workflows/${id}`).then(res => res.data),
  updateTasks: (id: number, tasks: any[]) => apiClient.put(`/tasks/workflow/${id}/sync`, tasks).then(res => res.data),
};

export const taxonomyApi = {
  list: () => apiClient.get('/taxonomy').then(res => res.data),
};

export const tasksApi = {
  list: (workflowId: number) => apiClient.get(`/tasks/workflow/${workflowId}`).then(res => res.data),
  create: (data: any) => apiClient.post('/tasks', data).then(res => res.data),
};
