import { describe, it, expect, beforeEach } from 'vitest'
import { MockAgentCallLogRepository } from './mock-agent-call-log.repository'
import type { AgentCallLog } from '@/types'

function makeLog(overrides?: Partial<AgentCallLog>): AgentCallLog {
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    sessionId: 'sess-1',
    runId: 'run-1',
    agentId: 'expert-1',
    roleId: 'expert-1',
    provider: 'mock',
    model: 'mock-default',
    inputSummary: '输入摘要',
    durationMs: 100,
    status: 'success',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('MockAgentCallLogRepository', () => {
  let repo: MockAgentCallLogRepository

  beforeEach(() => {
    repo = new MockAgentCallLogRepository()
  })

  it('saves a log and returns it', async () => {
    const log = makeLog({ id: 'log-1' })
    const saved = await repo.save(log)
    expect(saved.id).toBe('log-1')
    expect(saved.agentId).toBe('expert-1')
  })

  it('findBySessionId returns all logs for the given session', async () => {
    await repo.save(makeLog({ id: 'log-1', sessionId: 'sess-1' }))
    await repo.save(makeLog({ id: 'log-2', sessionId: 'sess-1' }))
    await repo.save(makeLog({ id: 'log-3', sessionId: 'sess-2' }))
    const results = await repo.findBySessionId('sess-1')
    expect(results).toHaveLength(2)
  })

  it('findBySessionId returns empty array when no logs exist', async () => {
    const results = await repo.findBySessionId('sess-nonexistent')
    expect(results).toEqual([])
  })
})
