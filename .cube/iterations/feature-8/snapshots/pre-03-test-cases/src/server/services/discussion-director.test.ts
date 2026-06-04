import { describe, it, expect, beforeEach } from 'vitest'
import { DiscussionService } from './discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
import { DefaultDirector } from '@/engine/director'
import type { Session, DiscussionMessage, Template, AgentProfile } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    templateId: 'tpl-3k',
    topic: '赤壁之战',
    status: 'running',
    state: { stage: 'developing', turnCount: 4, lastSpeakerId: 'role-zhuge' },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeMessage(overrides: Partial<DiscussionMessage> = {}): DiscussionMessage {
  return {
    messageId: `msg-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 'sess-1',
    type: 'character',
    content: '测试消息',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

class MockTemplateRepoWithSave {
  private templates: Template[] = [{ ...threeKingdomsTemplate, id: 'tpl-3k' }]
  async findAll() { return this.templates }
  async findById(id: string) { return this.templates.find(t => t.id === id) ?? null }
  async save(t: Template) { this.templates.push(t); return t }
}

function makeService(director: any, invitationRepo?: MockInvitationRepository) {
  const sessionRepo = new MockSessionRepository()
  const templateRepo = new MockTemplateRepoWithSave()
  const messageRepo = new MockMessageRepository()
  const callLogRepo = new MockAgentCallLogRepository()
  const invRepo = invitationRepo ?? new MockInvitationRepository()
  const directorDecisionRepo = new MockDirectorDecisionRepository()
  const orchestrator = {
    run: async () => ({
      agentMessages: [{
        messageId: 'msg-agent-1',
        sessionId: 'sess-1',
        type: 'character' as const,
        roleId: 'role-zhuge',
        content: '测试回复',
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
    director,
    invRepo,
    directorDecisionRepo,
  )

  return { svc, sessionRepo, messageRepo, invRepo, directorDecisionRepo }
}

describe('DiscussionService.sendUserMessage with Director integration', () => {
  it('saves Director decision record after each call', async () => {
    const director = new DefaultDirector()
    const { svc, sessionRepo, directorDecisionRepo } = makeService(director)
    await sessionRepo.save(makeSession())

    await svc.sendUserMessage('sess-1', '测试消息')
    const decisions = await directorDecisionRepo.findRecentBySessionId('sess-1')
    expect(decisions.length).toBeGreaterThanOrEqual(1)
  })

  it('creates pending invitation when Director decides invite_user', async () => {
    const inviteDirector = {
      decide: async () => ({
        decisionId: 'dec-inv',
        sessionId: 'sess-1',
        action: 'invite_user',
        reason: 'disagreement',
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo } = makeService(inviteDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-1', '我认为应该进攻')
    expect(result.pendingInvitation).toBeDefined()
    expect(result.pendingInvitation?.status).toBe('pending')
  })

  it('does not create invitation when Director decides continue', async () => {
    const continueDirector = {
      decide: async () => ({
        decisionId: 'dec-cont',
        sessionId: 'sess-1',
        action: 'continue',
        reason: 'keep going',
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo } = makeService(continueDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-1', '继续讨论')
    expect(result.pendingInvitation).toBeUndefined()
  })

  it('saves host event_candidate message when Director decides trigger_event', async () => {
    const eventDirector = {
      decide: async () => ({
        decisionId: 'dec-event',
        sessionId: 'sess-1',
        action: 'trigger_event',
        reason: 'tension detected',
        confidence: 0.7,
        eventCandidate: { type: 'face-slap' as const, reason: 'strong disagreement' },
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo, messageRepo } = makeService(eventDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-1', '触发事件')
    const messages = await messageRepo.findBySessionId('sess-1')
    const eventMsg = messages.find(m => m.metadata?.hostMessageKind === 'event_candidate')
    expect(eventMsg).toBeDefined()
  })

  it('does not duplicate invitation when pending invitation already exists', async () => {
    const invRepo = new MockInvitationRepository()
    await invRepo.save({
      invitationId: 'inv-existing',
      sessionId: 'sess-1',
      status: 'pending',
      prompt: '请参与',
      reason: 'existing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Director contract: must not return invite_user when pending exists
    const continueDirector = {
      decide: async () => ({
        decisionId: 'dec-cont',
        sessionId: 'sess-1',
        action: 'continue',
        reason: 'pending invitation exists',
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo } = makeService(continueDirector as any, invRepo)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-1', '继续')
    const pending = await invRepo.findPendingBySessionId('sess-1')
    expect(pending!.invitationId).toBe('inv-existing')
  })

  it('returns DIRECTOR_DECISION_FAILED when director throws', async () => {
    const failingDirector = {
      decide: async () => { throw new Error('director broken') },
    }
    const { svc, sessionRepo } = makeService(failingDirector as any)
    await sessionRepo.save(makeSession())

    await expect(svc.sendUserMessage('sess-1', '测试')).rejects.toThrow()
  })

  it('returns SendMessageResult with directorDecision field', async () => {
    const director = new DefaultDirector()
    const { svc, sessionRepo } = makeService(director)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-1', '测试')
    expect(result.directorDecision).toBeDefined()
    expect(result.directorDecision?.action).toBeTruthy()
  })
})
