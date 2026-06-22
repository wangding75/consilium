import { describe, it, expect } from 'vitest'
import { DefaultDirector } from '@/engine/director'
import type { DirectorInput, EventRecord, Session, VotePayload } from '@/types'

function makeSession(overrides: Partial<Session['state']> = {}): Session {
  return {
    id: 's1',
    templateId: 'three-kingdoms',
    topic: '三国战略',
    status: 'active',
    state: { stage: 'developing', turnCount: 5, lastSpeakerId: null, ...overrides },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeVoteEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  const votePayload: VotePayload = {
    question: '迁都何处',
    options: [
      { id: 'opt1', label: '许昌', roles: ['zgl'] },
      { id: 'opt2', label: '洛阳', roles: ['simayi'] },
    ],
    tally: { opt1: 2, opt2: 1 },
  }
  return {
    eventId: 'evt-001',
    sessionId: 's1',
    eventType: 'vote',
    trigger: 'manual',
    status: 'closed',
    title: '迁都投票',
    description: '请投票',
    reason: '用户触发',
    payload: votePayload,
    relatedMessageId: 'msg-001',
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeSlapEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    eventId: 'evt-slap-001',
    sessionId: 's1',
    eventType: 'slap',
    trigger: 'auto',
    status: 'active',
    title: '诸葛亮反驳关羽',
    description: '观点被反驳',
    reason: '检测到反驳',
    payload: { refuter: 'zgl', refuted: 'gy', refutedView: '北伐', reason: '兵力不足' },
    relatedMessageId: 'msg-002',
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeBaseInput(overrides: Partial<DirectorInput> = {}): DirectorInput {
  return {
    session: makeSession(),
    messages: [],
    roles: [],
    trigger: 'auto',
    recentEvents: [],
    ...overrides,
  }
}

describe('Task-15: DefaultDirector — unconsumed vote event → preferredAgentType=host', () => {
  it('returns preferredAgentType=host when unconsumed vote event is present', async () => {
    const director = new DefaultDirector()
    const voteEvent = makeVoteEvent({ directorConsumedAt: undefined })
    const input = makeBaseInput({ recentEvents: [voteEvent] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.preferredAgentType).toBe('host')
  })

  it('sets reason to event title in schedulerHint', async () => {
    const director = new DefaultDirector()
    const voteEvent = makeVoteEvent({ directorConsumedAt: undefined })
    const input = makeBaseInput({ recentEvents: [voteEvent] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.reason).toBe('迁都投票')
  })

  it('does not set preferredAgentType when all events are consumed', async () => {
    const director = new DefaultDirector()
    const consumedEvent = makeVoteEvent({ directorConsumedAt: '2026-06-01T00:01:00Z' })
    const input = makeBaseInput({ recentEvents: [consumedEvent] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.preferredAgentType).toBeUndefined()
  })
})

describe('Task-15: DefaultDirector — slap event unconsumed → preferredAgentType=host', () => {
  it('returns preferredAgentType=host for unconsumed slap event', async () => {
    const director = new DefaultDirector()
    const slapEvent = makeSlapEvent({ directorConsumedAt: undefined })
    const input = makeBaseInput({ recentEvents: [slapEvent] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.preferredAgentType).toBe('host')
  })

  it('uses first unconsumed event when multiple events exist', async () => {
    const director = new DefaultDirector()
    const consumed = makeVoteEvent({ directorConsumedAt: '2026-06-01T00:01:00Z' })
    const unconsumed = makeSlapEvent({ directorConsumedAt: undefined })
    const input = makeBaseInput({ recentEvents: [consumed, unconsumed] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.reason).toBe('诸葛亮反驳关羽')
  })
})

describe('Task-15: DefaultDirector — no recentEvents → normal decision flow', () => {
  it('returns normal continue decision when recentEvents is empty', async () => {
    const director = new DefaultDirector()
    const input = makeBaseInput({ recentEvents: [] })
    const decision = await director.decide(input)
    expect(decision.schedulerHint?.preferredAgentType).toBeUndefined()
  })

  it('returns normal continue decision when recentEvents is undefined', async () => {
    const director = new DefaultDirector()
    const { recentEvents: _, ...inputWithoutEvents } = makeBaseInput()
    const decision = await director.decide(inputWithoutEvents as DirectorInput)
    expect(decision.schedulerHint?.preferredAgentType).toBeUndefined()
  })
})
