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

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 clear storage and redirect to login (except during authentication request)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/api/login')) {
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
