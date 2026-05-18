import type { Session } from '@/types'
import type { CreateSessionParams, CreateSessionResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import { ServiceError } from '@/server/errors'
import { DEFAULT_STRATEGY_ID } from '@/data/model-strategies'

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

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const topic = params.topic?.trim()
    if (!topic) throw new ServiceError('TOPIC_REQUIRED', 'Topic is required')
    if (topic.length > 100) throw new ServiceError('TOPIC_TOO_LONG', 'Topic must be 100 chars or less')

    const template = await this.templateRepo.findById(params.templateId)
    if (!template) throw new ServiceError('TEMPLATE_NOT_FOUND', `Template not found: ${params.templateId}`)

    const now = Date.now()
    const session = await this.repo.save({
      id: '',
      templateId: params.templateId,
      topic,
      status: 'active',
      modelStrategyId: params.modelStrategyId ?? DEFAULT_STRATEGY_ID,
      state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
      messages: [],
      createdAt: now,
      updatedAt: now,
    })

    return {
      sessionId: session.id,
      topic: session.topic,
      template: { id: template.id, name: template.name },
      status: 'active',
      createdAt: session.createdAt,
    }
  }

  async getRecentSessions(limit?: number): Promise<Session[]> {
    try {
      return await this.repo.findRecent(limit)
    } catch (err) {
      throw new ServiceError('INTERNAL_ERROR', 'Failed to fetch recent sessions', err)
    }
  }
}
