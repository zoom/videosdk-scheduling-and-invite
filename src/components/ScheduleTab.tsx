import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DayPicker } from 'react-day-picker'
import { apiFetch, buildGuestLink, buildHostLink, getConfig, type ScheduledSession } from '../lib/api'
import { notifyError, notifySuccess } from '../lib/notify'
import {
  TIME_SLOTS,
  formatDate,
  formatSlotLabel,
  formatTime,
  getDefaultTimeZone,
  getTimeZones,
  zonedTimeToUtc,
} from '../lib/time'
import Spinner from './Spinner'

const DURATIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
]

interface Result {
  hostLink: string
  invite: string
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

function defaultTime(): string {
  const next = new Date(Date.now() + 60 * 60 * 1000)
  return `${String(next.getHours()).padStart(2, '0')}:00`
}

const ScheduleTab = () => {
  const timeZones = useMemo(getTimeZones, [])
  const [sessionName, setSessionName] = useState('')
  const [password, setPassword] = useState('')
  const [agenda, setAgenda] = useState('')
  const [date, setDate] = useState<Date | undefined>()
  const [time, setTime] = useState(defaultTime)
  const [timeZone, setTimeZone] = useState(getDefaultTimeZone)
  const [duration, setDuration] = useState(30)
  const [autoRecording, setAutoRecording] = useState(false)
  const [hold, setHold] = useState<0 | 1 | 2>(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (!sessionName.trim()) throw new Error('Please enter a session name')
      if (!date) throw new Error('Please select a date')
      if (!time) throw new Error('Please select a time')
      const startTime = zonedTimeToUtc(date, time, timeZone)

      const session = await apiFetch<ScheduledSession>('/create-session', {
        method: 'POST',
        body: JSON.stringify({
          role: 1,
          sessionName: sessionName.trim(),
          sessionPassword: password.trim() !== '',
          password: password.trim(),
          hold,
          auto_recording: autoRecording,
          agenda: agenda.trim(),
          startTime: startTime.toISOString(),
          timezone: timeZone,
          duration,
        }),
      })

      const { endpointUrl } = await getConfig()
      const hostLink = buildHostLink(endpointUrl, session.inviteId)
      const guestLink = buildGuestLink(endpointUrl, session.inviteId)
      const lines = [
        `Hi! You're invited to this Zoom Session: ${session.sessionName}`,
        '',
        `Date: ${formatDate(session.startTime, session.timezone)}`,
        `Time: ${formatTime(session.startTime, session.timezone)} (${duration} minutes)`,
        `Timezone: ${session.timezone}`,
      ]
      if (session.password) lines.push(`Password: ${session.password}`)
      if (session.agenda) lines.push('', 'Meeting Agenda:', session.agenda)
      lines.push('', `Please join using this link: ${guestLink}`)
      setResult({ hostLink, invite: lines.join('\n') })
      notifySuccess('Session scheduled')
    } catch (error) {
      notifyError(error)
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notifySuccess('Copied to clipboard')
    } catch (error) {
      notifyError(error)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-center text-3xl font-semibold">Schedule a Zoom Session</h1>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow">
        <div>
          <label className={labelClass} htmlFor="sessionName">Session name</label>
          <input
            id="sessionName"
            className={inputClass}
            value={sessionName}
            maxLength={200}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="password">Password (optional)</label>
          <input
            id="password"
            className={inputClass}
            value={password}
            maxLength={10}
            pattern="[A-Za-z0-9]*"
            title="Letters and numbers only (max 10 characters)"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="agenda">Meeting agenda (optional)</label>
          <textarea
            id="agenda"
            className={inputClass}
            rows={3}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
        </div>

        <div>
          <span className={labelClass}>Date</span>
          <div className="flex justify-center rounded-lg border border-gray-300 p-2">
            <DayPicker mode="single" selected={date} onSelect={setDate} disabled={{ before: today }} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="time">Time</label>
          <div className="flex gap-2">
            <input
              id="time"
              type="time"
              step={60}
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <select
              aria-label="Select a time"
              className={inputClass}
              value={TIME_SLOTS.includes(time) ? time : ''}
              onChange={(e) => e.target.value && setTime(e.target.value)}
            >
              <option value="" disabled>Pick a time</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{formatSlotLabel(slot)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            className={inputClass}
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
          >
            {(timeZones.includes(timeZone) ? timeZones : [timeZone, ...timeZones]).map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="duration">Duration</label>
          <select
            id="duration"
            className={inputClass}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={labelClass}>Features</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRecording}
                onChange={(e) => setAutoRecording(e.target.checked)}
              />
              Automatically record the session to the cloud
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hold === 1}
                onChange={(e) => setHold(e.target.checked ? 1 : 0)}
              />
              Hold: participants wait until the host admits them
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hold === 2}
                onChange={(e) => setHold(e.target.checked ? 2 : 0)}
              />
              Hold: off by default, host can enable it during the session
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Spinner size={24} light /> : 'Schedule Session'}
        </button>
      </form>

      {result && (
        <div ref={resultRef} className="mt-6 space-y-5 rounded-xl bg-white p-6 shadow">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Host link</h2>
              <button type="button" className="cursor-pointer text-sm text-sky-600 hover:underline" onClick={() => copy(result.hostLink)}>
                Copy
              </button>
            </div>
            <a className="break-all text-sky-600 hover:underline" href={result.hostLink} target="_blank" rel="noreferrer">
              {result.hostLink}
            </a>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite</h2>
              <button type="button" className="cursor-pointer text-sm text-sky-600 hover:underline" onClick={() => copy(result.invite)}>
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-3 font-sans text-sm">{result.invite}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScheduleTab
