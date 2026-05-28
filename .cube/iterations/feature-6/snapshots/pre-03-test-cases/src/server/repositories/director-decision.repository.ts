import type { DirectorDecisionRecord } from '@/types'

export interface DirectorDecisionRepository {
  save(decision: DirectorDecisionRecord): Promise<DirectorDecisionRecord>
  findRecentBySessionId(sessionId: string, limit?: number): Promise<DirectorDecisionRecord[]>
}
