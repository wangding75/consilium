import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { ServiceError } from '@/server/errors'
import type { DiscussionMessage, OrchestratorResult } from '@/types'
import type { IntentResponse } from '@/types/api'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'

const TEMPLATE_ID = 'three-kingdoms-advisors'

function makeOrchestratorResult(sessionId: string, activeSpeakerId = 'zhuge-liang'): OrchestratorResult {
  return {
    activeSpeakerId,
    agentMessages: [
      {
        messageId: `msg-agent-${activeSpeakerId}`,
        sessionId,
        type: activeSpeakerId === 'xunyu' ? 'host' : 'character',
        roleId: activeSpeakerId,
        agentType: activeSpeakerId === 'xunyu' ? 'host' : 'expert',
        content: `${activeSpeakerId} replies`,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
    ],
    callLogs: [],
  }
}

describe('user message intent metadata and vote boundary — Task-05', () => {
  let sessionRepo: MockSessionRepository
  let templateRepo: MockTemplateRepository
  let messageRepo: MockMessageRepository
  let callLogRepo: MockAgentCallLogRepository
  let discussionRepo: MockDiscussionRepository

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    templateRepo = new MockTemplateRepository()
    messageRepo = new MockMessageRepository()
    callLogRepo = new MockAgentCallLogRepository()
    discussionRepo = new MockDiscussionRepository()
  })

  async function createSession(status: 'running' | 'completed' | 'archived' = 'running') {
    return sessionRepo.save({
      id: '',
      templateId: TEMPLATE_ID,
      topic: '三国战略',
      status,
      state: { stage: 'developing', turnCount: 2, lastSpeakerId: 'xunyu' },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  function makeService(orchestrator: DiscussionOrchestrator) {
    return new DiscussionService(discussionRepo, sessionRepo, templateRepo, messageRepo, callLogRepo, orchestrator)
  }

  it('recognizeIntent rejects non-running sessions with SESSION_NOT_OPERABLE', async () => {
    const session = await createSession('completed')
    const service = makeService({ run: vi.fn() } as unknown as DiscussionOrchestrator)

    await expect(service.recognizeIntent(session.id, { content: '总结当前结论' })).rejects.toMatchObject({
      code: 'SESSION_NOT_OPERABLE',
    } satisfies Partial<ServiceError>)
  })

  it('sendUserMessage rejects intentResponse from a different session', async () => {
    const session = await createSession()
    const service = makeService({ run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id)) } as unknown as DiscussionOrchestrator)
    const intentResponse: IntentResponse = {
      sessionId: 'other-session',
      clientMessageId: 'client-1',
      activeSpeakerId: 'zhuge-liang',
      intent: {
        type: 'command',
        confidence: 0.9,
        rawText: '让诸葛亮回应一下',
        target: { roleId: 'zhuge-liang', action: 'reply' },
        schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
        execution: { status: 'immediate' },
      },
    }

    await expect(service.sendUserMessage(session.id, '让诸葛亮回应一下', 'client-1', intentResponse)).rejects.toMatchObject({
      code: 'SESSION_CONTEXT_MISMATCH',
    } satisfies Partial<ServiceError>)
  })

  it('persists user message intent metadata and label with write-then-read verification', async () => {
    const session = await createSession()
    const service = makeService({ run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id)) } as unknown as DiscussionOrchestrator)
    const intentResponse: IntentResponse = {
      sessionId: session.id,
      clientMessageId: 'client-command',
      activeSpeakerId: 'zhuge-liang',
      intent: {
        type: 'command',
        confidence: 0.9,
        rawText: '让诸葛亮回应一下',
        target: { roleId: 'zhuge-liang', action: 'reply' },
        schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
        execution: { status: 'immediate' },
      },
    }

    await service.sendUserMessage(session.id, '让诸葛亮回应一下', 'client-command', intentResponse)
    const saved = await messageRepo.findByClientMessageId('client-command', session.id)

    expect(saved?.metadata?.intent?.target?.roleId).toBe('zhuge-liang')
    expect(saved?.metadata?.intentLabel).toBe('指令')
  })

  it('records the vote boundary system message without completing the session', async () => {
    const session = await createSession()
    const service = makeService({ run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id, 'xunyu')) } as unknown as DiscussionOrchestrator)
    const intentResponse: IntentResponse = {
      sessionId: session.id,
      clientMessageId: 'client-vote',
      activeSpeakerId: 'xunyu',
      intent: {
        type: 'command',
        confidence: 0.88,
        rawText: '触发投票',
        target: { eventType: 'vote' },
        schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' },
        execution: {
          status: 'deferred',
          message: '已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。',
        },
      },
    }

    await service.sendUserMessage(session.id, '触发投票', 'client-vote', intentResponse)
    const messages: DiscussionMessage[] = await messageRepo.findBySessionId(session.id)
    const currentSession = await sessionRepo.findById(session.id)

    expect(messages.some((message) => message.type === 'system' && message.content === '已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。')).toBe(true)
    expect(currentSession?.status).toBe('running')
  })
})
