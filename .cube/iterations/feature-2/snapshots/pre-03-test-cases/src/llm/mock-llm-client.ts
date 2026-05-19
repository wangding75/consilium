import type { LLMConfig } from '@/types'
import type { LLMMessage, LLMProvider } from '@/llm/providers/base.provider'

export class MockLLMClient implements LLMProvider {
  async chat(_messages: LLMMessage[], _config: LLMConfig): Promise<string> {
    throw new Error('not implemented')
  }
}
