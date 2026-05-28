import type { AgentProfile, AgentOutput } from '@/types'
import type { LLMMessage } from '@/llm/providers/base.provider'
import type { LLMProvider } from '@/llm/providers/base.provider'

export interface AgentRuntime {
  run(profile: AgentProfile, contextMessages: LLMMessage[]): Promise<AgentOutput>
}

export class DefaultAgentRuntime implements AgentRuntime {
  constructor(private readonly provider: LLMProvider) {}

  async run(profile: AgentProfile, contextMessages: LLMMessage[]): Promise<AgentOutput> {
    const content = await this.provider.chat(contextMessages, {
      provider: 'mock',
      model: profile.model,
      temperature: profile.temperature,
    })
    return {
      agentId: profile.agentId,
      roleId: profile.roleId,
      content,
      messageType: profile.agentType === 'host' ? 'host' : 'character',
    }
  }
}
