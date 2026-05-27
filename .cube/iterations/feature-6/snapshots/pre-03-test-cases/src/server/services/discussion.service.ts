import type { DefaultStateMachine } from '@/engine/state-machine'
import type { Director } from '@/engine/director'
import type { Discussion, AgentCallLog, AgentProfile, IntentResult } from '@/types'
import type { DiscussionRepository } from '@/server/repositories/discussion.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { AgentCallLogRepository } from '@/server/repositories/agent-call-log.repository'
import type { InvitationRepository } from '@/server/repositories/invitation.repository'
import type { DirectorDecisionRepository } from '@/server/repositories/director-decision.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { GetInvitationResult, MessageListResult, RequestSummaryRequest, RequestSummaryResult, RespondInvitationRequest, RespondInvitationResult, SessionDetailResult, SendMessageResult, IntentRequest, IntentResponse, SkipInvitationRequest, SkipInvitationResult } from '@/types/api'
import { ServiceError } from '@/server/errors'
import { RuleBasedIntentClassifier } from '@/engine/intent'

const DEFAULT_MODEL = 'claude-3-5-haiku-latest'

export class DiscussionService {
  constructor(
    private readonly discussionRepo: DiscussionRepository,
    private readonly sessionRepo?: SessionRepository,
    private readonly templateRepo?: TemplateRepository,
    private readonly messageRepo?: MessageRepository,
    private readonly callLogRepo?: AgentCallLogRepository,
    private readonly orchestrator?: DiscussionOrchestrator,
    private readonly stateMachine?: DefaultStateMachine,
    private readonly director?: Director,
    private readonly invitationRepo?: InvitationRepository,
    private readonly directorDecisionRepo?: DirectorDecisionRepository
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
      phase: session.state.stage,
      state: session.state,
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

    const messages = await this.messageRepo?.findBySessionId(sessionId, { limit: opts.limit, before: opts.before }) ?? []

    return {
      sessionId,
      messages,
      activeSpeakerId: session.state.lastSpeakerId ?? null,
      hasMore: messages.length >= opts.limit,
    }
  }

  async recognizeIntent(
    sessionId: string,
    params: IntentRequest
  ): Promise<IntentResponse> {
    const content = params.content?.trim()
    if (!content) {
      throw new ServiceError('MESSAGE_EMPTY', 'Message content cannot be empty')
    }

    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    if (session.status !== 'running') {
      throw new ServiceError('SESSION_NOT_OPERABLE', 'Session cannot accept intervention in current status')
    }

    const template = await this.templateRepo?.findById(session.templateId)
    const roles = (template?.roles ?? []).map((r) => ({
      roleId: r.id,
      name: r.name,
      agentType: r.agentType ?? (r.isHost ? ('host' as const) : ('expert' as const)),
      avatar: r.avatarEmoji ?? '',
      model: DEFAULT_MODEL,
    }))

    const profiles: AgentProfile[] = (template?.roles ?? []).map((r) => ({
      agentId: r.id,
      roleId: r.id,
      agentType: r.agentType ?? (r.isHost ? ('host' as const) : ('expert' as const)),
      name: r.name,
      persona: r.persona,
      systemPrompt: r.systemPrompt,
      model: DEFAULT_MODEL,
      visible: true,
    }))

    const messages = await this.messageRepo?.findBySessionId(sessionId) ?? []

    // INSUFFICIENT_CONTEXT: summarize/decide intent requires >= 2 non-system messages
    const classifier = new RuleBasedIntentClassifier()
    const intent: IntentResult = await classifier.classify({
      sessionId,
      content,
      roles: profiles,
      messages,
      debug: params.debug,
      forceAsPlainMessage: params.forceAsPlainMessage,
    })

    if (intent.type === 'decide' && intent.target?.action === 'summarize') {
      const nonSystemMessages = messages.filter(m => m.type !== 'system')
      if (nonSystemMessages.length < 2) {
        throw new ServiceError('INSUFFICIENT_CONTEXT', 'Not enough discussion history to summarize')
      }
    }

    return {
      sessionId,
      clientMessageId: params.clientMessageId,
      intent,
      activeSpeakerId: session.state.lastSpeakerId ?? null,
    }
  }

  async sendUserMessage(
    sessionId: string,
    content: string,
    clientMessageId?: string,
    intentResponse?: IntentResponse
  ): Promise<SendMessageResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    if (session.status !== 'running') {
      throw new ServiceError('SESSION_NOT_OPERABLE', 'Session cannot accept messages in current status')
    }

    // SESSION_CONTEXT_MISMATCH: intentResponse must belong to the same session
    if (intentResponse && intentResponse.sessionId !== sessionId) {
      throw new ServiceError('SESSION_CONTEXT_MISMATCH', 'Intent response does not match the current session')
    }

