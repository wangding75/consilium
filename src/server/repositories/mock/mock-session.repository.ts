import type { DiscussionState, Session, SessionLifecycleStatus, StateHistoryEntry } from '@/types'
import type { ListSessionsQuery } from '@/types/api'
import type { SessionRepository } from '../session.repository'

function normalizeStatus(status: SessionLifecycleStatus): SessionLifecycleStatus {
  return status === 'active' ? 'running' : status
}

export class MockSessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>()

  async findAll(): Promise<Session[]> {
    return Array.from(this.store.values()).map(s => ({ ...s, status: normalizeStatus(s.status) }))
  }

  async findMany(query?: ListSessionsQuery): Promise<Session[]> {
    let results = Array.from(this.store.values()).map(s => ({ ...s, status: normalizeStatus(s.status) }))

    if (query?.status) {
      results = results.filter(s => s.status === query.status)
    }
    if (query?.keyword) {
      const kw = query.keyword.toLowerCase()
      results = results.filter(s => s.topic.toLowerCase().includes(kw))
    }
    if (query?.limit) {
      results = results.slice(0, query.limit)
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async findById(id: string): Promise<Session | null> {
    const session = this.store.get(id)
    if (!session) return null
    return { ...session, status: normalizeStatus(session.status) }
  }

  async findRecent(limit = 10): Promise<Session[]> {
    return Array.from(this.store.values())
      .map(s => ({ ...s, status: normalizeStatus(s.status) }))
      .sort((a, b) => b.updatedAt - a.createdAt)
      .slice(0, limit)
  }

  async save(session: Session): Promise<Session> {
    const id = session.id || crypto.randomUUID()
    const saved = { ...session, id }
    this.store.set(id, saved)
    return saved
  }

  async updateStatus(id: string, status: SessionLifecycleStatus, reason: string): Promise<Session | null> {
    const session = this.store.get(id)
    if (!session) return null
    const historyEntry: StateHistoryEntry = {
      from: session.status,
      to: status,
      reason,
      createdAt: new Date().toISOString(),
    }
    const updated: Session = {
      ...session,
      status,
      updatedAt: Date.now(),
      state: {
        ...session.state,
        history: [...(session.state.history ?? []), historyEntry],
      },
    }
    this.store.set(id, updated)
    return updated
  }

  async updateState(id: string, state: DiscussionState, reason: string): Promise<Session | null> {
    const session = this.store.get(id)
    if (!session) return null
    const historyEntry: StateHistoryEntry = {
      from: session.state.stage,
      to: state.stage,
      reason,
      createdAt: new Date().toISOString(),
    }
    const updated: Session = {
      ...session,
      state: {
        ...state,
        history: [...(session.state.history ?? []), historyEntry],
      },
      updatedAt: Date.now(),
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
