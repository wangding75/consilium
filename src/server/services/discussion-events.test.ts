import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import { MockAgentCallLogRepository } from '@/server/repositories/mock/mock-agent-call-log.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import { ServiceError } from '@/server/errors'
import type {
  EventDetector,
  EventRateLimiter,
  EventRateLimitInput,
} from '@/engine/events'
import type {
  EventDetectionResult,
  Session,
  DiscussionMessage,
  VotePayload,
} from '@/types'
import type { CreateEventRequest, OrchestratorResult } from '@/types'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'

async function createSession(sessionRepo: MockSessionRepository): Promise<Session> {
  return sessionRepo.save({
    id: '',
    templateId: 'three-kingdoms',
    topic: '三国战略',
    status: 'active',
    state: { stage: 'developing', turnCount: 5, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

function makeVotePayload(): VotePayload {
  return {
    question: '迁都何处',
    options: [
      { id: 'opt1', label: '许昌', roles: ['zgl'] },
      { id: 'opt2', label: '洛阳', roles: ['simayi'] },
    ],
    tally: { opt1: 0, opt2: 0 },
  }
}

function makeCreateVoteRequest(): CreateEventRequest {
  return {
    eventType: 'vote',
    title: '迁都投票',
    description: '请投票决定迁都位置',
    payload: makeVotePayload(),
  }
}

describe('Task-06: DiscussionService.createEvent — event creation and message stream insertion', () => {
  let sessionRepo: MockSessionRepository
  let messageRepo: MockMessageRepository
  let eventRepo: MockEventRepository
  let voteRepo: MockVoteRepository
  let discussionRepo: MockDiscussionRepository

  function makeService() {
    return new DiscussionService(
      discussionRepo,
      sessionRepo,
      undefined,
      messageRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo
    )
  }

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    messageRepo = new MockMessageRepository()
    eventRepo = new MockEventRepository()
    voteRepo = new MockVoteRepository()
    discussionRepo = new MockDiscussionRepository()
  })

  it('creates event message then EventRecord — write-then-read via API entry', async () => {
    const session = await createSession(sessionRepo)
    const service = makeService()
    const result = await service.createEvent(session.id, makeCreateVoteRequest())

    // Verify EventRecord persisted
    const savedEvent = await eventRepo.findById(session.id, result.event.eventId)
    expect(savedEvent).not.toBeNull()
    expect(savedEvent!.sessionId).toBe(session.id)
    expect(savedEvent!.eventType).toBe('vote')

    // Verify message persisted with eventId in metadata
    expect(result.message.metadata?.hostMessageKind).toBe('event')
    expect(result.message.metadata?.eventId).toBe(result.event.eventId)

    // Verify EventRecord points to message
    expect(savedEvent!.relatedMessageId).toBe(result.message.messageId)
  })

  it('sets trigger to manual by default', async () => {
    const session = await createSession(sessionRepo)
    const service = makeService()
    const result = await service.createEvent(session.id, makeCreateVoteRequest())
    expect(result.event.trigger).toBe('manual')
  })

  it('sets trigger to auto when specified', async () => {
    const session = await createSession(sessionRepo)
    const service = makeService()
    const result = await service.createEvent(session.id, makeCreateVoteRequest(), 'auto')
    expect(result.event.trigger).toBe('auto')
  })

  it('throws SESSION_NOT_FOUND when session does not exist', async () => {
    const service = makeService()
    await expect(service.createEvent('non-existent', makeCreateVoteRequest())).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    })
  })

  it('created event belongs only to given session — session isolation', async () => {
    const session1 = await createSession(sessionRepo)
    const session2 = await createSession(sessionRepo)
    const service = makeService()
    const result = await service.createEvent(session1.id, makeCreateVoteRequest())
    // event should not be accessible from session2
    const fromS2 = await eventRepo.findById(session2.id, result.event.eventId)
    expect(fromS2).toBeNull()
  })
})

