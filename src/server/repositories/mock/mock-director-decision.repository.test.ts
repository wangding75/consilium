import { describe, it, expect, beforeEach } from 'vitest'
import { MockDirectorDecisionRepository } from './mock-director-decision.repository'
import type { DirectorDecisionRecord } from '@/types'

function makeDecision(overrides: Partial<DirectorDecisionRecord> = {}): DirectorDecisionRecord {
  return {
    decisionId: 'dec-1',
    sessionId: 'sess-1',
    action: 'continue',
    reason: 'insufficient coverage',
    confidence: 0.8,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('MockDirectorDecisionRepository', () => {
  let repo: MockDirectorDecisionRepository

  beforeEach(() => {
    repo = new MockDirectorDecisionRepository()
  })

  describe('save', () => {
    it('saves a decision and returns it', async () => {
      const decision = makeDecision()
      const result = await repo.save(decision)
      expect(result).toEqual(decision)
    })
  })

  describe('findRecentBySessionId', () => {
    it('returns empty array when no decisions exist', async () => {
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result).toEqual([])
    })

    it('returns decisions sorted by createdAt descending', async () => {
      await repo.save(makeDecision({ decisionId: 'dec-1', createdAt: '2026-01-01T00:00:00.000Z' }))
      await repo.save(makeDecision({ decisionId: 'dec-2', createdAt: '2026-01-02T00:00:00.000Z' }))
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result[0].decisionId).toBe('dec-2')
      expect(result[1].decisionId).toBe('dec-1')
    })

    it('respects limit parameter', async () => {
      await repo.save(makeDecision({ decisionId: 'dec-1', createdAt: '2026-01-01T00:00:00.000Z' }))
      await repo.save(makeDecision({ decisionId: 'dec-2', createdAt: '2026-01-02T00:00:00.000Z' }))
      await repo.save(makeDecision({ decisionId: 'dec-3', createdAt: '2026-01-03T00:00:00.000Z' }))
      const result = await repo.findRecentBySessionId('sess-1', 2)
      expect(result).toHaveLength(2)
    })

    it('only returns decisions for the specified session', async () => {
      await repo.save(makeDecision({ sessionId: 'sess-1' }))
      await repo.save(makeDecision({ decisionId: 'dec-s2', sessionId: 'sess-2', createdAt: '2026-01-04T00:00:00.000Z' }))
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result).toHaveLength(1)
    })
  })
})
