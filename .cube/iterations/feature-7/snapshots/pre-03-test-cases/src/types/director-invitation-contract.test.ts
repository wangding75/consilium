import type {
  DirectorAction,
  DirectorTrigger,
  HostMessageKind,
  InvitationStatus,
  DirectorEventCandidate,
  DirectorSummaryHint,
  Invitation,
  DiscussionSummary,
  DirectorInput,
  DirectorDecisionRecord,
  InvitationStatusPatch,
  DiscussionMessage,
  AgentProfile,
  Session,
  IntentResult,
  SchedulerHint,
} from '@/types'

// --- DirectorAction ---
it('DirectorAction allows continue', () => {
  const action: DirectorAction = 'continue'
  expect(action).toBe('continue')
})

it('DirectorAction allows invite_user', () => {
  const action: DirectorAction = 'invite_user'
  expect(action).toBe('invite_user')
})

it('DirectorAction allows trigger_event', () => {
  const action: DirectorAction = 'trigger_event'
  expect(action).toBe('trigger_event')
})

it('DirectorAction allows conclude', () => {
  const action: DirectorAction = 'conclude'
  expect(action).toBe('conclude')
})

// --- DirectorTrigger ---
it('DirectorTrigger includes user_message', () => {
  const trigger: DirectorTrigger = 'user_message'
  expect(trigger).toBe('user_message')
})

it('DirectorTrigger includes invitation_response', () => {
  const trigger: DirectorTrigger = 'invitation_response'
  expect(trigger).toBe('invitation_response')
})

it('DirectorTrigger includes summary_request', () => {
  const trigger: DirectorTrigger = 'summary_request'
  expect(trigger).toBe('summary_request')
})

// --- HostMessageKind ---
it('HostMessageKind includes opening', () => {
  const kind: HostMessageKind = 'opening'
  expect(kind).toBe('opening')
})

it('HostMessageKind includes transition', () => {
  const kind: HostMessageKind = 'transition'
  expect(kind).toBe('transition')
})

it('HostMessageKind includes invitation', () => {
  const kind: HostMessageKind = 'invitation'
  expect(kind).toBe('invitation')
})

it('HostMessageKind includes event_candidate', () => {
  const kind: HostMessageKind = 'event_candidate'
  expect(kind).toBe('event_candidate')
})

it('HostMessageKind includes final_summary', () => {
  const kind: HostMessageKind = 'final_summary'
  expect(kind).toBe('final_summary')
})

it('HostMessageKind includes stage_summary', () => {
  const kind: HostMessageKind = 'stage_summary'
  expect(kind).toBe('stage_summary')
})

// --- InvitationStatus ---
it('InvitationStatus allows pending', () => {
  const status: InvitationStatus = 'pending'
  expect(status).toBe('pending')
})

it('InvitationStatus allows responded', () => {
  const status: InvitationStatus = 'responded'
  expect(status).toBe('responded')
})

it('InvitationStatus allows skipped', () => {
  const status: InvitationStatus = 'skipped'
  expect(status).toBe('skipped')
})

it('InvitationStatus allows expired', () => {
  const status: InvitationStatus = 'expired'
  expect(status).toBe('expired')
})

// --- DirectorEventCandidate ---
it('DirectorEventCandidate has type and reason', () => {
  const candidate: DirectorEventCandidate = {
    type: 'face-slap',
    reason: 'disagreement escalated',
  }
  expect(candidate.type).toBe('face-slap')
  expect(candidate.reason).toBe('disagreement escalated')
})

// --- DirectorSummaryHint ---
it('DirectorSummaryHint has reason and sections', () => {
  const hint: DirectorSummaryHint = {
    reason: 'discussion reached climax',
    sections: ['consensus', 'disagreements', 'recommendations', 'nextSteps'],
  }
  expect(hint.sections).toHaveLength(4)
  expect(hint.reason).toBe('discussion reached climax')
})

