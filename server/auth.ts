import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { query } from './db'
import { getUserDocument } from './store'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

const COOKIE = 'session_token'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export interface AuthUser {
  id: string
  user_name: string
  user_email: string
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

function setSessionCookie(res: Response, token: string, maxAgeMs: number) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  })
}

async function startSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('hex')
  await query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [
    hashToken(token),
    userId,
    new Date(Date.now() + SESSION_MS),
  ])
  setSessionCookie(res, token, SESSION_MS)
}

export async function userFromRequest(req: Request): Promise<AuthUser | undefined> {
  const token = readCookie(req, COOKIE)
  if (!token) return undefined
  const rows = await query<AuthUser>(
    `SELECT u.id, u.user_name, u.user_email FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  )
  return rows[0]
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await userFromRequest(req)
    if (!user) throw new HttpError(401, 'Not signed in')
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const name = str(req.body?.userName)
  const email = str(req.body?.userEmail).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!name || name.length > 100) throw new HttpError(400, 'Name is required (max 100 characters)')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'A valid email is required')
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'Password must be 8-128 characters')

  const rows = await query<AuthUser>(
    `INSERT INTO users (user_name, user_email, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING RETURNING id, user_name, user_email`,
    [name, email, await hashPassword(password)],
  )
  const user = rows[0]
  if (!user) throw new HttpError(409, 'An account with this email already exists')
  await startSession(res, user.id)
  res.status(201).json(await getUserDocument(user))
})

authRouter.post('/signin', async (req, res) => {
  const email = str(req.body?.userEmail).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const rows = await query<AuthUser & { password_hash: string }>(
    'SELECT id, user_name, user_email, password_hash FROM users WHERE lower(user_email) = $1',
    [email],
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password')
  }
  await startSession(res, user.id)
  res.json(await getUserDocument(user))
})

authRouter.post('/signout', async (req, res) => {
  const token = readCookie(req, COOKIE)
  if (token) await query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)])
  res.clearCookie(COOKIE, { path: '/' })
  res.status(204).end()
})

authRouter.get('/me', async (req, res) => {
  const user = await userFromRequest(req)
  if (!user) throw new HttpError(401, 'Not signed in')
  res.json(await getUserDocument(user))
})
