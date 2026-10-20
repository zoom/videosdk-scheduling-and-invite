import { useState } from 'react'
import ScheduleTab from '../components/ScheduleTab'
import ScheduledSessionsTab from '../components/ScheduledSessionsTab'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/auth'
import { notifyError } from '../lib/notify'
import AuthPage from './AuthPage'

const tabs = ['Schedule and Invite', 'Scheduled Sessions'] as const

const HomePage = () => {
  const { user, loading, signOut } = useAuth()
  const [active, setActive] = useState<(typeof tabs)[number]>(tabs[0])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!user) return <AuthPage />

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="fixed right-4 top-4 z-10 flex items-center gap-3">
        <span className="hidden text-sm text-gray-600 sm:inline">{user.userName}</span>
        <button
          type="button"
          onClick={() => signOut().catch(notifyError)}
          className="cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>

      <div role="tablist" className="mx-auto mb-8 flex w-full max-w-2xl border-b border-gray-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`flex-1 cursor-pointer px-4 py-3 font-medium ${
              active === tab
                ? 'border-b-2 border-sky-500 text-sky-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === tabs[0] ? <ScheduleTab /> : <ScheduledSessionsTab />}
    </div>
  )
}

export default HomePage
