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
  template: { id: string; name: string }
  status: SessionLifecycleStatus
  createdAt: number
}

// Iteration 2: discussion API types
export interface SessionDetailResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string }
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
  activeSpeakerId: string | null
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
