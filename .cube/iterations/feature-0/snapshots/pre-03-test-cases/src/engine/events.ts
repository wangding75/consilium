import type { Session, AgentOutput, EventType } from '@/types'

export interface EventDetectionResult {
  eventTriggered: boolean
  eventType?: EventType
  description?: string
}

export interface EventDetector {
  detect(session: Session, lastOutput: AgentOutput): Promise<EventDetectionResult>
}

export class DefaultEventDetector implements EventDetector {
  async detect(_session: Session, _lastOutput: AgentOutput): Promise<EventDetectionResult> {
    throw new Error('not implemented — will be built in iteration 7')
  }
}
