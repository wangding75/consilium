import { describe, it, expect } from 'vitest'
import type {
  SessionLifecycleStatus,
  SessionStatusAction,
  StateHistoryEntry,
  DiscussionState,
  DiscussionStage,
  NormalizedSessionLifecycleStatus,
} from '@/types'

// Task-01: Unified session lifecycle status & state history types
describe('SessionLifecycleStatus types — Task-01', () => {
  it('accepts valid SessionLifecycleStatus values', () => {
    const running: SessionLifecycleStatus = 'running'
    const completed: SessionLifecycleStatus = 'completed'
    const archived: SessionLifecycleStatus = 'archived'
    expect([running, completed, archived]).toEqual(['running', 'completed', 'archived'])
  })

  it('accepts legacy active value for backward compatibility', () => {
    const legacy: SessionLifecycleStatus = 'active'
    expect(legacy).toBe('active')
  })

  it('NormalizedSessionLifecycleStatus excludes active', () => {
    const normalized: NormalizedSessionLifecycleStatus = 'running'
    expect(['running', 'completed', 'archived']).toContain(normalized)
  })

  it('SessionStatusAction only allows valid actions', () => {
    const archive: SessionStatusAction = 'archive'
    const complete: SessionStatusAction = 'complete'
    const resume: SessionStatusAction = 'resume'
    expect([archive, complete, resume]).toEqual(['archive', 'complete', 'resume'])
  })

  it('StateHistoryEntry has required fields', () => {
    const entry: StateHistoryEntry = {
      from: 'running',
      to: 'archived',
      reason: 'user archive',
      createdAt: new Date().toISOString(),
    }
    expect(entry.from).toBe('running')
    expect(entry.to).toBe('archived')
    expect(entry.reason).toBeTruthy()
    expect(entry.createdAt).toBeTruthy()
  })

  it('DiscussionState includes stage, turnCount, lastSpeakerId, and optional history', () => {
    const state: DiscussionState = {
      stage: 'developing' as DiscussionStage,
      turnCount: 5,
      lastSpeakerId: 'role-1',
    }
    expect(state.stage).toBe('developing')
    expect(state.turnCount).toBe(5)
    expect(state.lastSpeakerId).toBe('role-1')
    expect(state.history).toBeUndefined()
  })

  it('DiscussionState with history entries', () => {
    const state: DiscussionState = {
      stage: 'closing',
      turnCount: 10,
      lastSpeakerId: null,
      history: [
        { from: 'climax', to: 'closing', reason: 'max turns reached', createdAt: new Date().toISOString() },
      ],
    }
    expect(state.history).toHaveLength(1)
    expect(state.history![0].to).toBe('closing')
  })
})
