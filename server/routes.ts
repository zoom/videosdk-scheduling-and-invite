import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import {
  ZoomApiError,
  createVideoSession,
  deleteSession,
  generateSignature,
  getSession,
} from './zoom'
import {
  addSession,
  findInvite,
  readSessions,
  removeSessions,
  type StoredSession,
} from './store'
import { requireAuth, userFromRequest } from './auth'

export const router = Router()

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function validateSessionName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'sessionName is required')
  }
  if (value.length > 200) {
    throw new HttpError(400, 'sessionName is too long (max 200 characters)')
  }
  return value
}

function validateRole(value: unknown): number {
  if (value !== 0 && value !== 1) {
    throw new HttpError(400, 'role must be 0 (participant) or 1 (host)')
  }
  return value
}

router.get('/config', (_req, res) => {
  const port = process.env.PORT ?? '3000'
  const endpointUrl = (process.env.ENDPOINT_URL?.trim() || `http://localhost:${port}`).replace(/\/+$/, '')
  res.json({ endpointUrl })
})

router.post(['/token', '/generateToken'], async (req, res) => {
  const inviteId = req.body?.inviteId
  if (typeof inviteId !== 'string' || inviteId.length === 0 || inviteId.length > 128) {
    throw new HttpError(404, 'Invite not found')
  }
  const role = validateRole(req.body?.role)
  const invite = await findInvite(inviteId)
  if (!invite) throw new HttpError(404, 'Invite not found')
  const token = generateSignature(invite.sessionName, role, invite.hold)

  if (role === 1) {
    // Hosts must be signed in as the account (matched by email) that owns the session.
    const user = await userFromRequest(req)
    if (!user) throw new HttpError(401, 'Sign in to join as host')
    if (user.user_email.toLowerCase() !== invite.ownerEmail.toLowerCase()) {
      throw new HttpError(403, 'This host link does not belong to your account')
    }
    res.json({ token, sessionName: invite.sessionName, password: invite.password })
    return
  }

  res.json({ token, sessionName: invite.sessionName, passwordRequired: invite.password !== '' })
})

router.post(['/create-session', '/createsession'], requireAuth, async (req, res) => {
  const body = req.body ?? {}
  const sessionName = validateSessionName(body.sessionName)
  const role = validateRole(body.role)
  const hold = body.hold
  if (hold !== 0 && hold !== 1 && hold !== 2) {
    throw new HttpError(400, 'hold must be 0, 1 or 2')
  }
  if (typeof body.sessionPassword !== 'boolean' || typeof body.auto_recording !== 'boolean') {
    throw new HttpError(400, 'sessionPassword and auto_recording must be booleans')
  }
  const startTime = new Date(body.startTime)
  if (Number.isNaN(startTime.getTime())) {
    throw new HttpError(400, 'startTime must be a valid date')
  }

  // sessionPassword=true means "protect with a password"; the value comes from `password` or is generated.
  let password = ''
  if (body.sessionPassword) {
    password = typeof body.password === 'string' && body.password.trim() !== ''
      ? body.password.trim()
      : randomBytes(5).toString('hex')
    if (!/^[A-Za-z0-9]{1,10}$/.test(password)) {
      throw new HttpError(400, 'password must be alphanumeric and at most 10 characters')
    }
  }

  const created = await createVideoSession(sessionName, password, {
    auto_recording: body.auto_recording ? 'cloud' : 'none',
    hold,
  })

  const record: StoredSession = {
    sessionId: created.session_id,
    inviteId: randomBytes(16).toString('base64url'),
    sessionName,
    password,
    agenda: typeof body.agenda === 'string' ? body.agenda : '',
    startTime: startTime.toISOString(),
    timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
    duration: Number(body.duration) || 30,
    autoRecording: body.auto_recording,
    hold,
    createdAt: new Date().toISOString(),
  }
  await addSession(req.user!.id, record)

  res.status(201).json({ ...record, role, token: generateSignature(sessionName, role, hold) })
})

router.get('/scheduled-sessions', requireAuth, async (req, res) => {
  const userId = req.user!.id
  const stored = await readSessions(userId)
  const results = await Promise.all(
    stored.map(async (record) => {
      try {
        return { record, zoom: await getSession(record.sessionId) }
      } catch (error) {
        if (error instanceof ZoomApiError && error.status === 404) return { record, zoom: null }
        throw error
      }
    }),
  )
  // Sessions Zoom no longer knows about were deleted or expired, so drop them.
  await removeSessions(userId, results.filter((r) => r.zoom === null).map((r) => r.record.sessionId))
  const sessions = results
    .filter((r) => r.zoom !== null)
    .map((r) => ({ ...r.record, zoom: r.zoom }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  res.json({ sessions })
})

router.delete('/scheduled-sessions/:sessionId', requireAuth, async (req, res) => {
  const sessionId = String(req.params.sessionId)
  const owned = (await readSessions(req.user!.id)).some((s) => s.sessionId === sessionId)
  if (!owned) throw new HttpError(404, 'Session not found')
  try {
    await deleteSession(sessionId)
  } catch (error) {
    if (!(error instanceof ZoomApiError && error.status === 404)) throw error
  }
  await removeSessions(req.user!.id, [sessionId])
  res.status(204).end()
})
