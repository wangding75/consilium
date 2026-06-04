import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventCard } from '@/modules/discussion/event-card'
import type { EventRecord, VoteRecord } from '@/types'

const makeSlapEvent = (): EventRecord => ({
  eventId: 'evt-slap',
  sessionId: 's1',
  eventType: 'slap',
  trigger: 'auto',
  status: 'active',
  title: '打脸事件',
  description: '关羽的观点被反驳了',
  reason: '检测到反驳',
  payload: { refuter: '诸葛亮', refuted: '关羽', refutedView: '北伐可行', reason: '兵力不足' },
  relatedMessageId: 'msg-001',
  createdAt: '2026-06-01T00:00:00Z',
})

const makeCampEvent = (): EventRecord => ({
  eventId: 'evt-camp',
  sessionId: 's1',
  eventType: 'camp',
  trigger: 'auto',
  status: 'active',
  title: '站队事件',
  description: '形成两个阵营',
  reason: '检测到对立',
  payload: {
    camps: [
      { name: '主战', roleIds: ['gy', 'zf'], stance: '主张北伐' },
      { name: '主和', roleIds: ['simayi'], stance: '反对北伐' },
    ],
  },
  relatedMessageId: 'msg-002',
  createdAt: '2026-06-01T00:00:00Z',
})

const makeVoteEvent = (): EventRecord => ({
  eventId: 'evt-vote',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '迁都投票',
  description: '请投票决定迁都位置',
  reason: '用户触发',
  payload: {
    question: '迁都何处？',
    options: [
      { id: 'opt1', label: '许昌', roles: ['zgl'] },
      { id: 'opt2', label: '洛阳', roles: ['simayi'] },
    ],
    tally: { opt1: 2, opt2: 1 },
  },
  relatedMessageId: 'msg-003',
  createdAt: '2026-06-01T00:00:00Z',
})

const makeReverseEvent = (): EventRecord => ({
  eventId: 'evt-reverse',
  sessionId: 's1',
  eventType: 'reverse',
  trigger: 'auto',
  status: 'active',
  title: '反转事件',
  description: '前提条件发生了变化',
  reason: '检测到反转信号',
  payload: { premise: '曹魏强大', newVariable: '吴蜀联盟', impact: '改变战略格局' },
  relatedMessageId: 'msg-004',
  createdAt: '2026-06-01T00:00:00Z',
})

describe('Task-11: EventCard — slap event rendering', () => {
  it('renders event title and description', () => {
    render(<EventCard event={makeSlapEvent()} votes={[]} />)
    expect(screen.getByText('打脸事件')).toBeDefined()
    expect(screen.getByText('关羽的观点被反驳了')).toBeDefined()
  })

  it('renders slap event type label', () => {
    render(<EventCard event={makeSlapEvent()} votes={[]} />)
    expect(screen.getByText('slap')).toBeDefined()
  })

  it('renders refuter and refuted info for slap events', () => {
    render(<EventCard event={makeSlapEvent()} votes={[]} />)
    expect(screen.getByText(/诸葛亮 反驳 关羽/)).toBeDefined()
  })
})

describe('Task-11: EventCard — camp event rendering', () => {
  it('renders camp event title and description', () => {
    render(<EventCard event={makeCampEvent()} votes={[]} />)
    expect(screen.getByText('站队事件')).toBeDefined()
  })

  it('renders camp count in detail', () => {
    render(<EventCard event={makeCampEvent()} votes={[]} />)
    expect(screen.getByText(/2 个阵营/)).toBeDefined()
  })
})

describe('Task-11: EventCard — reverse event rendering', () => {
  it('renders reverse event title', () => {
    render(<EventCard event={makeReverseEvent()} votes={[]} />)
    expect(screen.getByText('反转事件')).toBeDefined()
  })

  it('renders newVariable in detail', () => {
    render(<EventCard event={makeReverseEvent()} votes={[]} />)
    expect(screen.getByText(/吴蜀联盟/)).toBeDefined()
  })
})

describe('Task-11: EventCard — vote event renders VoteGrid', () => {
  it('renders vote question', () => {
    render(<EventCard event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText('迁都何处？')).toBeDefined()
  })

  it('renders vote options with labels', () => {
    render(<EventCard event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText('许昌')).toBeDefined()
    expect(screen.getByText('洛阳')).toBeDefined()
  })

  it('renders tally counts from payload.tally', () => {
    render(<EventCard event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText(/2 票/)).toBeDefined()
    expect(screen.getByText(/1 票/)).toBeDefined()
  })

  it('calls onVote with eventId and optionId when option clicked', async () => {
    const onVote = vi.fn()
    render(<EventCard event={makeVoteEvent()} votes={[]} onVote={onVote} />)
    const option = screen.getByRole('button', { name: /许昌/ })
    await userEvent.click(option)
    expect(onVote).toHaveBeenCalledWith('evt-vote', 'opt1')
  })

  it('disables option buttons when pending is true', async () => {
    const onVote = vi.fn()
    render(<EventCard event={makeVoteEvent()} votes={[]} pending={true} onVote={onVote} />)
    const options = screen.getAllByRole('button')
    for (const btn of options) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('shows already-voted indicator for selected option', () => {
    const vote: VoteRecord = {
      voteId: 'vote-001',
      sessionId: 's1',
      eventId: 'evt-vote',
      voterType: 'user',
      voterId: 'current-user',
      optionId: 'opt1',
      createdAt: '2026-06-01T00:00:00Z',
    }
    render(<EventCard event={makeVoteEvent()} votes={[vote]} />)
    expect(screen.getByText('已投')).toBeDefined()
  })

  it('disables all options after user has voted', () => {
    const vote: VoteRecord = {
      voteId: 'vote-001',
      sessionId: 's1',
      eventId: 'evt-vote',
      voterType: 'user',
      voterId: 'current-user',
      optionId: 'opt1',
      createdAt: '2026-06-01T00:00:00Z',
    }
    render(<EventCard event={makeVoteEvent()} votes={[vote]} />)
    const options = screen.getAllByRole('button')
    for (const btn of options) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('disables all options when event is closed', () => {
    const closedEvent = { ...makeVoteEvent(), status: 'closed' as const }
    render(<EventCard event={closedEvent} votes={[]} />)
    const options = screen.getAllByRole('button')
    for (const btn of options) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
