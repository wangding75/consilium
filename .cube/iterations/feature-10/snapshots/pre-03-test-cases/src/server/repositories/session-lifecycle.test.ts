import { describe, it, expect } from 'vitest'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import type { ListSessionsQuery } from '@/types/api'

// Task-03: Extended session repository query & state update
describe('SessionRepository lifecycle operations — Task-03', () => {
  const repo = new MockSessionRepository()

  it('findMany filters by status', async () => {
    const query: ListSessionsQuery = { status: 'running' }
    const results = await repo.findMany(query)
    expect(results.every(s => s.status === 'running' || s.status === 'active')).toBe(true)
  })

  it('findMany filters by keyword', async () => {
    const query: ListSessionsQuery = { keyword: 'test' }
    const results = await repo.findMany(query)
    expect(results.every(s => s.topic.includes('test'))).toBe(true)
  })

  it('findMany applies limit', async () => {
    const query: ListSessionsQuery = { limit: 2 }
    const results = await repo.findMany(query)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('findMany normalizes legacy active to running', async () => {
    const query: ListSessionsQuery = { status: 'running' }
    const results = await repo.findMany(query)
    const activeResults = results.filter(s => s.status === 'active')
    expect(activeResults).toHaveLength(0)
  })

  it('updateStatus updates session status and returns updated session', async () => {
    const sessions = await repo.findAll()
    if (sessions.length === 0) return
    const session = sessions[0]
    const updated = await repo.updateStatus(session.id, 'archived', 'user archive')
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('archived')
  })

  it('updateStatus returns null for non-existent session', async () => {
    const result = await repo.updateStatus('nonexistent', 'archived', 'test')
    expect(result).toBeNull()
  })

  it('updateState updates session state and returns updated session', async () => {
    const sessions = await repo.findAll()
    if (sessions.length === 0) return
    const session = sessions[0]
    const newState = { stage: 'opening' as const, turnCount: 1, lastSpeakerId: 'role-1' }
    const updated = await repo.updateState(session.id, newState, 'first message')
    expect(updated).not.toBeNull()
    expect(updated!.state.stage).toBe('opening')
  })

  it('updateState returns null for non-existent session', async () => {
    const result = await repo.updateState('nonexistent', { stage: 'idle', turnCount: 0, lastSpeakerId: null }, 'test')
    expect(result).toBeNull()
  })
})