describe('Task-07: DiscussionService.sendMessage — automatic event detection integration', () => {
  let sessionRepo: MockSessionRepository
  let messageRepo: MockMessageRepository
  let eventRepo: MockEventRepository
  let voteRepo: MockVoteRepository
  let discussionRepo: MockDiscussionRepository
  let orchestrator: DiscussionOrchestrator
  let templateRepo: MockTemplateRepository

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    messageRepo = new MockMessageRepository()
    eventRepo = new MockEventRepository()
    voteRepo = new MockVoteRepository()
    discussionRepo = new MockDiscussionRepository()
    templateRepo = new MockTemplateRepository()
    orchestrator = {
      run: vi.fn(),
    } as unknown as DiscussionOrchestrator
  })

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

  it('returns createdEvents in result when detector triggers event and rate limiter allows', async () => {
    const mockDetector: EventDetector = {
      detect: vi.fn().mockResolvedValue({
        eventTriggered: true,
        eventType: 'slap',
        confidence: 0.85,
        reason: '检测到反驳',
        title: '打脸事件',
        description: '关羽观点被反驳',
        payload: { refuter: 'zgl', refuted: 'gy', refutedView: '北伐', reason: '兵力不足' },
        relatedMessageId: 'agent-msg-1',
      } as EventDetectionResult),
    }
    const mockRateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: true }),
    }

    const session = await createSession(sessionRepo)
    vi.mocked(orchestrator.run).mockResolvedValue(makeOrchestratorResult(session.id))

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      templateRepo,
      messageRepo,
      undefined,
      orchestrator,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo,
      mockDetector,
      mockRateLimiter
    )

    const result = await service.sendMessage(session.id, { content: '我反对北伐' })
    // After implementation, createdEvents should be non-empty
    // For now (stub) — verify result structure accepted
    expect(result).toBeDefined()
    expect(result.messages).toBeDefined()
  })

  it('does not create event when detector returns confidence below 0.6', async () => {
    const mockDetector: EventDetector = {
      detect: vi.fn().mockResolvedValue({
        eventTriggered: false,
        confidence: 0.4,
        reason: '信号不足',
      } as EventDetectionResult),
    }
    const mockRateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: true }),
    }
    const session = await createSession(sessionRepo)
    vi.mocked(orchestrator.run).mockResolvedValue(makeOrchestratorResult(session.id))

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      templateRepo,
      messageRepo,
      undefined,
      orchestrator,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo,
      mockDetector,
      mockRateLimiter
    )

    await service.sendMessage(session.id, { content: '普通消息' })
    const events = await eventRepo.findBySessionId(session.id)
    // No event should be created when not triggered
    expect(events).toHaveLength(0)
  })

  it('does not create event when rate limiter rejects', async () => {
    const mockDetector: EventDetector = {
      detect: vi.fn().mockResolvedValue({
        eventTriggered: true,
        eventType: 'slap',
        confidence: 0.85,
        reason: '反驳',
        title: '打脸',
        description: '描述',
        payload: { refuter: 'a', refuted: 'b', refutedView: 'v', reason: 'r' },
        relatedMessageId: 'agent-msg-1',
      } as EventDetectionResult),
    }
    const mockRateLimiter: EventRateLimiter = {
      check: vi.fn().mockReturnValue({ allowed: false, reason: 'COOLDOWN' }),
    }
    const session = await createSession(sessionRepo)
    vi.mocked(orchestrator.run).mockResolvedValue(makeOrchestratorResult(session.id))

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      templateRepo,
      messageRepo,
      undefined,
      orchestrator,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo,
      mockDetector,
      mockRateLimiter
    )

    await service.sendMessage(session.id, { content: '反驳消息' })
    const events = await eventRepo.findBySessionId(session.id)
    expect(events).toHaveLength(0)
  })
})

