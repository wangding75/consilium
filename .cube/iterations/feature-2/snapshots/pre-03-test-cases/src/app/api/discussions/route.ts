import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Discussion } from '@/types'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import {
  sharedSessionRepo,
  sharedTemplateRepo,
  sharedMessageRepo,
  sharedAgentCallLogRepo,
} from '@/server/repositories/mock/instances'
import { DiscussionOrchestrator } from '@/engine/orchestrator'
import { RoundRobinScheduler } from '@/engine/scheduler'
import { ContextBuilder } from '@/engine/context-builder'
import { DefaultAgentRuntime } from '@/engine/agent-runtime'
import { MockLLMClient } from '@/llm/mock-llm-client'
import { ServiceError } from '@/server/errors'

function createService(): DiscussionService {
  const orchestrator = new DiscussionOrchestrator(
    new RoundRobinScheduler(),
    new ContextBuilder(),
    new DefaultAgentRuntime(new MockLLMClient())
  )
  return new DiscussionService(
    new MockDiscussionRepository(),
    sharedSessionRepo,
    sharedTemplateRepo,
    sharedMessageRepo,
    sharedAgentCallLogRepo,
    orchestrator
  )
}

export async function GET(): Promise<NextResponse<ApiResponse<Discussion[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = createService()
    const data = await service.listDiscussions()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
