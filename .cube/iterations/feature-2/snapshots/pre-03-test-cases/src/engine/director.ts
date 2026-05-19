import type { Session, AgentOutput } from '@/types'

export type DirectorDecision = 'continue' | 'invite' | 'conclude' | 'trigger-event'

export interface Director {
  decide(session: Session, lastOutput?: AgentOutput): Promise<DirectorDecision>
}

export class DefaultDirector implements Director {
  async decide(_session: Session, _lastOutput?: AgentOutput): Promise<DirectorDecision> {
    throw new Error('not implemented — will be built in iteration 6')
  }
}
