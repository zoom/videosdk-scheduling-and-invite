import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The Zoom create-session API doesn't persist schedule details or the password, so they're kept here.
export interface StoredSession {
  sessionId: string
  sessionName: string
  password: string
  agenda: string
  startTime: string
  timezone: string
  duration: number
  autoRecording: boolean
  hold: number
  createdAt: string
}

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const file = path.join(dataDir, 'sessions.json')

export async function readSessions(): Promise<StoredSession[]> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as StoredSession[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeSessions(sessions: StoredSession[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(file, JSON.stringify(sessions, null, 2))
}

export async function addSession(session: StoredSession): Promise<void> {
  await writeSessions([...(await readSessions()), session])
}

export async function removeSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sessions = await readSessions()
  await writeSessions(sessions.filter((s) => !ids.includes(s.sessionId)))
}
