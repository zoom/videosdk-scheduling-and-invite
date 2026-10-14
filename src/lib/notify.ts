import Toastify from 'toastify-js'

export function notifyError(error: unknown): void {
  // Calls racing a session that already closed (e.g. on leave) are expected and harmless.
  const zoomError = error as { errorCode?: number; reason?: string } | null
  if (zoomError?.errorCode === 5002 && zoomError.reason === 'closed') return
  console.error(error)
  const message = error instanceof Error ? error.message : (zoomError?.reason ?? String(error))
  Toastify({
    text: message,
    duration: 6000,
    gravity: 'top',
    position: 'right',
    close: true,
    style: { background: '#dc2626' },
  }).showToast()
}

export function notifySuccess(message: string): void {
  Toastify({
    text: message,
    duration: 3000,
    gravity: 'top',
    position: 'right',
    style: { background: '#16a34a' },
  }).showToast()
}
