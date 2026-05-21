import type { OrchestratorInput, OrchestratorResult, DiscussionMessage, AgentCallLogData } from '@/types'
import type { Scheduler } from '@/engine/scheduler'
import type { ContextBuilder } from '@/engine/context-builder'
import type { AgentRuntime } from '@/engine/agent-runtime'

export class DiscussionOrchestrator {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly contextBuilder: ContextBuilder,
    private readonly agentRuntime: AgentRuntime
  ) {}

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const { sessionId, runId, topic, templateName, profiles, messageHistory } = input
    const selection = this.scheduler.selectSpeakers({
      sessionId,
      roles: profiles,
      messageHistory,
      roundIndex: messageHistory.length,
      schedulerHint: input.schedulerHint ?? input.intent?.schedulerHint,
    })

    const agentMessages: DiscussionMessage[] = []
    const callLogs: AgentCallLogData[] = []
    let activeSpeakerId: string | null = null

    for (const speakerId of selection.speakerIds) {
      const profile = profiles.find((p) => p.roleId === speakerId)
      if (!profile) continue

      const contextMessages = this.contextBuilder.build({
        sessionId,
        topic,
        templateName,
        role: profile,
        messageHistory,
      })

      const start = Date.now()
      const output = await this.agentRuntime.run(profile, contextMessages)
      const durationMs = Date.now() - start

      const messageId = `msg-${runId}-${speakerId}`
      const msg: DiscussionMessage = {
        messageId,
        sessionId,
        type: output.messageType,
        roleId: output.roleId,
        content: output.content,
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
      agentMessages.push(msg)

      const callLog: AgentCallLogData = {
        sessionId,
        runId,
        messageId,
        agentId: output.agentId,
        roleId: output.roleId,
        provider: 'mock',
        model: profile.model,
        inputSummary: contextMessages[0]?.content?.slice(0, 100) ?? '',
        outputSummary: output.content.slice(0, 100),
        output: output.content,
        durationMs,
        status: 'success',
      }
      callLogs.push(callLog)
      activeSpeakerId = speakerId
    }

    return { agentMessages, callLogs, activeSpeakerId }
  }
}

// @deprecated — compatibility stub for iteration-1 engine.test.ts
export class DefaultOrchestrator {
  async start(_session: unknown): Promise<void> {
    return
  }
  async next(_session: unknown): Promise<null> {
    return null
  }
}
