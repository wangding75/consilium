import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/sessions/[sessionId]/status/route'
import { GET as getState } from '@/app/api/sessions/[sessionId]/state/route'
import { GET as listSessions } from '@/app/api/sessions/route'
import { SessionService } from '@/server/services/session.service'
import type { ApiResponse, Session, SessionStateResult } from '@/types'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })

// Task-05: Session API routes for lifecycle, status, and state
describe('Session lifecycle API routes — Task-05', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /api/sessions returns sessions list with query params', async () => {
    const req = new Request('http://localhost/api/sessions?status=running&limit=5')
    const res = await listSessions(req)
    expect(res.status).toBe(200)
    const json = await res.json() as ApiResponse<Session[]>
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('GET /api/sessions returns 400 for invalid status', async () => {
    const req = new Request('http://localhost/api/sessions?status=invalid')
    const res = await listSessions(req)
    expect(res.status).toBe(400)
  })

  it('PATCH /api/sessions/:id/status archives a session', async () => {
    const service = new SessionService(
      await import('@/server/repositories/mock/instances').then(m => m.sharedSessionRepo),
      await import('@/server/repositories/mock/instances').then(m => m.sharedTemplateRepo),
    )
    const session = await service.createSession({ topic: 'api archive', templateId: 'three-kingdoms-advisors' })
    const req = new Request(`http://localhost/api/sessions/${session.sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    })
    const res = await PATCH(req, { params: makeParams(session.sessionId) })
    expect(res.status).toBe(200)
    const json = await res.json() as ApiResponse<Session>
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('archived')
  })

  it('PATCH /api/sessions/:id/status completes a session', async () => {
    const service = new SessionService(
      await import('@/server/repositories/mock/instances').then(m => m.sharedSessionRepo),
      await import('@/server/repositories/mock/instances').then(m => m.sharedTemplateRepo),
    )
    const session = await service.createSession({ topic: 'api complete', templateId: 'three-kingdoms-advisors' })
    await (await import('@/server/repositories/mock/instances')).sharedSessionRepo.updateState(
      session.sessionId, { stage: 'closing', turnCount: 10, lastSpeakerId: null }, 'test',
    )
    const req = new Request(`http://localhost/api/sessions/${session.sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    const res = await PATCH(req, { params: makeParams(session.sessionId) })
    expect(res.status).toBe(200)
  })

  it('PATCH /api/sessions/:id/status returns 409 for premature complete', async () => {
    const service = new SessionService(
      await import('@/server/repositories/mock/instances').then(m => m.sharedSessionRepo),
      await import('@/server/repositories/mock/instances').then(m => m.sharedTemplateRepo),
    )
    const session = await service.createSession({ topic: 'api premature', templateId: 'three-kingdoms-advisors' })
    const req = new Request(`http://localhost/api/sessions/${session.sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    const res = await PATCH(req, { params: makeParams(session.sessionId) })
    expect(res.status).toBe(409)
  })

  it('PATCH /api/sessions/:id/status returns 400 for invalid action', async () => {
    const req = new Request('http://localhost/api/sessions/sess-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' }),
    })
    const res = await PATCH(req, { params: makeParams('sess-1') })
    expect(res.status).toBe(400)
  })

  it('GET /api/sessions/:id/state returns session state', async () => {
    const service = new SessionService(
      await import('@/server/repositories/mock/instances').then(m => m.sharedSessionRepo),
      await import('@/server/repositories/mock/instances').then(m => m.sharedTemplateRepo),
    )
    const session = await service.createSession({ topic: 'state api', templateId: 'three-kingdoms-advisors' })
    const req = new Request(`http://localhost/api/sessions/${session.sessionId}/state`)
    const res = await getState(req, { params: makeParams(session.sessionId) })
    expect(res.status).toBe(200)
    const json = await res.json() as ApiResponse<SessionStateResult>
    expect(json.success).toBe(true)
    expect(json.data.sessionId).toBe(session.sessionId)
  })

  it('GET /api/sessions/:id/state returns 404 for missing session', async () => {
    const req = new Request('http://localhost/api/sessions/nonexistent/state')
    const res = await getState(req, { params: makeParams('nonexistent') })
    expect(res.status).toBe(404)
  })

  it('PATCH /api/sessions/:id/status resumes a session', async () => {
    const service = new SessionService(
      await import('@/server/repositories/mock/instances').then(m => m.sharedSessionRepo),
      await import('@/server/repositories/mock/instances').then(m => m.sharedTemplateRepo),
    )
    const session = await service.createSession({ topic: 'api resume', templateId: 'three-kingdoms-advisors' })
    await service.updateSessionStatus(session.sessionId, 'archive')
    const req = new Request(`http://localhost/api/sessions/${session.sessionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume' }),
    })
    const res = await PATCH(req, { params: makeParams(session.sessionId) })
    expect(res.status).toBe(200)
  })
})
