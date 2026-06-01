import type { VoteRecord } from '@/types'
import type { VoteRepository } from '../vote.repository'

export class MockVoteRepository implements VoteRepository {
  private store = new Map<string, VoteRecord>()

  async findByEventId(sessionId: string, eventId: string): Promise<VoteRecord[]> {
    return Array.from(this.store.values())
      .filter((vote) => vote.sessionId === sessionId && vote.eventId === eventId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async findByKey(
    sessionId: string,
    eventId: string,
    voterType: VoteRecord['voterType'],
    voterId: string
  ): Promise<VoteRecord | null> {
    return Array.from(this.store.values()).find(
      (vote) =>
        vote.sessionId === sessionId &&
        vote.eventId === eventId &&
        vote.voterType === voterType &&
        vote.voterId === voterId
    ) ?? null
  }

  async save(vote: VoteRecord): Promise<VoteRecord> {
    this.store.set(vote.voteId, vote)
    return vote
  }

  async countByOption(sessionId: string, eventId: string, optionId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (vote) => vote.sessionId === sessionId && vote.eventId === eventId && vote.optionId === optionId
    ).length
  }
}
