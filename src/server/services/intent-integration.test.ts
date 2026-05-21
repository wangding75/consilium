import { describe, expect, it, vi } from 'vitest'
import { DiscussionOrchestrator } from '@/engine/orchestrator'
import { RoundRobinScheduler } from '@/engine/scheduler'
import type { AgentOutput } from '@/types'

function makeAgentRuntime(roleId = 'zhuge-liang') {
  return {
    run: vi.fn().mockImplementation(async (): Promise<AgentOutput> => ({
      agentId: roleId,
      roleId,
      messageType: roleId === 'xunyu' ? 'host' : 'character',
      content: `${roleId} replies`,
    })),
  }
}

function makeContextBuilder() {
  return {
    build: vi.fn().mockReturnValue([{ role: 'user', content: 'context' }]),
  }
}

describe('schedulerHint consumption chain — Task-04', () => {
  it('passes schedulerHint from intent through the orchestrator to RoundRobinScheduler', async () => {
    const scheduler = new RoundRobinScheduler()
    const agentRuntime = makeAgentRuntime('zhuge-liang')
    const orchestrator = new DiscussionOrchestrator(scheduler, makeContextBuilder() as never, agentRuntime as never)

    const result = await orchestrator.run({
      sessionId: 'sess-1',
      runId: 'run-1',
      topic: '战略',
      templateName: '三国',
      profiles: [
        { agentId: 'xunyu', roleId: 'xunyu', agentType: 'host', name: '荀彧', persona: '', systemPrompt: '', model: 'mock', visible: true },
        { agentId: 'zhuge-liang', roleId: 'zhuge-liang', agentType: 'expert', name: '诸葛亮', persona: '', systemPrompt: '', model: 'mock', visible: true },
      ],
      messageHistory: [{ messageId: 'msg-1', sessionId: 'sess-1', type: 'user', content: '让诸葛亮回应', status: 'completed', createdAt: new Date().toISOString() }],
      triggerContent: '让诸葛亮回应',
      intent: {
        type: 'command',
        confidence: 0.9,
        rawText: '让诸葛亮回应',
        target: { roleId: 'zhuge-liang', action: 'reply' },
        schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
        execution: { status: 'immediate' },
      },
    })

    expect(result.activeSpeakerId).toBe('zhuge-liang')
    expect(result.agentMessages[0].roleId).toBe('zhuge-liang')
  })

  it('does not silently fall back when schedulerHint points to a missing role', () => {
    const scheduler = new RoundRobinScheduler()

    const result = scheduler.selectSpeakers({
      sessionId: 'sess-1',
      roles: [
        { agentId: 'xunyu', roleId: 'xunyu', agentType: 'host', name: '荀彧', persona: '', systemPrompt: '', model: 'mock', visible: true },
        { agentId: 'zhuge-liang', roleId: 'zhuge-liang', agentType: 'expert', name: '诸葛亮', persona: '', systemPrompt: '', model: 'mock', visible: true },
      ],
      messageHistory: [{ messageId: 'msg-1', sessionId: 'sess-1', type: 'user', content: '让不存在角色回应', status: 'completed', createdAt: new Date().toISOString() }],
      roundIndex: 1,
      schedulerHint: { preferredSpeakerId: 'missing-role', reason: 'direct mention' },
    })

    expect(result.speakerIds).toEqual([])
    expect(result.reason).toMatch(/missing-role|不存在|无效/)
  })
})
