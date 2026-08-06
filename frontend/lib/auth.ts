'use client'

import { User } from './mockData'
import { api, setToken, getToken, USER_KEY } from './api'

export interface AuthState {
  isLoggedIn: boolean
  user: User | null
}

function persistUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function toUser(u: any): User {
  return {
    id: String(u.id),
    email: u.email,
    name: u.name,
    dob: u.dob || '',
    address: u.address || '',
    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
  }
}

export async function login(email: string, password: string): Promise<AuthState> {
  const res = await api.login({ email, password })
  setToken(res.token)
  const user = toUser(res.user)
  persistUser(user)
  return { isLoggedIn: true, user }
}

export async function signup(
  name: string,
  email: string,
  dob: string,
  password: string
): Promise<AuthState> {
  const res = await api.signup({ name, email, dob, password })
  setToken(res.token)
  const user = toUser(res.user)
  persistUser(user)
  return { isLoggedIn: true, user }
}

export function logout(): void {
  setToken(null)
  if (typeof window !== 'undefined') localStorage.removeItem(USER_KEY)
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getCurrentUser()
}

export function getCurrentAuth(): AuthState {
  const user = getCurrentUser()
  return { isLoggedIn: isLoggedIn(), user }
}
