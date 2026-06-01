import type { AgentOutput, DiscussionMessage, EventDetectionResult, EventRecord, EventType, Session } from '@/types'

export interface EventDetector {
  detect(
    session: Session,
    messages: DiscussionMessage[],
    lastOutput: AgentOutput
  ): Promise<EventDetectionResult>
}

export interface EventRateLimitInput {
  sessionId: string
  eventType: EventType
  recentMessages: DiscussionMessage[]
  recentEvents: EventRecord[]
  currentMessageIndex: number
}

export interface RateLimitResult {
  allowed: boolean
  reason?: 'COOLDOWN' | 'DENSITY'
}

export interface EventRateLimiter {
  check(input: EventRateLimitInput): RateLimitResult
}

export class DefaultEventDetector implements EventDetector {
  async detect(
    _session: Session,
    _messages: DiscussionMessage[],
    _lastOutput: AgentOutput
  ): Promise<EventDetectionResult> {
    throw new Error('not implemented')
  }
}

export class DefaultEventRateLimiter implements EventRateLimiter {
  check(_input: EventRateLimitInput): RateLimitResult {
    throw new Error('not implemented')
  }
}
