import type { EventRecord, EventStatus } from '@/types'

export interface EventRepository {
  findById(sessionId: string, eventId: string): Promise<EventRecord | null>
  findBySessionId(sessionId: string): Promise<EventRecord[]>
  findRecentBySessionId(sessionId: string, limit: number): Promise<EventRecord[]>
  save(event: EventRecord): Promise<EventRecord>
  updateStatus(sessionId: string, eventId: string, status: EventStatus): Promise<EventRecord | null>
  updateTally(sessionId: string, eventId: string, optionId: string): Promise<EventRecord | null>
  markDirectorConsumed(sessionId: string, eventId: string, consumedAt: string): Promise<EventRecord | null>
  clearAll(): Promise<void>
}
