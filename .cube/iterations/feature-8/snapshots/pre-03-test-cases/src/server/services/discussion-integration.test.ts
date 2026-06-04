/**
 * integration: EventDetector → EventRateLimiter → DiscussionService.sendMessage → Director event consumption
 *
 * This test file verifies the full chain:
 *   sendMessage → orchestrator → eventDetector → rateLimiter → eventRepo → director.recentEvents
 *
 * Annotated: web-e2e
 * Label: integration test：EventDetector/RateLimiter/DiscussionService/Director chain
 */
import { describe, it, expect, vi } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import { DefaultDirector } from '@/engine/director'
import type { EventDetector, EventRateLimiter } from '@/engine/events'
import type { EventDetectionResult, Session, DiscussionMessage, OrchestratorResult } from '@/types'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'

function makeSession(): Omit<Session, 'id'> {
  return {
    templateId: 'three-kingdoms',
    topic: '三国战略',
    status: 'active',
    state: { stage: 'developing', turnCount: 5, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeOrchestratorResult(sessionId: string): OrchestratorResult {
  const msg: DiscussionMessage = {
    messageId: 'agent-msg-1',
    sessionId,
    type: 'character',
    roleId: 'zhuge-liang',
    content: '我反对这个观点',
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
  return { agentMessages: [msg], callLogs: [], activeSpeakerId: 'zhuge-liang' }
}

describe('integration: EventDetector + RateLimiter → DiscussionService.sendMessage creates event', () => {
  it('event is persisted to eventRepo when detector triggers and rateLimiter allows', async () => {
    const sessionRepo = new MockSessionRepository()
    const messageRepo = new MockMessageRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()
    const discussionRepo = new MockDiscussionRepository()
    const templateRepo = new MockTemplateRepository()

    const session = await sessionRepo.save({ id: '', ...makeSession() })

    const orchestrator: DiscussionOrchestrator = {
      run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id)),
    } as unknown as DiscussionOrchestrator

    const detector: EventDetector = {
      detect: vi.fn().mockResolvedValue({
        eventTriggered: true,
        eventType: 'slap',
        confidence: 0.85,
        reason: '检测到反驳',
        title: '诸葛亮反驳司马懿',
        description: '观点被明显推翻',
        payload: { refuter: 'zgl', refuted: 'smy', refutedView: '持久战', reason: '兵力不足' },
        relatedMessageId: 'agent-msg-1',
      } as EventDetectionResult),
    }

    const rateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: true }),
    }

    const service = new DiscussionService(
      discussionRepo, sessionRepo, templateRepo, messageRepo,
      undefined, orchestrator, undefined, undefined, undefined,
      undefined, eventRepo, voteRepo, detector, rateLimiter
    )

    const result = await service.sendMessage(session.id, { content: '这不可能成功' })

    const events = await eventRepo.findBySessionId(session.id)
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('slap')
    expect(result.createdEvents).toHaveLength(1)
  })

  it('no event persisted when rateLimiter blocks due to cooldown', async () => {
    const sessionRepo = new MockSessionRepository()
    const messageRepo = new MockMessageRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()
    const discussionRepo = new MockDiscussionRepository()
    const templateRepo = new MockTemplateRepository()

    const session = await sessionRepo.save({ id: '', ...makeSession() })

    const orchestrator: DiscussionOrchestrator = {
      run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id)),
    } as unknown as DiscussionOrchestrator

    const detector: EventDetector = {
      detect: vi.fn().mockResolvedValue({
        eventTriggered: true,
        eventType: 'slap',
        confidence: 0.9,
        reason: '强烈反驳',
        title: '打脸',
        description: '描述',
        payload: { refuter: 'a', refuted: 'b', refutedView: 'v', reason: 'r' },
        relatedMessageId: 'agent-msg-1',
      } as EventDetectionResult),
    }

    const rateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: false, reason: 'COOLDOWN' }),
    }

    const service = new DiscussionService(
      discussionRepo, sessionRepo, templateRepo, messageRepo,
      undefined, orchestrator, undefined, undefined, undefined,
      undefined, eventRepo, voteRepo, detector, rateLimiter
    )

    await service.sendMessage(session.id, { content: '反对' })

    const events = await eventRepo.findBySessionId(session.id)
    expect(events).toHaveLength(0)
  })
})

describe('integration: Director consumes recentEvents from eventRepo in service pipeline', () => {
  it('Director receives unconsumed events injected by service and returns schedulerHint', async () => {
    const sessionRepo = new MockSessionRepository()
    const messageRepo = new MockMessageRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()
    const discussionRepo = new MockDiscussionRepository()
    const templateRepo = new MockTemplateRepository()

    const session = await sessionRepo.save({ id: '', ...makeSession() })

    // Pre-populate an unconsumed event
    await eventRepo.save({
      eventId: 'evt-pre-001',
      sessionId: session.id,
      eventType: 'vote',
      trigger: 'manual',
      status: 'closed',
      title: '迁都投票结果',
      description: '投票已完成',
      reason: '用户触发',
      payload: { question: '迁都', options: [], tally: {} },
      relatedMessageId: 'msg-pre',
      createdAt: '2026-06-01T00:00:00Z',
    })

    const director = new DefaultDirector()
    const directorSpy = vi.spyOn(director, 'decide')

    const orchestrator: DiscussionOrchestrator = {
      run: vi.fn().mockResolvedValue(makeOrchestratorResult(session.id)),
    } as unknown as DiscussionOrchestrator

    const detector: EventDetector = {
      detect: vi.fn().mockResolvedValue({ eventTriggered: false, confidence: 0.1, reason: '无信号' }),
    }
    const rateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: true }),
    }

    const service = new DiscussionService(
      discussionRepo, sessionRepo, templateRepo, messageRepo,
      undefined, orchestrator, undefined, director, undefined,
      undefined, eventRepo, voteRepo, detector, rateLimiter
    )

    await service.sendMessage(session.id, { content: '继续讨论' })

    expect(directorSpy).toHaveBeenCalled()
    const callArg = directorSpy.mock.calls[0][0]
    expect(callArg.recentEvents).toBeDefined()
    expect(callArg.recentEvents!.length).toBeGreaterThanOrEqual(1)
    const unconsumed = callArg.recentEvents!.find((e) => e.eventId === 'evt-pre-001')
    expect(unconsumed).toBeDefined()
  })
})
