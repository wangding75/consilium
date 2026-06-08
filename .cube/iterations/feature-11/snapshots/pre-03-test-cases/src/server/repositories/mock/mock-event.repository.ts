import type { EventRecord, EventStatus, VotePayload } from '@/types'
import type { EventRepository } from '../event.repository'

export class MockEventRepository implements EventRepository {
  private store = new Map<string, EventRecord>()

  async findById(sessionId: string, eventId: string): Promise<EventRecord | null> {
    const event = this.store.get(eventId)
    if (!event || event.sessionId !== sessionId) return null
    return event
  }

  async findBySessionId(sessionId: string): Promise<EventRecord[]> {
    return Array.from(this.store.values())
      .filter((event) => event.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async findRecentBySessionId(sessionId: string, limit: number): Promise<EventRecord[]> {
    const events = await this.findBySessionId(sessionId)
    return events.slice(-limit)
  }

  async save(event: EventRecord): Promise<EventRecord> {
    this.store.set(event.eventId, event)
    return event
  }

  async updateStatus(sessionId: string, eventId: string, status: EventStatus): Promise<EventRecord | null> {
    const event = await this.findById(sessionId, eventId)
    if (!event) return null
    const updated = { ...event, status }
    this.store.set(eventId, updated)
    return updated
  }

  async updateTally(sessionId: string, eventId: string, optionId: string): Promise<EventRecord | null> {
    const event = await this.findById(sessionId, eventId)
    if (!event || event.eventType !== 'vote') return null
    const payload = event.payload as VotePayload
    const updatedPayload: VotePayload = {
      ...payload,
      tally: {
        ...payload.tally,
        [optionId]: (payload.tally[optionId] ?? 0) + 1,
      },
    }
    const updated = { ...event, payload: updatedPayload }
    this.store.set(eventId, updated)
    return updated
  }

  async markDirectorConsumed(sessionId: string, eventId: string, consumedAt: string): Promise<EventRecord | null> {
    const event = await this.findById(sessionId, eventId)
    if (!event) return null
    const updated = { ...event, directorConsumedAt: consumedAt }
    this.store.set(eventId, updated)
    return updated
  }

  async clearAll(): Promise<void> {
    this.store.clear()
  }
}
