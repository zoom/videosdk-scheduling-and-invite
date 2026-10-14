import 'dotenv/config'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { createServer as createViteServer } from 'vite'
import { router } from './routes'
import { ZoomApiError } from './zoom'

const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 3000
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (!process.env.ZOOM_VSDK_KEY || !process.env.ZOOM_VSDK_SECRET) {
  console.warn('Warning: ZOOM_VSDK_KEY and/or ZOOM_VSDK_SECRET are not set in .env')
}

const endpointUrl: string = process.env.ENDPOINT_URL?.trim() || `http://localhost:${process.env.PORT || 3000}`

const app = express()
const httpServer = http.createServer(app)

app.use(cors())
app.use(express.json())
app.use(router)

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error)
  const status = (error as { status?: number }).status
  const message = error instanceof Error ? error.message : String(error)
  // Zoom auth failures are a server config problem, not a client one.
  const code = error instanceof ZoomApiError && (status === 401 || status === 403) ? 502 : (status ?? 500)
  res.status(code).json({ error: message })
}

if (isProd) {
  const distDir = path.join(rootDir, 'dist')
  app.use(express.static(distDir))
  app.use((_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  const vite = await createViteServer({
    root: rootDir,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: httpServer } },
  })
  app.use(vite.middlewares)
}

app.use(errorHandler)

httpServer.listen(port, () => {
  console.log(`Server running at ${endpointUrl} (${isProd ? 'production' : 'vite middleware / HMR'})`)
})
