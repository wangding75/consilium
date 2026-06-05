import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/sessions/[sessionId]/export/route'
import { sharedSessionRepo } from '@/server/repositories/mock/instances'
import type { Session } from '@/types'

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: 'sess_001',
    templateId: 'tpl_001',
    topic: '测试讨论',
    status: 'completed',
    state: { stage: 'closing', turnCount: 5, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    templateSnapshot: {
      templateId: 'tpl_001',
      version: '1.0.0',
      name: '三国演义',
      overview: { worldview: '三国', userIdentity: '主公', applicableScenarios: ['战略讨论'] },
      roles: [],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
      snapshotAt: '2026-06-04T00:00:00.000Z',
    },
    ...overrides,
  }
}

function reqWithParams(sessionId: string): Request {
  return new Request(`http://localhost/api/sessions/${sessionId}/export?format=md`)
}

// ─── Task-08: GET /api/sessions/[sessionId]/export ──────────────────────────

describe('GET /api/sessions/[sessionId]/export', () => {
  it('returns 404 NOT_FOUND when session does not exist', async () => {
    const res = await GET(reqWithParams('nonexistent'), { params: Promise.resolve({ sessionId: 'nonexistent' }) })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns SessionExportResult for existing session', async () => {
    await sharedSessionRepo.save(makeSession())
    const res = await GET(reqWithParams('sess_001'), { params: Promise.resolve({ sessionId: 'sess_001' }) })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.sessionId).toBe('sess_001')
    expect(body.data.format).toBe('md')
    expect(body.data.sanitized).toBe(true)
    expect(body.data.filename).toBe('session-sess_001.md')
    expect(typeof body.data.content).toBe('string')
    expect(typeof body.data.generatedAt).toBe('string')
    expect(typeof body.requestId).toBe('string')
  })

  it('export content is sanitized (no API key references)', async () => {
    await sharedSessionRepo.save(makeSession())
    const res = await GET(reqWithParams('sess_001'), { params: Promise.resolve({ sessionId: 'sess_001' }) })
    const body = await res.json()
    expect(body.data.content).not.toContain('apiKey')
    expect(body.data.content).not.toContain('apiKeyRef')
    expect(body.data.content).not.toContain('Authorization')
    expect(body.data.content).not.toContain('ProviderConfig')
    expect(body.data.content).not.toContain('sk-')
  })

  it('export content includes session metadata', async () => {
    await sharedSessionRepo.save(makeSession({ topic: '战略讨论' }))
    const res = await GET(reqWithParams('sess_001'), { params: Promise.resolve({ sessionId: 'sess_001' }) })
    const body = await res.json()
    expect(body.data.content).toContain('战略讨论')
    expect(body.data.content).toContain('sess_001')
  })

  it('response follows unified ApiResponse envelope', async () => {
    await sharedSessionRepo.save(makeSession())
    const res = await GET(reqWithParams('sess_001'), { params: Promise.resolve({ sessionId: 'sess_001' }) })
    const body = await res.json()
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('requestId')
  })
})