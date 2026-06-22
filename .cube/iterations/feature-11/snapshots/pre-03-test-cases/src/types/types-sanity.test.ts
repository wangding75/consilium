import { describe, it, expect } from 'vitest'
import type { AgentType, AgentProfile, DiscussionMessage, AgentCallLog } from '@/types'

describe('Core type definitions (Task-01)', () => {
  it('AgentType values are assignable and distinguishable', () => {
    const host: AgentType = 'host'
    const expert: AgentType = 'expert'
    const critic: AgentType = 'critic'
    expect(['host', 'expert', 'critic']).toContain(host)
    expect(['host', 'expert', 'critic']).toContain(expert)
    expect(['host', 'expert', 'critic']).toContain(critic)
    expect(host).not.toBe(expert)
  })

  it('AgentProfile structure has all required fields', () => {
    const profile: AgentProfile = {
      agentId: 'host-1',
      roleId: 'xunyu',
      agentType: 'host',
      name: '荀彧',
      persona: '主持人',
      systemPrompt: '你是荀彧',
      model: 'mock-default',
      visible: true,
    }
    expect(profile.agentType).toBe('host')
    expect(profile.visible).toBe(true)
  })

  it('DiscussionMessage type field distinguishes message types', () => {
    const msg: DiscussionMessage = {
      messageId: 'msg-1',
      sessionId: 'sess-1',
      type: 'host',
      content: '开场',
      status: 'completed',
      createdAt: new Date().toISOString(),
    }
    expect(['host', 'character', 'user', 'system']).toContain(msg.type)
  })

  it('AgentCallLog status field is either success or failed', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'expert-1',
      roleId: 'expert-1',
      provider: 'mock',
      model: 'mock-default',
      inputSummary: '输入',
      durationMs: 100,
      status: 'success',
      createdAt: new Date().toISOString(),
    }
    expect(['success', 'failed']).toContain(log.status)
  })
})
