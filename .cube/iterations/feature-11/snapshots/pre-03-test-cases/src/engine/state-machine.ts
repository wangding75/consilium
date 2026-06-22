import type { Session, DiscussionState, DiscussionStage, DiscussionMessage } from '@/types'
import { ServiceError } from '@/server/errors'

const VALID_TRANSITIONS: Record<DiscussionStage, DiscussionStage[]> = {
  idle: ['opening'],
  opening: ['developing'],
  developing: ['climax'],
  climax: ['closing'],
  closing: [],
}

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

  canTransition(from: DiscussionStage, to: DiscussionStage): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  transition(session: Session, nextStage: DiscussionStage, reason: string): DiscussionState {
    if (!this.canTransition(session.state.stage, nextStage)) {
      throw new ServiceError('INVALID_STATE_TRANSITION', `Cannot transition from ${session.state.stage} to ${nextStage}`)
    }
    return {
      stage: nextStage,
      turnCount: session.state.turnCount,
      lastSpeakerId: session.state.lastSpeakerId,
    }
  }

  advanceAfterMessage(session: Session, messages: DiscussionMessage[]): DiscussionState {
    const { stage, turnCount, lastSpeakerId } = session.state
    const newTurnCount = turnCount + 1
    const newLastSpeakerId = messages.length > 0 ? (messages[messages.length - 1].roleId ?? null) : lastSpeakerId

    if (stage === 'idle' && this.canTransition('idle', 'opening')) {
      return { stage: 'opening', turnCount: newTurnCount, lastSpeakerId: newLastSpeakerId }
    }

    if (stage === 'opening' && newTurnCount >= 2) {
      return { stage: 'developing', turnCount: newTurnCount, lastSpeakerId: newLastSpeakerId }
    }

    if (stage === 'developing' && newTurnCount >= 6) {
      return { stage: 'climax', turnCount: newTurnCount, lastSpeakerId: newLastSpeakerId }
    }

    if (stage === 'climax' && newTurnCount >= 10) {
      return { stage: 'closing', turnCount: newTurnCount, lastSpeakerId: newLastSpeakerId }
    }

    return { stage, turnCount: newTurnCount, lastSpeakerId: newLastSpeakerId }
  }
}
