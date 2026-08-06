'use client'

// Thin client for the Flask backend. Base URL from NEXT_PUBLIC_API_URL
// (defaults to http://localhost:8000). The auth token is kept in localStorage.
const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'MenoCare_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string | null) {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function req(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail || detail
    } catch {}
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // auth
  signup: (body: any) => req('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => req('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => req('/auth/me'),

  // profile
  getProfile: () => req('/profile'),
  updateProfile: (body: any) => req('/profile', { method: 'PUT', body: JSON.stringify(body) }),

  // symptoms
  listSymptoms: () => req('/symptoms'),
  addSymptom: (body: any) => req('/symptoms', { method: 'POST', body: JSON.stringify(body) }),
  deleteSymptom: (id: string) => req(`/symptoms/${id}`, { method: 'DELETE' }),

  // alerts
  listAlerts: () => req('/alerts'),
  dismissAlert: (id: string) => req(`/alerts/${id}/dismiss`, { method: 'POST' }),

  // forecast + reminders
  forecast: (body: any = {}) => req('/forecast', { method: 'POST', body: JSON.stringify(body) }),
  listReminders: () => req('/reminders'),
  testReminder: () => req('/reminders/test', { method: 'POST' }),

  // community
  listBlogs: () => req('/blogs'),
  createBlog: (body: any) => req('/blogs', { method: 'POST', body: JSON.stringify(body) }),
  getBlog: (id: number) => req(`/blogs/${id}`),
  commentBlog: (id: number, body: any) => req(`/blogs/${id}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  likeBlog: (id: number) => req(`/blogs/${id}/like`, { method: 'POST' }),

  // latest info
  latestInfo: (q?: string, topic?: 'news' | 'general', depth?: 'basic' | 'advanced') => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (topic) p.set('topic', topic)
    if (depth) p.set('depth', depth)
    const qs = p.toString()
    return req(`/latest-info${qs ? `?${qs}` : ''}`)
  },

  // AI assistant (Groq Llama 3.3)
  chat: (messages: { role: string; content: string }[]) =>
    req('/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
}
