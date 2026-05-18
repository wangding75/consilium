import type { Session } from '@/types'
import type { SessionRepository } from '../session.repository'

export class MockSessionRepository implements SessionRepository {
  async findAll(): Promise<Session[]> {
    return []
  }

  async findById(_id: string): Promise<Session | null> {
    return null
  }

  async save(session: Session): Promise<Session> {
    return session
  }

  async delete(_id: string): Promise<void> {
    // no-op in mock
  }
}
