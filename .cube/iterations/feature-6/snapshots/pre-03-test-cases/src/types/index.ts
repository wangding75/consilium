export type * from './api'
// Core domain types for consilium — 智囊团 multi-agent discussion platform

export type DiscussionStage = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'
export type SessionLifecycleStatus = 'running' | 'completed' | 'archived' | 'active'
export type NormalizedSessionLifecycleStatus = Exclude<SessionLifecycleStatus, 'active'>
export type LegacySessionLifecycleStatus = SessionLifecycleStatus
export type SessionStatusAction = 'archive' | 'complete' | 'resume'

export type IntentType = 'interrupt' | 'command' | 'decide' | 'passive'
export type CommandAction = 'reply' | 'rebut' | 'summarize' | 'vote' | 'end'
export type IntentExecutionStatus = 'immediate' | 'deferred' | 'recorded' | 'unsupported'

export interface StateHistoryEntry {
  from: string
  to: string
  reason: string
  createdAt: string
}

export interface DiscussionState {
  stage: DiscussionStage
  turnCount: number
  lastSpeakerId: string | null
  history?: StateHistoryEntry[]
}

export type AgentType = 'host' | 'expert' | 'critic'

export interface Role {
  id: string
  name: string
  persona: string
  isHost: boolean
  agentType?: AgentType
  systemPrompt: string
  avatarEmoji?: string
}

export type EventType = 'face-slap' | 'side-taking' | 'vote' | 'reversal'

export interface CommandTarget {
  roleId?: string
  action?: CommandAction
  eventType?: EventType
  referenceRoleId?: string
}

export interface SchedulerHint {
  preferredSpeakerId?: string
  preferredAgentType?: AgentType
  reason: string
}

export interface IntentDebugSummary {
  classifierMode: 'mock' | 'rule' | 'llm'
  matchedRule?: string
  confidence: number
  type: IntentType
  target?: CommandTarget
  schedulerHint?: SchedulerHint
}

export interface IntentResult {
  type: IntentType
  confidence: number
  rawText: string
  target?: CommandTarget
  schedulerHint?: SchedulerHint
  execution: {
    status: IntentExecutionStatus
    message?: string
  }
  debugSummary?: IntentDebugSummary
}

export interface DiscussionEvent {
  id: string
  type: EventType
  trigger: string
  description: string
}

export interface RhythmConfig {
  maxTurnsPerStage: Partial<Record<DiscussionStage, number>>
  minTurnsBeforeClimax: number
}

export interface Template {
  id: string
  name: string
  description: string
  worldview: string
  roles: Role[]
  events: DiscussionEvent[]
  rhythmConfig: RhythmConfig
}

export interface Message {
  id: string
  sessionId: string
  roleId: string
  content: string
  type: 'text' | 'event' | 'system'
  timestamp: number
}

export interface Session {
  id: string
  templateId: string
  topic: string
  status: LegacySessionLifecycleStatus
  modelStrategyId?: string
  state: DiscussionState
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// Discussion represents a runtime discussion run (to be expanded in iteration 2+)
export interface Discussion {
  id: string
  sessionId: string
  status: SessionLifecycleStatus
  createdAt: number
}

export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
}

// Iteration 2: replaced AgentProfile definition
export interface AgentProfile {
  agentId: string
  roleId: string
  agentType: AgentType
  name: string
  persona: string
  systemPrompt: string
  model: string
  temperature?: number
  visible: boolean
}

// Iteration 2: replaced AgentOutput definition
export interface AgentOutput {
  agentId: string
  roleId: string
  messageType: 'host' | 'character'
  content: string
  metadata?: {
    roundIndex?: number
    isMock?: boolean
    promptTokens?: number
    completionTokens?: number
    durationMs?: number
  }
}

