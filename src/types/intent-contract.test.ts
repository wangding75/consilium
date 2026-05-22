import { describe, expect, it } from 'vitest'
import type { AgentType, IntentResult, SchedulerHint } from '@/types'
import type { IntentRequest, IntentResponse, SendMessageParams } from '@/types/api'

describe('Intent domain and API DTO contracts — Task-01', () => {
  it('represents command intent metadata with a scheduler hint for a target role', () => {
    const hint: SchedulerHint = {
      preferredSpeakerId: 'zhuge-liang',
      reason: 'user requested a direct reply from Zhuge Liang',
    }
    const intent: IntentResult = {
      type: 'command',
      confidence: 0.92,
      rawText: '让诸葛亮回应一下',
      target: { roleId: 'zhuge-liang', action: 'reply' },
      schedulerHint: hint,
      execution: { status: 'immediate' },
    }

    expect(intent.target?.roleId).toBe('zhuge-liang')
    expect(intent.schedulerHint?.preferredSpeakerId).toBe('zhuge-liang')
    expect(intent.execution.status).toBe('immediate')
  })

  it('keeps Message API bound to the full IntentResponse wrapper', () => {
    const response: IntentResponse = {
      sessionId: 'sess-1',
      clientMessageId: 'client-1',
      activeSpeakerId: 'host-1',
      intent: {
        type: 'decide',
        confidence: 0.88,
        rawText: '总结当前结论',
        target: { action: 'summarize' },
        schedulerHint: { preferredAgentType: 'host' as AgentType, reason: 'summary requires host' },
        execution: { status: 'recorded' },
      },
    }
    const params: SendMessageParams = {
      content: '总结当前结论',
      clientMessageId: 'client-1',
      intentResponse: response,
    }

    expect(params.intentResponse?.sessionId).toBe('sess-1')
    expect(params.intentResponse?.clientMessageId).toBe('client-1')
    expect(params.intentResponse?.intent.rawText).toBe(params.content)
  })

  it('supports safe debug summaries without provider prompts or credentials', () => {
    const req: IntentRequest = { content: '触发投票', clientMessageId: 'client-debug', debug: true }
    const result: IntentResult = {
      type: 'command',
      confidence: 0.86,
      rawText: req.content,
      target: { eventType: 'vote' },
      schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' },
      execution: { status: 'deferred' },
      debugSummary: {
        classifierMode: 'rule',
        matchedRule: 'vote-keyword',
        confidence: 0.86,
        type: 'command',
        target: { eventType: 'vote' },
        schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' },
      },
    }

    expect(result.debugSummary).toEqual({
      classifierMode: 'rule',
      matchedRule: 'vote-keyword',
      confidence: 0.86,
      type: 'command',
      target: { eventType: 'vote' },
      schedulerHint: { preferredAgentType: 'host', reason: 'vote is mediated by host' },
    })
    expect(JSON.stringify(result.debugSummary)).not.toMatch(/apiKey|prompt|providerRequest/i)
  })
})
