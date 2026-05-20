import type { Session, DiscussionState, DiscussionStage, DiscussionMessage } from '@/types'

export interface StateMachine {
  getState(session: Session): DiscussionState
  canTransition(from: DiscussionStage, to: DiscussionStage): boolean
  transition(session: Session, nextStage: DiscussionStage, reason: string): DiscussionState
  advanceAfterMessage(session: Session, messages: DiscussionMessage[]): DiscussionState
}

export class DefaultStateMachine implements StateMachine {
  getState(session: Session): DiscussionState {
    return session.state
  }

  canTransition(_from: DiscussionStage, _to: DiscussionStage): boolean {
    throw new Error('not implemented — will be built in iteration 4')
  }

  transition(_session: Session, _nextStage: DiscussionStage, _reason: string): DiscussionState {
    throw new Error('not implemented — will be built in iteration 4')
  }

  advanceAfterMessage(_session: Session, _messages: DiscussionMessage[]): DiscussionState {
    throw new Error('not implemented — will be built in iteration 4')
  }
}
