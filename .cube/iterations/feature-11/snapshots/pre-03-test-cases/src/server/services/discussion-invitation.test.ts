import { describe, it, expect, beforeEach } from 'vitest'
import { DiscussionService } from './discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
import { ServiceError } from '@/server/errors'
import type { Session, Invitation } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

class MockTemplateRepoWithSave {
  private templates = [{ ...threeKingdomsTemplate, id: 'tpl-3k' }]
  async findAll() { return this.templates }
  async findById(id: string) { return this.templates.find(t => t.id === id) ?? null }
  async save(t: any) { this.templates.push(t); return t }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    templateId: 'tpl-3k',
    topic: '测试议题',
    status: 'running',
    state: { stage: 'developing', turnCount: 4, lastSpeakerId: 'role-zhuge' },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    invitationId: 'inv-1',
    sessionId: 'sess-1',
    status: 'pending',
    prompt: '请发表看法',
    reason: 'disagreement',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeService(invitationRepo?: MockInvitationRepository) {
  const sessionRepo = new MockSessionRepository()
  const templateRepo = new MockTemplateRepoWithSave()
  const messageRepo = new MockMessageRepository()
  const callLogRepo = new MockAgentCallLogRepository()
  const invRepo = invitationRepo ?? new MockInvitationRepository()
  const directorDecisionRepo = new MockDirectorDecisionRepository()
  const continueDirector = {
    decide: async () => ({
      decisionId: 'dec-cont',
      sessionId: 'sess-1',
      action: 'continue' as const,
      reason: 'continue after invitation',
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    }),
  }
  const orchestrator = {
    run: async () => ({
      agentMessages: [{
        messageId: 'msg-agent-1',
        sessionId: 'sess-1',
        type: 'character' as const,
        roleId: 'role-zhuge',
        content: '后续发言',
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
      }],
      callLogs: [],
      activeSpeakerId: 'role-zhuge',
    }),
  }

  const svc = new DiscussionService(
    { findAll: async () => [] } as any,
    sessionRepo,
    templateRepo as any,
    messageRepo,
    callLogRepo,
    orchestrator as any,
    undefined,
    continueDirector as any,
    invRepo,
    directorDecisionRepo,
  )

  return { svc, sessionRepo, messageRepo, invRepo, directorDecisionRepo }
}

describe('DiscussionService.respondInvitation', () => {
  it('rejects empty content', async () => {
    const { svc } = makeService()
    await expect(svc.respondInvitation('sess-1', 'inv-1', { content: '' }))
      .rejects.toThrow('MESSAGE_EMPTY')
  })

  it('rejects empty whitespace content', async () => {
    const { svc } = makeService()
    await expect(svc.respondInvitation('sess-1', 'inv-1', { content: '   ' }))
      .rejects.toThrow('MESSAGE_EMPTY')
  })

  it('throws INVITATION_INVALID when invitation does not exist', async () => {
    const { svc, sessionRepo } = makeService()
    await sessionRepo.save(makeSession())
    await expect(svc.respondInvitation('sess-1', 'nonexistent', { content: '我的看法' }))
      .rejects.toThrow('INVITATION_INVALID')
  })

  it('throws INVITATION_INVALID when invitation belongs to another session', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1', sessionId: 'sess-2' }))
    await expect(svc.respondInvitation('sess-1', 'inv-1', { content: '我的看法' }))
      .rejects.toThrow('INVITATION_INVALID')
  })

  it('throws INVITATION_INVALID when invitation is already responded', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1', status: 'responded' }))
    await expect(svc.respondInvitation('sess-1', 'inv-1', { content: '再次回应' }))
      .rejects.toThrow('INVITATION_INVALID')
  })

  it('updates invitation status to responded and saves user message', async () => {
    const { svc, sessionRepo, invRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.respondInvitation('sess-1', 'inv-1', { content: '我同意这个观点' })
    expect(result.invitation.status).toBe('responded')
    expect(result.userMessage).not.toBeNull()
    expect(result.userMessage?.content).toBe('我同意这个观点')
  })

  it('triggers Director to decide next action after response', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.respondInvitation('sess-1', 'inv-1', { content: '我的看法' })
    expect(result.directorDecision).toBeDefined()
  })

  it('idempotent: duplicate clientMessageId does not create duplicate messages', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const clientMessageId = 'client-dup-1'
    const result1 = await svc.respondInvitation('sess-1', 'inv-1', { content: '回应1', clientMessageId })
    // Second call should be idempotent
    const result2 = await svc.respondInvitation('sess-1', 'inv-1', { content: '回应2', clientMessageId })
    expect(result2.userMessage?.content).toBe(result1.userMessage?.content)
  })

  it('returns agentMessages after invitation response', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.respondInvitation('sess-1', 'inv-1', { content: '回应' })
    expect(result.agentMessages.length).toBeGreaterThanOrEqual(0)
  })
})

describe('DiscussionService.getPendingInvitation', () => {
  it('returns null when no pending invitation', async () => {
    const { svc, sessionRepo } = makeService()
    await sessionRepo.save(makeSession())
    const result = await svc.getPendingInvitation('sess-1')
    expect(result.invitation).toBeNull()
  })

  it('returns pending invitation for session', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1', status: 'pending' }))
    const result = await svc.getPendingInvitation('sess-1')
    expect(result.invitation).not.toBeNull()
    expect(result.invitation!.status).toBe('pending')
  })

  it('throws SESSION_NOT_FOUND for non-existent session', async () => {
    const { svc } = makeService()
    await expect(svc.getPendingInvitation('nonexistent')).rejects.toThrow('SESSION_NOT_FOUND')
  })
})
