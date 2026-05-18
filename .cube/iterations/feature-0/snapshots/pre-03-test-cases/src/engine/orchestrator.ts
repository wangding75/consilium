import type { Session, AgentOutput } from '@/types'

export interface Orchestrator {
  start(session: Session): Promise<void>
  next(session: Session): Promise<AgentOutput | null>
}

export class DefaultOrchestrator implements Orchestrator {
  async start(_session: Session): Promise<void> {
    throw new Error('not implemented — will be built in iteration 2')
  }

  async next(_session: Session): Promise<AgentOutput | null> {
    throw new Error('not implemented — will be built in iteration 2')
  }
}
