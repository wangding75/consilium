import { describe, it, expect, beforeEach } from 'vitest'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { VoteRecord } from '@/types'

const makeVoteRecord = (overrides: Partial<VoteRecord> = {}): VoteRecord => ({
  voteId: 'vote-001',
  sessionId: 's1',
  eventId: 'evt-001',
  voterType: 'user',
  voterId: 'current-user',
  optionId: 'opt1',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

describe('MockVoteRepository — write-then-read', () => {
  let repo: MockVoteRepository

  beforeEach(() => {
    repo = new MockVoteRepository()
  })

  it('saves and retrieves vote by idempotency key', async () => {
    const vote = makeVoteRecord()
    await repo.save(vote)
    const found = await repo.findByKey('s1', 'evt-001', 'user', 'current-user')
    expect(found).not.toBeNull()
    expect(found!.voteId).toBe('vote-001')
    expect(found!.optionId).toBe('opt1')
  })

  it('returns null for unknown idempotency key', async () => {
    const found = await repo.findByKey('s1', 'evt-001', 'user', 'unknown-user')
    expect(found).toBeNull()
  })

  it('enforces session isolation — cannot retrieve vote from different session', async () => {
    await repo.save(makeVoteRecord({ sessionId: 's1' }))
    const found = await repo.findByKey('s2', 'evt-001', 'user', 'current-user')
    expect(found).toBeNull()
  })

  it('findByEventId returns votes for given session+event', async () => {
    await repo.save(makeVoteRecord({ voteId: 'vote-001', sessionId: 's1', eventId: 'evt-001' }))
    await repo.save(makeVoteRecord({ voteId: 'vote-002', sessionId: 's1', eventId: 'evt-002' }))
    await repo.save(makeVoteRecord({ voteId: 'vote-003', sessionId: 's2', eventId: 'evt-001' }))
    const votes = await repo.findByEventId('s1', 'evt-001')
    expect(votes).toHaveLength(1)
    expect(votes[0].voteId).toBe('vote-001')
  })

  it('countByOption returns correct count for option', async () => {
    await repo.save(makeVoteRecord({ voteId: 'vote-001', optionId: 'opt1', voterId: 'user-1' }))
    await repo.save(makeVoteRecord({ voteId: 'vote-002', optionId: 'opt1', voterId: 'user-2' }))
    await repo.save(makeVoteRecord({ voteId: 'vote-003', optionId: 'opt2', voterId: 'user-3' }))
    const count = await repo.countByOption('s1', 'evt-001', 'opt1')
    expect(count).toBe(2)
  })

  it('countByOption returns 0 for unknown option', async () => {
    const count = await repo.countByOption('s1', 'evt-001', 'non-existent')
    expect(count).toBe(0)
  })

  it('countByOption is session-scoped', async () => {
    await repo.save(makeVoteRecord({ voteId: 'vote-001', sessionId: 's1', optionId: 'opt1' }))
    const count = await repo.countByOption('s2', 'evt-001', 'opt1')
    expect(count).toBe(0)
  })

  it('idempotency key uniqueness: (sessionId, eventId, voterType, voterId)', async () => {
    await repo.save(makeVoteRecord({ voteId: 'vote-001', voterId: 'user-a', optionId: 'opt1' }))
    const found = await repo.findByKey('s1', 'evt-001', 'user', 'user-a')
    expect(found!.optionId).toBe('opt1')
    // Different voterId — separate key
    const notFound = await repo.findByKey('s1', 'evt-001', 'user', 'user-b')
    expect(notFound).toBeNull()
  })
})
