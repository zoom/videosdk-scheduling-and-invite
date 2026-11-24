import 'dotenv/config'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import { router } from './routes'
import { authRouter } from './auth'
import { ensureSchema } from './db'
import { errorHandler } from './error-handler'

const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 3000
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

if (!process.env.ZOOM_VSDK_KEY || !process.env.ZOOM_VSDK_SECRET) {
  console.warn('Warning: ZOOM_VSDK_KEY and/or ZOOM_VSDK_SECRET are not set in .env')
}

await ensureSchema()

const endpointUrl: string = process.env.ENDPOINT_URL?.trim() || `http://localhost:${process.env.PORT || 3000}`

const app = express()
const httpServer = http.createServer(app)

app.use(cors())
app.use(express.json())
app.use('/auth', authRouter)
app.use(router)

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
