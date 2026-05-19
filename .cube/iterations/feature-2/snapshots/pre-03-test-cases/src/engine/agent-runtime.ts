import type { AgentProfile, AgentOutput } from '@/types'
import type { LLMMessage } from '@/llm/providers/base.provider'
import type { LLMProvider } from '@/llm/providers/base.provider'

export interface AgentRuntime {
  run(profile: AgentProfile, contextMessages: LLMMessage[]): Promise<AgentOutput>
}

export class DefaultAgentRuntime implements AgentRuntime {
  constructor(private readonly provider: LLMProvider) {}

  async run(_profile: AgentProfile, _contextMessages: LLMMessage[]): Promise<AgentOutput> {
    throw new Error('not implemented')
  }
}
