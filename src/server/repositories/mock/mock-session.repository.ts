import type { Session } from '@/types'
import type { SessionRepository } from '../session.repository'

export class MockSessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>()

  async findAll(): Promise<Session[]> {
    return Array.from(this.store.values())
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

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
