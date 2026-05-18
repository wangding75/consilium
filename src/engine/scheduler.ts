import type { Session, Role } from '@/types'

export interface Scheduler {
  selectNext(session: Session): Promise<Role | null>
}

export class DefaultScheduler implements Scheduler {
  async selectNext(_session: Session): Promise<Role | null> {
    throw new Error('not implemented — will be built in iteration 2')
  }
}
