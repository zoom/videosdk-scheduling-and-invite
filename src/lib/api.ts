export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    let message = `Request to ${path} failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // non-JSON error body
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface ScheduledSession {
  sessionId: string
  inviteId: string
  sessionName: string
  password: string
  agenda: string
  startTime: string
  timezone: string
  duration: number
  autoRecording: boolean
  hold: number
}

let configPromise: Promise<{ endpointUrl: string }> | undefined

export function getConfig() {
  configPromise ??= apiFetch<{ endpointUrl: string }>('/config').catch((error) => {
    configPromise = undefined
    throw error
  })
  return configPromise
}

export const buildGuestLink = (endpointUrl: string, inviteId: string) =>
  `${endpointUrl}/s/${encodeURIComponent(inviteId)}`

export const buildHostLink = (endpointUrl: string, inviteId: string) =>
  `${buildGuestLink(endpointUrl, inviteId)}/host`
