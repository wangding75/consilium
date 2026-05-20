import { describe, it, expect } from 'vitest'
import { DefaultStateMachine } from '@/engine/state-machine'
import { createMockSession } from '@/tests/utils/mock-factories'

// Task-02: Discussion state machine legal transitions & message-driven advancement
describe('DefaultStateMachine — Task-02', () => {
  const machine = new DefaultStateMachine()

  it('allows forward adjacent transition idle → opening', () => {
    expect(machine.canTransition('idle', 'opening')).toBe(true)
  })

  it('allows forward adjacent transition opening → developing', () => {
    expect(machine.canTransition('opening', 'developing')).toBe(true)
  })

  it('allows forward adjacent transition developing → climax', () => {
    expect(machine.canTransition('developing', 'climax')).toBe(true)
  })

  it('allows forward adjacent transition climax → closing', () => {
    expect(machine.canTransition('climax', 'closing')).toBe(true)
  })

  it('rejects backward transition', () => {
    expect(machine.canTransition('developing', 'opening')).toBe(false)
  })

  it('rejects skip transition', () => {
    expect(machine.canTransition('idle', 'climax')).toBe(false)
  })

  it('transition returns new DiscussionState with updated stage', () => {
    const session = createMockSession({ state: { stage: 'idle', turnCount: 0, lastSpeakerId: null } })
    const result = machine.transition(session, 'opening', 'first message')
    expect(result.stage).toBe('opening')
  })

  it('transition rejects invalid transition and throws', () => {
    const session = createMockSession({ state: { stage: 'idle', turnCount: 0, lastSpeakerId: null } })
    expect(() => machine.transition(session, 'closing', 'skip')).toThrow()
  })

  it('advanceAfterMessage advances from idle to opening on first message', () => {
    const session = createMockSession({ state: { stage: 'idle', turnCount: 0, lastSpeakerId: null } })
    const result = machine.advanceAfterMessage(session, [])
    expect(result.stage).toBe('opening')
  })
})
