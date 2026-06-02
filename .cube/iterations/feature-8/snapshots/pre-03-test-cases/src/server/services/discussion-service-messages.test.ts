import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'

const TEMPLATE_ID = 'three-kingdoms-advisors'

// Task-05：完善 DiscussionService.getMessages（消息排序与 before 游标）
describe('DiscussionService.getMessages — Task-05', () => {
  let sessionRepo: MockSessionRepository
  let templateRepo: MockTemplateRepository
  let messageRepo: MockMessageRepository
  let callLogRepo: MockAgentCallLogRepository
  let discussionRepo: MockDiscussionRepository
  let orchestrator: DiscussionOrchestrator

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    templateRepo = new MockTemplateRepository()
    messageRepo = new MockMessageRepository()
    callLogRepo = new MockAgentCallLogRepository()
    discussionRepo = new MockDiscussionRepository()
    orchestrator = { run: vi.fn() } as unknown as DiscussionOrchestrator
  })

  function makeService() {
    return new DiscussionService(discussionRepo, sessionRepo, templateRepo, messageRepo, callLogRepo, orchestrator)
  }

  async function createSession() {
    return sessionRepo.save({
      id: '',
      templateId: TEMPLATE_ID,
      topic: '三国战略',
      status: 'active',
      state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  it('passes before cursor to repository for pagination', async () => {
    const session = await createSession()
    await messageRepo.save({
      messageId: 'msg-a',
      sessionId: session.id,
      type: 'user',
      content: '消息A',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    await messageRepo.save({
      messageId: 'msg-b',
      sessionId: session.id,
      type: 'character',
      roleId: 'zhuge-liang',
      content: '消息B',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    const service = makeService()
    const result = await service.getMessages(session.id, { limit: 50, before: 'msg-b' })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].messageId).toBe('msg-a')
  })

  it('returns messages sorted by createdAt ascending', async () => {
    const session = await createSession()
    await messageRepo.save({
      messageId: 'msg-late',
      sessionId: session.id,
      type: 'user',
      content: '后发的消息',
      status: 'completed',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    await messageRepo.save({
      messageId: 'msg-early',
      sessionId: session.id,
      type: 'character',
      roleId: 'zhuge-liang',
      content: '先发的消息',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const service = makeService()
    const result = await service.getMessages(session.id, { limit: 50 })
    expect(result.messages[0].messageId).toBe('msg-early')
    expect(result.messages[1].messageId).toBe('msg-late')
  })
})
