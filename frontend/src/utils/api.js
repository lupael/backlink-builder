import axios from 'axios';

// Default to same-origin so the Vite dev proxy and nginx reverse proxy work
// transparently. Set VITE_API_URL only when the backend is on a different origin.
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 -> attempt silent token refresh, then redirect to login
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      // Guard: only retry if we have a refresh token, a config object, and
      // haven't already retried (to avoid infinite loops).
      if (refreshToken && err.config && !err.config._retry) {
        err.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          localStorage.setItem('access_token', data.access_token);
          // Ensure headers object exists before mutating
          err.config.headers = err.config.headers || {};
          err.config.headers['Authorization'] = `Bearer ${data.access_token}`;
          return api(err.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
