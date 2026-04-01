const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // If the endpoint is already a full URL, use it as is
  // Otherwise, prepend the base URL
  const url = (endpoint.startsWith('http') || !API_BASE_URL) 
    ? endpoint 
    : `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const headers: Record<string, string> = { ...options.headers } as any;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any = {};
    let fullTraceback = null;
    try {
      errorData = await response.json();
      // If FastAPI returns an error, it often includes details in 'detail'
      // If we've implemented custom traceback capture on backend, it might be in 'traceback'
      fullTraceback = errorData.traceback || null;
    } catch (e) {
      errorData = { detail: `API Error ${response.status}: ${response.statusText}` };
    }
    
    const errorMessage = errorData.detail || errorData.message || `API error: ${response.status}`;
    const error = new Error(errorMessage) as any;
    error.status = response.status;
    error.traceback = fullTraceback;
    error.data = errorData;
    throw error;
  }

  return response;
}
