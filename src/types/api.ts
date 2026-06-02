import type {
  AgentType,
  DiscussionMessage,
  DiscussionStage,
  DiscussionState,
  IntentResult,
  LegacySessionLifecycleStatus,
  SessionLifecycleStatus,
  SessionStatusAction,
  StateHistoryEntry,
  DirectorDecisionRecord,
  DiscussionSummary,
  Invitation,
  EventRecord,
  VoteRecord,
  EventType,
  EventPayload,
  DiscussionTemplate,
  TemplateRole,
  ModelStrategy,
} from '@/types'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> =
  | { success: true; data: T; error?: never; requestId: string }
  | { success: false; data: null; error: ApiError; requestId: string }

export interface CreateSessionParams {
  topic: string
  templateId: string
  modelStrategyId?: string
}

export interface CreateSessionResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string; version: string }
  modelStrategy: { modelStrategyId: string; name: string; selectedByDefault: boolean }
  status: SessionLifecycleStatus
  createdAt: number
}

// ─── Template API DTOs (iteration 8) ───────────────────────────────────────

export interface TemplateSummary {
  templateId: string
  version: string
  name: string
  description: string
  category: string
  tags: string[]
  roleCount: number
  eventCount: number
  usageCount: number
  sessionCount: number
  favoriteCount: number
  isBuiltin: boolean
  availableForSessionCreation: boolean
}

export interface TemplateListResult {
  templates: TemplateSummary[]
}

export interface TemplateDetailResult {
  template: DiscussionTemplate
}

export interface TemplateRolesResult {
  templateId: string
  templateVersion: string
  roles: TemplateRole[]
}

export interface RoleConfigPatchRequest {
  model?: string
  temperature?: number
  maxCharsPerTurn?: number
}

export interface RoleRuntimeConfig {
  model?: string
  temperature?: number
  maxCharsPerTurn?: number
}

export interface RoleConfigPatchResult {
  templateId: string
  templateVersion: string
  roleId: string
  config: RoleRuntimeConfig
  effectScope: 'future_sessions_only'
}

// ─── Model strategy API DTOs (iteration 8) ─────────────────────────────────

export interface ModelStrategiesResult {
  strategies: ModelStrategy[]
  defaultModelStrategyId: string
}

// ─── Session list DTOs (iteration 8) ───────────────────────────────────────

export interface SessionListItem {
  sessionId: string
  topic: string
  status: SessionLifecycleStatus
  template: {
    templateId: string
    name: string
    version?: string
    fromSnapshot: boolean
    fallbackReason?: string
  }
  modelStrategy?: {
    modelStrategyId: string
    name: string
    selectedByDefault?: boolean
    fromSnapshot: boolean
  }
  roleCount: number
  eventCount: number
  messageCount: number
  createdAt: number
  updatedAt: number
}

export interface SessionListResult {
  sessions: SessionListItem[]
}

// Iteration 2: discussion API types
export interface SessionDetailResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string; version?: string; fromSnapshot: boolean; fallbackReason?: string }
  modelStrategy?: { modelStrategyId: string; name: string; selectedByDefault?: boolean; fromSnapshot: boolean; fallbackReason?: string }
  status: LegacySessionLifecycleStatus
  phase?: DiscussionStage
  state?: DiscussionState
  roles: Array<{
    roleId: string
    name: string
    agentType: AgentType
    avatar: string
    model: string
  }>
  activeSpeakerId: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageListResult {
  sessionId: string
  messages: DiscussionMessage[]
  activeSpeakerId: string | null
  hasMore: boolean
}

export interface SendMessageParams {
  content: string
  clientMessageId?: string
  intentResponse?: IntentResponse
}

export interface IntentRequest {
  content: string
  clientMessageId?: string
  debug?: boolean
  forceAsPlainMessage?: boolean
}

export interface IntentResponse {
  sessionId: string
  clientMessageId?: string
  intent: IntentResult
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
  summary?: DiscussionSummary | null
}

export interface SendMessageResult {
  sessionId: string
  runId: string
  clientMessageId?: string
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  eventMessages?: DiscussionMessage[]
  createdEvents?: EventRecord[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
  summary?: DiscussionSummary | null
}

export interface CreateEventRequest {
  eventType: EventType
  title: string
  description: string
  payload: EventPayload
}

export interface VoteRequest {
  optionId: string
}

export interface EventListResult {
  sessionId: string
  events: EventRecord[]
  votes: VoteRecord[]
}

export interface CreateEventResult {
  event: EventRecord
  message: DiscussionMessage
}

export interface VoteResult {
  vote: VoteRecord
  event: EventRecord
}

export interface ListSessionsQuery {
  status?: SessionLifecycleStatus
  keyword?: string
  limit?: number
}

export interface UpdateSessionStatusRequest {
  action: SessionStatusAction
}

export interface SessionStateResult {
  sessionId: string
  status: SessionLifecycleStatus
  phase: DiscussionStage
  state: DiscussionState
  history: StateHistoryEntry[]
}


export interface GetInvitationResult {
  sessionId: string
  invitation: Invitation | null
}

export interface RespondInvitationRequest {
  content: string
  clientMessageId?: string
}

export interface RespondInvitationResult {
  sessionId: string
  invitation: Invitation
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
  summary?: DiscussionSummary | null
}

export interface SkipInvitationRequest {
  clientMessageId?: string
}

export interface SkipInvitationResult {
  sessionId: string
  invitation: Invitation
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
}

export interface RequestSummaryRequest {
  clientMessageId?: string
  source: 'more_sheet' | 'composer' | 'auto'
}

export interface RequestSummaryResult {
  sessionId: string
  summary: DiscussionSummary
  summaryMessage: DiscussionMessage
  sessionStatus: SessionLifecycleStatus
  directorDecision: DirectorDecisionRecord
}
