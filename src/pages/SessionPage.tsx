import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ZoomVideo from '@zoom/videosdk'
import Video from '../components/features/Video'
import Controls from '../components/features/Controls'
import Spinner from '../components/Spinner'
import WaitingRoom from '../components/features/WaitingRoom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import AuthPage from './AuthPage'
import { notifyError } from '../lib/notify'

interface ConnectionPayload {
  state: string
  reason?: string
}

interface TokenResponse {
  token: string
  sessionName: string
  password?: string
  passwordRequired?: boolean
}

function getTokenTopic(token: string): string {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Invalid session token')
  const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  if (!decoded || typeof decoded !== 'object' || !('tpc' in decoded) || typeof decoded.tpc !== 'string' || !decoded.tpc) {
    throw new Error('Invalid session token')
  }
  return decoded.tpc
}

const SessionPage = ({ host = false }: { host?: boolean }) => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { inviteId = '' } = useParams()
  const role = host ? 1 : 0

  const clientRef = useRef<ReturnType<typeof ZoomVideo.createClient>>(null)
  clientRef.current ??= ZoomVideo.createClient()
  const client = clientRef.current

  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [onHold, setOnHold] = useState(false)
  const [mediaVersion, setMediaVersion] = useState(0)
  const [prep, setPrep] = useState<TokenResponse | null>(null)
  const [enteredPassword, setEnteredPassword] = useState<string | null>(null)
  const [passwordDraft, setPasswordDraft] = useState('')
  const joinedRef = useRef(false)
  const initializedRef = useRef(false)

  const isHost = host
  const sessionName = prep?.sessionName ?? ''
  const needsAuth = isHost && !user
  const needsPassword = !isHost && prep?.passwordRequired === true && enteredPassword === null
  const joinPassword = isHost ? prep?.password : (enteredPassword ?? '')
  const ready = prep !== null && joinPassword !== undefined && !needsPassword

  // Request a signature. Host tokens are only issued to the signed-in owner of the session.
  const userEmail = user?.userEmail
  useEffect(() => {
    if (authLoading || (isHost && !userEmail)) return

    let cancelled = false
    apiFetch<TokenResponse>('/token', {
      method: 'POST',
      body: JSON.stringify({ inviteId, role }),
    })
      .then((data) => {
        if (!cancelled) setPrep(data)
      })
      .catch((error) => {
        notifyError(error)
        if (!cancelled) {
          setFailed(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [inviteId, role, isHost, authLoading, userEmail])

  useEffect(() => {
    if (!ready || !prep) return

    let cancelled = false

    const onHoldChange = (payload: { isOnHold: boolean }) => {
      if (cancelled) return
      setOnHold(payload.isOnHold)
      if (payload.isOnHold) setLoading(false)
    }

    const onConnectionChange = (payload: ConnectionPayload) => {
      if (payload.state === 'Reconnecting') setLoading(payload.reason !== 'on hold')
      else if (payload.state === 'Connected') setLoading(false)
      else if (payload.state === 'Closed' || payload.state === 'Fail') navigate('/')
    }

    const join = async () => {
      setLoading(true)
      try {
        if (!initializedRef.current) {
          await client.init('en-US', 'Global', {
            patchJsMedia: true,
            stayAwake: true,
            leaveOnPageUnload: true,
          })
          initializedRef.current = true
        }
        client.on('connection-change', onConnectionChange)
        client.on('on-hold-change', onHoldChange)
        const userName = `${isHost ? 'Host' : 'Guest'}-${Math.floor(Math.random() * 900 + 100)}`
        await client.join(getTokenTopic(prep.token), prep.token, userName, joinPassword ?? '')
        joinedRef.current = true
        if (!cancelled) {
          setOnHold(client.isUserOnHold())
          setInSession(true)
          setLoading(false)
        }
      } catch (error) {
        notifyError(error)
        if (cancelled) return
        setLoading(false)
        // Let guests retry when the entered password was rejected.
        if (!isHost && prep.passwordRequired) {
          setPasswordDraft('')
          setEnteredPassword(null)
        } else {
          setFailed(true)
        }
      }
    }
    join()

    return () => {
      cancelled = true
      client.off('connection-change', onConnectionChange)
      client.off('on-hold-change', onHoldChange)
      setOnHold(false)
      if (joinedRef.current) {
        joinedRef.current = false
        client.leave().catch(notifyError)
      }
    }
  }, [client, navigate, sessionName, isHost, prep, ready, joinPassword])

  const leaveSession = async (end: boolean) => {
    if (joinedRef.current) {
      joinedRef.current = false
      try {
        await client.leave(end)
      } catch (error) {
        notifyError(error)
      }
    }
    navigate('/')
  }

  if (needsAuth) return authLoading ? <Spinner size={96} /> : <AuthPage />

  if (needsPassword) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-100 px-4">
        <form
          className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
          onSubmit={(event) => {
            event.preventDefault()
            setEnteredPassword(passwordDraft)
          }}
        >
          <h1 className="text-xl font-semibold">Session password</h1>
          <p className="truncate text-sm text-gray-600">Enter the password to join {sessionName}.</p>
          <input
            type="password"
            autoFocus
            required
            autoComplete="off"
            aria-label="Session password"
            value={passwordDraft}
            onChange={(event) => setPasswordDraft(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
          >
            Join
          </button>
        </form>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <p className="text-lg">Unable to join the session.</p>
        <Link to="/" className="text-sky-600 hover:underline">Back to scheduler</Link>
      </div>
    )
  }

  return (
    <div className="relative flex h-dvh w-full flex-col bg-gray-100">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-100">
          <Spinner size={96} />
        </div>
      )}
      {inSession && onHold && <WaitingRoom />}
      {inSession && !onHold && (
        <>
          <h1 className="w-full truncate px-2 py-3 text-center text-xl font-semibold">{sessionName}</h1>
          <Video client={client} version={mediaVersion}>
            <Controls
              client={client}
              isHost={role === 1}
              leaveSession={leaveSession}
              onMediaChange={() => setMediaVersion((v) => v + 1)}
            />
          </Video>
        </>
      )}
    </div>
  )
}

export default SessionPage
