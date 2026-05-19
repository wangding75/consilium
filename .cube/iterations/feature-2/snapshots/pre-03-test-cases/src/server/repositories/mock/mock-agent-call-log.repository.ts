import type { AgentCallLog } from '@/types'
import type { AgentCallLogRepository } from '../agent-call-log.repository'

export class MockAgentCallLogRepository implements AgentCallLogRepository {
  async save(_log: AgentCallLog): Promise<AgentCallLog> {
    throw new Error('not implemented')
  }

  async findBySessionId(_sessionId: string): Promise<AgentCallLog[]> {
    throw new Error('not implemented')
  }
}
