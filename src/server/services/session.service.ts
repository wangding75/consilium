import type { Session, SessionStatusAction } from '@/types'
import type { CreateSessionParams, CreateSessionResult, ListSessionsQuery, SessionStateResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import { ServiceError } from '@/server/errors'
import { MODEL_STRATEGIES, DEFAULT_STRATEGY_ID, type ModelStrategyId } from '@/data/model-strategies'

const VALID_STRATEGY_IDS = new Set(MODEL_STRATEGIES.map((s) => s.id))

export class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly templateRepo: TemplateRepository
  ) {}

  async listSessions(query?: ListSessionsQuery): Promise<Session[]> {
    try {
      if (query) return await this.repo.findMany(query)
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('SESSION_LIST_FAILED', 'Failed to list sessions', err)
    }
  }

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const topic = params.topic?.trim()
    if (!topic) throw new ServiceError('TOPIC_REQUIRED', 'Topic is required')
    if (topic.length > 100) throw new ServiceError('TOPIC_TOO_LONG', 'Topic must be 100 chars or less')

    try {
      const template = await this.templateRepo.findById(params.templateId)
      if (!template) throw new ServiceError('TEMPLATE_NOT_FOUND', `Template not found: ${params.templateId}`)

      const strategyId = (params.modelStrategyId ?? DEFAULT_STRATEGY_ID) as ModelStrategyId
      if (!VALID_STRATEGY_IDS.has(strategyId)) {
        throw new ServiceError('INVALID_STRATEGY', `Invalid model strategy: ${strategyId}`)
      }

      const now = Date.now()
      const session = await this.repo.save({
        id: '',
        templateId: params.templateId,
        topic,
        status: 'running',
        modelStrategyId: strategyId,
        state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
        messages: [],
        createdAt: now,
        updatedAt: now,
      })

      return {
        sessionId: session.id,
        topic: session.topic,
        template: { id: template.id, name: template.name },
        status: 'running',
        createdAt: session.createdAt,
      }
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError('INTERNAL_ERROR', 'Failed to create session', err)
    }
  }

  async getRecentSessions(limit?: number): Promise<Session[]> {
    try {
      return await this.repo.findRecent(limit)
    } catch (err) {
      throw new ServiceError('INTERNAL_ERROR', 'Failed to fetch recent sessions', err)
    }
  }

  async updateSessionStatus(_sessionId: string, _action: SessionStatusAction): Promise<Session> {
    throw new Error('not implemented — will be built in iteration 4')
  }

  async getSessionState(_sessionId: string): Promise<SessionStateResult> {
    throw new Error('not implemented — will be built in iteration 4')
  }
}
