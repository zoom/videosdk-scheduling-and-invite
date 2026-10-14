import { useCallback, useEffect, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { apiFetch, buildSessionLink, getConfig, type ScheduledSession } from '../lib/api'
import { notifyError, notifySuccess } from '../lib/notify'
import { formatDate, formatTime } from '../lib/time'
import Spinner from './Spinner'

const ScheduledSessionsTab = () => {
  const [sessions, setSessions] = useState<ScheduledSession[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setSessions(null)
    try {
      const { sessions } = await apiFetch<{ sessions: ScheduledSession[] }>('/scheduled-sessions')
      setSessions(sessions)
    } catch (error) {
      notifyError(error)
      setSessions([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId)
    try {
      await apiFetch(`/scheduled-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
      setSessions((prev) => prev?.filter((s) => s.sessionId !== sessionId) ?? null)
      notifySuccess('Session deleted')
    } catch (error) {
      notifyError(error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleJoin = async (session: ScheduledSession) => {
    try {
      const { endpointUrl } = await getConfig()
      window.open(buildSessionLink(endpointUrl, session.sessionName, 1, session.password), '_blank', 'noopener')
    } catch (error) {
      notifyError(error)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-center text-3xl font-semibold">Scheduled Sessions</h1>

      {sessions === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-gray-600">No scheduled sessions.</p>
      ) : (
        <ul className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{session.sessionName}</p>
                <p className="text-sm text-gray-600">{formatDate(session.startTime, session.timezone)}</p>
                <p className="text-sm text-gray-600">
                  {formatTime(session.startTime, session.timezone)} ({session.timezone})
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-white hover:bg-sky-600 active:bg-sky-700"
                  onClick={() => handleJoin(session)}
                >
                  Join
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${session.sessionName}`}
                  disabled={deletingId === session.sessionId}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleDelete(session.sessionId)}
                >
                  {deletingId === session.sessionId ? <Spinner size={18} /> : <FiTrash2 size={20} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ScheduledSessionsTab
