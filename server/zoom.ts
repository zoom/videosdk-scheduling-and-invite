import jsrsasign from 'jsrsasign'

const { KJUR } = jsrsasign

const ZOOM_API_BASE = 'https://api.zoom.us/v2/videosdk'

export class ZoomApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function getCredentials() {
  const key = process.env.ZOOM_VSDK_KEY?.trim()
  const secret = process.env.ZOOM_VSDK_SECRET?.trim()
  if (!key || !secret) {
    throw new Error('ZOOM_VSDK_KEY and ZOOM_VSDK_SECRET must be set in your .env file')
  }
  return { key, secret }
}

export function generateSignature(sessionName: string, role: number, expiresInHours = 2): string {
  const { key, secret } = getCredentials()
  const iat = Math.round(Date.now() / 1000) - 30
  const exp = iat + 60 * 60 * expiresInHours
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    app_key: key,
    tpc: sessionName,
    role_type: role,
    version: 1,
    iat,
    exp,
  }
  return KJUR.jws.JWS.sign('HS256', JSON.stringify(header), JSON.stringify(payload), secret)
}

function generateAPIJWT(): string {
  const key = process.env.ZOOM_API_KEY?.trim()
  const secret = process.env.ZOOM_API_SECRET?.trim()
  if (!key || !secret) {
    throw new Error('ZOOM_API_KEY and ZOOM_API_SECRET must be set in your .env file')
  }
  const iat = Math.round(Date.now() / 1000) - 30
  const exp = iat + 60 * 60 * 2
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { iss: key, iat, exp }
  return KJUR.jws.JWS.sign('HS256', JSON.stringify(header), JSON.stringify(payload), secret)
}

// Zoom requires session IDs containing "/" to be double-encoded in the path.
const encodeSessionId = (id: string) => encodeURIComponent(encodeURIComponent(id))

async function zoomFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${ZOOM_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${generateAPIJWT()}`,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text
    } catch {
      // keep raw text
    }
    throw new ZoomApiError(response.status, `Zoom API error (${response.status}): ${message}`)
  }
  return response
}

export interface ZoomSessionSettings {
  auto_recording: 'cloud' | 'none'
  hold: number
}

export interface ZoomCreatedSession {
  session_id: string
  session_name: string
  session_password?: string
  settings?: Record<string, unknown>
}

export async function createVideoSession(
  sessionName: string,
  sessionPassword: string,
  settings: ZoomSessionSettings,
): Promise<ZoomCreatedSession> {
  const response = await zoomFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      session_name: sessionName,
      session_password: sessionPassword,
      settings,
    }),
  })
  return (await response.json()) as ZoomCreatedSession
}

export async function getSession(sessionId: string): Promise<Record<string, unknown>> {
  const response = await zoomFetch(`/sessions/${encodeSessionId(sessionId)}?type=scheduled`)
  return (await response.json()) as Record<string, unknown>
}

export async function deleteSession(sessionId: string): Promise<void> {
  await zoomFetch(`/sessions/${encodeSessionId(sessionId)}`, { method: 'DELETE' })
}