// DiscussionMessage is stored in MessageRepository (iteration 2)
export interface DiscussionMessage {
  messageId: string
  sessionId: string
  type: 'host' | 'character' | 'user' | 'system'
  roleId?: string
  agentType?: AgentType
  content: string
  status: 'pending' | 'completed' | 'streaming' | 'failed'
  clientMessageId?: string
  createdAt: string
  metadata?: {
    roundIndex?: number
    isMock?: boolean
    promptTokens?: number
    completionTokens?: number
    durationMs?: number
    replyToClientMessageId?: string
    intent?: IntentResult
    intentLabel?: string
    hostMessageKind?: HostMessageKind
    invitationId?: string
    summary?: DiscussionSummary
  }
}

// AgentCallLog is persisted by Service layer (iteration 2)
export interface AgentCallLog {
  id: string
  sessionId: string
  runId: string
  messageId?: string
  agentId: string
  roleId: string
  provider: string
  model: string
  inputSummary: string
  outputSummary?: string
  output?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  cost?: number
  durationMs: number
  status: 'success' | 'failed'
  errorCode?: string
  errorMessage?: string
  createdAt: string
}

// Pre-save log data constructed by Orchestrator (without id/createdAt)
export type AgentCallLogData = Omit<AgentCallLog, 'id' | 'createdAt'>

// Scheduler types (iteration 2)
export interface SpeakerSelectionInput {
  sessionId: string
  roles: AgentProfile[]
  messageHistory: DiscussionMessage[]
  roundIndex: number
  lastSpeakerId?: string
  policy?: string
  schedulerHint?: SchedulerHint
}

export interface SpeakerSelectionResult {
  speakerIds: string[]
  reason: string
}

// Orchestrator types (iteration 2)
export interface OrchestratorInput {
  sessionId: string
  runId: string
  topic: string
  templateName: string
  profiles: AgentProfile[]
  messageHistory: DiscussionMessage[]
  triggerContent: string | null
  intent?: IntentResult
  schedulerHint?: SchedulerHint
}

export interface OrchestratorResult {
  agentMessages: DiscussionMessage[]
  callLogs: AgentCallLogData[]
  activeSpeakerId: string | null
}

// ContextBuilder input type (iteration 2)
export interface ContextBuilderInput {
  sessionId: string
  topic: string
  templateName: string
  role: AgentProfile
  messageHistory: DiscussionMessage[]
  maxMessages?: number
  maxChars?: number
}


export type DirectorAction = 'continue' | 'invite_user' | 'trigger_event' | 'conclude'
export type DirectorTrigger = 'opening' | 'user_message' | 'invitation_response' | 'invitation_skip' | 'summary_request' | 'auto'
export type HostMessageKind = 'opening' | 'transition' | 'invitation' | 'event_candidate' | 'stage_summary' | 'final_summary'
export type InvitationStatus = 'pending' | 'responded' | 'skipped' | 'expired'

export interface DirectorEventCandidate {
  type: EventType
  reason: string
}

export interface DirectorSummaryHint {
  reason: string
  sections: Array<'consensus' | 'disagreements' | 'recommendations' | 'nextSteps'>
}

export interface Invitation {
  invitationId: string
  sessionId: string
  status: InvitationStatus
  prompt: string
  reason: string
  createdByMessageId?: string
  respondedByMessageId?: string
  clientMessageId?: string
  createdAt: string
  updatedAt: string
}

export interface DiscussionSummary {
  summaryId: string
  sessionId: string
  messageId: string
  consensus: string[]
  disagreements: string[]
  recommendations: string[]
  nextSteps: string[]
  checkpointCreatedAt: string
}

export interface DirectorInput {
  session: Session
  messages: DiscussionMessage[]
  roles: AgentProfile[]
  trigger: DirectorTrigger
  intent?: IntentResult
  pendingInvitation?: Invitation | null
  lastSchedulerHint?: SchedulerHint
}

export interface DirectorDecisionRecord {
  decisionId: string
  sessionId: string
  action: DirectorAction
  reason: string
  confidence: number
  schedulerHint?: SchedulerHint
  stageSuggestion?: DiscussionStage
  eventCandidate?: DirectorEventCandidate
  summaryHint?: DirectorSummaryHint
  createdAt: string
}

export interface InvitationStatusPatch {
  respondedByMessageId?: string
  clientMessageId?: string
}
