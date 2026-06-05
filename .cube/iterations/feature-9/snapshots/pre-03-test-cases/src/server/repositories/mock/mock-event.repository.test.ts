import { describe, it, expect, beforeEach } from 'vitest'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import type { EventRecord, VotePayload } from '@/types'

const makeEventRecord = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  eventId: 'evt-001',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '是否迁都',
  description: '讨论迁都',
  reason: '用户触发',
  payload: { question: '迁哪里', options: [{ id: 'opt1', label: '许昌', roles: ['zgl'] }], tally: { opt1: 0 } } as VotePayload,
  relatedMessageId: 'msg-001',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

describe('MockEventRepository — write-then-read', () => {
  let repo: MockEventRepository

  beforeEach(() => {
    repo = new MockEventRepository()
  })

  it('saves and retrieves event by sessionId+eventId', async () => {
    const event = makeEventRecord()
    await repo.save(event)
    const found = await repo.findById('s1', 'evt-001')
    expect(found).not.toBeNull()
    expect(found!.eventId).toBe('evt-001')
    expect(found!.sessionId).toBe('s1')
  })

  it('returns null for unknown eventId', async () => {
    const found = await repo.findById('s1', 'non-existent')
    expect(found).toBeNull()
  })

  it('enforces session isolation — cannot read across sessions', async () => {
    const event = makeEventRecord({ sessionId: 's1' })
    await repo.save(event)
    const found = await repo.findById('s2', 'evt-001')
    expect(found).toBeNull()
  })

  it('findBySessionId returns only events for given session', async () => {
    await repo.save(makeEventRecord({ eventId: 'evt-001', sessionId: 's1' }))
    await repo.save(makeEventRecord({ eventId: 'evt-002', sessionId: 's2' }))
    const s1Events = await repo.findBySessionId('s1')
    expect(s1Events).toHaveLength(1)
    expect(s1Events[0].eventId).toBe('evt-001')
  })

  it('findRecentBySessionId returns up to limit events ordered by createdAt', async () => {
    await repo.save(makeEventRecord({ eventId: 'evt-001', createdAt: '2026-06-01T00:00:01Z' }))
    await repo.save(makeEventRecord({ eventId: 'evt-002', createdAt: '2026-06-01T00:00:02Z' }))
    await repo.save(makeEventRecord({ eventId: 'evt-003', createdAt: '2026-06-01T00:00:03Z' }))
    const recent = await repo.findRecentBySessionId('s1', 2)
    expect(recent).toHaveLength(2)
    expect(recent[recent.length - 1].eventId).toBe('evt-003')
  })

  it('updateStatus changes event status and persists', async () => {
    await repo.save(makeEventRecord({ status: 'active' }))
    const updated = await repo.updateStatus('s1', 'evt-001', 'closed')
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('closed')
    const found = await repo.findById('s1', 'evt-001')
    expect(found!.status).toBe('closed')
  })

  it('updateStatus returns null for non-existent event', async () => {
    const result = await repo.updateStatus('s1', 'non-existent', 'closed')
    expect(result).toBeNull()
  })

  it('updateTally increments tally for given optionId', async () => {
    const event = makeEventRecord()
    await repo.save(event)
    const updated = await repo.updateTally('s1', 'evt-001', 'opt1')
    expect(updated).not.toBeNull()
    const payload = updated!.payload as VotePayload
    expect(payload.tally['opt1']).toBe(1)
    // write-then-read: verify persistence
    const found = await repo.findById('s1', 'evt-001')
    expect((found!.payload as VotePayload).tally['opt1']).toBe(1)
  })

  it('updateTally returns null for non-vote event', async () => {
    await repo.save(makeEventRecord({ eventType: 'slap', payload: { refuter: 'a', refuted: 'b', refutedView: 'v', reason: 'r' } }))
    const result = await repo.updateTally('s1', 'evt-001', 'opt1')
    expect(result).toBeNull()
  })

  it('markDirectorConsumed sets directorConsumedAt and persists', async () => {
    await repo.save(makeEventRecord())
    const consumedAt = '2026-06-01T10:00:00Z'
    const updated = await repo.markDirectorConsumed('s1', 'evt-001', consumedAt)
    expect(updated).not.toBeNull()
    expect(updated!.directorConsumedAt).toBe(consumedAt)
    const found = await repo.findById('s1', 'evt-001')
    expect(found!.directorConsumedAt).toBe(consumedAt)
  })

  it('markDirectorConsumed returns null for non-existent event', async () => {
    const result = await repo.markDirectorConsumed('s1', 'non-existent', '2026-06-01T00:00:00Z')
    expect(result).toBeNull()
  })

  it('save uses immutable update — original object is unchanged after updateTally', async () => {
    const event = makeEventRecord()
    await repo.save(event)
    await repo.updateTally('s1', 'evt-001', 'opt1')
    const originalPayload = event.payload as VotePayload
    expect(originalPayload.tally['opt1']).toBe(0)
  })
})
