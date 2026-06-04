import type { LLMConfig } from '@/types'

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMConnectionTestResult {
  status: 'success' | 'failed'
  latencyMs: number
  availableModels: string[]
  errorCode?: string
  errorMessage?: string
}

export interface LLMProvider {
  chat(messages: LLMMessage[], config: LLMConfig): Promise<string>
  testConnection?(): Promise<LLMConnectionTestResult>
}
