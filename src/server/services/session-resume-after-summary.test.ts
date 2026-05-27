import { describe, it, expect, beforeEach } from 'vitest'
import { SessionService } from './session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import type { Session, DiscussionMessage } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

class MockTemplateRepoWithSave {
  private templates = [{ ...threeKingdomsTemplate, id: 'tpl-3k' }]
  async findAll() { return this.templates }
  async findById(id: string) { return this.templates.find(t => t.id === id) ?? null }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    templateId: 'tpl-3k',
    topic: '测试',
    status: 'completed',
    state: {
      stage: 'closing',
      turnCount: 10,
      lastSpeakerId: 'role-1',
      history: [
        { from: 'developing', to: 'climax', reason: 'natural transition', createdAt: '2026-01-01T00:00:00.000Z' },
        { from: 'climax', to: 'closing', reason: 'summary triggered', createdAt: '2026-01-02T00:00:00.000Z' },
      ],
    },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeSummaryMessage(): DiscussionMessage {
  return {
    messageId: 'msg-summary',
    sessionId: 'sess-1',
    type: 'host',
    content: '总结内容',
    status: 'completed',
    createdAt: new Date().toISOString(),
    metadata: {
      hostMessageKind: 'final_summary',
      summary: {
        summaryId: 'sum-1',
        sessionId: 'sess-1',
        messageId: 'msg-summary',
        consensus: ['一致'],
        disagreements: [],
        recommendations: [],
        nextSteps: [],
        checkpointCreatedAt: new Date().toISOString(),
      },
    },
  }
}

describe('SessionService.updateSessionStatus resume after summary', () => {
  let service: SessionService
  let sessionRepo: MockSessionRepository
  let messageRepo: MockMessageRepository

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    messageRepo = new MockMessageRepository()
    service = new SessionService(
      sessionRepo,
      new MockTemplateRepoWithSave() as any,
    )
  })

  it('throws SESSION_NOT_FOUND for non-existent session', async () => {
    await expect(service.updateSessionStatus('nonexistent', 'resume'))
      .rejects.toThrow('SESSION_NOT_FOUND')
  })

  it('throws SESSION_NOT_RESUMABLE when session is not completed', async () => {
    await sessionRepo.save(makeSession({ status: 'running', state: { stage: 'developing', turnCount: 4, lastSpeakerId: null } }))
    await expect(service.updateSessionStatus('sess-1', 'resume'))
      .rejects.toThrow('SESSION_NOT_RESUMABLE')
  })

  it('throws SESSION_NOT_RESUMABLE when session is completed but stage is not closing', async () => {
    await sessionRepo.save(makeSession({ status: 'completed', state: { stage: 'developing', turnCount: 4, lastSpeakerId: null } }))
    await expect(service.updateSessionStatus('sess-1', 'resume'))
      .rejects.toThrow('SESSION_NOT_RESUMABLE')
  })

  it('throws SESSION_NOT_RESUMABLE when no summary checkpoint exists', async () => {
    await sessionRepo.save(makeSession({ status: 'completed', state: { stage: 'closing', turnCount: 10, lastSpeakerId: null } }))
    await expect(service.updateSessionStatus('sess-1', 'resume'))
      .rejects.toThrow('SESSION_NOT_RESUMABLE')
  })

  it('resumes completed+closing session with summary checkpoint to running/developing', async () => {
    await sessionRepo.save(makeSession())
    await messageRepo.save(makeSummaryMessage())

    const result = await service.updateSessionStatus('sess-1', 'resume')
    expect(result.status).toBe('running')
    expect(result.state.stage).toBe('developing')
  })

  it('preserves summary checkpoint after resume', async () => {
    await sessionRepo.save(makeSession())
    await messageRepo.save(makeSummaryMessage())

    await service.updateSessionStatus('sess-1', 'resume')
    const summaryMsg = await messageRepo.findById('msg-summary')
    expect(summaryMsg?.metadata?.summary).toBeDefined()
    expect(summaryMsg?.metadata?.summary?.summaryId).toBe('sum-1')
  })

  it('does not delete summary message after resume', async () => {
    await sessionRepo.save(makeSession())
    await messageRepo.save(makeSummaryMessage())

    await service.updateSessionStatus('sess-1', 'resume')
    const msg = await messageRepo.findById('msg-summary')
    expect(msg).not.toBeNull()
    expect(msg!.content).toBe('总结内容')
  })

  it('does not create a new session on resume', async () => {
    await sessionRepo.save(makeSession())
    await messageRepo.save(makeSummaryMessage())

    const result = await service.updateSessionStatus('sess-1', 'resume')
    expect(result.id).toBe('sess-1')
  })

  it('does not clear session history on resume', async () => {
    await sessionRepo.save(makeSession())
    await messageRepo.save(makeSummaryMessage())

    const result = await service.updateSessionStatus('sess-1', 'resume')
    expect(result.state.history!.length).toBeGreaterThanOrEqual(2)
  })
})
