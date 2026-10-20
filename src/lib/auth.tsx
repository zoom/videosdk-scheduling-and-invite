import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '../lib/api'

export interface UserDocument {
  userName: string
  userEmail: string
  meetings: { meetingId: string; meetingName: string; meetingPassword: string; dateTime: string }[]
}

interface AuthContextValue {
  user: UserDocument | null
  loading: boolean
  signIn: (userEmail: string, password: string) => Promise<void>
  signUp: (userName: string, userEmail: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const post = <T,>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDocument | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<UserDocument>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (userEmail: string, password: string) => {
    setUser(await post<UserDocument>('/auth/signin', { userEmail, password }))
  }, [])
  const signUp = useCallback(async (userName: string, userEmail: string, password: string) => {
    setUser(await post<UserDocument>('/auth/signup', { userName, userEmail, password }))
  }, [])
  const signOut = useCallback(async () => {
    try {
      await post('/auth/signout')
    } finally {
      setUser(null)
    }
  }, [])

  return <AuthContext value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
