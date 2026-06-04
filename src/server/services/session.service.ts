import type { Session, SessionLifecycleStatus, SessionStatusAction } from '@/types'
import type { CreateSessionParams, CreateSessionResult, ListSessionsQuery, SessionListItem, SessionListResult, SessionStateResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { ModelStrategyRepository } from '@/server/repositories/model-strategy.repository'
import { sharedModelStrategyRepo } from '@/server/repositories/mock/instances'
import { ModelStrategyService } from '@/server/services/model-strategy.service'
import { ServiceError } from '@/server/errors'

function isMessageRepository(
  value: MessageRepository | ModelStrategyRepository | undefined
): value is MessageRepository {
  return !!value && 'findBySessionId' in value && 'countBySessionId' in value
}

export class SessionService {
  private readonly _messageRepo?: MessageRepository
  private readonly repo: SessionRepository
  private readonly templateRepo: TemplateRepository
  private readonly modelStrategyService: ModelStrategyService

  constructor(repo: SessionRepository, templateRepo: TemplateRepository, modelStrategyRepo?: ModelStrategyRepository)
  constructor(
    repo: SessionRepository,
    templateRepo: TemplateRepository,
    messageRepo: MessageRepository,
    modelStrategyRepo?: ModelStrategyRepository
  )
  constructor(
    repo: SessionRepository,
    templateRepo: TemplateRepository,
    messageRepoOrModelStrategyRepo?: MessageRepository | ModelStrategyRepository,
    modelStrategyRepo?: ModelStrategyRepository
  ) {
    this.repo = repo
    this.templateRepo = templateRepo

    if (isMessageRepository(messageRepoOrModelStrategyRepo)) {
      this._messageRepo = messageRepoOrModelStrategyRepo
      this.modelStrategyService = new ModelStrategyService(modelStrategyRepo ?? sharedModelStrategyRepo)
      return
    }

    this._messageRepo = undefined
    this.modelStrategyService = new ModelStrategyService(messageRepoOrModelStrategyRepo ?? sharedModelStrategyRepo)
  }

  private get messageRepo(): MessageRepository | undefined {
    return this._messageRepo
  }

  private async buildSessionListItem(session: Session): Promise<SessionListItem> {
    const liveTemplate = session.templateSnapshot ? null : await this.templateRepo.findDetailById(session.templateId)
    const liveStrategy = session.strategySnapshot || !session.modelStrategyId
      ? null
      : await this.modelStrategyService.getStrategy(session.modelStrategyId).catch(() => null)
    const messageCount = this.messageRepo
      ? await this.messageRepo.countBySessionId(session.id)
      : session.messages.length

    return {
      sessionId: session.id,
      topic: session.topic,
      status: session.status,
      template: session.templateSnapshot
        ? {
            templateId: session.templateSnapshot.templateId,
            name: session.templateSnapshot.name,
            version: session.templateSnapshot.version,
            fromSnapshot: true,
          }
        : {
            templateId: session.templateId,
            name: liveTemplate?.name ?? session.templateId,
            version: liveTemplate?.version,
            fromSnapshot: false,
            fallbackReason: liveTemplate ? 'templateSnapshot missing' : 'template unavailable',
          },
      modelStrategy: session.strategySnapshot
        ? {
            modelStrategyId: session.strategySnapshot.modelStrategyId,
            name: session.strategySnapshot.name,
            selectedByDefault: session.strategySnapshot.selectedByDefault,
            fromSnapshot: true,
          }
        : session.modelStrategyId
          ? {
              modelStrategyId: session.modelStrategyId,
              name: liveStrategy?.name ?? session.modelStrategyId,
              fromSnapshot: false,
              ...(liveStrategy ? { selectedByDefault: liveStrategy.isDefault } : {}),
            }
          : undefined,
      roleCount: session.templateSnapshot?.roles.length ?? liveTemplate?.roles.length ?? 0,
      eventCount: session.templateSnapshot?.events.length ?? liveTemplate?.events.length ?? 0,
      messageCount,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }
  }

  async listSessions(query?: ListSessionsQuery): Promise<SessionListResult> {
    try {
      const sessions = query ? await this.repo.findMany(query) : await this.repo.findAll()
      return {
        sessions: await Promise.all(sessions.map((session) => this.buildSessionListItem(session))),
      }
    } catch (err) {
      throw new ServiceError('SESSION_LIST_FAILED', 'Failed to list sessions', err)
    }
  }

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const topic = params.topic?.trim()
    if (!topic) throw new ServiceError('TOPIC_REQUIRED', 'Topic is required')
    if (topic.length > 100) throw new ServiceError('TOPIC_TOO_LONG', 'Topic must be 100 chars or less')

    try {
      const template = await this.templateRepo.findDetailById(params.templateId)
      if (!template) throw new ServiceError('TEMPLATE_NOT_FOUND', `Template not found: ${params.templateId}`)
      if (!template.availableForSessionCreation) {
        throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template is not available: ${params.templateId}`)
      }

      const selectedByDefault = !params.modelStrategyId
      const strategy = params.modelStrategyId
        ? await this.modelStrategyService.getStrategy(params.modelStrategyId)
        : await this.modelStrategyService.getDefaultStrategy()
      const now = Date.now()
      const snapshotCreatedAt = new Date(now).toISOString()
      const templateSnapshot = {
        templateId: template.templateId,
        version: template.version,
        name: template.name,
        overview: structuredClone(template.overview),
        roles: structuredClone(template.roles),
        events: structuredClone(template.events),
        rhythm: structuredClone(template.rhythm),
        modelDefaults: structuredClone(template.modelDefaults),
        snapshotAt: snapshotCreatedAt,
      }
      const strategySnapshot = this.modelStrategyService.createStrategySnapshot(strategy, selectedByDefault)

      const session = await this.repo.save({
        id: '',
        templateId: params.templateId,
        topic,
        status: 'running',
        modelStrategyId: strategy.modelStrategyId,
        state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
        messages: [],
        createdAt: now,
        updatedAt: now,
        templateSnapshot,
        strategySnapshot,
        snapshotCreatedAt,
      })

      return {
        sessionId: session.id,
        topic: session.topic,
        template: { id: template.templateId, templateId: template.templateId, name: template.name, version: template.version },
        modelStrategy: { modelStrategyId: strategy.modelStrategyId, name: strategy.name, selectedByDefault },
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

    let nextStatus: SessionLifecycleStatus
    let reason: string

    switch (action) {
      case 'archive':
        nextStatus = 'archived'
        reason = 'user archive'
        break
      case 'resume': {
        if (session.status === 'archived') {
          nextStatus = 'running'
          reason = 'user resume from archive'
          break
        }
        if (session.status !== 'completed') {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: Session is not completed')
        }
        if (session.state.stage !== 'closing') {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: Session stage is not closing')
        }
        let hasSummaryCheckpoint = false
        if (this.messageRepo) {
          const messages = await this.messageRepo.findBySessionId(sessionId)
          hasSummaryCheckpoint = messages.some(m => m.metadata?.summary)
        } else {
          hasSummaryCheckpoint = (session.state.history ?? []).some(h => h.reason?.includes('summary'))
        }
        if (!hasSummaryCheckpoint) {
          throw new ServiceError('SESSION_NOT_RESUMABLE', 'SESSION_NOT_RESUMABLE: No summary checkpoint found')
        }
        nextStatus = 'running'
        reason = 'user resume after summary'
        const updatedState = await this.repo.updateState(sessionId, {
          ...session.state,
          stage: 'developing',
        }, reason)
        if (!updatedState) {
          throw new ServiceError('INTERNAL_ERROR', 'Failed to update session state')
        }
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

    const updated = await this.repo.updateStatus(sessionId, nextStatus, reason)
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
