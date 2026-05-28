import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GET,
  POST,
} from '@/app/api/discussions/[sessionId]/messages/route'
import { DiscussionService } from '@/server/services/discussion.service'
import type { ApiResponse, MessageListResult, SendMessageResult } from '@/types/api'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

function mockGetMessages(result: MessageListResult) {
  vi.spyOn(DiscussionService.prototype, 'getMessages').mockResolvedValue(result)
}

function mockSendUserMessage(result: SendMessageResult) {
  vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValue(result)
}

describe('GET /api/discussions/[sessionId]/messages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns messages for valid session', async () => {
    mockGetMessages({
      sessionId: 'sess-1',
      messages: [],
      activeSpeakerId: null,
      hasMore: false,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=50')
    const res = await GET(req as unknown as Request, { params: makeParams('sess-1') })
    const json = await res.json() as ApiResponse<MessageListResult>
    expect(json.success).toBe(true)
    expect(json.data.sessionId).toBe('sess-1')
  })

  it('returns 404 for non-existent session', async () => {
    vi.spyOn(DiscussionService.prototype, 'getMessages').mockRejectedValue(
      Object.assign(new Error('Session not found'), { code: 'SESSION_NOT_FOUND' })
    )
    const req = new Request('http://localhost/api/discussions/nonexistent/messages?limit=50')
    const res = await GET(req as unknown as Request, { params: makeParams('nonexistent') })
    expect(res.status).toBe(404)
    const json = await res.json() as ApiResponse<MessageListResult>
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('SESSION_NOT_FOUND')
  })
})

describe('POST /api/discussions/[sessionId]/messages', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends a message and returns result', async () => {
    mockSendUserMessage({
      sessionId: 'sess-1',
      runId: 'run-1',
      userMessage: {
        messageId: 'msg-1',
        sessionId: 'sess-1',
        type: 'user',
        content: 'hello',
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      agentMessages: [],
      activeSpeakerId: null,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('sess-1') })
    const json = await res.json() as ApiResponse<SendMessageResult>
    expect(json.success).toBe(true)
    expect(json.data.userMessage?.content).toBe('hello')
  })

  it('returns 404 for non-existent session', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValue(
      Object.assign(new Error('Session not found'), { code: 'SESSION_NOT_FOUND' })
    )
    const req = new Request('http://localhost/api/discussions/nonexistent/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('nonexistent') })
    expect(res.status).toBe(404)
  })
})
