import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/discussions/[sessionId]/messages/route'
import { DiscussionService } from '@/server/services/discussion.service'
import { ServiceError } from '@/server/errors'
import type { ApiResponse, MessageListResult } from '@/types/api'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

// Task-07：完善 GET /messages API（分页、校验和错误码）
describe('GET /api/discussions/[sessionId]/messages — Task-07', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes limit query parameter to service', async () => {
    const spy = vi.spyOn(DiscussionService.prototype, 'getMessages').mockResolvedValue({
      sessionId: 'sess-1', messages: [], activeSpeakerId: null, hasMore: false,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=20')
    await GET(req as unknown as Request, { params: makeParams('sess-1') })
    expect(spy).toHaveBeenCalledWith('sess-1', { limit: 20, before: undefined })
  })

  it('returns 400 VALIDATION_ERROR when limit is zero or negative', async () => {
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=0')
    const res = await GET(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(400)
    const json = await res.json() as ApiResponse<MessageListResult>
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when limit exceeds maximum', async () => {
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=500')
    const res = await GET(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(400)
    const json = await res.json() as ApiResponse<MessageListResult>
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('passes before cursor query parameter to service', async () => {
    const spy = vi.spyOn(DiscussionService.prototype, 'getMessages').mockResolvedValue({
      sessionId: 'sess-1', messages: [], activeSpeakerId: null, hasMore: false,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=50&before=msg-abc')
    await GET(req as unknown as Request, { params: makeParams('sess-1') })
    expect(spy).toHaveBeenCalledWith('sess-1', { limit: 50, before: 'msg-abc' })
  })

  it('returns 500 INTERNAL_ERROR for unexpected service errors', async () => {
    vi.spyOn(DiscussionService.prototype, 'getMessages').mockRejectedValue(new Error('unexpected'))
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=50')
    const res = await GET(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(500)
    const json = await res.json() as ApiResponse<MessageListResult>
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
