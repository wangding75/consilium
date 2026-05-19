import type { Discussion, AgentCallLog } from '@/types'
import type { DiscussionRepository } from '@/server/repositories/discussion.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { AgentCallLogRepository } from '@/server/repositories/agent-call-log.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { SessionDetailResult, MessageListResult, SendMessageResult } from '@/types/api'
import { ServiceError } from '@/server/errors'

const DEFAULT_MODEL = 'claude-3-5-haiku-latest'

export class DiscussionService {
  constructor(
    private readonly discussionRepo: DiscussionRepository,
    private readonly sessionRepo?: SessionRepository,
    private readonly templateRepo?: TemplateRepository,
    private readonly messageRepo?: MessageRepository,
    private readonly callLogRepo?: AgentCallLogRepository,
    private readonly orchestrator?: DiscussionOrchestrator
  ) {}

  async listDiscussions(): Promise<Discussion[]> {
    try {
      return await this.discussionRepo.findAll()
    } catch (err) {
      throw new ServiceError('DISCUSSION_LIST_FAILED', 'Failed to list discussions', err)
    }
  }

  async getSessionDetail(sessionId: string): Promise<SessionDetailResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    const template = await this.templateRepo?.findById(session.templateId)

    const roles = (template?.roles ?? []).map((r) => ({
      roleId: r.id,
      name: r.name,
      agentType: r.agentType ?? (r.isHost ? ('host' as const) : ('expert' as const)),
      avatar: r.avatarEmoji ?? '',
      model: DEFAULT_MODEL,
    }))

    return {
      sessionId: session.id,
      topic: session.topic,
      template: {
        templateId: template?.id ?? session.templateId,
        name: template?.name ?? '',
      },
      status: session.status,
      roles,
      activeSpeakerId: session.state.lastSpeakerId ?? null,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
    }
  }

  async getMessages(
    sessionId: string,
    opts: { limit: number; before?: string }
  ): Promise<MessageListResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    const messages = await this.messageRepo?.findBySessionId(sessionId, { limit: opts.limit }) ?? []

    return {
      sessionId,
      messages,
      activeSpeakerId: session.state.lastSpeakerId ?? null,
      hasMore: false,
    }
  }

  async sendUserMessage(
    sessionId: string,
    content: string,
    _clientMessageId?: string
  ): Promise<SendMessageResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    const template = await this.templateRepo?.findById(session.templateId)
    const existingMessages = await this.messageRepo?.findBySessionId(sessionId) ?? []
    const isOpening = content.trim() === '' && existingMessages.length === 0

    if (content.trim() === '' && !isOpening) {
      throw new ServiceError('MESSAGE_EMPTY', 'Message content cannot be empty')
    }

    const runId = `run-${crypto.randomUUID()}`
    let userMessage = null

    if (!isOpening) {
      const msg = await this.messageRepo?.save({
        messageId: `msg-user-${crypto.randomUUID()}`,
        sessionId,
        type: 'user',
        content,
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
      userMessage = msg ?? null
    }

    const profiles = (template?.roles ?? []).map((r) => ({
      agentId: r.id,
      roleId: r.id,
      agentType: r.agentType ?? (r.isHost ? ('host' as const) : ('expert' as const)),
      name: r.name,
      persona: r.persona,
      systemPrompt: r.systemPrompt,
      model: DEFAULT_MODEL,
      visible: true,
    }))

    const orchestratorResult = await this.orchestrator?.run({
      sessionId,
      runId,
      topic: session.topic,
      templateName: template?.name ?? '',
      profiles,
      messageHistory: [...existingMessages, ...(userMessage ? [userMessage] : [])],
      triggerContent: isOpening ? null : content,
    })

    const agentMessages = orchestratorResult?.agentMessages ?? []
    const callLogs = orchestratorResult?.callLogs ?? []

    for (const msg of agentMessages) {
      await this.messageRepo?.save(msg)
    }

    for (const logData of callLogs) {
      const log: AgentCallLog = {
        id: `log-${crypto.randomUUID()}`,
        ...logData,
        createdAt: new Date().toISOString(),
      }
      await this.callLogRepo?.save(log)
    }

    return {
      sessionId,
      runId,
      userMessage,
      agentMessages,
      activeSpeakerId: orchestratorResult?.activeSpeakerId ?? null,
    }
  }
}
