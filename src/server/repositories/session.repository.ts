import type { Session } from '@/types'

export interface SessionRepository {
  findAll(): Promise<Session[]>
  findById(id: string): Promise<Session | null>
  save(session: Session): Promise<Session>
  delete(id: string): Promise<void>
}
