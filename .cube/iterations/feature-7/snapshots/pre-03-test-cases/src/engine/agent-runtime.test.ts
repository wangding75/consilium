import { describe, it, expect, vi } from 'vitest'
import { DefaultAgentRuntime } from './agent-runtime'
import type { AgentProfile } from '@/types'
import type { LLMMessage, LLMProvider } from '@/llm/providers/base.provider'

function makeProfile(overrides?: Partial<AgentProfile>): AgentProfile {
  return {
    agentId: 'role-expert-1',
    roleId: 'role-expert-1',
    agentType: 'expert',
    name: '诸葛亮',
    persona: '智谋无双',
    systemPrompt: '你是诸葛亮，提供深刻战略分析。',
    model: 'mock-default',
    visible: true,
    ...overrides,
  }
}

const dummyMessages: LLMMessage[] = [
  { role: 'system', content: '你是诸葛亮' },
  { role: 'user', content: '请分析形势' },
]

describe('DefaultAgentRuntime', () => {
  it('returns AgentOutput with content from provider', async () => {
    const provider: LLMProvider = { chat: vi.fn().mockResolvedValue('亮以为，当三分天下。') }
    const runtime = new DefaultAgentRuntime(provider)
    const output = await runtime.run(makeProfile(), dummyMessages)
    expect(output.content).toBe('亮以为，当三分天下。')
    expect(output.agentId).toBe('role-expert-1')
    expect(output.roleId).toBe('role-expert-1')
  })

  it('sets messageType to host for host agentType', async () => {
    const provider: LLMProvider = { chat: vi.fn().mockResolvedValue('欢迎各位。') }
    const runtime = new DefaultAgentRuntime(provider)
    const output = await runtime.run(makeProfile({ agentType: 'host', agentId: 'host-1', roleId: 'host-1' }), dummyMessages)
    expect(output.messageType).toBe('host')
  })

  it('sets messageType to character for non-host agentType', async () => {
    const provider: LLMProvider = { chat: vi.fn().mockResolvedValue('我认为...') }
    const runtime = new DefaultAgentRuntime(provider)
    const output = await runtime.run(makeProfile({ agentType: 'expert' }), dummyMessages)
    expect(output.messageType).toBe('character')
  })

  it('passes contextMessages to provider', async () => {
    const mockChat = vi.fn().mockResolvedValue('回复')
    const provider: LLMProvider = { chat: mockChat }
    const runtime = new DefaultAgentRuntime(provider)
    await runtime.run(makeProfile(), dummyMessages)
    expect(mockChat).toHaveBeenCalledWith(dummyMessages, expect.objectContaining({ model: 'mock-default' }))
  })

  it('throws when provider throws', async () => {
    const provider: LLMProvider = {
      chat: vi.fn().mockRejectedValue(new Error('LLM failed')),
    }
    const runtime = new DefaultAgentRuntime(provider)
    await expect(runtime.run(makeProfile(), dummyMessages)).rejects.toThrow()
  })
})
