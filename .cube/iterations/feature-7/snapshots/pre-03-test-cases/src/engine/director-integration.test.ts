import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultDirector } from './director'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
import type { Session, DiscussionMessage, Template, AgentProfile, DirectorDecisionRecord } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-int',
    templateId: 'tpl-3k',
    topic: 'Director 确定性集成测试',
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
    sessionId: 'sess-int',
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
        messageId: 'msg-agent-int',
        sessionId: 'sess-int',
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

describe('Director deterministic rules: Director -> DiscussionService -> Repository chain', () => {
  const director = new DefaultDirector()

  it('continue: Director returns continue, no invitation created, decision saved', async () => {
    const continueDirector = {
      decide: async () => ({
        decisionId: 'dec-cont-int',
        sessionId: 'sess-int',
        action: 'continue',
        reason: 'keep going',
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo, invRepo, directorDecisionRepo } = makeService(continueDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-int', '继续讨论')
    expect(result.pendingInvitation).toBeUndefined()
    expect(result.directorDecision?.action).toBe('continue')

    const decisions = await directorDecisionRepo.findRecentBySessionId('sess-int')
    expect(decisions.length).toBeGreaterThanOrEqual(1)
    expect(decisions[0].action).toBe('continue')

    const pending = await invRepo.findPendingBySessionId('sess-int')
    expect(pending).toBeNull()
  })

  it('invite_user: Director returns invite_user, invitation created with pending status', async () => {
    const inviteDirector = {
      decide: async () => ({
        decisionId: 'dec-inv-int',
        sessionId: 'sess-int',
        action: 'invite_user',
        reason: 'disagreement detected',
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo, invRepo, directorDecisionRepo } = makeService(inviteDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-int', '我认为应该进攻')
    expect(result.pendingInvitation).toBeDefined()
    expect(result.pendingInvitation?.status).toBe('pending')

    const pending = await invRepo.findPendingBySessionId('sess-int')
    expect(pending).toBeDefined()
    expect(pending!.status).toBe('pending')

    const decisions = await directorDecisionRepo.findRecentBySessionId('sess-int')
    expect(decisions[0].action).toBe('invite_user')
  })

  it('trigger_event: Director returns trigger_event, event_candidate message saved in repository', async () => {
    const eventDirector = {
      decide: async () => ({
        decisionId: 'dec-event-int',
        sessionId: 'sess-int',
        action: 'trigger_event',
        reason: 'dramatic tension',
        confidence: 0.7,
        eventCandidate: { type: 'face-slap' as const, reason: 'strong disagreement' },
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo, messageRepo, directorDecisionRepo } = makeService(eventDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-int', '触发事件')
    expect(result.directorDecision?.action).toBe('trigger_event')

    const messages = await messageRepo.findBySessionId('sess-int')
    const eventMsg = messages.find(m => m.metadata?.hostMessageKind === 'event_candidate')
    expect(eventMsg).toBeDefined()

    const decisions = await directorDecisionRepo.findRecentBySessionId('sess-int')
    expect(decisions[0].action).toBe('trigger_event')
  })

  it('conclude: Director returns conclude, summary hint preserved in decision record', async () => {
    const concludeDirector = {
      decide: async () => ({
        decisionId: 'dec-conc-int',
        sessionId: 'sess-int',
        action: 'conclude',
        reason: 'closing stage reached',
        confidence: 0.9,
        summaryHint: { topics: ['战略', '联盟'], consensusLevel: 'partial' },
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo, directorDecisionRepo } = makeService(concludeDirector as any)
    await sessionRepo.save(makeSession())

    const result = await svc.sendUserMessage('sess-int', '总结一下')
    expect(result.directorDecision?.action).toBe('conclude')

    const decisions = await directorDecisionRepo.findRecentBySessionId('sess-int')
    expect(decisions[0].action).toBe('conclude')
    expect(decisions[0].summaryHint).toBeDefined()
  })

  it('no duplicate invite_user when pending invitation exists in repository', async () => {
    const invRepo = new MockInvitationRepository()
    await invRepo.save({
      invitationId: 'inv-existing-int',
      sessionId: 'sess-int',
      status: 'pending',
      prompt: '请参与',
      reason: 'existing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const inviteDirector = {
      decide: async () => ({
        decisionId: 'dec-inv-dup',
        sessionId: 'sess-int',
        action: 'continue',
        reason: 'pending invitation exists',
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      }),
    }
    const { svc, sessionRepo } = makeService(inviteDirector as any, invRepo)
    await sessionRepo.save(makeSession())

    await svc.sendUserMessage('sess-int', '继续')
    const pending = await invRepo.findPendingBySessionId('sess-int')
    expect(pending!.invitationId).toBe('inv-existing-int')
  })

  it('Director decision failure propagates across component boundary', async () => {
    const failingDirector = {
      decide: async () => { throw new Error('director broken') },
    }
    const { svc, sessionRepo } = makeService(failingDirector as any)
    await sessionRepo.save(makeSession())

    await expect(svc.sendUserMessage('sess-int', '测试')).rejects.toThrow()
  })

  it('all four action types produce valid DirectorDecisionRecord shape', async () => {
    const actions = ['continue', 'invite_user', 'trigger_event', 'conclude'] as const
    for (const action of actions) {
      const stubDirector = {
        decide: async () => ({
          decisionId: `dec-${action}-int`,
          sessionId: 'sess-int',
          action,
          reason: `test ${action}`,
          confidence: 0.8,
          ...(action === 'trigger_event' ? { eventCandidate: { type: 'face-slap' as const, reason: 'test' } } : {}),
          ...(action === 'conclude' ? { summaryHint: { topics: ['test'], consensusLevel: 'partial' as const } } : {}),
          createdAt: new Date().toISOString(),
        }),
      }
      const { svc, sessionRepo, directorDecisionRepo } = makeService(stubDirector as any)
      await sessionRepo.save(makeSession())

      await svc.sendUserMessage('sess-int', `trigger ${action}`)
      const decisions = await directorDecisionRepo.findRecentBySessionId('sess-int')
      expect(decisions.length).toBeGreaterThanOrEqual(1)
      const record = decisions[0]
      expect(record.decisionId).toBeTruthy()
      expect(record.sessionId).toBe('sess-int')
      expect(record.action).toBe(action)
      expect(record.reason).toBeTruthy()
      expect(record.confidence).toBeGreaterThanOrEqual(0)
      expect(record.confidence).toBeLessThanOrEqual(1)
      expect(record.createdAt).toBeTruthy()
    }
  })
})
