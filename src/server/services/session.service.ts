import type { Session } from '@/types'
import type { SessionRepository } from '@/server/repositories/session.repository'
import { ServiceError } from '@/server/errors'

export class SessionService {
  constructor(private readonly repo: SessionRepository) {}

  async listSessions(): Promise<Session[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('SESSION_LIST_FAILED', 'Failed to list sessions', err)
    }
  }
}
