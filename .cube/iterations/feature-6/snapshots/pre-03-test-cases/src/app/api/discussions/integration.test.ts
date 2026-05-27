/**
 * Integration test: POST /api/discussions/:sessionId/messages
 * Verifies that the full chain POST → Service → Orchestrator → AgentRuntime
 * is wired correctly end-to-end using mock implementations.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/discussions/[sessionId]/messages/route'
import { sharedSessionRepo, sharedMessageRepo } from '@/server/repositories/mock/instances'

// Reset shared repos before each test to avoid cross-test contamination
beforeEach(async () => {
  // Clear session repo by creating fresh state
  const sessions = await sharedSessionRepo.findAll()
  for (const s of sessions) {
    await sharedSessionRepo.delete(s.id)
  }
})

async function createTestSession(): Promise<string> {
  const session = await sharedSessionRepo.save({
    id: '',
    templateId: 'three-kingdoms-advisors',
    topic: '三国战略集成测试',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return session.id
}

describe('POST /discussions/:sessionId/messages — integration chain', () => {
  it('empty content + empty history triggers host opening via full chain', async () => {
    const sessionId = await createTestSession()
    const req = new Request(`http://localhost/api/discussions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const res = await POST(req, { params: Promise.resolve({ sessionId }) })
    const body = await res.json()
    // The chain should complete (even if stub, route-level error mapping works)
    // With NOT_IMPLEMENTED stubs this will fail (confirming Red phase)
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.userMessage).toBeNull()
    expect(Array.isArray(body.data.agentMessages)).toBe(true)
    expect(body.data.agentMessages.length).toBeGreaterThan(0)
  })

  it('non-empty content with history produces user + agent messages', async () => {
    const sessionId = await createTestSession()
    // First, trigger opening
    await POST(
      new Request(`http://localhost/api/discussions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      }),
      { params: Promise.resolve({ sessionId }) }
    )
    // Then send a user message
    const req = new Request(`http://localhost/api/discussions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '请分析局势' }),
    })
    const res = await POST(req, { params: Promise.resolve({ sessionId }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.userMessage?.content).toBe('请分析局势')
    expect(body.data.agentMessages.length).toBeGreaterThan(0)
  })

  it('messages are persisted to messageRepo after successful send', async () => {
    const sessionId = await createTestSession()
    const req = new Request(`http://localhost/api/discussions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    await POST(req, { params: Promise.resolve({ sessionId }) })
    const messages = await sharedMessageRepo.findBySessionId(sessionId)
    expect(messages.length).toBeGreaterThan(0)
  })
})
