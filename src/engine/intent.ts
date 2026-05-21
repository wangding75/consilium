import type { AgentProfile, DiscussionMessage, IntentResult, IntentDebugSummary, IntentType, CommandAction } from '@/types'

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
  async classify(input: IntentClassifierInput): Promise<IntentResult> {
    if (input.forceAsPlainMessage) {
      return { type: 'passive', confidence: 1.0, rawText: input.content, execution: { status: 'immediate' } }
    }
    const result = this.matchRules(input)
    if (result) {
      if (input.debug) {
        result.debugSummary = {
          classifierMode: 'mock',
          matchedRule: 'mock-delegate',
          confidence: result.confidence,
          type: result.type,
          target: result.target,
          schedulerHint: result.schedulerHint,
        }
      }
      return result
    }
    throw new IntentClassificationError('INTENT_CLASSIFICATION_FAILED', '无法识别的指令')
  }

  private matchRules(input: IntentClassifierInput): IntentResult | null {
    const text = input.content
    const host = input.roles.find(r => r.agentType === 'host')

    if (/总结|结论/.test(text)) {
      return {
        type: 'decide',
        confidence: 0.88,
        rawText: text,
        target: { action: 'summarize' },
        schedulerHint: { preferredAgentType: 'host', reason: 'summary requires host' },
        execution: { status: 'recorded' },
      }
    }

    const mentioned = input.roles.find(r => r.name && text.includes(r.name))
    if (mentioned) {
      return {
        type: 'command',
        confidence: 0.9,
        rawText: text,
        target: { roleId: mentioned.roleId, action: 'reply' },
        schedulerHint: { preferredSpeakerId: mentioned.roleId, reason: `user mentions ${mentioned.name}` },
        execution: { status: 'immediate' },
      }
    }

    if (host) {
      return {
        type: 'passive',
        confidence: 0.5,
        rawText: text,
        schedulerHint: { preferredSpeakerId: host.roleId, reason: 'default to host' },
        execution: { status: 'immediate' },
      }
    }

    return null
  }
}

const VOTE_MESSAGE = '已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。'

export class RuleBasedIntentClassifier implements IntentClassifier {
  async classify(input: IntentClassifierInput): Promise<IntentResult> {
    if (input.forceAsPlainMessage) {
      return { type: 'passive', confidence: 1.0, rawText: input.content, execution: { status: 'immediate' } }
    }

    const text = input.content
    const host = input.roles.find(r => r.agentType === 'host')

    // Direct role mention: "让诸葛亮回应一下"
    const mentionMatch = text.match(/让(.+?)(回应|回答|说话|回复)/)
    if (mentionMatch) {
      const mentioned = input.roles.find(r => r.name === mentionMatch[1])
      if (mentioned) {
        return {
          type: 'command',
          confidence: 0.92,
          rawText: text,
          target: { roleId: mentioned.roleId, action: 'reply' },
          schedulerHint: { preferredSpeakerId: mentioned.roleId, reason: `user requested a direct reply from ${mentioned.name}` },
          execution: { status: 'immediate' },
          debugSummary: input.debug ? { classifierMode: 'rule', matchedRule: 'role-mention', confidence: 0.92, type: 'command', target: { roleId: mentioned.roleId, action: 'reply' }, schedulerHint: { preferredSpeakerId: mentioned.roleId, reason: `user requested a direct reply from ${mentioned.name}` } } : undefined,
        }
      }
    }

    // Rebut: "让诸葛亮反驳司马懿"
    const rebutMatch = text.match(/让(.+?)反驳(.+)/)
    if (rebutMatch) {
      const speaker = input.roles.find(r => r.name === rebutMatch[1])
      const target = input.roles.find(r => r.name === rebutMatch[2])
      if (speaker) {
        return {
          type: 'command',
          confidence: 0.9,
          rawText: text,
          target: { roleId: speaker.roleId, action: 'rebut' as CommandAction, referenceRoleId: target?.roleId },
          schedulerHint: { preferredSpeakerId: speaker.roleId, reason: `rebut instruction targeting ${target?.name ?? 'unknown'}` },
          execution: { status: 'immediate' },
          debugSummary: input.debug ? { classifierMode: 'rule', matchedRule: 'rebut-keyword', confidence: 0.9, type: 'command', target: { roleId: speaker.roleId, action: 'rebut' as CommandAction, referenceRoleId: target?.roleId }, schedulerHint: { preferredSpeakerId: speaker.roleId, reason: `rebut instruction targeting ${target?.name ?? 'unknown'}` } } : undefined,
        }
      }
    }

    // Vote: "触发投票"
    if (/投票/.test(text)) {
      return {
        type: 'command',
        confidence: 0.88,
        rawText: text,
        target: { eventType: 'vote' },
        schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' },
        execution: { status: 'deferred', message: VOTE_MESSAGE },
        debugSummary: input.debug ? { classifierMode: 'rule', matchedRule: 'vote-keyword', confidence: 0.88, type: 'command', target: { eventType: 'vote' }, schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' } } : undefined,
      }
    }

    // End discussion: "结束讨论"
    if (/结束讨论|结束/.test(text)) {
      return {
        type: 'decide',
        confidence: 0.9,
        rawText: text,
        target: { action: 'end' },
        schedulerHint: { preferredAgentType: 'host', reason: 'end discussion requires host' },
        execution: { status: 'recorded' },
        debugSummary: input.debug ? { classifierMode: 'rule', matchedRule: 'end-keyword', confidence: 0.9, type: 'decide', target: { action: 'end' as CommandAction }, schedulerHint: { preferredAgentType: 'host', reason: 'end discussion requires host' } } : undefined,
      }
    }

    // Summarize: "总结当前结论"
    if (/总结|结论/.test(text)) {
      return {
        type: 'decide',
        confidence: 0.88,
        rawText: text,
        target: { action: 'summarize' },
        schedulerHint: { preferredAgentType: 'host', reason: 'summary requires host' },
        execution: { status: 'recorded' },
        debugSummary: input.debug ? { classifierMode: 'rule', matchedRule: 'summarize-keyword', confidence: 0.88, type: 'decide', target: { action: 'summarize' as CommandAction }, schedulerHint: { preferredAgentType: 'host', reason: 'summary requires host' } } : undefined,
      }
    }

    // Command-like but unrecognizable (starts with @ or # or /)
    if (/^[@#\/]/.test(text) || /执行|那个/.test(text)) {
      throw new IntentClassificationError('INTENT_CLASSIFICATION_FAILED', '无法识别的指令，请改写或按普通发言继续')
    }

    // Default: passive
    return {
      type: 'passive',
      confidence: 0.5,
      rawText: text,
      schedulerHint: host ? { preferredSpeakerId: host.roleId, reason: 'default to host' } : undefined,
      execution: { status: 'immediate' },
    }
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