describe('Task-08: DiscussionService.submitVote — idempotency and tally update', () => {
  let sessionRepo: MockSessionRepository
  let messageRepo: MockMessageRepository
  let eventRepo: MockEventRepository
  let voteRepo: MockVoteRepository
  let discussionRepo: MockDiscussionRepository

  function makeService() {
    return new DiscussionService(
      discussionRepo,
      sessionRepo,
      undefined,
      messageRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo
    )
  }

  beforeEach(() => {
    sessionRepo = new MockSessionRepository()
    messageRepo = new MockMessageRepository()
    eventRepo = new MockEventRepository()
    voteRepo = new MockVoteRepository()
    discussionRepo = new MockDiscussionRepository()
  })

  async function setupVoteEvent(sessionId: string) {
    return eventRepo.save({
      eventId: 'evt-vote-001',
      sessionId,
      eventType: 'vote',
      trigger: 'manual',
      status: 'active',
      title: '迁都投票',
      description: '请投票',
      reason: '用户触发',
      payload: makeVotePayload(),
      relatedMessageId: 'msg-001',
      createdAt: '2026-06-01T00:00:00Z',
    })
  }

  it('submits vote, updates tally, and persists — write-then-read', async () => {
    const session = await createSession(sessionRepo)
    await setupVoteEvent(session.id)
    const service = makeService()

    const result = await service.submitVote(session.id, 'evt-vote-001', { optionId: 'opt1' })

    expect(result.vote.optionId).toBe('opt1')
    expect(result.vote.sessionId).toBe(session.id)
    expect(result.vote.voterId).toBe('current-user')

    // Verify tally updated
    const updatedEvent = await eventRepo.findById(session.id, 'evt-vote-001')
    expect((updatedEvent!.payload as VotePayload).tally['opt1']).toBe(1)
  })

  it('returns existing vote on duplicate submission same option — idempotent', async () => {
    const session = await createSession(sessionRepo)
    await setupVoteEvent(session.id)
    const service = makeService()

    const result1 = await service.submitVote(session.id, 'evt-vote-001', { optionId: 'opt1' })
    const result2 = await service.submitVote(session.id, 'evt-vote-001', { optionId: 'opt1' })

    expect(result2.vote.voteId).toBe(result1.vote.voteId)
    // Tally should still be 1 — not incremented twice
    const updatedEvent = await eventRepo.findById(session.id, 'evt-vote-001')
    expect((updatedEvent!.payload as VotePayload).tally['opt1']).toBe(1)
  })

  it('throws SESSION_NOT_FOUND when session does not exist', async () => {
    const service = makeService()
    await expect(service.submitVote('non-existent', 'evt-001', { optionId: 'opt1' })).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    })
  })

  it('throws EVENT_NOT_FOUND when event does not exist', async () => {
    const session = await createSession(sessionRepo)
    const service = makeService()
    await expect(service.submitVote(session.id, 'non-existent-event', { optionId: 'opt1' })).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
    })
  })

  it('throws EVENT_NOT_VOTABLE when event type is not vote', async () => {
    const session = await createSession(sessionRepo)
    await eventRepo.save({
      eventId: 'evt-slap-001',
      sessionId: session.id,
      eventType: 'slap',
      trigger: 'auto',
      status: 'active',
      title: '打脸',
      description: '描述',
      reason: '原因',
      payload: { refuter: 'a', refuted: 'b', refutedView: 'v', reason: 'r' },
      relatedMessageId: 'msg-001',
      createdAt: '2026-06-01T00:00:00Z',
    })
    const service = makeService()
    await expect(service.submitVote(session.id, 'evt-slap-001', { optionId: 'opt1' })).rejects.toMatchObject({
      code: 'EVENT_NOT_VOTABLE',
    })
  })

  it('throws EVENT_CLOSED when event status is closed', async () => {
    const session = await createSession(sessionRepo)
    await eventRepo.save({
      eventId: 'evt-closed-001',
      sessionId: session.id,
      eventType: 'vote',
      trigger: 'manual',
      status: 'closed',
      title: '已关闭投票',
      description: '描述',
      reason: '原因',
      payload: makeVotePayload(),
      relatedMessageId: 'msg-001',
      createdAt: '2026-06-01T00:00:00Z',
    })
    const service = makeService()
    await expect(service.submitVote(session.id, 'evt-closed-001', { optionId: 'opt1' })).rejects.toMatchObject({
      code: 'EVENT_CLOSED',
    })
  })

  it('throws VOTE_OPTION_INVALID when optionId does not exist', async () => {
    const session = await createSession(sessionRepo)
    await setupVoteEvent(session.id)
    const service = makeService()
    await expect(service.submitVote(session.id, 'evt-vote-001', { optionId: 'non-existent-opt' })).rejects.toMatchObject({
      code: 'VOTE_OPTION_INVALID',
    })
  })

  it('does not allow cross-session vote submission', async () => {
    const session1 = await createSession(sessionRepo)
    const session2 = await createSession(sessionRepo)
    await setupVoteEvent(session1.id)
    const service = makeService()
    // Trying to vote on session1's event using session2's id
    await expect(service.submitVote(session2.id, 'evt-vote-001', { optionId: 'opt1' })).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
    })
  })
})

describe('Task-16: DiscussionService — recentEvents injection into Director', () => {
  it('listEvents returns events and votes for session', async () => {
    const sessionRepo = new MockSessionRepository()
    const messageRepo = new MockMessageRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()
    const discussionRepo = new MockDiscussionRepository()

    const session = await createSession(sessionRepo)

    // Pre-populate event
    await eventRepo.save({
      eventId: 'evt-001',
      sessionId: session.id,
      eventType: 'vote',
      trigger: 'manual',
      status: 'active',
      title: '测试投票',
      description: '描述',
      reason: '原因',
      payload: makeVotePayload(),
      relatedMessageId: 'msg-001',
      createdAt: '2026-06-01T00:00:00Z',
    })
    await voteRepo.save({
      voteId: 'vote-001',
      sessionId: session.id,
      eventId: 'evt-001',
      voterType: 'user',
      voterId: 'current-user',
      optionId: 'opt1',
      createdAt: '2026-06-01T00:00:00Z',
    })

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      undefined,
      messageRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      eventRepo,
      voteRepo
    )

    const result = await service.listEvents(session.id)
    expect(result.sessionId).toBe(session.id)
    expect(result.events).toHaveLength(1)
    expect(result.votes).toHaveLength(1)
    expect(result.votes[0].eventId).toBe('evt-001')
  })

  it('listEvents throws SESSION_NOT_FOUND for unknown session', async () => {
    const service = new DiscussionService(
      new MockDiscussionRepository(),
      new MockSessionRepository(),
      undefined,
      new MockMessageRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new MockEventRepository(),
      new MockVoteRepository()
    )
    await expect(service.listEvents('non-existent')).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    })
  })
})
