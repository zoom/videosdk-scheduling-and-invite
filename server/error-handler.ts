import type { ErrorRequestHandler } from 'express'
import { ZoomApiError } from './zoom'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error)
  const status = (error as { status?: number } | null)?.status
  const code = error instanceof ZoomApiError ? 502 : (status ?? 500)
  const message = code >= 500 ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
  res.status(code).json({ error: message })
}
