import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/db` : '/api/db',
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

let inMemoryToken: string | null = null;

// Interceptor to attach Authorization header if in-memory token exists
api.interceptors.request.use((config) => {
  // Add timestamp to prevent aggressive browser/proxy caching
  if (config.method?.toLowerCase() === 'get') {
    config.params = config.params || {};
    config.params._t = Date.now();
  }

  if (inMemoryToken) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${inMemoryToken}`);
    } else if (config.headers) {
      (config.headers as any).Authorization = `Bearer ${inMemoryToken}`;
    }
  }
  return config;
});

// Interceptor to handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      inMemoryToken = null;
      try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('currentUser');
        sessionStorage.clear();
      } catch (e) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth_unauthorized'));
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
          localStorage.removeItem('admin_token');
          localStorage.removeItem('currentUser');
          sessionStorage.clear();
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
          sessionStorage.clear();
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
      }
      return res.data;
    },
    logout: async () => {
      try {
        await api.post('/logout');
      } catch (e) {}
      inMemoryToken = null;
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


