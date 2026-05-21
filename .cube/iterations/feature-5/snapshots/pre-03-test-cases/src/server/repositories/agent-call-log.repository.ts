import type { AgentCallLog } from '@/types'

export interface AgentCallLogRepository {
  save(log: AgentCallLog): Promise<AgentCallLog>
  findBySessionId(sessionId: string): Promise<AgentCallLog[]>
}
