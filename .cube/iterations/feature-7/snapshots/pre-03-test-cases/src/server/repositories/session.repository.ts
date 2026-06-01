import type { DiscussionState, Session, SessionLifecycleStatus } from '@/types'
import type { ListSessionsQuery } from '@/types/api'

export interface SessionRepository {
  findAll(): Promise<Session[]>
  findMany(query?: ListSessionsQuery): Promise<Session[]>
  findById(id: string): Promise<Session | null>
  findRecent(limit?: number): Promise<Session[]>
  save(session: Session): Promise<Session>
  updateStatus(id: string, status: SessionLifecycleStatus, reason: string): Promise<Session | null>
  updateState(id: string, state: DiscussionState, reason: string): Promise<Session | null>
  delete(id: string): Promise<void>
}
