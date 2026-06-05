import { describe, it, expect } from 'vitest'
import { RoundRobinScheduler } from './scheduler'
import type { SpeakerSelectionInput, AgentProfile, DiscussionMessage } from '@/types'

function makeProfile(
  roleId: string,
  agentType: 'host' | 'expert' | 'critic' = 'expert'
): AgentProfile {
  return {
    agentId: roleId,
    roleId,
    agentType,
    name: roleId,
    persona: '',
    systemPrompt: '',
    model: 'mock-default',
    visible: true,
  }
}

function makeMessage(roleId: string): DiscussionMessage {
  return {
    messageId: `msg-${roleId}`,
    sessionId: 'sess-1',
    type: 'character',
    roleId,
    content: '发言',
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
}

const profiles: AgentProfile[] = [
  makeProfile('host-1', 'host'),
  makeProfile('expert-1', 'expert'),
  makeProfile('expert-2', 'expert'),
  makeProfile('critic-1', 'critic'),
]

describe('RoundRobinScheduler', () => {
  it('selects host when message history is empty', () => {
    const scheduler = new RoundRobinScheduler()
    const input: SpeakerSelectionInput = {
      sessionId: 'sess-1',
      roles: profiles,
      messageHistory: [],
      roundIndex: 0,
    }
    const result = scheduler.selectSpeakers(input)
    expect(result.speakerIds).toHaveLength(1)
    expect(result.speakerIds[0]).toBe('host-1')
  })

  it('returns a single speakerId for serial turn rotation', () => {
    const scheduler = new RoundRobinScheduler()
    const input: SpeakerSelectionInput = {
      sessionId: 'sess-1',
      roles: profiles,
      messageHistory: [makeMessage('host-1')],
      roundIndex: 1,
    }
    const result = scheduler.selectSpeakers(input)
    expect(result.speakerIds).toHaveLength(1)
  })

  it('skips lastSpeakerId in round-robin', () => {
    const scheduler = new RoundRobinScheduler()
    const input: SpeakerSelectionInput = {
      sessionId: 'sess-1',
      roles: profiles,
      messageHistory: [makeMessage('expert-1')],
      roundIndex: 1,
      lastSpeakerId: 'expert-1',
    }
    const result = scheduler.selectSpeakers(input)
    expect(result.speakerIds[0]).not.toBe('expert-1')
  })

  it('selects non-host roles after opening', () => {
    const scheduler = new RoundRobinScheduler()
    const input: SpeakerSelectionInput = {
      sessionId: 'sess-1',
      roles: profiles,
      messageHistory: [makeMessage('host-1')],
      roundIndex: 1,
      lastSpeakerId: 'host-1',
    }
    const result = scheduler.selectSpeakers(input)
    expect(result.speakerIds[0]).not.toBe('host-1')
  })

  it('returns a reason string', () => {
    const scheduler = new RoundRobinScheduler()
    const input: SpeakerSelectionInput = {
      sessionId: 'sess-1',
      roles: profiles,
      messageHistory: [],
      roundIndex: 0,
    }
    const result = scheduler.selectSpeakers(input)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})
