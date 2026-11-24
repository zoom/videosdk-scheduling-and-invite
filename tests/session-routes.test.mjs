import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex } from 'node:stream'
import { test } from 'node:test'
import express from 'express'
import pg from 'pg'
import { router } from '../server/routes.ts'
import { errorHandler } from '../server/error-handler.ts'

const topic = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).tpc
const hash = (value) => createHash('sha256').update(value).digest('hex')

test('session topics, invite authorization, and error responses', async (t) => {
  process.env.DATABASE_URL = 'postgres://unused'
  process.env.ZOOM_VSDK_KEY = 'test-key'
  process.env.ZOOM_VSDK_SECRET = 'test-secret'
  process.env.ZOOM_API_KEY = 'test-api-key'
  process.env.ZOOM_API_SECRET = 'test-api-secret'

  const users = {
    [hash('owner')]: { id: 'owner', user_name: 'Owner', user_email: 'owner@example.test' },
    [hash('attacker')]: { id: 'attacker', user_name: 'Attacker', user_email: 'attacker@example.test' },
  }
  const meetings = []
  const zoomTopics = []
  let zoomError = false
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).startsWith('https://api.zoom.us/'))
    if (zoomError) return new Response('{"message":"sensitive Zoom detail"}', { status: 400 })
    const body = JSON.parse(init.body)
    zoomTopics.push(body.session_name)
    return Response.json({ session_id: `id-${meetings.length}`, session_name: body.session_name })
  })
  t.mock.method(pg.Pool.prototype, 'query', async (sql, params = []) => {
    if (sql.includes('FROM auth_sessions')) return { rows: users[params[0]] ? [users[params[0]]] : [] }
    if (sql.includes('INSERT INTO meetings')) {
      const [meeting_id, invite_id, user_id, meeting_name, zoom_session_name, meeting_password, date_time, timezone, agenda, duration, auto_recording, hold] = params
      meetings.push({ meeting_id, invite_id, user_id, meeting_name, zoom_session_name, meeting_password, date_time, timezone, agenda, duration, auto_recording, hold })
      return { rows: [] }
    }
    if (sql.includes('WHERE m.invite_id')) {
      if (params[0] === 'db-error') throw new Error('sensitive database detail')
      const meeting = meetings.find((m) => m.invite_id === params[0])
      return { rows: meeting ? [{ ...meeting, user_email: Object.values(users).find((u) => u.id === meeting.user_id).user_email }] : [] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  })

  const app = express()
  app.use(express.json(), router, errorHandler)
  const post = (path, body, user) => new Promise((resolve, reject) => {
    const chunks = []
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    })
    const request = new IncomingMessage(socket)
    request.method = 'POST'
    request.url = path
    const data = JSON.stringify(body)
    request.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(data)) }
    if (user) request.headers.cookie = `session_token=${user}`
    const response = new ServerResponse(request)
    response.assignSocket(socket)
    response.on('error', reject)
    response.on('finish', () => {
      const raw = Buffer.concat(chunks).toString()
      const content = raw.slice(raw.indexOf('\r\n\r\n') + 4)
      resolve({ status: response.statusCode, json: async () => JSON.parse(content) })
    })
    app.handle(request, response)
    request.push(data)
    request.push(null)
  })
  const create = (sessionName, user = 'owner') => post('/create-session', {
    sessionName, role: 1, hold: 0, sessionPassword: true, password: 'pass',
    auto_recording: false, startTime: '2030-01-01T00:00:00Z',
  }, user)

  const firstResponse = await create('Public title')
  assert.equal(firstResponse.status, 201)
  const first = await firstResponse.json()
  assert.equal(first.sessionName, 'Public title')
  assert.equal(first.zoomSessionName, undefined)
  const firstTopic = topic(first.token)
  assert.match(firstTopic, /^[a-f0-9]{64}$/)
  assert.equal(meetings[0].zoom_session_name, firstTopic)
  assert.equal(zoomTopics[0], firstTopic)

  const guestResponse = await post('/token', { inviteId: first.inviteId, role: 0 })
  const guest = await guestResponse.json()
  assert.equal(guestResponse.status, 200)
  assert.equal(guest.sessionName, 'Public title')
  assert.equal(guest.zoomSessionName, undefined)
  assert.equal(guest.password, undefined)
  assert.equal(guest.passwordRequired, true)
  assert.equal(topic(guest.token), firstTopic)

  const attacker = await (await create(firstTopic, 'attacker')).json()
  assert.notEqual(topic(attacker.token), firstTopic)
  assert.equal((await post('/token', { inviteId: first.inviteId, role: 1 }, 'attacker')).status, 403)
  assert.equal((await post('/token', { inviteId: first.inviteId, role: 1 })).status, 401)
  const host = await (await post('/token', { inviteId: first.inviteId, role: 1 }, 'owner')).json()
  assert.equal(topic(host.token), firstTopic)
  assert.equal(host.password, 'pass')

  meetings.push({ invite_id: 'legacy', user_id: 'owner', meeting_name: 'Old topic', zoom_session_name: null, meeting_password: '', hold: 0 })
  const legacy = await (await post('/token', { inviteId: 'legacy', role: 0 })).json()
  assert.equal(topic(legacy.token), 'Old topic')

  const badInput = await post('/token', { inviteId: first.inviteId, role: 2 })
  assert.equal(badInput.status, 400)
  assert.match((await badInput.json()).error, /role must be/)
  const dbFailure = await post('/token', { inviteId: 'db-error', role: 0 })
  assert.equal(dbFailure.status, 500)
  assert.equal((await dbFailure.json()).error, 'Internal server error')
  zoomError = true
  const zoomFailure = await create('Another title')
  assert.equal(zoomFailure.status, 502)
  assert.equal((await zoomFailure.json()).error, 'Internal server error')
})
