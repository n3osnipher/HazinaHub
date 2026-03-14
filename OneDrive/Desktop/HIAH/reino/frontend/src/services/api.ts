import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL: BASE, timeout: 30000 })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('reino_token')
  if (token && cfg.headers) cfg.headers['Authorization'] = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('reino_token')
    window.dispatchEvent(new CustomEvent('reino:unauthorized'))
  }
  return Promise.reject(err)
})

export const authAPI = {
  register: (name: string, email: string, password: string, phone?: string) =>
    api.post('/auth/register', { name, email, password, phone }),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: Record<string, unknown>) => api.patch('/auth/me', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password', { token, new_password }),
}

export const contactsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/contacts', { params }),
  create: (data: Record<string, unknown>) => api.post('/contacts', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
  remove: (id: string) => api.delete(`/contacts/${id}`),
  block: (id: string, reason?: string) => api.post(`/contacts/${id}/block`, { reason }),
  unblock: (id: string) => api.post(`/contacts/${id}/unblock`),
  reportSpam: (id: string) => api.post(`/contacts/${id}/report-spam`),
  lookup: (phone: string) => api.get(`/contacts/lookup/${encodeURIComponent(phone)}`),
  sync: (contacts: unknown[]) => api.post('/contacts/sync', { contacts }),
}

export const callsAPI = {
  list: (params?: Record<string, unknown>) => api.get('/calls', { params }),
  initiate: (data: Record<string, unknown>) => api.post('/calls/initiate', data),
  incoming: (data: Record<string, unknown>) => api.post('/calls/incoming', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/calls/${id}`, data),
  sync: (calls: unknown[]) => api.post('/calls/sync', { calls }),
}

export const messagesAPI = {
  list: (params?: Record<string, unknown>) => api.get('/messages', { params }),
  send: (data: Record<string, unknown>) => api.post('/messages/send', data),
  incoming: (data: Record<string, unknown>) => api.post('/messages/incoming', data),
  markRead: (id: string) => api.patch(`/messages/${id}/read`),
  archive: (id: string) => api.patch(`/messages/${id}/archive`),
  archiveThread: (contactName: string) => api.patch(`/messages/thread/${encodeURIComponent(contactName)}/archive`),
  delete: (id: string) => api.delete(`/messages/${id}`),
  deleteThread: (contactName: string) => api.delete(`/messages/thread/${encodeURIComponent(contactName)}`),
  sync: (messages: unknown[]) => api.post('/messages/sync', { messages }),
}

export const hiahAPI = {
  chat: (message: string, history: unknown[], history_id?: string) =>
    api.post('/hiah/chat', { message, history, history_id }),
  tts: (text: string, voice_id?: string) =>
    api.post('/hiah/tts', { text, voice_id }, { responseType: 'blob' }),
  voiceInput: (blob: Blob) => {
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')
    return api.post('/hiah/voice-input', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  listActions: () => api.get('/hiah/actions'),
  approveAction: (id: string) => api.post(`/hiah/actions/${id}/approve`),
  rejectAction: (id: string) => api.post(`/hiah/actions/${id}/reject`),
  // Chat histories
  listHistories: () => api.get('/hiah/histories'),
  createHistory: (title?: string) => api.post('/hiah/histories', { title: title ?? 'New Chat' }),
  getHistory: (id: string) => api.get(`/hiah/histories/${id}`),
  renameHistory: (id: string, title: string) => api.patch(`/hiah/histories/${id}`, { title }),
  deleteHistory: (id: string) => api.delete(`/hiah/histories/${id}`),
}

export const notifAPI = {
  list: (page = 1) => api.get('/notifications', { params: { page } }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

export const settingsAPI = {
  updateGeneral: (data: Record<string, unknown>) => api.patch('/settings/general', data),
  updateApiKeys: (data: Record<string, unknown>) => api.patch('/settings/api-keys', data),
  updatePermissions: (data: Record<string, unknown>) => api.patch('/settings/hiah-permissions', data),
  syncSimCards: (sims: unknown[]) => api.post('/settings/sim-cards', sims),
  getSimCards: () => api.get('/settings/sim-cards'),
  getSecurity: () => api.get('/settings/security'),
  updateSecurity: (data: Record<string, unknown>) => api.patch('/settings/security', data),
  verifyPin: (pin: string) => api.post('/settings/security/verify-pin', { pin }),
}

export function getWSUrl(token: string): string {
  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
    return `${base}/ws?token=${token}`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws?token=${token}`
}

export default api
