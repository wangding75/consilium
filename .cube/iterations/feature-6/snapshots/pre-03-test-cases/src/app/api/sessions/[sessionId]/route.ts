import { NextResponse } from 'next/server'
import type { ApiResponse, SessionDetailResult } from '@/types/api'
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<SessionDetailResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const service = createService()
    const data = await service.getSessionDetail(sessionId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: 404 }
      )
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}