    const template = await this.templateRepo?.findById(session.templateId)
    const existingMessages = await this.messageRepo?.findBySessionId(sessionId) ?? []
    const isOpening = content.trim() === '' && existingMessages.length === 0

    if (content.trim() === '' && !isOpening) {
      throw new ServiceError('MESSAGE_EMPTY', 'Message content cannot be empty')
    }

    // clientMessageId dedup: check for existing message
    if (clientMessageId) {
      const existingUserMsg = await this.messageRepo?.findByClientMessageId(clientMessageId, sessionId)
      if (existingUserMsg && existingUserMsg.status === 'completed') {
        const replies = await this.messageRepo?.findRepliesByClientMessageId(sessionId, clientMessageId) ?? []
        if (replies.length > 0) {
          return {
            sessionId,
            runId: `run-idempotent-${crypto.randomUUID()}`,
            clientMessageId,
            userMessage: existingUserMsg,
            agentMessages: replies,
            activeSpeakerId: session.state.lastSpeakerId ?? null,
          }
        }
      }
      if (existingUserMsg && (existingUserMsg.status === 'failed' || existingUserMsg.status === 'pending')) {
        await this.messageRepo?.updateStatus(existingUserMsg.messageId, 'pending')
      }
    }

    const runId = `run-${crypto.randomUUID()}`
    let userMessage = null

    if (!isOpening) {
      const existingUserMsg = clientMessageId
        ? await this.messageRepo?.findByClientMessageId(clientMessageId, sessionId)
        : null
      if (existingUserMsg) {
        await this.messageRepo?.updateStatus(existingUserMsg.messageId, 'completed')
        userMessage = { ...existingUserMsg, status: 'completed' as const }
      } else {
        const msg = await this.messageRepo?.save({
          messageId: `msg-user-${crypto.randomUUID()}`,
          sessionId,
          type: 'user',
          content,
          status: 'completed',
          clientMessageId,
          createdAt: new Date().toISOString(),
          metadata: intentResponse ? {
            intent: intentResponse.intent,
            intentLabel: intentResponse.intent.type === 'command' || intentResponse.intent.type === 'decide' ? '指令' : undefined,
          } : undefined,
        })
        userMessage = msg ?? null
      }
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

    let orchestratorResult
    try {
      orchestratorResult = await this.orchestrator?.run({
        sessionId,
        runId,
        topic: session.topic,
        templateName: template?.name ?? '',
        profiles,
        messageHistory: [...existingMessages, ...(userMessage ? [userMessage] : [])],
        triggerContent: isOpening ? null : content,
        intent: intentResponse?.intent,
        schedulerHint: intentResponse?.intent.schedulerHint,
      })
    } catch (err) {
      if (userMessage) await this.messageRepo?.updateStatus(userMessage.messageId, 'failed')
      throw new ServiceError('AGENT_GENERATION_FAILED', 'Agent generation failed', err)
    }

    // Vote boundary: record system message for deferred intents with a message
    if (intentResponse?.intent.execution.status === 'deferred' && intentResponse.intent.execution.message) {
      await this.messageRepo?.save({
        messageId: `msg-system-${crypto.randomUUID()}`,
        sessionId,
        type: 'system',
        content: intentResponse.intent.execution.message,
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
    }

    const agentMessages = orchestratorResult?.agentMessages ?? []
    if (agentMessages.length === 0 && profiles.length > 0) {
      if (userMessage) await this.messageRepo?.updateStatus(userMessage.messageId, 'failed')
      throw new ServiceError('NO_AVAILABLE_AGENT', 'No agent available to respond')
    }
    const callLogs = orchestratorResult?.callLogs ?? []

    for (const msg of agentMessages) {
      await this.messageRepo?.save({
        ...msg,
        metadata: { ...msg.metadata, replyToClientMessageId: clientMessageId },
      })
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
      clientMessageId,
      userMessage,
      agentMessages,
      activeSpeakerId: orchestratorResult?.activeSpeakerId ?? null,
    }
  }

  async getPendingInvitation(sessionId: string): Promise<GetInvitationResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)
    return {
      sessionId,
      invitation: await this.invitationRepo?.findPendingBySessionId(sessionId) ?? null,
    }
  }

  async respondInvitation(
    _sessionId: string,
    _invitationId: string,
    _params: RespondInvitationRequest
  ): Promise<RespondInvitationResult> {
    throw new Error('not implemented')
  }

  async skipInvitation(
    _sessionId: string,
    _invitationId: string,
    _params: SkipInvitationRequest
  ): Promise<SkipInvitationResult> {
    throw new Error('not implemented')
  }

  async requestSummary(
    _sessionId: string,
    _params: RequestSummaryRequest
  ): Promise<RequestSummaryResult> {
    throw new Error('not implemented')
  }

}
