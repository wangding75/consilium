import type { DefaultStateMachine } from '@/engine/state-machine'
import type { Director } from '@/engine/director'
import type { Discussion, AgentCallLog, AgentProfile, IntentResult, EventRecord, DiscussionMessage, VotePayload, AgentOutput, EventPayload } from '@/types'
import type { EventDetector, EventRateLimiter } from '@/engine/events'
import type { EventRepository } from '@/server/repositories/event.repository'
import type { VoteRepository } from '@/server/repositories/vote.repository'
import type { DiscussionRepository } from '@/server/repositories/discussion.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { AgentCallLogRepository } from '@/server/repositories/agent-call-log.repository'
import type { InvitationRepository } from '@/server/repositories/invitation.repository'
import type { DirectorDecisionRepository } from '@/server/repositories/director-decision.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { GetInvitationResult, MessageListResult, RequestSummaryRequest, RequestSummaryResult, RespondInvitationRequest, RespondInvitationResult, SessionDetailResult, SendMessageResult, IntentRequest, IntentResponse, SkipInvitationRequest, SkipInvitationResult, CreateEventRequest, CreateEventResult, EventListResult, VoteRequest, VoteResult } from '@/types/api'
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
    private readonly directorDecisionRepo?: DirectorDecisionRepository,
    private readonly eventRepo?: EventRepository,
    private readonly voteRepo?: VoteRepository,
    private readonly eventDetector?: EventDetector,
    private readonly eventRateLimiter?: EventRateLimiter
  ) {}

  async listDiscussions(): Promise<Discussion[]> {
    try {
      return await this.discussionRepo.findAll()
    } catch (err) {
      throw new ServiceError('DISCUSSION_LIST_FAILED', 'Failed to list discussions', err)
    }
  }

  async listEvents(sessionId: string): Promise<EventListResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)

    const events = await this.eventRepo?.findBySessionId(sessionId) ?? []
    const votes = (await Promise.all(
      events.map((event) => this.voteRepo?.findByEventId(sessionId, event.eventId) ?? Promise.resolve([]))
    )).flat()

    return { sessionId, events, votes }
  }

  async createEvent(
    sessionId: string,
    params: CreateEventRequest,
    trigger: EventRecord['trigger'] = 'manual'
  ): Promise<CreateEventResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)
    if (!this.eventRepo || !this.messageRepo) {
      throw new ServiceError('EVENT_REPOSITORY_UNAVAILABLE', 'Event repository is unavailable')
    }

    const message = await this.messageRepo.save({
      messageId: `msg-event-${crypto.randomUUID()}`,
      sessionId,
      type: 'host',
      content: params.description,
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: { hostMessageKind: 'event' },
    })

    const event: EventRecord = await this.eventRepo.save({
      eventId: `evt-${crypto.randomUUID()}`,
      sessionId,
      eventType: params.eventType,
      trigger,
      status: 'active',
      title: params.title,
      description: params.description,
      reason: trigger === 'manual' ? 'manual event trigger' : 'auto event trigger',
      payload: params.payload,
      relatedMessageId: message.messageId,
      createdAt: new Date().toISOString(),
    })

    const updatedMessage = await this.messageRepo.updateMetadata(message.messageId, {
      ...message.metadata,
      eventId: event.eventId,
    })

    return { event, message: updatedMessage ?? { ...message, metadata: { ...message.metadata, eventId: event.eventId } } }
  }

  async submitVote(
    sessionId: string,
    eventId: string,
    params: VoteRequest
  ): Promise<VoteResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `Session ${sessionId} not found`)
    if (!this.eventRepo || !this.voteRepo) {
      throw new ServiceError('EVENT_REPOSITORY_UNAVAILABLE', 'Event repository is unavailable')
    }

    const event = await this.eventRepo.findById(sessionId, eventId)
    if (!event) throw new ServiceError('EVENT_NOT_FOUND', `Event ${eventId} not found`)
    if (event.eventType !== 'vote') throw new ServiceError('EVENT_NOT_VOTABLE', 'Event is not votable')
    if (event.status !== 'active') throw new ServiceError('EVENT_CLOSED', 'Event is closed')

    const payload = event.payload as VotePayload
    if (!payload.options.some((option) => option.id === params.optionId)) {
      throw new ServiceError('VOTE_OPTION_INVALID', 'Vote option is invalid')
    }

    const voterType = 'user'
    const voterId = 'current-user'
    const existingVote = await this.voteRepo.findByKey(sessionId, eventId, voterType, voterId)
    if (existingVote) return { vote: existingVote, event }

    const vote = await this.voteRepo.save({
      voteId: `vote-${crypto.randomUUID()}`,
      sessionId,
      eventId,
      voterType,
      voterId,
      optionId: params.optionId,
      createdAt: new Date().toISOString(),
    })
    const updatedEvent = await this.eventRepo.updateTally(sessionId, eventId, params.optionId)

    return { vote, event: updatedEvent ?? event }
  }

  private async detectAndCreateEvents(
    session: NonNullable<Awaited<ReturnType<SessionRepository['findById']>>>,
    sessionId: string,
    messages: DiscussionMessage[],
    lastOutput: AgentOutput
  ): Promise<CreateEventResult[]> {
    if (!this.eventDetector || !this.eventRateLimiter || !this.eventRepo) return []

    const detection = await this.eventDetector.detect(session, messages, lastOutput)
    if (!detection.eventTriggered || detection.confidence < 0.6) return []

    const recentEvents = await this.eventRepo.findRecentBySessionId(sessionId, 20)
    const rateLimitResult = this.eventRateLimiter.check({
      sessionId,
      eventType: detection.eventType!,
      recentMessages: messages,
      recentEvents,
      currentMessageIndex: messages.length - 1,
    })
    if (!rateLimitResult.allowed) return []

    const result = await this.createEvent(
      sessionId,
      {
        eventType: detection.eventType!,
        title: detection.title ?? detection.reason ?? '',
        description: detection.description ?? detection.reason ?? '',
        payload: detection.payload as EventPayload,
      },
      'auto'
    )
    return [result]
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
        fromSnapshot: false,
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

  async sendMessage(
    sessionId: string,
    params: { content: string; clientMessageId?: string }
  ): Promise<SendMessageResult & { messages: DiscussionMessage[] }> {
    const result = await this.sendUserMessage(sessionId, params.content, params.clientMessageId)
    const allMessages = await this.messageRepo?.findBySessionId(sessionId) ?? []
    return { ...result, messages: allMessages }
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

    const lastAgentMessage = agentMessages[agentMessages.length - 1]
    const createdEventResults = lastAgentMessage
      ? await this.detectAndCreateEvents(
          session,
          sessionId,
          [...existingMessages, ...(userMessage ? [userMessage] : []), ...agentMessages],
          { agentId: lastAgentMessage.roleId ?? '', roleId: lastAgentMessage.roleId ?? '', messageType: lastAgentMessage.type === 'host' ? 'host' : 'character', content: lastAgentMessage.content }
        )
      : []
    const createdEvents = createdEventResults.map((r) => r.event)
    const eventMessages = createdEventResults.map((r) => r.message)

    return {
      sessionId,
      runId,
      clientMessageId,
      userMessage,
      agentMessages,
      createdEvents: createdEvents.length > 0 ? createdEvents : undefined,
      eventMessages: eventMessages.length > 0 ? eventMessages : undefined,
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
    if (!this.director) {
      return {}
    }

    const pendingInvitation = await this.invitationRepo?.findPendingBySessionId(session.id) ?? null
    const recentEvents = await this.eventRepo?.findRecentBySessionId(session.id, 10) ?? []
    const input: DirectorInputType = {
      session,
      messages,
      roles,
      trigger,
      intent,
      pendingInvitation,
      recentEvents,
    }

    let decision: DirectorDecisionRecord
    try {
      decision = await this.director.decide(input)
    } catch {
      throw new ServiceError('DIRECTOR_DECISION_FAILED', 'Director decision failed')
    }

    await this.directorDecisionRepo?.save(decision)

    for (const event of recentEvents.filter((item) => !item.directorConsumedAt)) {
      await this.eventRepo?.markDirectorConsumed(session.id, event.eventId, decision.createdAt)
    }

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
    sessionId: string,
    params: RequestSummaryRequest
  ): Promise<RequestSummaryResult> {
    const session = await this.sessionRepo?.findById(sessionId)
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', `SESSION_NOT_FOUND: Session ${sessionId} not found`)

    if (session.status !== 'running') {
      throw new ServiceError('SESSION_NOT_OPERABLE', 'SESSION_NOT_OPERABLE: Session is not running')
    }

    const messages = await this.messageRepo?.findBySessionId(sessionId) ?? []
    const nonSystemMessages = messages.filter(m => m.type !== 'system')
    // In closing stage, skip INSUFFICIENT_CONTEXT check — director already concluded
    if (nonSystemMessages.length < 2 && session.state.stage !== 'closing') {
      throw new ServiceError('INSUFFICIENT_CONTEXT', 'INSUFFICIENT_CONTEXT: Not enough discussion history to summarize')
    }

    const directorResult = await this.runDirectorAndProduceSideEffects(
      session,
      messages,
      [],
      'summary_request',
    )

    const summaryId = `sum-${crypto.randomUUID()}`
    const summary: DiscussionSummary = {
      summaryId,
      sessionId,
      messageId: '',
      consensus: ['讨论已达成基本共识'],
      disagreements: [],
      recommendations: ['继续深入讨论'],
      nextSteps: ['等待用户决定下一步'],
      checkpointCreatedAt: new Date().toISOString(),
    }

    const summaryMessage = await this.messageRepo?.save({
      messageId: `msg-summary-${crypto.randomUUID()}`,
      sessionId,
      type: 'host',
      content: '讨论总结已生成',
      status: 'completed',
      createdAt: new Date().toISOString(),
      metadata: {
        hostMessageKind: 'final_summary',
        summary,
      },
    })

    summary.messageId = summaryMessage?.messageId ?? ''

    await this.sessionRepo?.updateStatus(sessionId, 'completed', 'summary requested')

    return {
      sessionId,
      summary,
      summaryMessage: summaryMessage!,
      sessionStatus: 'completed',
      directorDecision: directorResult.directorDecision!,
    }
  }

}
