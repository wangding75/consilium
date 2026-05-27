import type { DirectorDecisionRecord, DirectorInput, DiscussionStage, Invitation } from '@/types'

export interface Director {
  decide(input: DirectorInput): Promise<DirectorDecisionRecord>
}

export class DefaultDirector implements Director {
  async decide(input: DirectorInput): Promise<DirectorDecisionRecord> {
    const { session, messages, roles, trigger, pendingInvitation } = input
    const stage = session.state.stage
    const turnCount = session.state.turnCount
    const decisionId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // If pending invitation exists, never return invite_user
    if (pendingInvitation && pendingInvitation.status === 'pending') {
      return this.buildDecision(decisionId, session.id, 'continue', 'pending invitation exists, continue discussion', 0.9)
    }

    // Trigger-based decisions
    if (trigger === 'summary_request') {
      return this.buildDecision(decisionId, session.id, 'conclude', 'user requested summary', 0.9, {
        stageSuggestion: 'closing',
        summaryHint: {
          reason: 'user requested summary',
          sections: ['consensus', 'disagreements', 'recommendations', 'nextSteps'],
        },
      })
    }

    if (trigger === 'invitation_skip') {
      return this.buildDecision(decisionId, session.id, 'continue', 'invitation skipped, continue discussion', 0.85)
    }

    if (trigger === 'invitation_response') {
      return this.buildDecision(decisionId, session.id, 'continue', 'invitation responded, continue discussion', 0.85)
    }

    if (trigger === 'opening' || stage === 'idle') {
      return this.buildDecision(decisionId, session.id, 'continue', 'discussion starting', 0.9)
    }

    // Stage-based decisions
    if (stage === 'closing') {
      return this.buildDecision(decisionId, session.id, 'conclude', 'closing stage reached', 0.9, {
        stageSuggestion: 'closing',
        summaryHint: {
          reason: 'closing stage',
          sections: ['consensus', 'disagreements', 'recommendations', 'nextSteps'],
        },
      })
    }

    if (stage === 'climax' && turnCount >= 6) {
      return this.buildDecision(decisionId, session.id, 'trigger_event', 'dramatic tension detected at climax', 0.75, {
        eventCandidate: { type: 'face-slap', reason: 'strong disagreement between roles' },
      })
    }

    if (stage === 'developing' && messages.length >= 2) {
      const hasDisagreement = this.detectDisagreement(messages)
      if (hasDisagreement && roles.length >= 2) {
        return this.buildDecision(decisionId, session.id, 'invite_user', 'disagreement detected between roles', 0.8)
      }
    }

    // Stage transition suggestion
    const stageSuggestion = this.suggestStage(stage, turnCount, messages.length)

    return this.buildDecision(decisionId, session.id, 'continue', 'discussion progressing normally', 0.7, {
      stageSuggestion,
    })
  }

  private buildDecision(
    decisionId: string,
    sessionId: string,
    action: DirectorDecisionRecord['action'],
    reason: string,
    confidence: number,
    extras: Partial<Pick<DirectorDecisionRecord, 'stageSuggestion' | 'eventCandidate' | 'summaryHint' | 'schedulerHint'>> = {}
  ): DirectorDecisionRecord {
    return {
      decisionId,
      sessionId,
      action,
      reason,
      confidence,
      createdAt: new Date().toISOString(),
      ...extras,
    }
  }

  private detectDisagreement(messages: DirectorInput['messages']): boolean {
    if (messages.length < 2) return false
    const keywords = ['反对', '不同意', '不赞同', '我反对', '反驳', '不认为', '不应该']
    const lastMessages = messages.slice(-4)
    return lastMessages.some(m =>
      keywords.some(kw => m.content.includes(kw))
    )
  }

  private suggestStage(stage: DiscussionStage, turnCount: number, messageCount: number): DiscussionStage | undefined {
    if (stage === 'opening' && turnCount >= 4) return 'developing'
    if (stage === 'developing' && turnCount >= 8) return 'climax'
    if (stage === 'climax' && turnCount >= 12) return 'closing'
    return undefined
  }
}
