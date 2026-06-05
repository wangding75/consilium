import { GET as sessionsGet, POST as sessionsPost } from '@/app/api/sessions/route'
import { GET as recentGet } from '@/app/api/sessions/recent/route'
import { SessionService } from '@/server/services/session.service'
import { ServiceError } from '@/server/errors'

describe('POST /api/sessions (Task-06)', () => {
  it('returns snapshot-aware CreateSessionResult with template version and model strategy summary', async () => {
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: '如何推进董事会决策',
        templateId: 'three-kingdoms-advisors',
      }),
    })

    const res = await sessionsPost(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(typeof body.data.sessionId).toBe('string')
    expect(body.data.topic).toBe('如何推进董事会决策')
    expect(body.data.template.templateId).toBe('three-kingdoms-advisors')
    expect(body.data.template.name).toBe('三国军师团')
    expect(body.data.template.version).toBeTruthy()
    expect(body.data.modelStrategy).toEqual({
      modelStrategyId: 'smart',
      name: '智能平衡',
      selectedByDefault: true,
    })
    expect(body.data.status).toBe('running')
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 404 with MODEL_STRATEGY_NOT_FOUND when modelStrategyId does not exist', async () => {
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: '测试无效策略',
        templateId: 'three-kingdoms-advisors',
        modelStrategyId: 'missing-strategy',
      }),
    })

    const res = await sessionsPost(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MODEL_STRATEGY_NOT_FOUND')
  })

  it('returns 400 INVALID_REQUEST when topic or templateId is not a string', async () => {
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 123, templateId: null }),
    })

    const res = await sessionsPost(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_REQUEST')
  })

  it('returns 400 with TEMPLATE_UNAVAILABLE when template is disabled for session creation', async () => {
    vi.spyOn(SessionService.prototype, 'createSession').mockRejectedValueOnce(
      new ServiceError('TEMPLATE_UNAVAILABLE', 'Template is not available: three-kingdoms-advisors')
    )

    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '测试禁用模板', templateId: 'three-kingdoms-advisors' }),
    })

    const res = await sessionsPost(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('TEMPLATE_UNAVAILABLE')
  })

  it('returns 500 INTERNAL_ERROR when service throws unexpectedly', async () => {
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
})

describe('GET /api/sessions (Task-07)', () => {
  it('returns SessionListResult envelope instead of raw Session[]', async () => {
    vi.spyOn(SessionService.prototype, 'listSessions').mockResolvedValueOnce([] as never)

    const res = await sessionsGet(new Request('http://localhost/api/sessions?status=running'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.sessions)).toBe(true)
    expect(Array.isArray(body.data)).toBe(false)
    expect(typeof body.requestId).toBe('string')
  })

  it('returns snapshot summary fields including model strategy summary for each session list item', async () => {
    vi.spyOn(SessionService.prototype, 'listSessions').mockResolvedValueOnce([
      {
        id: 's1',
        templateId: 'three-kingdoms-advisors',
        topic: '测试会话',
        status: 'running',
        modelStrategyId: 'smart',
        state: { stage: 'developing', turnCount: 3, lastSpeakerId: null },
        messages: [],
        createdAt: 1717200000000,
        updatedAt: 1717203600000,
      },
    ] as never)

    const res = await sessionsGet(new Request('http://localhost/api/sessions?status=running'))
    const body = await res.json()

    expect(body.data.sessions?.[0]).toEqual(
      expect.objectContaining({
        sessionId: 's1',
        topic: '测试会话',
        status: 'running',
        template: expect.objectContaining({
          templateId: expect.any(String),
          name: expect.any(String),
          fromSnapshot: expect.any(Boolean),
        }),
        modelStrategy: expect.objectContaining({
          modelStrategyId: expect.any(String),
          name: expect.any(String),
          fromSnapshot: expect.any(Boolean),
        }),
        roleCount: expect.any(Number),
        eventCount: expect.any(Number),
        messageCount: expect.any(Number),
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      })
    )
  })

  it('returns 400 VALIDATION_ERROR when status is invalid', async () => {
    const res = await sessionsGet(new Request('http://localhost/api/sessions?status=paused'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when limit is invalid', async () => {
    const res = await sessionsGet(new Request('http://localhost/api/sessions?limit=-1'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/sessions/recent (Task-09 compatibility)', () => {
  it('returns 200 with data array and requestId', async () => {
    const res = await recentGet()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 500 INTERNAL_ERROR when service throws', async () => {
    vi.spyOn(SessionService.prototype, 'getRecentSessions').mockRejectedValueOnce(
      new ServiceError('INTERNAL_ERROR', 'forced failure')
    )

    const res = await recentGet()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
