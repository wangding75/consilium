import type { Session, DiscussionState, DiscussionStage } from '@/types'

export interface StateMachine {
  getState(session: Session): DiscussionState
  transition(session: Session, nextStage: DiscussionStage): DiscussionState
}

export class DefaultStateMachine implements StateMachine {
  getState(session: Session): DiscussionState {
    return session.state
  }

  transition(_session: Session, _nextStage: DiscussionStage): DiscussionState {
    throw new Error('not implemented — will be built in iteration 4')
  }
}
