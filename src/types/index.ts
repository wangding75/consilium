// Core domain types for consilium — 智囊团 multi-agent discussion platform

export type DiscussionStage = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'

export interface DiscussionState {
  stage: DiscussionStage
  turnCount: number
  lastSpeakerId: string | null
}

export interface Role {
  id: string
  name: string
  persona: string
  isHost: boolean
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
  status: 'active' | 'completed' | 'archived'
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
  status: 'active' | 'paused' | 'completed'
  createdAt: number
}

export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
}

export interface AgentProfile {
  roleId: string
  role: Role
  llmConfig: LLMConfig
}

export interface AgentOutput {
  roleId: string
  content: string
  eventTriggered?: EventType
  timestamp: number
}

export interface AgentRuntime {
  run(profile: AgentProfile, context: Session): Promise<AgentOutput>
}

// Agent combines profile with runtime execution
export interface Agent {
  profile: AgentProfile
  run(context: Session): Promise<AgentOutput>
}
