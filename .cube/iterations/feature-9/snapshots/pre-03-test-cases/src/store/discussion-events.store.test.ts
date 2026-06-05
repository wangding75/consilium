import { describe, it, expect } from 'vitest'
import {
  discussionReducer,
  type DiscussionStoreState,
  type DiscussionAction,
} from './discussion.store'
import type { EventRecord, VoteRecord, VotePayload, DiscussionMessage } from '@/types'

const baseState: DiscussionStoreState = {
  sessions: {},
  messagesBySessionId: {},
  eventsBySessionId: {},
  votesBySessionId: {},
  pendingVoteByEventId: {},
  activeSpeakerBySessionId: {},
  loadingBySessionId: {},
  sendingByClientMessageId: {},
  typingBySessionId: {},
  typingSpeakerBySessionId: {},
  errorBySessionId: {},
  recognizingIntentBySessionId: {},
  intentErrorBySessionId: {},
  pendingCommandBySessionId: {},
  pendingInvitationBySessionId: {},
  summaryBySessionId: {},
  directorErrorBySessionId: {},
}

const makeVotePayload = (): VotePayload => ({
  question: '迁都何处',
  options: [
    { id: 'opt1', label: '许昌', roles: ['zgl'] },
    { id: 'opt2', label: '洛阳', roles: ['simayi'] },
  ],
  tally: { opt1: 0, opt2: 0 },
})

const makeEvent = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  eventId: 'evt-001',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '迁都投票',
  description: '请投票',
  reason: '用户触发',
  payload: makeVotePayload(),
  relatedMessageId: 'msg-001',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

