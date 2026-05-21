import type { AgentProfile, DiscussionMessage, IntentResult, Message } from '@/types'

export interface IntentClassifierInput {
  sessionId: string
  content: string
  roles: AgentProfile[]
  messages: DiscussionMessage[]
  debug?: boolean
  forceAsPlainMessage?: boolean
}

export interface IntentClassifier {
  classify(input: IntentClassifierInput): Promise<IntentResult>
}

export class IntentClassificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'IntentClassificationError'
  }
}

export class MockIntentClassifier implements IntentClassifier {
  async classify(_input: IntentClassifierInput): Promise<IntentResult> {
    throw new Error('not implemented')
  }
}

export class RuleBasedIntentClassifier implements IntentClassifier {
  async classify(_input: IntentClassifierInput): Promise<IntentResult> {
    throw new Error('not implemented')
  }
}

export class DefaultIntentClassifier implements IntentClassifier {
  constructor(private readonly fallback: IntentClassifier = new RuleBasedIntentClassifier()) {}

  async classify(input: IntentClassifierInput): Promise<IntentResult> {
    return this.fallback.classify(input)
  }
}

export interface IntentRecognizer {
  recognize(message: Message): Promise<IntentResult>
}

export class DefaultIntentRecognizer implements IntentRecognizer {
  constructor(private readonly classifier: IntentClassifier = new DefaultIntentClassifier()) {}

  async recognize(message: Message): Promise<IntentResult> {
    return this.classifier.classify({
      sessionId: message.sessionId,
      content: message.content,
      roles: [],
      messages: [],
    })
  }
}
