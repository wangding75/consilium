import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/discussions/[sessionId]/intent/route'
import { SessionService } from '@/server/services/session.service'
import {
  sharedMessageRepo,
  sharedSessionRepo,
  sharedTemplateRepo,
} from '@/server/repositories/mock/instances'
import type { ApiResponse, IntentResponse } from '@/types/api'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

async function createRunningSession(topic: string) {
  const sessionService = new SessionService(sharedSessionRepo, sharedTemplateRepo)
  return sessionService.createSession({ topic, templateId: 'three-kingdoms-advisors' })
}

describe('POST /api/discussions/[sessionId]/intent — Task-03', () => {
  beforeEach(() => {
    // shared repositories are process-wide; each case creates a unique session id.
  })

  it('returns an IntentResponse for a valid command request through the route and service stack', async () => {
    const session = await createRunningSession(`intent command ${crypto.randomUUID()}`)
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '让诸葛亮回应一下', clientMessageId: 'client-1' }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.sessionId).toBe(session.sessionId)
    expect(json.data.clientMessageId).toBe('client-1')
    expect(json.data.intent.rawText).toBe('让诸葛亮回应一下')
    expect(json.data.intent.schedulerHint?.preferredSpeakerId).toBe('zhuge-liang')
  })

  it('returns passive intent with safe debug summary when forced to send as a plain message', async () => {
    const session = await createRunningSession(`intent debug ${crypto.randomUUID()}`)
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '@/# 现在执行那个', clientMessageId: 'client-debug', debug: true, forceAsPlainMessage: true }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.intent.type).toBe('passive')
    expect(json.data.intent.debugSummary?.classifierMode).toBe('rule')
    expect(JSON.stringify(json.data.intent.debugSummary)).not.toMatch(/prompt|apiKey|providerRequest/i)
  })

  it('returns 400 MESSAGE_EMPTY for blank content', async () => {
    const session = await createRunningSession(`intent blank ${crypto.randomUUID()}`)
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ' }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('MESSAGE_EMPTY')
  })

  it('returns 409 SESSION_NOT_OPERABLE when the session cannot accept intervention', async () => {
    const session = await createRunningSession(`intent completed ${crypto.randomUUID()}`)
    await sharedSessionRepo.updateStatus(session.sessionId, 'completed', 'test completed session')
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '总结当前结论' }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(409)
    expect(json.success).toBe(false)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('SESSION_NOT_OPERABLE')
  })

  it('returns 400 INSUFFICIENT_CONTEXT for summary before enough discussion history exists', async () => {
    const session = await createRunningSession(`intent insufficient ${crypto.randomUUID()}`)
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '总结当前结论' }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('INSUFFICIENT_CONTEXT')
  })

  it('returns 422 INTENT_CLASSIFICATION_FAILED for unrecognizable command-like text', async () => {
    const session = await createRunningSession(`intent unknown ${crypto.randomUUID()}`)
    await sharedMessageRepo.save({
      messageId: `msg-${crypto.randomUUID()}`,
      sessionId: session.sessionId,
      type: 'user',
      content: '请先分析局势',
      status: 'completed',
      createdAt: new Date().toISOString(),
    })
    await sharedMessageRepo.save({
      messageId: `msg-${crypto.randomUUID()}`,
      sessionId: session.sessionId,
      type: 'character',
      roleId: 'zhuge-liang',
      content: '亮以为应先联吴',
      status: 'completed',
      createdAt: new Date().toISOString(),
    })
    const req = new Request(`http://localhost/api/discussions/${session.sessionId}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '@/# 现在执行那个' }),
    })

    const res = await POST(req, { params: makeParams(session.sessionId) })
    const json = await res.json() as ApiResponse<IntentResponse>

    expect(res.status).toBe(422)
    expect(json.success).toBe(false)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('INTENT_CLASSIFICATION_FAILED')
  })
})
