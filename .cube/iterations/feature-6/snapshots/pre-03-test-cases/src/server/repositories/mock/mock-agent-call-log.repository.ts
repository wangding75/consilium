import type { AgentCallLog } from '@/types'
import type { AgentCallLogRepository } from '../agent-call-log.repository'

export class MockAgentCallLogRepository implements AgentCallLogRepository {
  private store = new Map<string, AgentCallLog>()

  async save(log: AgentCallLog): Promise<AgentCallLog> {
    this.store.set(log.id, log)
    return log
  }

  async findBySessionId(sessionId: string): Promise<AgentCallLog[]> {
    return Array.from(this.store.values()).filter((l) => l.sessionId === sessionId)
  }
}
