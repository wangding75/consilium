import type { SpeakerSelectionInput, SpeakerSelectionResult } from '@/types'

export interface Scheduler {
  selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult
}

export class RoundRobinScheduler implements Scheduler {
  selectSpeakers(_input: SpeakerSelectionInput): SpeakerSelectionResult {
    throw new Error('not implemented')
  }
}
