import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoteGrid } from './vote-grid'
import type { EventRecord, VoteRecord, VotePayload } from '@/types'

const makeVotePayload = (): VotePayload => ({
  question: '迁都何处',
  options: [
    { id: 'opt1', label: '许昌', roles: ['zgl'] },
    { id: 'opt2', label: '洛阳', roles: ['simayi'] },
  ],
  tally: { opt1: 2, opt2: 1 },
})

const makeVoteEvent = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  eventId: 'evt-001',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '迁都投票',
  description: '请投票决定迁都位置',
  reason: '用户触发',
  payload: makeVotePayload(),
  relatedMessageId: 'msg-001',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

const makeUserVote = (optionId: string): VoteRecord => ({
  voteId: 'vote-001',
  sessionId: 's1',
  eventId: 'evt-001',
  voterType: 'user',
  voterId: 'current-user',
  optionId,
  createdAt: '2026-06-01T00:00:00Z',
})

describe('Task-11: VoteGrid — rendering', () => {
  it('renders vote question', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText('迁都何处')).toBeDefined()
  })

  it('renders all option labels', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText('许昌')).toBeDefined()
    expect(screen.getByText('洛阳')).toBeDefined()
  })

  it('renders tally counts for each option', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[]} />)
    expect(screen.getByText('2 票')).toBeDefined()
    expect(screen.getByText('1 票')).toBeDefined()
  })

  it('returns null for non-vote payload', () => {
    const event: EventRecord = {
      ...makeVoteEvent(),
      eventType: 'slap',
      payload: { refuter: 'a', refuted: 'b', refutedView: 'v', reason: 'r' },
    }
    const { container } = render(<VoteGrid event={event} votes={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('Task-11: VoteGrid — interaction', () => {
  it('calls onVote with eventId and optionId when option clicked', () => {
    const onVote = vi.fn()
    render(<VoteGrid event={makeVoteEvent()} votes={[]} onVote={onVote} />)
    fireEvent.click(screen.getByRole('button', { name: /许昌/ }))
    expect(onVote).toHaveBeenCalledWith('evt-001', 'opt1')
  })

  it('disables all buttons when pending=true', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[]} pending={true} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true))
  })

  it('disables all buttons when event is closed', () => {
    render(<VoteGrid event={makeVoteEvent({ status: 'closed' })} votes={[]} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true))
  })

  it('shows 已投 on the selected option when userVote exists', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[makeUserVote('opt1')]} />)
    expect(screen.getByText('已投')).toBeDefined()
  })

  it('disables all buttons when user has already voted', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[makeUserVote('opt1')]} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true))
  })

  it('does not show 已投 when user has not voted', () => {
    render(<VoteGrid event={makeVoteEvent()} votes={[]} />)
    expect(screen.queryByText('已投')).toBeNull()
  })

  it('does not call onVote when button is disabled', () => {
    const onVote = vi.fn()
    render(<VoteGrid event={makeVoteEvent()} votes={[makeUserVote('opt1')]} onVote={onVote} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => fireEvent.click(btn))
    expect(onVote).not.toHaveBeenCalled()
  })
})
