import { describe, it, expect } from 'vitest'
import { DiscussionService } from './discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockInvitationRepository } from '@/server/repositories/mock/mock-invitation.repository'
import { MockDirectorDecisionRepository } from '@/server/repositories/mock/mock-director-decision.repository'
import type { Session, DiscussionMessage } from '@/types'
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
    topic: '赤壁之战',
    status: 'running',
    state: { stage: 'developing', turnCount: 8, lastSpeakerId: 'role-1' },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeMessages(count: number): DiscussionMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    messageId: `msg-${i}`,
    sessionId: 'sess-1',
    type: i % 2 === 0 ? 'character' as const : 'host' as const,
    content: `消息${i}`,
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
  }))
}

function makeService() {
  const sessionRepo = new MockSessionRepository()
  const messageRepo = new MockMessageRepository()
  const invRepo = new MockInvitationRepository()
  const directorDecisionRepo = new MockDirectorDecisionRepository()
  const concludeDirector = {
    decide: async () => ({
      decisionId: 'dec-conclude',
      sessionId: 'sess-1',
      action: 'conclude' as const,
      reason: 'sufficient coverage',
      confidence: 0.95,
      summaryHint: {
        reason: 'climax reached',
        sections: ['consensus', 'disagreements', 'recommendations', 'nextSteps'] as const,
      },
      createdAt: new Date().toISOString(),
    }),
  }

  const svc = new DiscussionService(
    { findAll: async () => [] } as any,
    sessionRepo,
    new MockTemplateRepoWithSave() as any,
    messageRepo,
    new MockAgentCallLogRepository(),
    undefined,
    undefined,
    concludeDirector as any,
    invRepo,
    directorDecisionRepo,
  )

  return { svc, sessionRepo, messageRepo, invRepo, directorDecisionRepo }
}

describe('DiscussionService.requestSummary', () => {
  it('throws SESSION_NOT_FOUND for non-existent session', async () => {
    const { svc } = makeService()
    await expect(svc.requestSummary('nonexistent', { source: 'more_sheet' }))
      .rejects.toThrow('SESSION_NOT_FOUND')
  })

  it('throws SESSION_NOT_OPERABLE for non-running session', async () => {
    const { svc, sessionRepo } = makeService()
    await sessionRepo.save(makeSession({ status: 'completed' }))
    await expect(svc.requestSummary('sess-1', { source: 'more_sheet' }))
      .rejects.toThrow('SESSION_NOT_OPERABLE')
  })

  it('throws INSUFFICIENT_CONTEXT when too few messages', async () => {
    const { svc, sessionRepo } = makeService()
    await sessionRepo.save(makeSession())
    await expect(svc.requestSummary('sess-1', { source: 'composer' }))
      .rejects.toThrow('INSUFFICIENT_CONTEXT')
  })

  it('generates summary and saves summary message', async () => {
    const { svc, sessionRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    // Seed messages
    for (const msg of makeMessages(6)) {
      await messageRepo.save(msg)
    }

    const result = await svc.requestSummary('sess-1', { source: 'more_sheet' })
    expect(result.summary).toBeDefined()
    expect(result.summary.consensus).toBeDefined()
    expect(result.summaryMessage).toBeDefined()
    expect(result.summaryMessage.metadata?.hostMessageKind).toBe('final_summary')
    expect(result.summaryMessage.metadata?.summary).toBeDefined()
  })

  it('sets session status to completed after successful summary', async () => {
    const { svc, sessionRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    for (const msg of makeMessages(6)) {
      await messageRepo.save(msg)
    }

    const result = await svc.requestSummary('sess-1', { source: 'more_sheet' })
    expect(result.sessionStatus).toBe('completed')
  })

  it('does not complete session when summary generation fails', async () => {
    const { svc, sessionRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    // Not enough messages - should fail before completing
    await expect(svc.requestSummary('sess-1', { source: 'auto' }))
      .rejects.toThrow()
    const session = await sessionRepo.findById('sess-1')
    expect(session!.status).toBe('running')
  })

  it('returns DirectorDecisionRecord with conclude action', async () => {
    const { svc, sessionRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    for (const msg of makeMessages(6)) {
      await messageRepo.save(msg)
    }

    const result = await svc.requestSummary('sess-1', { source: 'more_sheet' })
    expect(result.directorDecision.action).toBe('conclude')
  })

  it('preserves summary checkpoint in message metadata', async () => {
    const { svc, sessionRepo, messageRepo } = makeService()
    await sessionRepo.save(makeSession())
    for (const msg of makeMessages(6)) {
      await messageRepo.save(msg)
    }

    const result = await svc.requestSummary('sess-1', { source: 'more_sheet' })
    const savedMsg = await messageRepo.findById(result.summaryMessage.messageId)
    expect(savedMsg?.metadata?.summary?.summaryId).toBe(result.summary.summaryId)
  })
})
