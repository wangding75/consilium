import type { Session, AgentOutput } from '@/types'

export interface Orchestrator {
  start(session: Session): Promise<void>
  next(session: Session): Promise<AgentOutput | null>
}

export class DefaultOrchestrator implements Orchestrator {
  async start(_session: Session): Promise<void> {
    return
  }

  async next(_session: Session): Promise<AgentOutput | null> {
    return null
  }
}
