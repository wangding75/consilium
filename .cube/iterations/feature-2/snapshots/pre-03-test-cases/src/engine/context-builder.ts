import type { LLMMessage } from '@/llm/providers/base.provider'
import type { ContextBuilderInput } from '@/types'

export class ContextBuilder {
  build(_input: ContextBuilderInput): LLMMessage[] {
    throw new Error('not implemented')
  }
}
