import type { VoteRecord } from '@/types'

export interface VoteRepository {
  findByEventId(sessionId: string, eventId: string): Promise<VoteRecord[]>
  findByKey(
    sessionId: string,
    eventId: string,
    voterType: VoteRecord['voterType'],
    voterId: string
  ): Promise<VoteRecord | null>
  save(vote: VoteRecord): Promise<VoteRecord>
  countByOption(sessionId: string, eventId: string, optionId: string): Promise<number>
  findBySessionId(sessionId: string): Promise<VoteRecord[]>
  clearAll(): Promise<void>
}
