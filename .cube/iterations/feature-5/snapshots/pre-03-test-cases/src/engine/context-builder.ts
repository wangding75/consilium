import type { LLMMessage } from '@/llm/providers/base.provider'
import type { ContextBuilderInput, DiscussionMessage } from '@/types'

const DEFAULT_MAX_MESSAGES = 20
const DEFAULT_MAX_CHARS = 4000

function toRole(msg: DiscussionMessage): 'user' | 'assistant' {
  return msg.type === 'user' ? 'user' : 'assistant'
}

export class ContextBuilder {
  build(input: ContextBuilderInput): LLMMessage[] {
    const { role, topic, templateName, messageHistory, maxMessages, maxChars } = input
    const limitMsgs = maxMessages ?? DEFAULT_MAX_MESSAGES
    const limitChars = maxChars ?? DEFAULT_MAX_CHARS

    const systemContent = `${role.systemPrompt}\n\n讨论主题：${topic}\n模板：${templateName}`
    const systemMsg: LLMMessage = { role: 'system', content: systemContent }

    const recent = messageHistory.slice(-limitMsgs)
    let chars = systemContent.length
    const historyMsgs: LLMMessage[] = []

    for (let i = recent.length - 1; i >= 0; i--) {
      const content = recent[i].content
      if (chars + content.length > limitChars) break
      chars += content.length
      historyMsgs.unshift({ role: toRole(recent[i]), content })
    }

    return [systemMsg, ...historyMsgs]
  }
}
