import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { OrchestratorResult, DiscussionMessage } from '@/types'

const TEMPLATE_ID = 'three-kingdoms-advisors'

function makeOrchestratorResult(sessionId: string, clientMessageId?: string): OrchestratorResult {
  const msg: DiscussionMessage = {
    messageId: 'agent-msg-1',
    sessionId,
    type: 'character',
    roleId: 'zhuge-liang',
    agentType: 'expert',
    content: '亮以为，当三分天下',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...(clientMessageId ? { metadata: { replyToClientMessageId: clientMessageId } } : {}),
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

// Task-06：完善 DiscussionService.sendUserMessage（clientMessageId 去重、失败重试再生成）
describe('DiscussionService.sendUserMessage — Task-06', () => {
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

  it('returns clientMessageId echo when provided', async () => {
    const session = await createSession()
    ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrchestratorResult(session.id, 'client_test_echo')
    )
    const service = makeService()
    const result = await service.sendUserMessage(session.id, '请分析', 'client_test_echo')
    expect(result.clientMessageId).toBe('client_test_echo')
  })

  it('returns existing userMessage and agentMessages for duplicate completed clientMessageId', async () => {
    const session = await createSession()
    await messageRepo.save({
      messageId: 'msg-user-dup',
      sessionId: session.id,
      type: 'user',
      content: '请分析',
      status: 'completed',
      clientMessageId: 'client_dup_completed',
      createdAt: new Date().toISOString(),
    })
    await messageRepo.save({
      messageId: 'msg-agent-dup',
      sessionId: session.id,
      type: 'character',
      roleId: 'zhuge-liang',
      content: '已有回复',
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: { replyToClientMessageId: 'client_dup_completed' },
    })
    const service = makeService()
    const result = await service.sendUserMessage(session.id, '请分析', 'client_dup_completed')
    expect(result.userMessage?.messageId).toBe('msg-user-dup')
    expect(result.agentMessages).toHaveLength(1)
    expect(result.agentMessages[0].content).toBe('已有回复')
    expect(orchestrator.run).not.toHaveBeenCalled()
  })

  it('re-generates agent messages for duplicate failed clientMessageId', async () => {
    const session = await createSession()
    await messageRepo.save({
      messageId: 'msg-user-failed',
      sessionId: session.id,
      type: 'user',
      content: '请分析',
      status: 'failed',
      clientMessageId: 'client_dup_failed',
      createdAt: new Date().toISOString(),
    })
    ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrchestratorResult(session.id, 'client_dup_failed')
    )
    const service = makeService()
    const result = await service.sendUserMessage(session.id, '请分析', 'client_dup_failed')
    expect(orchestrator.run).toHaveBeenCalled()
    expect(result.userMessage?.status).toBe('completed')
  })

  it('saves user message with clientMessageId when provided', async () => {
    const session = await createSession()
    ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrchestratorResult(session.id, 'client_save_test')
    )
    const service = makeService()
    await service.sendUserMessage(session.id, '请分析', 'client_save_test')
    const found = await messageRepo.findByClientMessageId('client_save_test', session.id)
    expect(found).not.toBeNull()
    expect(found!.type).toBe('user')
  })

  it('agent messages have replyToClientMessageId in metadata when clientMessageId provided', async () => {
    const session = await createSession()
    ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrchestratorResult(session.id, 'client_reply_test')
    )
    const service = makeService()
    const result = await service.sendUserMessage(session.id, '请分析', 'client_reply_test')
    const replies = await messageRepo.findRepliesByClientMessageId(session.id, 'client_reply_test')
    expect(replies.length).toBeGreaterThan(0)
    expect(replies[0].metadata?.replyToClientMessageId).toBe('client_reply_test')
  })

  it('re-generates when completed clientMessageId has no associated agent replies', async () => {
    const session = await createSession()
    await messageRepo.save({
      messageId: 'msg-user-no-replies',
      sessionId: session.id,
      type: 'user',
      content: '请分析',
      status: 'completed',
      clientMessageId: 'client_no_replies',
      createdAt: new Date().toISOString(),
    })
    ;(orchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeOrchestratorResult(session.id, 'client_no_replies')
    )
    const service = makeService()
    const result = await service.sendUserMessage(session.id, '请分析', 'client_no_replies')
    expect(orchestrator.run).toHaveBeenCalled()
    expect(result.agentMessages.length).toBeGreaterThan(0)
  })
})