const makeVote = (overrides: Partial<VoteRecord> = {}): VoteRecord => ({
  voteId: 'vote-001',
  sessionId: 's1',
  eventId: 'evt-001',
  voterType: 'user',
  voterId: 'current-user',
  optionId: 'opt1',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

const makeEventMessage = (): DiscussionMessage => ({
  messageId: 'msg-event-001',
  sessionId: 's1',
  type: 'host',
  content: '投票事件',
  status: 'completed',
  createdAt: '2026-06-01T00:00:00Z',
  metadata: { hostMessageKind: 'event', eventId: 'evt-001' },
})

describe('Task-10: EVENTS_LOADED reducer', () => {
  it('stores events indexed by sessionId', () => {
    const action: DiscussionAction = {
      type: 'EVENTS_LOADED',
      sessionId: 's1',
      events: [makeEvent()],
      votes: [makeVote()],
    }
    const state = discussionReducer(baseState, action)
    expect(state.eventsBySessionId['s1']).toHaveLength(1)
    expect(state.eventsBySessionId['s1'][0].eventId).toBe('evt-001')
  })

  it('stores votes indexed by sessionId', () => {
    const action: DiscussionAction = {
      type: 'EVENTS_LOADED',
      sessionId: 's1',
      events: [],
      votes: [makeVote()],
    }
    const state = discussionReducer(baseState, action)
    expect(state.votesBySessionId['s1']).toHaveLength(1)
  })

  it('replaces existing events for session on reload', () => {
    const preState: DiscussionStoreState = {
      ...baseState,
      eventsBySessionId: { s1: [makeEvent({ eventId: 'evt-old' })] },
    }
    const action: DiscussionAction = {
      type: 'EVENTS_LOADED',
      sessionId: 's1',
      events: [makeEvent({ eventId: 'evt-new' })],
      votes: [],
    }
    const state = discussionReducer(preState, action)
    expect(state.eventsBySessionId['s1']).toHaveLength(1)
    expect(state.eventsBySessionId['s1'][0].eventId).toBe('evt-new')
  })
})

describe('Task-10: EVENT_CREATED reducer', () => {
  it('appends new event to session events', () => {
    const action: DiscussionAction = {
      type: 'EVENT_CREATED',
      sessionId: 's1',
      event: makeEvent(),
      message: makeEventMessage(),
    }
    const state = discussionReducer(baseState, action)
    expect(state.eventsBySessionId['s1']).toHaveLength(1)
    expect(state.eventsBySessionId['s1'][0].eventId).toBe('evt-001')
  })

  it('also adds event message to messagesBySessionId', () => {
    const action: DiscussionAction = {
      type: 'EVENT_CREATED',
      sessionId: 's1',
      event: makeEvent(),
      message: makeEventMessage(),
    }
    const state = discussionReducer(baseState, action)
    expect(state.messagesBySessionId['s1']).toHaveLength(1)
    expect(state.messagesBySessionId['s1'][0].messageId).toBe('msg-event-001')
  })
})

describe('Task-10: VOTE_OPTIMISTIC reducer', () => {
  it('sets pendingVoteByEventId for event', () => {
    const action: DiscussionAction = {
      type: 'VOTE_OPTIMISTIC',
      eventId: 'evt-001',
    }
    const state = discussionReducer(baseState, action)
    expect(state.pendingVoteByEventId['evt-001']).toBe(true)
  })
})

describe('Task-10: VOTE_SUBMITTED reducer', () => {
  it('clears pendingVoteByEventId', () => {
    const preState: DiscussionStoreState = {
      ...baseState,
      pendingVoteByEventId: { 'evt-001': true },
      eventsBySessionId: { s1: [makeEvent()] },
      votesBySessionId: { s1: [] },
    }
    const updatedEvent = makeEvent({
      payload: { ...makeVotePayload(), tally: { opt1: 1, opt2: 0 } },
    })
    const action: DiscussionAction = {
      type: 'VOTE_SUBMITTED',
      sessionId: 's1',
      event: updatedEvent,
      vote: makeVote(),
    }
    const state = discussionReducer(preState, action)
    expect(state.pendingVoteByEventId['evt-001']).toBeFalsy()
  })

  it('updates event in eventsBySessionId with server response', () => {
    const preState: DiscussionStoreState = {
      ...baseState,
      pendingVoteByEventId: { 'evt-001': true },
      eventsBySessionId: { s1: [makeEvent()] },
      votesBySessionId: { s1: [] },
    }
    const updatedEvent = makeEvent({
      payload: { ...makeVotePayload(), tally: { opt1: 1, opt2: 0 } },
    })
    const action: DiscussionAction = {
      type: 'VOTE_SUBMITTED',
      sessionId: 's1',
      event: updatedEvent,
      vote: makeVote(),
    }
    const state = discussionReducer(preState, action)
    const evt = state.eventsBySessionId['s1'].find((e) => e.eventId === 'evt-001')
    expect((evt!.payload as VotePayload).tally['opt1']).toBe(1)
  })

  it('adds vote record to votesBySessionId', () => {
    const preState: DiscussionStoreState = {
      ...baseState,
      pendingVoteByEventId: { 'evt-001': true },
      eventsBySessionId: { s1: [makeEvent()] },
      votesBySessionId: { s1: [] },
    }
    const action: DiscussionAction = {
      type: 'VOTE_SUBMITTED',
      sessionId: 's1',
      event: makeEvent(),
      vote: makeVote(),
    }
    const state = discussionReducer(preState, action)
    expect(state.votesBySessionId['s1']).toHaveLength(1)
  })
})

describe('Task-10: VOTE_FAILED reducer', () => {
  it('clears pendingVoteByEventId on failure', () => {
    const preState: DiscussionStoreState = {
      ...baseState,
      pendingVoteByEventId: { 'evt-001': true },
    }
    const action: DiscussionAction = {
      type: 'VOTE_FAILED',
      sessionId: 's1',
      eventId: 'evt-001',
      error: { code: 'NETWORK_ERROR', message: '网络错误' },
    }
    const state = discussionReducer(preState, action)
    expect(state.pendingVoteByEventId['evt-001']).toBeFalsy()
  })
})

describe('Task-14: MESSAGE_SENT merges event messages', () => {
  it('adds eventMessages from sendMessage response to messagesBySessionId', () => {
    const eventMsg = makeEventMessage()
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 's1',
      clientMessageId: 'client-001',
      userMessage: null,
      agentMessages: [],
      eventMessages: [eventMsg],
      createdEvents: [makeEvent()],
      activeSpeakerId: null,
    }
    const state = discussionReducer(baseState, action)
    const messages = state.messagesBySessionId['s1']
    expect(messages.some((m) => m.messageId === 'msg-event-001')).toBe(true)
  })

  it('adds createdEvents from sendMessage response to eventsBySessionId', () => {
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 's1',
      clientMessageId: 'client-001',
      userMessage: null,
      agentMessages: [],
      eventMessages: [],
      createdEvents: [makeEvent()],
      activeSpeakerId: null,
    }
    const state = discussionReducer(baseState, action)
    expect(state.eventsBySessionId['s1']).toHaveLength(1)
  })

  it('does not duplicate event messages already in messagesBySessionId', () => {
    const eventMsg = makeEventMessage()
    const preState: DiscussionStoreState = {
      ...baseState,
      messagesBySessionId: { s1: [eventMsg] },
    }
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 's1',
      clientMessageId: 'client-001',
      userMessage: null,
      agentMessages: [],
      eventMessages: [eventMsg],
      createdEvents: [],
      activeSpeakerId: null,
    }
    const state = discussionReducer(preState, action)
    const count = state.messagesBySessionId['s1'].filter(
      (m) => m.messageId === 'msg-event-001'
    ).length
    expect(count).toBe(1)
  })
})
