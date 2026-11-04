import { query } from './db'

// The Zoom create-session API doesn't persist schedule details or the password, so they're kept in Postgres.
export interface StoredSession {
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
  createdAt: string
}

interface MeetingRow {
  meeting_id: string
  invite_id: string
  meeting_name: string
  meeting_password: string
  date_time: Date
  timezone: string
  agenda: string
  duration: number
  auto_recording: boolean
  hold: number
  created_at: Date
}

const toStored = (r: MeetingRow): StoredSession => ({
  sessionId: r.meeting_id,
  inviteId: r.invite_id,
  sessionName: r.meeting_name,
  password: r.meeting_password,
  agenda: r.agenda,
  startTime: r.date_time.toISOString(),
  timezone: r.timezone,
  duration: r.duration,
  autoRecording: r.auto_recording,
  hold: r.hold,
  createdAt: r.created_at.toISOString(),
})

export async function readSessions(userId: string): Promise<StoredSession[]> {
  const rows = await query<MeetingRow>('SELECT * FROM meetings WHERE user_id = $1 ORDER BY date_time', [userId])
  return rows.map(toStored)
}

export async function addSession(userId: string, s: StoredSession): Promise<void> {
  await query(
    `INSERT INTO meetings
      (meeting_id, invite_id, user_id, meeting_name, meeting_password, date_time, timezone, agenda, duration, auto_recording, hold)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [s.sessionId, s.inviteId, userId, s.sessionName, s.password, s.startTime, s.timezone, s.agenda, s.duration, s.autoRecording, s.hold],
  )
}

export async function removeSessions(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await query('DELETE FROM meetings WHERE user_id = $1 AND meeting_id = ANY($2::text[])', [userId, ids])
}

export interface InviteRecord {
  sessionName: string
  password: string
  ownerEmail: string
  hold: number
}

export async function findInvite(inviteId: string): Promise<InviteRecord | undefined> {
  const rows = await query<{ meeting_name: string; meeting_password: string; hold: number; user_email: string }>(
    `SELECT m.meeting_name, m.meeting_password, m.hold, u.user_email FROM meetings m
     JOIN users u ON u.id = m.user_id
     WHERE m.invite_id = $1`,
    [inviteId],
  )
  const r = rows[0]
  return r && { sessionName: r.meeting_name, password: r.meeting_password, ownerEmail: r.user_email, hold: r.hold }
}

export async function getUserDocument(user: { id: string; user_name: string; user_email: string }) {
  const meetings = await readSessions(user.id)
  return {
    userName: user.user_name,
    userEmail: user.user_email,
    meetings: meetings.map((m) => ({
      meetingId: m.sessionId,
      meetingName: m.sessionName,
      meetingPassword: m.password,
      dateTime: m.startTime,
    })),
  }
}
