import { describe, it, expect } from 'vitest'
import { DiscussionService } from './discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
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
    topic: '测试',
    status: 'running',
    state: { stage: 'developing', turnCount: 4, lastSpeakerId: 'role-1' },
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
    prompt: '请参与',
    reason: 'disagreement',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeService() {
  const sessionRepo = new MockSessionRepository()
  const messageRepo = new MockMessageRepository()
  const invRepo = new MockInvitationRepository()
  const directorDecisionRepo = new MockDirectorDecisionRepository()
  const continueDirector = {
    decide: async () => ({
      decisionId: 'dec-skip',
      sessionId: 'sess-1',
      action: 'continue' as const,
      reason: 'continue after skip',
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    }),
  }
  const orchestrator = {
    run: async () => ({
      agentMessages: [{
        messageId: 'msg-after-skip',
        sessionId: 'sess-1',
        type: 'character' as const,
        roleId: 'role-1',
        content: '继续讨论',
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
      }],
      callLogs: [],
      activeSpeakerId: 'role-1',
    }),
  }

  const svc = new DiscussionService(
    { findAll: async () => [] } as any,
    sessionRepo,
    new MockTemplateRepoWithSave() as any,
    messageRepo,
    new MockAgentCallLogRepository(),
    orchestrator as any,
    undefined,
    continueDirector as any,
    invRepo,
    directorDecisionRepo,
  )

  return { svc, sessionRepo, invRepo, messageRepo }
}

describe('DiscussionService.skipInvitation', () => {
  it('throws INVITATION_INVALID when invitation does not exist', async () => {
    const { svc, sessionRepo } = makeService()
    await sessionRepo.save(makeSession())
    await expect(svc.skipInvitation('sess-1', 'nonexistent', {}))
      .rejects.toThrow('INVITATION_INVALID')
  })

  it('throws INVITATION_INVALID when invitation belongs to another session', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1', sessionId: 'sess-2' }))
    await expect(svc.skipInvitation('sess-1', 'inv-1', {}))
      .rejects.toThrow('INVITATION_INVALID')
  })

  it('updates invitation status to skipped', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.skipInvitation('sess-1', 'inv-1', {})
    expect(result.invitation.status).toBe('skipped')
  })

  it('idempotent: skipping already skipped invitation returns current state', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1', status: 'skipped' }))

    const result = await svc.skipInvitation('sess-1', 'inv-1', {})
    expect(result.invitation.status).toBe('skipped')
  })

  it('does not block subsequent discussion after skip', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.skipInvitation('sess-1', 'inv-1', {})
    expect(result.agentMessages).toBeDefined()
    expect(result.directorDecision).toBeDefined()
  })

  it('triggers Director continue decision after skip', async () => {
    const { svc, sessionRepo, invRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    const result = await svc.skipInvitation('sess-1', 'inv-1', {})
    expect(result.directorDecision?.action).toBe('continue')
  })

  it('does not create duplicate skip messages for same invitation', async () => {
    const { svc, sessionRepo, invRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    await invRepo.save(makeInvitation({ invitationId: 'inv-1' }))

    await svc.skipInvitation('sess-1', 'inv-1', { clientMessageId: 'skip-1' })
    const messages1 = await messageRepo.findBySessionId('sess-1')

    // Second skip with same clientMessageId should be idempotent
    await svc.skipInvitation('sess-1', 'inv-1', { clientMessageId: 'skip-1' })
    const messages2 = await messageRepo.findBySessionId('sess-1')
    expect(messages2.length).toBe(messages1.length)
  })
})
