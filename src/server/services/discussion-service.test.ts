import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { OrchestratorResult, Session, DiscussionMessage } from '@/types'

const TEMPLATE_ID = 'three-kingdoms-advisors'

async function createSession(sessionRepo: MockSessionRepository): Promise<Session> {
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

function makeOrchestratorResult(sessionId: string): OrchestratorResult {
  const msg: DiscussionMessage = {
    messageId: 'agent-msg-1',
    sessionId,
    type: 'character',
    roleId: 'zhuge-liang',
    agentType: 'expert',
    content: '亮以为，当三分天下',
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
  return {
    agentMessages: [msg],
    callLogs: [
      {
        sessionId,
        runId: 'run-1',
        agentId: 'zhuge-liang',
        roleId: 'zhuge-liang',
        provider: 'mock',
        model: 'mock-default',
        inputSummary: '测试',
        durationMs: 50,
        status: 'success',
      },
    ],
    activeSpeakerId: 'zhuge-liang',
  }
}

describe('DiscussionService', () => {
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
    orchestrator = {
      run: vi.fn(),
    } as unknown as DiscussionOrchestrator
  })

  function makeService() {
    return new DiscussionService(
      discussionRepo,
      sessionRepo,
      templateRepo,
      messageRepo,
      callLogRepo,
      orchestrator
    )
  }

  // Task-10: getSessionDetail
  describe('getSessionDetail', () => {
    it('returns session detail with roles when session exists', async () => {
      const session = await createSession(sessionRepo)
      const service = makeService()
      const result = await service.getSessionDetail(session.id)
      expect(result.sessionId).toBe(session.id)
      expect(result.topic).toBe('三国战略')
      expect(Array.isArray(result.roles)).toBe(true)
      expect(result.roles.length).toBeGreaterThan(0)
    })

    it('throws SESSION_NOT_FOUND when session does not exist', async () => {
      const service = makeService()
      await expect(service.getSessionDetail('nonexistent-id')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      })
    })

    it('returns roles with agentType field', async () => {
      const session = await createSession(sessionRepo)
      const service = makeService()
      const result = await service.getSessionDetail(session.id)
      for (const role of result.roles) {
        expect(['host', 'expert', 'critic']).toContain(role.agentType)
      }
    })
  })

  // Task-11: getMessages
  describe('getMessages', () => {
    it('returns empty messages list when no messages exist', async () => {
      const session = await createSession(sessionRepo)
      const service = makeService()
      const result = await service.getMessages(session.id, { limit: 50 })
      expect(result.messages).toEqual([])
      expect(result.sessionId).toBe(session.id)
    })

    it('throws SESSION_NOT_FOUND when session does not exist', async () => {
      const service = makeService()
      await expect(service.getMessages('nonexistent', { limit: 50 })).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      })
    })

    it('returns messages saved in the repository', async () => {
      const session = await createSession(sessionRepo)
      await messageRepo.save({
        messageId: 'msg-1',
        sessionId: session.id,
        type: 'user',
        content: '测试内容',
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
      const service = makeService()
      const result = await service.getMessages(session.id, { limit: 50 })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content).toBe('测试内容')
    })
  })

  // Task-12: sendUserMessage
  describe('sendUserMessage', () => {
    it('saves user message and returns agentMessages on successful run', async () => {
      const session = await createSession(sessionRepo)
      ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeOrchestratorResult(session.id)
      )
      const service = makeService()
      const result = await service.sendUserMessage(session.id, '请分析局势')
      expect(result.userMessage).not.toBeNull()
      expect(result.userMessage?.content).toBe('请分析局势')
      expect(result.agentMessages).toHaveLength(1)
    })

    it('triggers host opening when content is empty and history is empty', async () => {
      const session = await createSession(sessionRepo)
      const hostMsg: DiscussionMessage = {
        messageId: 'host-msg-1',
        sessionId: session.id,
        type: 'host',
        roleId: 'xunyu',
        agentType: 'host',
        content: '欢迎大家！',
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
      ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        agentMessages: [hostMsg],
        callLogs: [],
        activeSpeakerId: 'xunyu',
      })
      const service = makeService()
      const result = await service.sendUserMessage(session.id, '')
      expect(result.userMessage).toBeNull()
      expect(result.agentMessages[0].type).toBe('host')
    })

    it('throws MESSAGE_EMPTY when content is empty and history is not empty', async () => {
      const session = await createSession(sessionRepo)
      await messageRepo.save({
        messageId: 'msg-existing',
        sessionId: session.id,
        type: 'host',
        content: '已有消息',
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
      const service = makeService()
      await expect(service.sendUserMessage(session.id, '')).rejects.toMatchObject({
        code: 'MESSAGE_EMPTY',
      })
    })

    it('throws SESSION_NOT_FOUND when session does not exist', async () => {
      const service = makeService()
      await expect(service.sendUserMessage('nonexistent', '内容')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      })
    })

    it('persists agentMessages to messageRepo after successful run', async () => {
      const session = await createSession(sessionRepo)
      ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeOrchestratorResult(session.id)
      )
      const service = makeService()
      await service.sendUserMessage(session.id, '请分析')
      const messages = await messageRepo.findBySessionId(session.id)
      expect(messages.some((m) => m.content === '亮以为，当三分天下')).toBe(true)
    })

    it('persists callLogs to callLogRepo after successful run', async () => {
      const session = await createSession(sessionRepo)
      ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeOrchestratorResult(session.id)
      )
      const service = makeService()
      await service.sendUserMessage(session.id, '请分析')
      const logs = await callLogRepo.findBySessionId(session.id)
      expect(logs).toHaveLength(1)
    })
  })
})
