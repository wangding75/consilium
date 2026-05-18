import type { Session, DiscussionStage } from '@/types'

export interface RhythmController {
  shouldAdvanceStage(session: Session): boolean
  getNextStage(currentStage: DiscussionStage): DiscussionStage | null
}

export class DefaultRhythmController implements RhythmController {
  shouldAdvanceStage(_session: Session): boolean {
    throw new Error('not implemented — will be built in iteration 4')
  }

  getNextStage(currentStage: DiscussionStage): DiscussionStage | null {
    const stages: DiscussionStage[] = ['opening', 'developing', 'climax', 'closing']
    const idx = stages.indexOf(currentStage)
    return idx < stages.length - 1 ? stages[idx + 1] : null
  }
}