// --- Invitation ---
it('Invitation has all required fields', () => {
  const invitation: Invitation = {
    invitationId: 'inv-1',
    sessionId: 'sess-1',
    status: 'pending',
    prompt: '请您发表看法',
    reason: '角色质疑用户',
    createdByMessageId: 'msg-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  expect(invitation.invitationId).toBe('inv-1')
  expect(invitation.status).toBe('pending')
  expect(invitation.prompt).toBeTruthy()
})

it('Invitation optional fields can be omitted', () => {
  const invitation: Invitation = {
    invitationId: 'inv-2',
    sessionId: 'sess-1',
    status: 'pending',
    prompt: '请参与讨论',
    reason: '分叉',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  expect(invitation.respondedByMessageId).toBeUndefined()
  expect(invitation.clientMessageId).toBeUndefined()
})

// --- DiscussionSummary ---
it('DiscussionSummary has all required fields', () => {
  const summary: DiscussionSummary = {
    summaryId: 'sum-1',
    sessionId: 'sess-1',
    messageId: 'msg-summary',
    consensus: ['观点一致'],
    disagreements: ['意见分歧'],
    recommendations: ['建议1'],
    nextSteps: ['下一步'],
    checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
  }
  expect(summary.consensus).toHaveLength(1)
  expect(summary.disagreements).toHaveLength(1)
  expect(summary.checkpointCreatedAt).toBeTruthy()
})

// --- DirectorInput ---
it('DirectorInput requires session, messages, roles, trigger', () => {
  const input: DirectorInput = {
    session: {} as Session,
    messages: [],
    roles: [],
    trigger: 'user_message',
  }
  expect(input.trigger).toBe('user_message')
  expect(input.intent).toBeUndefined()
  expect(input.pendingInvitation).toBeUndefined()
  expect(input.lastSchedulerHint).toBeUndefined()
})

it('DirectorInput can include optional fields', () => {
  const input: DirectorInput = {
    session: {} as Session,
    messages: [],
    roles: [] as AgentProfile[],
    trigger: 'invitation_response',
    intent: {} as IntentResult,
    pendingInvitation: null,
    lastSchedulerHint: {} as SchedulerHint,
  }
  expect(input.intent).toBeDefined()
  expect(input.pendingInvitation).toBeNull()
})

// --- DirectorDecisionRecord ---
it('DirectorDecisionRecord has action, reason, confidence', () => {
  const record: DirectorDecisionRecord = {
    decisionId: 'dec-1',
    sessionId: 'sess-1',
    action: 'continue',
    reason: 'opening phase, insufficient coverage',
    confidence: 0.85,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  expect(record.action).toBe('continue')
  expect(record.confidence).toBeGreaterThanOrEqual(0)
  expect(record.confidence).toBeLessThanOrEqual(1)
})

it('DirectorDecisionRecord can include schedulerHint', () => {
  const record: DirectorDecisionRecord = {
    decisionId: 'dec-2',
    sessionId: 'sess-1',
    action: 'continue',
    reason: 'need more arguments',
    confidence: 0.7,
    schedulerHint: { preferredSpeakerId: 'role-1', reason: 'next in rotation' },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  expect(record.schedulerHint?.preferredSpeakerId).toBe('role-1')
})

it('DirectorDecisionRecord can include stageSuggestion', () => {
  const record: DirectorDecisionRecord = {
    decisionId: 'dec-3',
    sessionId: 'sess-1',
    action: 'continue',
    reason: 'transition to developing',
    confidence: 0.9,
    stageSuggestion: 'developing',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  expect(record.stageSuggestion).toBe('developing')
})

it('DirectorDecisionRecord can include eventCandidate', () => {
  const record: DirectorDecisionRecord = {
    decisionId: 'dec-4',
    sessionId: 'sess-1',
    action: 'trigger_event',
    reason: 'disagreement detected',
    confidence: 0.75,
    eventCandidate: { type: 'face-slap', reason: 'strong disagreement' },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  expect(record.eventCandidate?.type).toBe('face-slap')
})

it('DirectorDecisionRecord can include summaryHint', () => {
  const record: DirectorDecisionRecord = {
    decisionId: 'dec-5',
    sessionId: 'sess-1',
    action: 'conclude',
    reason: 'sufficient coverage',
    confidence: 0.95,
    summaryHint: { reason: 'climax reached', sections: ['consensus', 'nextSteps'] },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  expect(record.summaryHint?.sections).toContain('consensus')
})

// --- InvitationStatusPatch ---
it('InvitationStatusPatch allows respondedByMessageId', () => {
  const patch: InvitationStatusPatch = {
    respondedByMessageId: 'msg-resp',
  }
  expect(patch.respondedByMessageId).toBe('msg-resp')
})

it('InvitationStatusPatch allows clientMessageId', () => {
  const patch: InvitationStatusPatch = {
    clientMessageId: 'client-1',
  }
  expect(patch.clientMessageId).toBe('client-1')
})

// --- DiscussionMessage metadata hostMessageKind ---
it('DiscussionMessage metadata can carry hostMessageKind', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-host-1',
    sessionId: 'sess-1',
    type: 'host',
    content: '欢迎参与讨论',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      hostMessageKind: 'opening',
    },
  }
  expect(msg.metadata?.hostMessageKind).toBe('opening')
})

it('DiscussionMessage metadata can carry invitationId', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-inv-1',
    sessionId: 'sess-1',
    type: 'host',
    content: '请您发表看法',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      hostMessageKind: 'invitation',
      invitationId: 'inv-1',
    },
  }
  expect(msg.metadata?.invitationId).toBe('inv-1')
})

it('DiscussionMessage metadata can carry summary checkpoint', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-summary-1',
    sessionId: 'sess-1',
    type: 'host',
    content: '总结内容',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      hostMessageKind: 'final_summary',
      summary: {
        summaryId: 'sum-1',
        sessionId: 'sess-1',
        messageId: 'msg-summary-1',
        consensus: ['一致'],
        disagreements: [],
        recommendations: [],
        nextSteps: [],
        checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }
  expect(msg.metadata?.summary?.summaryId).toBe('sum-1')
})
