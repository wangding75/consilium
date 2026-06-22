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
    messages: DiscussionMessage[],
    lastOutput: AgentOutput
  ): Promise<EventDetectionResult> {
    const allContent = messages.map((m) => m.content).join('\n') + '\n' + lastOutput.content

    if (
      allContent.includes('反对') ||
      allContent.includes('不同意') ||
      allContent.includes('是错的') ||
      allContent.includes('错误的')
    ) {
      return { eventTriggered: true, eventType: 'slap', confidence: 0.75, reason: '检测到反驳信号' }
    }

    if (allContent.includes('投票') || allContent.includes('无法定夺')) {
      return { eventTriggered: true, eventType: 'vote', confidence: 0.8, reason: '检测到投票信号' }
    }

    if (
      allContent.includes('立场') ||
      allContent.includes('主战') ||
      allContent.includes('主和')
    ) {
      return { eventTriggered: true, eventType: 'camp', confidence: 0.7, reason: '检测到阵营信号' }
    }

    if (allContent.includes('如果') && (allContent.includes('前提') || allContent.includes('情况'))) {
      return { eventTriggered: true, eventType: 'reverse', confidence: 0.7, reason: '检测到反转信号' }
    }

    return { eventTriggered: false, confidence: 0.3, reason: '无足够信号' }
  }
}

export class DefaultEventRateLimiter implements EventRateLimiter {
  check(input: EventRateLimitInput): RateLimitResult {
    const { eventType, recentMessages, recentEvents, currentMessageIndex } = input

    // Cooldown: same event type within 3 messages gap (use most recent occurrence)
    const sameTypeEvent = recentEvents.findLast((e) => e.eventType === eventType)
    if (sameTypeEvent) {
      const eventMsgIndex = recentMessages.findIndex(
        (m) => m.messageId === sameTypeEvent.relatedMessageId
      )
      if (eventMsgIndex !== -1 && currentMessageIndex - eventMsgIndex < 3) {
        return { allowed: false, reason: 'COOLDOWN' }
      }
    }

    // Density: 3+ events in last 10 timeline items
    const windowStart = Math.max(0, currentMessageIndex - 9)
    const windowIds = new Set(
      recentMessages.slice(windowStart, currentMessageIndex + 1).map((m) => m.messageId)
    )
    const eventsInWindow = recentEvents.filter(
      (e) => e.relatedMessageId && windowIds.has(e.relatedMessageId)
    )
    if (eventsInWindow.length >= 3) {
      return { allowed: false, reason: 'DENSITY' }
    }

    return { allowed: true }
  }
}
