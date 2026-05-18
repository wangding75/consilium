import type { Session } from '@/types'

export interface SessionRepository {
  findAll(): Promise<Session[]>
  findById(id: string): Promise<Session | null>
  findRecent(limit?: number): Promise<Session[]>
  save(session: Session): Promise<Session>
  delete(id: string): Promise<void>
}
