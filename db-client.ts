import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/db` : '/api/db',
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

let inMemoryToken: string | null = (() => {
  try {
    return typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || sessionStorage.getItem('host_token')) : null;
  } catch (e) {
    return null;
  }
})();

// Interceptor to attach Authorization header if token exists
api.interceptors.request.use((config) => {
  // Add timestamp to prevent aggressive browser/proxy caching
  if (config.method?.toLowerCase() === 'get') {
    config.params = config.params || {};
    config.params._t = Date.now();
  }

  const token = inMemoryToken || (() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem('admin_token') || sessionStorage.getItem('host_token')) : null;
    } catch (e) {
      return null;
    }
  })();

  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (config.headers) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const reqUrl = String(error.config?.url || '');
      // Do not trigger global logout if 401 came from login attempt itself
      if (!reqUrl.includes('/login')) {
        inMemoryToken = null;
        try {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('currentUser');
          sessionStorage.removeItem('host_token');
          sessionStorage.removeItem('host_session');
        } catch (e) {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth_unauthorized'));
        }
      }
    }
    return Promise.reject(error);
  }
);

import { io } from 'socket.io-client';

export const dbApi = {
  auth: {
    login: async (username: string, password: string) => {
      const res = await api.post('/login', { username, password });
      if (res.data?.token) {
        inMemoryToken = res.data.token;
        try {
          localStorage.setItem('admin_token', res.data.token);
          if (res.data.user) {
            localStorage.setItem('currentUser', JSON.stringify(res.data.user));
          }
        } catch (e) {}
      }
      return res.data;
    },
    logout: async () => {
      try {
        await api.post('/logout');
      } catch (e) {
        // ignore errors on logout
      } finally {
        inMemoryToken = null;
        try {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('currentUser');
          sessionStorage.removeItem('host_token');
          sessionStorage.removeItem('host_session');
        } catch (e) {}
      }
    },
    getToken: () => inMemoryToken,
  },
  events: {
    getActive: async () => (await api.get('/events/active')).data,
    getAll: async () => (await api.get('/events')).data,
    create: async (title: string, hostUsername?: string, hostPassword?: string) => (await api.post('/events', { title, hostUsername, hostPassword })).data,
    update: async (id: string, data: { title?: string; hostUsername?: string; hostPassword?: string }) => (await api.patch(`/events/${id}`, data)).data,
    activate: async (id: string) => (await api.post(`/events/${id}/activate`)).data,
    archive: async (id: string) => (await api.post(`/events/${id}/archive`)).data,
    unarchive: async (id: string) => (await api.post(`/events/${id}/unarchive`)).data,
    delete: async (id: string) => (await api.delete(`/events/${id}`)).data,
  },
  host: {
    login: async (username: string, password: string) => {
      const res = await api.post('/host/login', { username, password });
      if (res.data?.token) {
        inMemoryToken = res.data.token;
        try {
          sessionStorage.setItem('host_token', res.data.token);
        } catch (e) {}
      }
      return res.data;
    },
    logout: async () => {
      try {
        await api.post('/logout');
      } catch (e) {}
      inMemoryToken = null;
      try {
        sessionStorage.removeItem('host_token');
        sessionStorage.removeItem('host_session');
      } catch (e) {}
    },
    getDonations: async () => (await api.get('/host/donations')).data,
  },
  donations: {
    getByEvent: async (eventId?: string | null) => (await api.get(`/donations/${eventId || 'all'}`)).data,
    getApprovedByEvent: async (eventId?: string | null) => (await api.get(`/donations/${eventId || 'active'}/approved`)).data,
    create: async (data: any) => (await api.post('/donations', data)).data,
    update: async (id: string, data: any) => (await api.patch(`/donations/${id}`, data)).data,
    delete: async (id: string) => (await api.delete(`/donations/${id}`)).data,
    getReceipt: async (id: string) => (await api.get(`/donations/${id}/receipt`)).data,
  },
  config: {
    get: async (key: string) => (await api.get(`/config/${key}`)).data,
    upsert: async (key: string, value: any) => (await api.post('/config', { key, value })).data,
  },
  admins: {
    getAll: async () => (await api.get('/admins')).data,
    create: async (data: any) => (await api.post('/admins', data)).data,
    update: async (id: string, data: any) => (await api.patch(`/admins/${id}`, data)).data,
    delete: async (id: string) => (await api.delete(`/admins/${id}`)).data,
  },
  subscribe: (onMessage: (event: any) => void) => {
    const baseURL = import.meta.env.VITE_API_URL || '/';
    const socket = io(baseURL, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socket.on('db_change', (data) => {
      onMessage(data);
    });

    return () => {
      socket.off('db_change');
      socket.disconnect();
    };
  }
};


