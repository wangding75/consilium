import type { LLMConfig } from '@/types'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMProvider {
  chat(messages: LLMMessage[], config: LLMConfig): Promise<string>
}
