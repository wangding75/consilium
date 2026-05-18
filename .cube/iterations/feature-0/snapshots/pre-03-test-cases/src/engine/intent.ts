import type { Message } from '@/types'

export type IntentType = 'interrupt' | 'command' | 'passive'

export interface IntentResult {
  type: IntentType
  confidence: number
}

export interface IntentRecognizer {
  recognize(message: Message): Promise<IntentResult>
}

export class DefaultIntentRecognizer implements IntentRecognizer {
  async recognize(_message: Message): Promise<IntentResult> {
    throw new Error('not implemented — will be built in iteration 5')
  }
}
