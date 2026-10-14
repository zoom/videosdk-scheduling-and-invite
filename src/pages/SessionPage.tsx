import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ZoomVideo from '@zoom/videosdk'
import Video from '../components/features/Video'
import Controls from '../components/features/Controls'
import Spinner from '../components/Spinner'
import { apiFetch } from '../lib/api'
import { notifyError } from '../lib/notify'

interface ConnectionPayload {
  state: string
  reason?: string
}

const SessionPage = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sessionName = params.get('sessionName') ?? ''
  const role = params.get('role') === '1' ? 1 : 0
  const password = params.get('password') ?? ''

  const clientRef = useRef<ReturnType<typeof ZoomVideo.createClient>>(null)
  clientRef.current ??= ZoomVideo.createClient()
  const client = clientRef.current

  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [mediaVersion, setMediaVersion] = useState(0)
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!sessionName) {
      notifyError(new Error('Missing sessionName in the link'))
      setFailed(true)
      setLoading(false)
      return
    }

    let cancelled = false

    const onConnectionChange = (payload: ConnectionPayload) => {
      if (payload.state === 'Reconnecting') setLoading(true)
      else if (payload.state === 'Connected') setLoading(false)
      else if (payload.state === 'Closed' || payload.state === 'Fail') navigate('/')
    }

    const join = async () => {
      try {
        const { token } = await apiFetch<{ token: string }>('/token', {
          method: 'POST',
          body: JSON.stringify({ sessionName, role }),
        })
        await client.init('en-US', 'Global', {
          patchJsMedia: true,
          stayAwake: true,
          leaveOnPageUnload: true,
        })
        client.on('connection-change', onConnectionChange)
        const userName = `${role === 1 ? 'Host' : 'Guest'}-${Math.floor(Math.random() * 900 + 100)}`
        await client.join(sessionName, token, userName, password)
        joinedRef.current = true
        if (!cancelled) {
          setInSession(true)
          setLoading(false)
        }
      } catch (error) {
        notifyError(error)
        if (!cancelled) {
          setFailed(true)
          setLoading(false)
        }
      }
    }
    join()

    return () => {
      cancelled = true
      client.off('connection-change', onConnectionChange)
      if (joinedRef.current) {
        joinedRef.current = false
        client.leave().catch(notifyError)
      }
    }
  }, [client, navigate, sessionName, role, password])

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
      {inSession && (
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
