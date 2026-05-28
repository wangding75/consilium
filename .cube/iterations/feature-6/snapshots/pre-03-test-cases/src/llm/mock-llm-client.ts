import type { LLMConfig } from '@/types'
import type { LLMMessage, LLMProvider } from '@/llm/providers/base.provider'

export class MockLLMClient implements LLMProvider {
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<string> {
    if (config.model === 'mock-fail') {
      throw new Error('MockLLMClient: simulated failure (model=mock-fail)')
    }
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    if (/主持人|主持|host/i.test(system)) {
      return `【主持人】欢迎各位，今天的主题是：${messages.find((m) => m.role === 'user')?.content ?? ''}。请大家畅所欲言。`
    }
    if (/评论者|质疑|批判|critic/i.test(system)) {
      return `【评论】这个方案存在一些值得商榷之处，我们需要仔细审视其潜在风险。`
    }
    return `【发言】基于对${messages.find((m) => m.role === 'user')?.content ?? '该问题'}的分析，提出以下见解：此议题涉及多个层面，需要综合考量。`
  }
}
