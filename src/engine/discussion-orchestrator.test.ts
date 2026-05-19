import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionOrchestrator } from './orchestrator'
import type { Scheduler } from './scheduler'
import type { ContextBuilder } from './context-builder'
import type { AgentRuntime } from './agent-runtime'
import type { OrchestratorInput, AgentProfile, AgentOutput, DiscussionMessage } from '@/types'
import type { LLMMessage } from '@/llm/providers/base.provider'

function makeProfile(roleId: string, agentType: 'host' | 'expert' | 'critic' = 'expert'): AgentProfile {
  return {
    agentId: roleId,
    roleId,
    agentType,
    name: roleId,
    persona: '',
    systemPrompt: `你是 ${roleId}`,
    model: 'mock-default',
    visible: true,
  }
}

function makeInput(overrides?: Partial<OrchestratorInput>): OrchestratorInput {
  return {
    sessionId: 'sess-1',
    runId: 'run-1',
    topic: '战略分析',
    templateName: '三国模板',
    profiles: [makeProfile('host-1', 'host'), makeProfile('expert-1', 'expert')],
    messageHistory: [],
    triggerContent: '请开始',
    ...overrides,
  }
}

describe('DiscussionOrchestrator', () => {
  let scheduler: Scheduler
  let contextBuilder: ContextBuilder
  let agentRuntime: AgentRuntime

  beforeEach(() => {
    scheduler = {
      selectSpeakers: vi.fn().mockReturnValue({ speakerIds: ['expert-1'], reason: 'round-robin' }),
    }
    contextBuilder = {
      build: vi.fn().mockReturnValue([
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '请分析' },
      ] as LLMMessage[]),
    }
    agentRuntime = {
      run: vi.fn().mockResolvedValue({
        agentId: 'expert-1',
        roleId: 'expert-1',
        messageType: 'character',
        content: '我的分析是...',
      } as AgentOutput),
    }
  })

  it('returns agentMessages with one message for single selected speaker', async () => {
    const orchestrator = new DiscussionOrchestrator(scheduler, contextBuilder, agentRuntime)
    const result = await orchestrator.run(makeInput())
    expect(result.agentMessages).toHaveLength(1)
    expect(result.agentMessages[0].content).toBe('我的分析是...')
    expect(result.agentMessages[0].roleId).toBe('expert-1')
  })

  it('includes callLogs in result', async () => {
    const orchestrator = new DiscussionOrchestrator(scheduler, contextBuilder, agentRuntime)
    const result = await orchestrator.run(makeInput())
    expect(result.callLogs).toHaveLength(1)
    expect(result.callLogs[0].sessionId).toBe('sess-1')
    expect(result.callLogs[0].agentId).toBe('expert-1')
  })

  it('sets activeSpeakerId to last speaker', async () => {
    const orchestrator = new DiscussionOrchestrator(scheduler, contextBuilder, agentRuntime)
    const result = await orchestrator.run(makeInput())
    expect(result.activeSpeakerId).toBe('expert-1')
  })

  it('selects host when messageHistory is empty (opening trigger)', async () => {
    ;(scheduler.selectSpeakers as ReturnType<typeof vi.fn>).mockReturnValue({
      speakerIds: ['host-1'],
      reason: 'opening',
    })
    ;(agentRuntime.run as ReturnType<typeof vi.fn>).mockResolvedValue({
      agentId: 'host-1',
      roleId: 'host-1',
      messageType: 'host',
      content: '欢迎大家！',
    } as AgentOutput)
    const orchestrator = new DiscussionOrchestrator(scheduler, contextBuilder, agentRuntime)
    const result = await orchestrator.run(makeInput({ messageHistory: [], triggerContent: null }))
    expect(result.agentMessages[0].type).toBe('host')
    expect(result.agentMessages[0].roleId).toBe('host-1')
  })

  it('propagates AgentRuntime error with callLog status failed', async () => {
    ;(agentRuntime.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM timeout'))
    const orchestrator = new DiscussionOrchestrator(scheduler, contextBuilder, agentRuntime)
    await expect(orchestrator.run(makeInput())).rejects.toThrow()
  })
})
