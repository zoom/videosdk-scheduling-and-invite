import { useState } from 'react'
import ScheduleTab from '../components/ScheduleTab'
import ScheduledSessionsTab from '../components/ScheduledSessionsTab'

const tabs = ['Schedule and Invite', 'Scheduled Sessions'] as const

const HomePage = () => {
  const [active, setActive] = useState<(typeof tabs)[number]>(tabs[0])

  return (
    <div className="min-h-screen px-4 py-8">
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
