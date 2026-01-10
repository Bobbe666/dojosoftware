/**
 * Zentrale API-Service-Schicht
 * Alle Backend-Kommunikation sollte durch diesen Service laufen
 */

import axios from 'axios';
import config from '../config/config';

// Erstelle Axios-Instance mit Default-Config
const apiClient = axios.create({
  baseURL: config.apiUrl || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - fügt Auth-Token automatisch hinzu
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - zentrale Fehlerbehandlung
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Bei 401 Unauthorized -> Logout
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }

    // Bei 403 Forbidden -> Access Denied
    if (error.response?.status === 403) {
      console.error('Access Denied:', error.response.data);
    }

    // Bei 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server Error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

/**
 * API Service Object mit allen Endpunkten
 */
const api = {
  // ==================== AUTH ====================
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    tokenLogin: (token) => apiClient.post('/auth/token-login', { token }),
    logout: () => apiClient.post('/auth/logout'),
    resetPassword: (email) => apiClient.post('/auth/reset-password', { email }),
    changePassword: (data) => apiClient.post('/auth/change-password', data),
  },

  // ==================== MITGLIEDER ====================
  mitglieder: {
    getAll: (params) => apiClient.get('/mitglieder', { params }),
    getById: (id) => apiClient.get(`/mitglieder/${id}`),
    create: (data) => apiClient.post('/mitglieder', data),
    update: (id, data) => apiClient.put(`/mitglieder/${id}`, data),
    delete: (id) => apiClient.delete(`/mitglieder/${id}`),
    search: (query) => apiClient.get('/mitglieder/search', { params: { q: query } }),
    getStatistics: (id) => apiClient.get(`/mitglieder/${id}/statistiken`),
    getFortschritt: (id) => apiClient.get(`/mitglieder/${id}/fortschritt`),
  },

  // ==================== VERTRÄGE ====================
  vertraege: {
    getAll: (params) => apiClient.get('/vertraege', { params }),
    getById: (id) => apiClient.get(`/vertraege/${id}`),
    getByMitglied: (mitgliedId) => apiClient.get(`/vertraege/mitglied/${mitgliedId}`),
    create: (data) => apiClient.post('/vertraege', data),
    update: (id, data) => apiClient.put(`/vertraege/${id}`, data),
    delete: (id) => apiClient.delete(`/vertraege/${id}`),
    kuendigen: (id, data) => apiClient.post(`/vertraege/${id}/kuendigen`, data),
  },

  // ==================== TRANSAKTIONEN ====================
  transaktionen: {
    getAll: (params) => apiClient.get('/transaktionen', { params }),
    getById: (id) => apiClient.get(`/transaktionen/${id}`),
    getByMitglied: (mitgliedId) => apiClient.get(`/transaktionen/mitglied/${mitgliedId}`),
    create: (data) => apiClient.post('/transaktionen', data),
    exportSepa: (params) => apiClient.get('/transaktionen/export/sepa', { params, responseType: 'blob' }),
  },

  // ==================== PRÜFUNGEN ====================
  pruefungen: {
    getAll: (params) => apiClient.get('/pruefungen', { params }),
    getById: (id) => apiClient.get(`/pruefungen/${id}`),
    getByMitglied: (mitgliedId) => apiClient.get(`/pruefungen/mitglied/${mitgliedId}`),
    create: (data) => apiClient.post('/pruefungen', data),
    update: (id, data) => apiClient.put(`/pruefungen/${id}`, data),
    delete: (id) => apiClient.delete(`/pruefungen/${id}`),
    anmelden: (data) => apiClient.post('/pruefungen/anmelden', data),
  },

  // ==================== ANWESENHEIT ====================
  anwesenheit: {
    getAll: (params) => apiClient.get('/anwesenheit', { params }),
    getByMitglied: (mitgliedId, params) => apiClient.get(`/anwesenheit/mitglied/${mitgliedId}`, { params }),
    checkin: (data) => apiClient.post('/anwesenheit/checkin', data),
    getStatistics: (params) => apiClient.get('/anwesenheit/statistiken', { params }),
  },

  // ==================== NOTIFICATIONS ====================
  notifications: {
    getAll: (params) => apiClient.get('/notifications', { params }),
    getById: (id) => apiClient.get(`/notifications/${id}`),
    markAsRead: (id) => apiClient.put(`/notifications/${id}/read`),
    markAllAsRead: () => apiClient.put('/notifications/read-all'),
    delete: (id) => apiClient.delete(`/notifications/${id}`),
    send: (data) => apiClient.post('/notifications', data),
  },

  // ==================== DOKUMENTE ====================
  dokumente: {
    getAll: (params) => apiClient.get('/dokumente', { params }),
    getById: (id) => apiClient.get(`/dokumente/${id}`),
    create: (data) => apiClient.post('/dokumente', data),
    update: (id, data) => apiClient.put(`/dokumente/${id}`, data),
    delete: (id) => apiClient.delete(`/dokumente/${id}`),
    getLatestVersion: (typ) => apiClient.get(`/dokumente/latest/${typ}`),
  },

  // ==================== STILE & GÜRTEL ====================
  stile: {
    getAll: () => apiClient.get('/stile'),
    getById: (id) => apiClient.get(`/stile/${id}`),
    create: (data) => apiClient.post('/stile', data),
    update: (id, data) => apiClient.put(`/stile/${id}`, data),
    delete: (id) => apiClient.delete(`/stile/${id}`),
  },

  guertel: {
    getAll: (params) => apiClient.get('/guertel', { params }),
    getByStil: (stilId) => apiClient.get(`/guertel/stil/${stilId}`),
    create: (data) => apiClient.post('/guertel', data),
    update: (id, data) => apiClient.put(`/guertel/${id}`, data),
    delete: (id) => apiClient.delete(`/guertel/${id}`),
  },

  // ==================== DASHBOARD ====================
  dashboard: {
    getStatistics: () => apiClient.get('/dashboard/statistics'),
    getRecentActivity: () => apiClient.get('/dashboard/recent-activity'),
    getChartData: (type) => apiClient.get(`/dashboard/charts/${type}`),
  },

  // ==================== ADMIN ====================
  admin: {
    getAllDojos: () => apiClient.get('/admin/dojos'),
    getDojoById: (id) => apiClient.get(`/admin/dojos/${id}`),
    createDojo: (data) => apiClient.post('/admin/dojos', data),
    updateDojo: (id, data) => apiClient.put(`/admin/dojos/${id}`, data),
    getAllUsers: () => apiClient.get('/admin/users'),
    createUser: (data) => apiClient.post('/admin/users', data),
    updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data),
  },
};

export default api;
export { apiClient };
