import type { DiscussionState, Role } from '@/types'

it('DiscussionState shape has required fields', () => {
  const state: DiscussionState = {
    stage: 'opening',
    turnCount: 0,
    lastSpeakerId: null,
  }
  expect(state.stage).toBe('opening')
  expect(state.turnCount).toBe(0)
  expect(state.lastSpeakerId).toBeNull()
})

it('Role shape includes isHost flag and systemPrompt', () => {
  const role: Role = {
    id: 'r1',
    name: 'Test',
    persona: 'p',
    isHost: false,
    systemPrompt: 'sp',
  }
  expect(role.id).toBe('r1')
  expect(role.isHost).toBe(false)
  expect(role.systemPrompt).toBe('sp')
})
