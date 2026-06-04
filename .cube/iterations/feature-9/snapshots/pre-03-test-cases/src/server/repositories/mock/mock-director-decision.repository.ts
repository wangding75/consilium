import type { DirectorDecisionRecord } from '@/types'
import type { DirectorDecisionRepository } from '../director-decision.repository'

export class MockDirectorDecisionRepository implements DirectorDecisionRepository {
  private readonly store = new Map<string, DirectorDecisionRecord>()

  async save(decision: DirectorDecisionRecord): Promise<DirectorDecisionRecord> {
    this.store.set(decision.decisionId, decision)
    return decision
  }

  async findRecentBySessionId(sessionId: string, limit = 10): Promise<DirectorDecisionRecord[]> {
    return Array.from(this.store.values())
      .filter((decision) => decision.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }
}
