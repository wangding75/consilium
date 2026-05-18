import type { Session } from '@/types'
import type { CreateSessionParams, CreateSessionResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import { ServiceError } from '@/server/errors'

export class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly templateRepo: TemplateRepository
  ) {}

  async listSessions(): Promise<Session[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('SESSION_LIST_FAILED', 'Failed to list sessions', err)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createSession(_params: CreateSessionParams): Promise<CreateSessionResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'createSession not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecentSessions(_limit?: number): Promise<Session[]> {
    throw new ServiceError('NOT_IMPLEMENTED', 'getRecentSessions not implemented')
  }
}
