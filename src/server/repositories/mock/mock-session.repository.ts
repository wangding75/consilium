import type { DiscussionState, Session, SessionLifecycleStatus } from '@/types'
import type { ListSessionsQuery } from '@/types/api'
import type { SessionRepository } from '../session.repository'

export class MockSessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>()

  async findAll(): Promise<Session[]> {
    return Array.from(this.store.values())
  }

  async findMany(_query?: ListSessionsQuery): Promise<Session[]> {
    throw new Error('not implemented — will be built in iteration 4')
  }

  async findById(id: string): Promise<Session | null> {
    return this.store.get(id) ?? null
  }

  async findRecent(limit = 10): Promise<Session[]> {
    return Array.from(this.store.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  async save(session: Session): Promise<Session> {
    const id = session.id || crypto.randomUUID()
    const saved = { ...session, id }
    this.store.set(id, saved)
    return saved
  }

  async updateStatus(_id: string, _status: SessionLifecycleStatus, _reason: string): Promise<Session | null> {
    throw new Error('not implemented — will be built in iteration 4')
  }

  async updateState(_id: string, _state: DiscussionState, _reason: string): Promise<Session | null> {
    throw new Error('not implemented — will be built in iteration 4')
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
