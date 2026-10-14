function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

/** Converts a wall-clock date/time in the given IANA time zone to a UTC Date. */
export function zonedTimeToUtc(date: Date, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const guess = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
  let result = guess - tzOffsetMs(guess, timeZone)
  // Re-check the offset at the resulting instant to handle DST boundaries.
  result = guess - tzOffsetMs(result, timeZone)
  return new Date(result)
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: 'full' }).format(new Date(iso))
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, timeStyle: 'short' }).format(new Date(iso))
}

export function getTimeZones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

export function getDefaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** 15-minute increments across the day, as HH:mm. */
export const TIME_SLOTS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0')
  const m = String((i % 4) * 15).padStart(2, '0')
  return `${h}:${m}`
})

export function formatSlotLabel(slot: string): string {
  const [h, m] = slot.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}
