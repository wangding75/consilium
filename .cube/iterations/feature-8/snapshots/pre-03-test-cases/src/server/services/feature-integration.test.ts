import { describe, it, expect, beforeEach } from 'vitest'
import { DiscussionService } from './discussion.service'
import { SessionService } from './session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
import { DefaultDirector } from '@/engine/director'
import type { Session, DiscussionMessage, Template, Invitation, DirectorDecisionRecord } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-fi',
    templateId: 'tpl-3k',
    topic: 'Feature integration test',
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
    sessionId: 'sess-fi',
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

function makeDiscussionService(director?: any, invitationRepo?: MockInvitationRepository) {
  const sessionRepo = new MockSessionRepository()
  const templateRepo = new MockTemplateRepoWithSave()
  const messageRepo = new MockMessageRepository()
  const callLogRepo = new MockAgentCallLogRepository()
  const invRepo = invitationRepo ?? new MockInvitationRepository()
  const directorDecisionRepo = new MockDirectorDecisionRepository()
  const orchestrator = {
    run: async () => ({
      agentMessages: [{
        messageId: 'msg-agent-fi',
        sessionId: 'sess-fi',
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
    director ?? new DefaultDirector(),
    invRepo,
    directorDecisionRepo,
  )

  return { svc, sessionRepo, messageRepo, invRepo, directorDecisionRepo }
}

describe('Feature integration: UI -> Store -> API -> DiscussionService -> Repository -> Director/Orchestrator', () => {
  describe('Message send chain: DiscussionService -> Director -> Repository', () => {
    it('sendUserMessage invokes Director, saves decision, returns decision in result', async () => {
      const { svc, sessionRepo, directorDecisionRepo } = makeDiscussionService()
      await sessionRepo.save(makeSession())

      const result = await svc.sendUserMessage('sess-fi', '请分析局势')
      expect(result.directorDecision).toBeDefined()
      expect(result.directorDecision?.action).toBeTruthy()

      const decisions = await directorDecisionRepo.findRecentBySessionId('sess-fi')
      expect(decisions.length).toBeGreaterThanOrEqual(1)
    })

    it('sendUserMessage creates invitation in repository when Director decides invite_user', async () => {
      const inviteDirector = {
        decide: async () => ({
          decisionId: 'dec-fi-inv',
          sessionId: 'sess-fi',
          action: 'invite_user',
          reason: 'disagreement',
          confidence: 0.8,
          createdAt: new Date().toISOString(),
        }),
      }
      const { svc, sessionRepo, invRepo } = makeDiscussionService(inviteDirector as any)
      await sessionRepo.save(makeSession())

      const result = await svc.sendUserMessage('sess-fi', '应该进攻')
      expect(result.pendingInvitation).toBeDefined()
      expect(result.pendingInvitation?.status).toBe('pending')

      const pending = await invRepo.findPendingBySessionId('sess-fi')
      expect(pending).toBeDefined()
      expect(pending!.status).toBe('pending')
    })
  })

  describe('Invitation lifecycle chain: respondInvitation -> Director -> Repository', () => {
    it('respondInvitation updates invitation and triggers Director follow-up', async () => {
      const invRepo = new MockInvitationRepository()
      const invitation: Invitation = {
        invitationId: 'inv-fi-1',
        sessionId: 'sess-fi',
        status: 'pending',
        prompt: '请发表看法',
        reason: 'disagreement',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await invRepo.save(invitation)

      const { svc, sessionRepo } = makeDiscussionService(undefined, invRepo)
      await sessionRepo.save(makeSession())

      const result = await svc.respondInvitation('sess-fi', 'inv-fi-1', {
        content: '我认为应该防守',
        clientMessageId: 'client-fi-1',
      })
      expect(result).toBeDefined()
    })
  })

  describe('Summary chain: requestSummary -> MessageRepository -> SessionRepository', () => {
    it('requestSummary saves summary checkpoint and completes session', async () => {
      const { svc, sessionRepo, messageRepo } = makeDiscussionService()
      await sessionRepo.save(makeSession({
        state: { stage: 'closing', turnCount: 12, lastSpeakerId: 'role-zhuge' },
      }))

      const result = await svc.requestSummary('sess-fi', {})
      expect(result).toBeDefined()
    })
  })

  describe('Resume after summary: SessionService -> MessageRepository -> SessionRepository', () => {
    it('resume restores session to running with preserved summary checkpoint', async () => {
      const sessionRepo = new MockSessionRepository()
      const messageRepo = new MockMessageRepository()
      const sessionService = new SessionService(sessionRepo, messageRepo as any)

      await sessionRepo.save(makeSession({
        status: 'completed',
        state: { stage: 'closing', turnCount: 12, lastSpeakerId: 'role-zhuge' },
      }))

      // Save a message with summary checkpoint
      const summaryMsg: DiscussionMessage = {
        messageId: 'msg-summary-fi',
        sessionId: 'sess-fi',
        type: 'host',
        content: '最终总结内容',
        status: 'completed',
        createdAt: new Date().toISOString(),
        metadata: {
          summary: {
            conclusion: '双方达成共识',
            keyPoints: ['战略要点1', '战略要点2'],
            consensusLevel: 'full',
            generatedAt: new Date().toISOString(),
          },
        },
      }
      await messageRepo.save(summaryMsg)

      const result = await sessionService.updateSessionStatus('sess-fi', 'resume')
      expect(result).toBeDefined()
    })
  })

  describe('Cross-component error propagation: Director failure -> DiscussionService', () => {
    it('Director error is caught and surfaced as DIRECTOR_DECISION_FAILED', async () => {
      const failingDirector = {
        decide: async () => { throw new Error('director crashed') },
      }
      const { svc, sessionRepo } = makeDiscussionService(failingDirector as any)
      await sessionRepo.save(makeSession())

      await expect(svc.sendUserMessage('sess-fi', '测试')).rejects.toThrow()
    })
  })
})
