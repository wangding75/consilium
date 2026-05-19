import type { OrchestratorInput, OrchestratorResult } from '@/types'
import type { Scheduler } from '@/engine/scheduler'
import type { ContextBuilder } from '@/engine/context-builder'
import type { AgentRuntime } from '@/engine/agent-runtime'

export class DiscussionOrchestrator {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly contextBuilder: ContextBuilder,
    private readonly agentRuntime: AgentRuntime
  ) {}

  async run(_input: OrchestratorInput): Promise<OrchestratorResult> {
    throw new Error('not implemented')
  }
}

// @deprecated — kept to allow existing engine.test.ts to compile; remove in 03-test-cases
export class DefaultOrchestrator {
  async start(_session: unknown): Promise<void> {
    return
  }
  async next(_session: unknown): Promise<null> {
    return null
  }
}
