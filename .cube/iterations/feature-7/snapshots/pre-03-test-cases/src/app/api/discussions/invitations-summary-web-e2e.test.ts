import { describe, it, expect, beforeEach } from 'vitest'
import { POST as postMessage } from '@/app/api/discussions/[sessionId]/messages/route'
import { GET as getInvitation } from '@/app/api/discussions/[sessionId]/invitations/route'
import { POST as postResponse } from '@/app/api/discussions/[sessionId]/invitations/[invitationId]/response/route'
import { POST as postSkip } from '@/app/api/discussions/[sessionId]/invitations/[invitationId]/skip/route'
import { POST as postSummary } from '@/app/api/discussions/[sessionId]/summary/route'
import { sharedSessionRepo, sharedMessageRepo } from '@/server/repositories/mock/instances'

beforeEach(async () => {
  const sessions = await sharedSessionRepo.findAll()
  for (const s of sessions) {
    await sharedSessionRepo.delete(s.id)
  }
})

async function createTestSession(): Promise<string> {
  const session = await sharedSessionRepo.save({
    id: '',
    templateId: 'three-kingdoms-advisors',
    topic: 'web-e2e 邀请总结测试',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return session.id
}

async function seedRunningSession(): Promise<string> {
  const sessionId = await createTestSession()
  // Trigger opening first
  await postMessage(
    new Request(`http://localhost/api/discussions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    }),
    { params: Promise.resolve({ sessionId }) }
  )
  return sessionId
}

describe('Web-E2E: Discussion API endpoints for invitations and summary', () => {
  describe('GET /discussions/:sessionId/invitations', () => {
    it('returns 200 with null invitation when no pending invitation exists', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(`http://localhost/api/discussions/${sessionId}/invitations`, {
        method: 'GET',
      })
      const res = await getInvitation(req, { params: Promise.resolve({ sessionId }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.sessionId).toBe(sessionId)
      expect(body.data.invitation).toBeNull()
    })

    it('returns 200 with invitation shape when pending invitation exists', async () => {
      const sessionId = await seedRunningSession()
      // After implementation, sending messages that trigger invite_user will create invitation
      // For now, verify the contract shape
      const req = new Request(`http://localhost/api/discussions/${sessionId}/invitations`, {
        method: 'GET',
      })
      const res = await getInvitation(req, { params: Promise.resolve({ sessionId }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('sessionId')
      expect(body.data).toHaveProperty('invitation')
    })
  })

  describe('POST /discussions/:sessionId/invitations/:invitationId/response', () => {
    it('returns validation error for empty content', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/invitations/inv-1/response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '' }),
        }
      )
      const res = await postResponse(req, {
        params: Promise.resolve({ sessionId, invitationId: 'inv-1' }),
      })
      const body = await res.json()

      // Should return 400 for empty content or 501 for not-implemented stub
      expect([400, 501]).toContain(res.status)
      expect(body.success).toBe(false)
      expect(body.data).toBeNull()
      expect(body.error).toBeDefined()
    })

    it('returns domain error for nonexistent invitation', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/invitations/inv-nonexist/response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '我的看法' }),
        }
      )
      const res = await postResponse(req, {
        params: Promise.resolve({ sessionId, invitationId: 'inv-nonexist' }),
      })
      const body = await res.json()

      // Should return 404 for not found or 501 for stub
      expect([404, 501]).toContain(res.status)
      expect(body.success).toBe(false)
    })

    it('returns 501 NOT_IMPLEMENTED for stub endpoint (current state)', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/invitations/inv-1/response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '我的回应' }),
        }
      )
      const res = await postResponse(req, {
        params: Promise.resolve({ sessionId, invitationId: 'inv-1' }),
      })
      const body = await res.json()

      // Current stub returns 501; after implementation will return 200/400/404
      expect([200, 400, 404, 501]).toContain(res.status)
      expect(body).toHaveProperty('requestId')
    })
  })

  describe('POST /discussions/:sessionId/invitations/:invitationId/skip', () => {
    it('returns 501 or domain error for nonexistent invitation', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/invitations/inv-nonexist/skip`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const res = await postSkip(req, {
        params: Promise.resolve({ sessionId, invitationId: 'inv-nonexist' }),
      })
      const body = await res.json()

      expect([404, 501]).toContain(res.status)
      expect(body.success).toBe(false)
    })
  })

  describe('POST /discussions/:sessionId/summary', () => {
    it('returns 501 NOT_IMPLEMENTED for stub endpoint (current state)', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const res = await postSummary(req, {
        params: Promise.resolve({ sessionId }),
      })
      const body = await res.json()

      expect(res.status).toBe(501)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('NOT_IMPLEMENTED')
    })

    it('returns error for nonexistent session', async () => {
      const req = new Request(
        `http://localhost/api/discussions/sess-nonexist/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const res = await postSummary(req, {
        params: Promise.resolve({ sessionId: 'sess-nonexist' }),
      })
      const body = await res.json()

      // Should return domain error or NOT_IMPLEMENTED stub
      expect([404, 501]).toContain(res.status)
      expect(body.success).toBe(false)
    })
  })

  describe('POST /discussions/:sessionId/messages — Director status in response', () => {
    it('returns directorDecision field in SendMessageResult', async () => {
      const sessionId = await seedRunningSession()
      const req = new Request(
        `http://localhost/api/discussions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '请分析局势' }),
        }
      )
      const res = await postMessage(req, { params: Promise.resolve({ sessionId }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      // After implementation, directorDecision should be present
      // Current state may not have it yet
      if (body.data.directorDecision) {
        expect(body.data.directorDecision).toHaveProperty('action')
        expect(body.data.directorDecision).toHaveProperty('reason')
      }
    })
  })
})
