import { describe, it, expect, vi } from 'vitest'
import {
  GET,
  POST,
} from '@/app/api/discussions/[sessionId]/messages/route'
import { DiscussionService } from '@/server/services/discussion.service'
import { ServiceError } from '@/server/errors'
import type { DiscussionMessage } from '@/types'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

const agentMsg: DiscussionMessage = {
  messageId: 'agent-msg-1',
  sessionId: 'sess-1',
  type: 'character',
  roleId: 'zhuge-liang',
  content: '亮以为...',
  status: 'completed',
  createdAt: new Date().toISOString(),
}

describe('GET /api/discussions/:sessionId/messages', () => {
  it('returns 200 with messages array and requestId', async () => {
    vi.spyOn(DiscussionService.prototype, 'getMessages').mockResolvedValueOnce({
      sessionId: 'sess-1',
      messages: [agentMsg],
      activeSpeakerId: null,
      hasMore: false,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages?limit=50')
    const res = await GET(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.messages)).toBe(true)
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 404 SESSION_NOT_FOUND when session does not exist', async () => {
    vi.spyOn(DiscussionService.prototype, 'getMessages').mockRejectedValueOnce(
      new ServiceError('SESSION_NOT_FOUND', 'Session not found')
    )
    const req = new Request('http://localhost/api/discussions/nonexistent/messages')
    const res = await GET(req, { params: makeParams('nonexistent') })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 500 INTERNAL_ERROR for unexpected errors', async () => {
    vi.spyOn(DiscussionService.prototype, 'getMessages').mockRejectedValueOnce(
      new Error('unexpected')
    )
    const req = new Request('http://localhost/api/discussions/sess-1/messages')
    const res = await GET(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('POST /api/discussions/:sessionId/messages', () => {
  it('returns 200 with agentMessages when message sent successfully', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValueOnce({
      sessionId: 'sess-1',
      runId: 'run-1',
      userMessage: {
        messageId: 'user-msg-1',
        sessionId: 'sess-1',
        type: 'user',
        content: '请分析',
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      agentMessages: [agentMsg],
      activeSpeakerId: 'zhuge-liang',
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '请分析' }),
    })
    const res = await POST(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.agentMessages).toHaveLength(1)
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 404 SESSION_NOT_FOUND when session does not exist', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValueOnce(
      new ServiceError('SESSION_NOT_FOUND', 'Session not found')
    )
    const req = new Request('http://localhost/api/discussions/nonexistent/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '内容' }),
    })
    const res = await POST(req, { params: makeParams('nonexistent') })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 400 MESSAGE_EMPTY when content is empty and history is not empty', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValueOnce(
      new ServiceError('MESSAGE_EMPTY', 'Message content is empty')
    )
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const res = await POST(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('MESSAGE_EMPTY')
  })

  it('returns 502 LLM_PROVIDER_ERROR when LLM call fails', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValueOnce(
      new ServiceError('LLM_PROVIDER_ERROR', 'LLM call failed')
    )
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '请分析' }),
    })
    const res = await POST(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(502)
    expect(body.error.code).toBe('LLM_PROVIDER_ERROR')
  })

  it('returns null userMessage for opening trigger (empty content + empty history)', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValueOnce({
      sessionId: 'sess-1',
      runId: 'run-1',
      userMessage: null,
      agentMessages: [
        {
          messageId: 'host-1',
          sessionId: 'sess-1',
          type: 'host',
          roleId: 'xunyu',
          content: '欢迎！',
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ],
      activeSpeakerId: 'xunyu',
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const res = await POST(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.userMessage).toBeNull()
    expect(body.data.agentMessages[0].type).toBe('host')
  })

  it('response includes requestId on success', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValueOnce({
      sessionId: 'sess-1',
      runId: 'run-2',
      userMessage: null,
      agentMessages: [],
      activeSpeakerId: null,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const res = await POST(req, { params: makeParams('sess-1') })
    const body = await res.json()
    expect(typeof body.requestId).toBe('string')
  })
})
