import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/discussions/[sessionId]/messages/route'
import { DiscussionService } from '@/server/services/discussion.service'
import { ServiceError } from '@/server/errors'
import type { ApiResponse, SendMessageResult } from '@/types/api'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

// Task-08：完善 POST /messages API（clientMessageId 回显、幂等和失败重试）
describe('POST /api/discussions/[sessionId]/messages — Task-08', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes clientMessageId from request body to service', async () => {
    const spy = vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValue({
      sessionId: 'sess-1',
      runId: 'run-1',
      clientMessageId: 'client_echo_test',
      userMessage: null,
      agentMessages: [],
      activeSpeakerId: null,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello', clientMessageId: 'client_echo_test' }),
    })
    await POST(req as unknown as Request, { params: makeParams('sess-1') })
    expect(spy).toHaveBeenCalledWith('sess-1', 'hello', 'client_echo_test')
  })

  it('returns clientMessageId echo in response', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockResolvedValue({
      sessionId: 'sess-1',
      runId: 'run-1',
      clientMessageId: 'client_echo_test',
      userMessage: null,
      agentMessages: [],
      activeSpeakerId: null,
    })
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello', clientMessageId: 'client_echo_test' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('sess-1') })
    const json = await res.json() as ApiResponse<SendMessageResult>
    expect(json.data.clientMessageId).toBe('client_echo_test')
  })

  it('returns 500 for AGENT_GENERATION_FAILED error', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValue(new ServiceError('AGENT_GENERATION_FAILED', 'Agent generation failed'))
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(500)
    const json = await res.json() as ApiResponse<SendMessageResult>
    expect(json.error.code).toBe('AGENT_GENERATION_FAILED')
  })

  it('returns 500 for NO_AVAILABLE_AGENT error', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValue(new ServiceError('NO_AVAILABLE_AGENT', 'No agent available'))
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(500)
    const json = await res.json() as ApiResponse<SendMessageResult>
    expect(json.error.code).toBe('NO_AVAILABLE_AGENT')
  })

  it('returns 502 for LLM_PROVIDER_ERROR', async () => {
    vi.spyOn(DiscussionService.prototype, 'sendUserMessage').mockRejectedValue(new ServiceError('LLM_PROVIDER_ERROR', 'LLM provider error'))
    const req = new Request('http://localhost/api/discussions/sess-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    })
    const res = await POST(req as unknown as Request, { params: makeParams('sess-1') })
    expect(res.status).toBe(502)
    const json = await res.json() as ApiResponse<SendMessageResult>
    expect(json.error.code).toBe('LLM_PROVIDER_ERROR')
  })
})
