import { POST as sessionsPost, GET as sessionsGet } from '@/app/api/sessions/route'
import { GET as recentGet } from '@/app/api/sessions/recent/route'
import { SessionService } from '@/server/services/session.service'
import { ServiceError } from '@/server/errors'

// ── Task-08: POST /api/sessions ───────────────────────────────────────────

it('POST /api/sessions with valid body returns 200 with sessionId', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: '如何提高团队效率',
      templateId: 'three-kingdoms-advisors',
    }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(typeof body.data.sessionId).toBe('string')
  expect(body.data.status).toBe('active')
  expect(typeof body.requestId).toBe('string')
})

it('POST /api/sessions with empty topic returns 400 TOPIC_REQUIRED', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '', templateId: 'three-kingdoms-advisors' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(400)
  expect(body.success).toBe(false)
  expect(body.error.code).toBe('TOPIC_REQUIRED')
})

it('POST /api/sessions with whitespace topic returns 400 TOPIC_REQUIRED', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '   ', templateId: 'three-kingdoms-advisors' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(400)
  expect(body.error.code).toBe('TOPIC_REQUIRED')
})

it('POST /api/sessions with topic >100 chars returns 400 TOPIC_TOO_LONG', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'A'.repeat(101), templateId: 'three-kingdoms-advisors' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(400)
  expect(body.error.code).toBe('TOPIC_TOO_LONG')
})

it('POST /api/sessions with nonexistent templateId returns 404 TEMPLATE_NOT_FOUND', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '有效议题', templateId: 'nonexistent' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(404)
  expect(body.error.code).toBe('TEMPLATE_NOT_FOUND')
})

it('POST /api/sessions returns requestId string', async () => {
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '测试议题', templateId: 'three-kingdoms-advisors' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(typeof body.requestId).toBe('string')
  expect(body.requestId.length).toBeGreaterThan(0)
})

it('POST /api/sessions returns 500 INTERNAL_ERROR when service throws unexpectedly', async () => {
  vi.spyOn(SessionService.prototype, 'createSession').mockRejectedValueOnce(
    new Error('unexpected')
  )
  const req = new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '测试', templateId: 'three-kingdoms-advisors' }),
  })
  const res = await sessionsPost(req)
  const body = await res.json()
  expect(res.status).toBe(500)
  expect(body.error.code).toBe('INTERNAL_ERROR')
})

// ── Task-09: GET /api/sessions/recent ────────────────────────────────────

it('GET /api/sessions/recent returns 200 with data array and requestId', async () => {
  const res = await recentGet()
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body.success).toBe(true)
  expect(Array.isArray(body.data)).toBe(true)
  expect(typeof body.requestId).toBe('string')
})

it('GET /api/sessions returns 200 success with requestId', async () => {
  const res = await sessionsGet()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(typeof body.requestId).toBe('string')
})

it('GET /api/sessions/recent returns 500 INTERNAL_ERROR when service throws', async () => {
  vi.spyOn(SessionService.prototype, 'getRecentSessions').mockRejectedValueOnce(
    new ServiceError('INTERNAL_ERROR', 'forced failure')
  )
  const res = await recentGet()
  const body = await res.json()
  expect(res.status).toBe(500)
  expect(body.error.code).toBe('INTERNAL_ERROR')
})
