import type { Session, SessionStatusAction } from '@/types'
import type { CreateSessionParams, CreateSessionResult, ListSessionsQuery, SessionStateResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import { ServiceError } from '@/server/errors'
import { MODEL_STRATEGIES, DEFAULT_STRATEGY_ID, type ModelStrategyId } from '@/data/model-strategies'

const VALID_STRATEGY_IDS = new Set(MODEL_STRATEGIES.map((s) => s.id))

export class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly templateRepo: TemplateRepository,
    private readonly messageRepo?: MessageRepository
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

  async updateSessionStatus(sessionId: string, action: SessionStatusAction): Promise<Session> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session not found: ${sessionId}`)

    let nextStatus: string
    let reason: string

    switch (action) {
      case 'archive':
        nextStatus = 'archived'
        reason = 'user archive'
        break
      case 'resume': {
        if (session.status !== 'completed') {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: Session is not completed')
        }
        if (session.state.stage !== 'closing') {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: Session stage is not closing')
        }
        // Verify summary checkpoint exists
        let hasSummaryCheckpoint = false
        if (this.messageRepo) {
          const messages = await this.messageRepo.findBySessionId(sessionId)
          hasSummaryCheckpoint = messages.some(m => m.metadata?.hostMessageKind === 'final_summary' && m.metadata?.summary)
        } else {
          hasSummaryCheckpoint = (session.state.history ?? []).some(h => h.reason?.includes('summary'))
        }
        if (!hasSummaryCheckpoint) {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: No summary checkpoint found')
        }
        nextStatus = 'running'
        reason = 'user resume after summary'
        // Transition stage from closing back to developing
        await this.repo.updateState(sessionId, {
          ...session.state,
          stage: 'developing',
        }, reason)
        break
      }
      case 'complete': {
        if (session.state.stage !== 'closing') {
          throw new ServiceError('SUMMARY_REQUIRED', 'Session must be in closing phase to complete')
        }
        nextStatus = 'completed'
        reason = 'user complete'
        break
      }
      default:
        throw new ServiceError('VALIDATION_ERROR', `Invalid action: ${action}`)
    }

    if (session.status === nextStatus) return session

    const updated = await this.repo.updateStatus(sessionId, nextStatus as any, reason)
    if (!updated) throw new ServiceError('INTERNAL_ERROR', 'Failed to update session status')
    return updated
  }

  async getSessionState(sessionId: string): Promise<SessionStateResult> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session not found: ${sessionId}`)

    return {
      sessionId: session.id,
      status: session.status,
      phase: session.state.stage,
      state: session.state,
      history: session.state.history ?? [],
    }
  }
}
