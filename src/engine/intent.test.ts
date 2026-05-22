import { describe, expect, it } from 'vitest'
import {
  IntentClassificationError,
  MockIntentClassifier,
  RuleBasedIntentClassifier,
} from '@/engine/intent'
import type { AgentProfile, DiscussionMessage } from '@/types'

const roles: AgentProfile[] = [
  {
    agentId: 'host-1',
    roleId: 'host-1',
    agentType: 'host',
    name: '主持人',
    persona: '主持讨论',
    systemPrompt: '主持讨论',
    model: 'mock-default',
    visible: true,
  },
  {
    agentId: 'zhuge-liang',
    roleId: 'zhuge-liang',
    agentType: 'expert',
    name: '诸葛亮',
    persona: '战略家',
    systemPrompt: '战略家',
    model: 'mock-default',
    visible: true,
  },
]

const messages: DiscussionMessage[] = [
  {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: '请先分析局势',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
  {
    messageId: 'msg-2',
    sessionId: 'sess-1',
    type: 'character',
    roleId: 'zhuge-liang',
    content: '亮以为应先联吴',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
]

describe('IntentClassifier contracts — Task-02', () => {
  it('classifies a direct role mention as an immediate command with preferredSpeakerId', async () => {
    const classifier = new RuleBasedIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '让诸葛亮回应一下',
      roles,
      messages,
    })

    expect(intent.type).toBe('command')
    expect(intent.rawText).toBe('让诸葛亮回应一下')
    expect(intent.target?.roleId).toBe('zhuge-liang')
    expect(intent.target?.action).toBe('reply')
    expect(intent.schedulerHint?.preferredSpeakerId).toBe('zhuge-liang')
    expect(intent.execution.status).toBe('immediate')
  })

  it('classifies summarize as a decide intent assigned to the host', async () => {
    const classifier = new MockIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '总结当前结论',
      roles,
      messages,
      debug: true,
    })

    expect(intent.type).toBe('decide')
    expect(intent.target?.action).toBe('summarize')
    expect(intent.schedulerHint?.preferredAgentType).toBe('host')
    expect(intent.debugSummary?.classifierMode).toBe('mock')
  })

  it('classifies vote as a deferred command without creating a vote card', async () => {
    const classifier = new RuleBasedIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '触发投票',
      roles,
      messages,
    })

    expect(intent.type).toBe('command')
    expect(intent.target?.eventType).toBe('vote')
    expect(intent.execution.status).toBe('deferred')
    expect(intent.execution.message).toBe('已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。')
  })

  it('classifies rebuttal instructions as a command with reference role context', async () => {
    const classifier = new RuleBasedIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '让诸葛亮反驳司马懿',
      roles: [
        ...roles,
        {
          agentId: 'simayi',
          roleId: 'simayi',
          agentType: 'critic',
          name: '司马懿',
          persona: '谋士',
          systemPrompt: '谋士',
          model: 'mock-default',
          visible: true,
        },
      ],
      messages,
    })

    expect(intent.type).toBe('command')
    expect(intent.target?.roleId).toBe('zhuge-liang')
    expect(intent.target?.action).toBe('rebut')
    expect(intent.target?.referenceRoleId).toBe('simayi')
    expect(intent.schedulerHint?.preferredSpeakerId).toBe('zhuge-liang')
  })

  it('classifies end-discussion instructions as a recorded decide intent without completing the session', async () => {
    const classifier = new RuleBasedIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '结束讨论',
      roles,
      messages,
    })

    expect(intent.type).toBe('decide')
    expect(intent.target?.action).toBe('end')
    expect(intent.schedulerHint?.preferredAgentType).toBe('host')
    expect(intent.execution.status).toBe('recorded')
  })

  it('throws INTENT_CLASSIFICATION_FAILED for command-like text that cannot be interpreted', async () => {
    const classifier = new RuleBasedIntentClassifier()

    await expect(classifier.classify({
      sessionId: 'sess-1',
      content: '@/# 现在执行那个',
      roles,
      messages,
    })).rejects.toMatchObject({
      code: 'INTENT_CLASSIFICATION_FAILED',
    } satisfies Partial<IntentClassificationError>)
  })

  it('returns passive intent when forceAsPlainMessage is set', async () => {
    const classifier = new RuleBasedIntentClassifier()

    const intent = await classifier.classify({
      sessionId: 'sess-1',
      content: '@/# 现在执行那个',
      roles,
      messages,
      forceAsPlainMessage: true,
    })

    expect(intent.type).toBe('passive')
    expect(intent.rawText).toBe('@/# 现在执行那个')
    expect(intent.schedulerHint).toBeUndefined()
  })
})
