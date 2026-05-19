import type { SpeakerSelectionInput, SpeakerSelectionResult } from '@/types'

export interface Scheduler {
  selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult
}

export class RoundRobinScheduler implements Scheduler {
  selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult {
    const { roles, messageHistory, lastSpeakerId, roundIndex } = input
    if (messageHistory.length === 0) {
      const host = roles.find((r) => r.agentType === 'host')
      if (host) return { speakerIds: [host.roleId], reason: '空历史，Host 开场' }
    }
    const nonHosts = roles.filter((r) => r.agentType !== 'host' && r.roleId !== lastSpeakerId)
    const candidates = nonHosts.length > 0 ? nonHosts : roles.filter((r) => r.agentType !== 'host')
    const speaker = candidates[roundIndex % candidates.length]
    return { speakerIds: [speaker.roleId], reason: `轮转策略，选择 ${speaker.name}` }
  }
}
