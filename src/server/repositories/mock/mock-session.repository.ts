import type { Session } from '@/types'
import type { SessionRepository } from '../session.repository'

const store = new Map<string, Session>()

export class MockSessionRepository implements SessionRepository {
  async findAll(): Promise<Session[]> {
    return Array.from(store.values())
  }

  async findById(id: string): Promise<Session | null> {
    return store.get(id) ?? null
  }

  async findRecent(limit = 10): Promise<Session[]> {
    return Array.from(store.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  async save(session: Session): Promise<Session> {
    const id = session.id || crypto.randomUUID()
    const saved = { ...session, id }
    store.set(id, saved)
    return saved
  }

  async delete(id: string): Promise<void> {
    store.delete(id)
  }
}
