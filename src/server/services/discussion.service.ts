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
import { DefaultDirector } from '@/engine/director'
import type { DirectorInput as DirectorInputType, DirectorDecisionRecord, Invitation, DiscussionSummary, DiscussionMessage as DMsg } from '@/types'

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
      ...(await this.runDirectorAndProduceSideEffects(session, [...existingMessages, ...(userMessage ? [userMessage] : [])], profiles, 'user_message', intentResponse?.intent)),
    }
  }

  private async runDirectorAndProduceSideEffects(
    session: NonNullable<Parameters<SessionRepository['findById']>[0] extends undefined ? never : Awaited<ReturnType<SessionRepository['findById']>>>,
    messages: DMsg[],
    roles: AgentProfile[],
    trigger: DirectorInputType['trigger'],
    intent?: IntentResult
  ): Promise<{ directorDecision?: DirectorDecisionRecord; pendingInvitation?: Invitation | null; summary?: DiscussionSummary | null }> {
    if (!this.director || !this.directorDecisionRepo) {
      return {}
    }

    const pendingInvitation = await this.invitationRepo?.findPendingBySessionId(session.id) ?? null
    const input: DirectorInputType = {
      session,
      messages,
      roles,
      trigger,
      intent,
      pendingInvitation,
    }

    let decision: DirectorDecisionRecord
    try {
      decision = await this.director.decide(input)
    } catch {
      throw new ServiceError('DIRECTOR_DECISION_FAILED', 'Director decision failed')
    }

    await this.directorDecisionRepo.save(decision)

    let resultInvitation: Invitation | undefined
    let resultSummary: DiscussionSummary | null | undefined

    if (decision.action === 'invite_user') {
      const invitation: Invitation = {
        invitationId: `inv-${crypto.randomUUID()}`,
        sessionId: session.id,
        status: 'pending',
        prompt: '请发表您的看法',
        reason: decision.reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await this.invitationRepo?.save(invitation)
      resultInvitation = invitation

      await this.messageRepo?.save({
        messageId: `msg-host-${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'host',
        content: '主持人邀请您发表看法',
        status: 'completed',
        createdAt: new Date().toISOString(),
        metadata: { hostMessageKind: 'invitation', invitationId: invitation.invitationId },
      })
    } else if (decision.action === 'trigger_event' && decision.eventCandidate) {
      await this.messageRepo?.save({
        messageId: `msg-host-${crypto.randomUUID()}`,
        sessionId: session.id,
        type: 'host',
        content: `事件候选：${decision.eventCandidate.reason}`,
        status: 'completed',
        createdAt: new Date().toISOString(),
        metadata: { hostMessageKind: 'event_candidate', eventCandidate: decision.eventCandidate },
      })
    }

    return { directorDecision: decision, pendingInvitation: resultInvitation, summary: resultSummary }
  }

  async getPendingInvitation(sessionId: string): Promise<GetInvitationResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session ${sessionId} not found`)
    return {
      sessionId,
      invitation: await this.invitationRepo?.findPendingBySessionId(sessionId) ?? null,
    }
  }

  async respondInvitation(
    sessionId: string,
    invitationId: string,
    params: RespondInvitationRequest
  ): Promise<RespondInvitationResult> {
    const content = params.content?.trim()
    if (!content) {
      throw new ServiceError('MESSAGE_EMPTY', 'MESSAGE_EMPTY: Invitation response content cannot be empty')
    }

    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session ${sessionId} not found`)

    // Idempotent check via clientMessageId — must precede invitation status check
    let userMessage = null
    if (params.clientMessageId) {
      const existing = await this.messageRepo?.findByClientMessageId(params.clientMessageId, sessionId)
      if (existing) {
        userMessage = existing
      }
    }

    const invitation = await this.invitationRepo?.findById(invitationId)
    if (!invitation || invitation.sessionId !== sessionId) {
      throw new ServiceError('INVITATION_INVALID', 'INVITATION_INVALID: Invitation is not valid for response')
    }

    // Skip status check on idempotent retry — invitation may already be 'responded'
    if (!userMessage && invitation.status !== 'pending') {
      throw new ServiceError('INVITATION_INVALID', 'INVITATION_INVALID: Invitation is not valid for response')
    }

    if (!userMessage) {
      userMessage = await this.messageRepo?.save({
        messageId: `msg-user-${crypto.randomUUID()}`,
        sessionId,
        type: 'user',
        content,
        status: 'completed',
        clientMessageId: params.clientMessageId,
        createdAt: new Date().toISOString(),
        metadata: { hostMessageKind: 'invitation', invitationId },
      }) ?? null
    }

    await this.invitationRepo?.updateStatus(invitationId, 'responded', {
      respondedByMessageId: userMessage?.messageId,
      clientMessageId: params.clientMessageId,
    })

    const directorResult = await this.runDirectorAndProduceSideEffects(
      session,
      await this.messageRepo?.findBySessionId(sessionId) ?? [],
      [],
      'invitation_response',
    )

    const orchestratorResult = await this.orchestrator?.run({
      sessionId,
      runId: `run-${crypto.randomUUID()}`,
      topic: session.topic,
      templateName: '',
      profiles: [],
      messageHistory: await this.messageRepo?.findBySessionId(sessionId) ?? [],
      triggerContent: content,
    })

    return {
      sessionId,
      invitation: (await this.invitationRepo?.findById(invitationId))!,
      userMessage,
      agentMessages: orchestratorResult?.agentMessages ?? [],
      activeSpeakerId: orchestratorResult?.activeSpeakerId ?? session.state.lastSpeakerId ?? null,
      directorDecision: directorResult.directorDecision,
      pendingInvitation: directorResult.pendingInvitation,
    }
  }

  async skipInvitation(
    sessionId: string,
    invitationId: string,
    params: SkipInvitationRequest
  ): Promise<SkipInvitationResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session ${sessionId} not found`)

    const invitation = await this.invitationRepo?.findById(invitationId)
    if (!invitation || invitation.sessionId !== sessionId) {
      throw new ServiceError('INVITATION_INVALID', 'INVITATION_INVALID: Invitation is not valid for skip')
    }

    // Idempotent: already skipped
    if (invitation.status === 'skipped') {
      const directorResult = await this.runDirectorAndProduceSideEffects(
        session,
        await this.messageRepo?.findBySessionId(sessionId) ?? [],
        [],
        'invitation_skip',
      )
      return {
        sessionId,
        invitation,
        agentMessages: [],
        activeSpeakerId: session.state.lastSpeakerId ?? null,
        directorDecision: directorResult.directorDecision,
        pendingInvitation: directorResult.pendingInvitation,
      }
    }

    if (invitation.status !== 'pending') {
      throw new ServiceError('INVITATION_INVALID', 'INVITATION_INVALID: Invitation is not valid for skip')
    }

    await this.invitationRepo?.updateStatus(invitationId, 'skipped', {
      clientMessageId: params.clientMessageId,
    })

    const updatedInvitation = await this.invitationRepo?.findById(invitationId)

    const directorResult = await this.runDirectorAndProduceSideEffects(
      session,
      await this.messageRepo?.findBySessionId(sessionId) ?? [],
      [],
      'invitation_skip',
    )

    const orchestratorResult = await this.orchestrator?.run({
      sessionId,
      runId: `run-${crypto.randomUUID()}`,
      topic: session.topic,
      templateName: '',
      profiles: [],
      messageHistory: await this.messageRepo?.findBySessionId(sessionId) ?? [],
      triggerContent: null,
    })

    return {
      sessionId,
      invitation: updatedInvitation!,
      agentMessages: orchestratorResult?.agentMessages ?? [],
      activeSpeakerId: orchestratorResult?.activeSpeakerId ?? session.state.lastSpeakerId ?? null,
      directorDecision: directorResult.directorDecision,
      pendingInvitation: directorResult.pendingInvitation,
    }
  }

  async requestSummary(
    _sessionId: string,
    _params: RequestSummaryRequest
  ): Promise<RequestSummaryResult> {
    throw new Error('not implemented')
  }

}
