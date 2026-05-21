// Core domain types for consilium — 智囊团 multi-agent discussion platform

export type DiscussionStage = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'
export type SessionLifecycleStatus = 'running' | 'completed' | 'archived' | 'active'
export type NormalizedSessionLifecycleStatus = Exclude<SessionLifecycleStatus, 'active'>
export type LegacySessionLifecycleStatus = SessionLifecycleStatus
export type SessionStatusAction = 'archive' | 'complete' | 'resume'

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
