import { describe, it, expect, vi } from 'vitest'
import { GET } from '@/app/api/sessions/[sessionId]/route'
import { DiscussionService } from '@/server/services/discussion.service'
import { ServiceError } from '@/server/errors'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

describe('GET /api/sessions/:sessionId', () => {
  it('returns 200 with session detail when session exists', async () => {
    vi.spyOn(DiscussionService.prototype, 'getSessionDetail').mockResolvedValueOnce({
      sessionId: 'sess-1',
      topic: '战略分析',
      template: { templateId: 'three-kingdoms-advisors', name: '三国军师团' },
      status: 'active',
      roles: [],
      activeSpeakerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const req = new Request('http://localhost/api/sessions/sess-1')
    const res = await GET(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.sessionId).toBe('sess-1')
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 404 SESSION_NOT_FOUND when session does not exist', async () => {
    vi.spyOn(DiscussionService.prototype, 'getSessionDetail').mockRejectedValueOnce(
      new ServiceError('SESSION_NOT_FOUND', 'Session not found')
    )
    const req = new Request('http://localhost/api/sessions/nonexistent')
    const res = await GET(req, { params: makeParams('nonexistent') })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 500 INTERNAL_ERROR for unexpected errors', async () => {
    vi.spyOn(DiscussionService.prototype, 'getSessionDetail').mockRejectedValueOnce(
      new Error('Database connection failed')
    )
    const req = new Request('http://localhost/api/sessions/sess-1')
    const res = await GET(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('response always includes requestId', async () => {
    vi.spyOn(DiscussionService.prototype, 'getSessionDetail').mockResolvedValueOnce({
      sessionId: 'sess-1',
      topic: '测试',
      template: { templateId: 'three-kingdoms-advisors', name: '三国军师团' },
      status: 'active',
      roles: [],
      activeSpeakerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const req = new Request('http://localhost/api/sessions/sess-1')
    const res = await GET(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(typeof body.requestId).toBe('string')
    expect(body.requestId.length).toBeGreaterThan(0)
  })
})
