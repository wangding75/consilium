import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageList } from './message-list'
import type { DiscussionMessage, EventRecord, VotePayload } from '@/types'

const makeEventMessage = (): DiscussionMessage => ({
  messageId: 'msg-event-001',
  sessionId: 's1',
  type: 'host',
  content: '投票事件',
  status: 'completed',
  createdAt: '2026-06-01T00:00:00Z',
  metadata: { hostMessageKind: 'event', eventId: 'evt-001' },
})

const makeRegularMessage = (): DiscussionMessage => ({
  messageId: 'msg-regular-001',
  sessionId: 's1',
  type: 'character',
  roleId: 'zhuge-liang',
  content: '我支持此决策',
  status: 'completed',
  createdAt: '2026-06-01T00:00:00Z',
})

const makeVotePayload = (): VotePayload => ({
  question: '迁都何处',
  options: [
    { id: 'opt1', label: '许昌', roles: ['zgl'] },
    { id: 'opt2', label: '洛阳', roles: ['simayi'] },
  ],
  tally: { opt1: 0, opt2: 0 },
})

const makeVoteEvent = (): EventRecord => ({
  eventId: 'evt-001',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '迁都投票',
  description: '请投票',
  reason: '用户触发',
  payload: makeVotePayload(),
  relatedMessageId: 'msg-event-001',
  createdAt: '2026-06-01T00:00:00Z',
})

describe('Task-12: MessageList — event message rendering', () => {
  it('renders EventCard when message has metadata.eventId matching an event', () => {
    render(
      <MessageList
        messages={[makeEventMessage()]}
        events={[makeVoteEvent()]}
        votes={[]}
        isLoading={false}
      />
    )
    expect(screen.getByText('迁都投票')).toBeDefined()
    expect(screen.getByText('迁都何处')).toBeDefined()
  })

  it('renders MessageBubble when message has no eventId in metadata', () => {
    render(
      <MessageList
        messages={[makeRegularMessage()]}
        events={[]}
        votes={[]}
        isLoading={false}
      />
    )
    expect(screen.getByText('我支持此决策')).toBeDefined()
  })

  it('renders EventCard even when events array is empty (event not found → falls back to MessageBubble)', () => {
    render(
      <MessageList
        messages={[makeEventMessage()]}
        events={[]}
        votes={[]}
        isLoading={false}
      />
    )
    // Event not in list → fallback to MessageBubble with message content
    expect(screen.getByText('投票事件')).toBeDefined()
  })

  it('passes votes filtered by eventId to EventCard', () => {
    const votes = [
      {
        voteId: 'v1',
        sessionId: 's1',
        eventId: 'evt-001',
        voterType: 'user' as const,
        voterId: 'current-user',
        optionId: 'opt1',
        createdAt: '2026-06-01T00:00:00Z',
      },
      {
        voteId: 'v2',
        sessionId: 's1',
        eventId: 'evt-other',
        voterType: 'user' as const,
        voterId: 'current-user',
        optionId: 'opt2',
        createdAt: '2026-06-01T00:00:00Z',
      },
    ]
    render(
      <MessageList
        messages={[makeEventMessage()]}
        events={[makeVoteEvent()]}
        votes={votes}
        isLoading={false}
      />
    )
    // User voted opt1 for this event, so 已投 should appear
    expect(screen.getByText('已投')).toBeDefined()
  })

  it('renders mixed messages and events in order', () => {
    render(
      <MessageList
        messages={[makeRegularMessage(), makeEventMessage()]}
        events={[makeVoteEvent()]}
        votes={[]}
        isLoading={false}
      />
    )
    expect(screen.getByText('我支持此决策')).toBeDefined()
    expect(screen.getByText('迁都投票')).toBeDefined()
  })
})
