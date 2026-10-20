import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { notifyError } from '../lib/notify'

type Mode = 'landing' | 'signin' | 'signup'

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 focus:border-sky-500 focus:outline-none'
const primaryBtn = 'cursor-pointer rounded-md bg-sky-500 px-6 py-2 font-medium text-white hover:bg-sky-600 disabled:opacity-60'
const secondaryBtn = 'cursor-pointer rounded-md border border-sky-500 px-6 py-2 font-medium text-sky-600 hover:bg-sky-50'

const AuthPage = () => {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('landing')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') await signUp(name, email, password)
      else await signIn(email, password)
    } catch (error) {
      notifyError(error)
      setSubmitting(false)
    }
  }

  if (mode === 'landing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-center text-3xl font-semibold">Schedule a Zoom Session</h1>
        <p className="text-gray-600">Sign in or create an account to get started.</p>
        <div className="flex gap-4">
          <button type="button" className={primaryBtn} onClick={() => setMode('signin')}>Sign in</button>
          <button type="button" className={secondaryBtn} onClick={() => setMode('signup')}>Sign up</button>
        </div>
      </div>
    )
  }

  const isSignUp = mode === 'signup'
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">{isSignUp ? 'Create your account' : 'Sign in'}</h1>
        {isSignUp && (
          <input
            className={inputClass}
            placeholder="Name"
            aria-label="Name"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          required
          minLength={isSignUp ? 8 : undefined}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={submitting} className={`${primaryBtn} w-full`}>
          {isSignUp ? 'Sign up' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-gray-600">
          <button type="button" className="cursor-pointer text-sky-600 hover:underline" onClick={() => setMode(isSignUp ? 'signin' : 'signup')}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          {' · '}
          <button type="button" className="cursor-pointer text-sky-600 hover:underline" onClick={() => setMode('landing')}>
            Back
          </button>
        </p>
      </form>
    </div>
  )
}

export default AuthPage
