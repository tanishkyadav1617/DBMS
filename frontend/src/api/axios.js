import axios from 'axios';

// Resolve base URL exclusively from environment variables with fallback
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL !== undefined
    ? process.env.REACT_APP_API_BASE_URL
    : process.env.REACT_APP_API_URL ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');


// Resolve timeout threshold from environment variables
export const API_TIMEOUT_MS = parseInt(
  process.env.REACT_APP_API_TIMEOUT_MS || '10000',
  10
);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: CORS 401 guard + SQL telemetry dispatch ────────────
api.interceptors.response.use(
  (res) => {
    // Read X-Executed-Queries on every successful response and broadcast it
    try {
      const raw = res.headers['x-executed-queries'];
      if (raw) {
        const queries = JSON.parse(decodeURIComponent(raw));
        window.dispatchEvent(
          new CustomEvent('sql-queries-executed', { detail: queries })
        );
      }
    } catch (_) {
      // Silently ignore parse / decode errors so real responses are never affected
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/api/login')) {
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
