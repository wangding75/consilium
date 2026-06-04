import { NextResponse } from 'next/server'
import type { ApiResponse, CreateSessionParams, CreateSessionResult, ListSessionsQuery, SessionListResult } from '@/types/api'
import type { Session, SessionLifecycleStatus } from '@/types'
import { SessionService } from '@/server/services/session.service'
import { sharedMessageRepo, sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

const MAX_SESSION_LIST_LIMIT = 100

function toSessionListResult(result: SessionListResult | Session[]): SessionListResult {
  if (!Array.isArray(result)) {
    return result
  }

  return {
    sessions: result.map((session) => ({
      sessionId: session.id,
      topic: session.topic,
      status: session.status,
      template: session.templateSnapshot
        ? {
            templateId: session.templateSnapshot.templateId,
            name: session.templateSnapshot.name,
            version: session.templateSnapshot.version,
            fromSnapshot: true,
          }
        : {
            templateId: session.templateId,
            name: session.templateId,
            fromSnapshot: false,
            fallbackReason: 'templateSnapshot missing',
          },
      modelStrategy: session.strategySnapshot
        ? {
            modelStrategyId: session.strategySnapshot.modelStrategyId,
            name: session.strategySnapshot.name,
            selectedByDefault: session.strategySnapshot.selectedByDefault,
            fromSnapshot: true,
          }
        : session.modelStrategyId
          ? {
              modelStrategyId: session.modelStrategyId,
              name: session.modelStrategyId,
              fromSnapshot: false,
            }
          : undefined,
      roleCount: session.templateSnapshot?.roles.length ?? 0,
      eventCount: session.templateSnapshot?.events.length ?? 0,
      messageCount: session.messages.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })),
  }
}

export function GET(): Promise<NextResponse<ApiResponse<SessionListResult>>>
export function GET(request: Request): Promise<NextResponse<ApiResponse<SessionListResult>>>
export async function GET(request?: Request): Promise<NextResponse<ApiResponse<SessionListResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const searchParams = request ? new URL(request.url).searchParams : new URLSearchParams()
    const rawStatus = searchParams.get('status')
    const validStatuses = new Set<string>(['running', 'completed', 'archived'])
    if (rawStatus && !validStatuses.has(rawStatus)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: `Invalid status: ${rawStatus}` }, requestId },
        { status: 400 }
      )
    }
    const rawLimit = searchParams.get('limit')
    const parsedLimit = rawLimit === null ? undefined : Number(rawLimit)
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > MAX_SESSION_LIST_LIMIT)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: `Invalid limit: ${rawLimit}` }, requestId },
        { status: 400 }
      )
    }
    const query: ListSessionsQuery = {
      status: rawStatus as SessionLifecycleStatus | undefined,
      keyword: searchParams.get('keyword') ?? undefined,
      limit: parsedLimit,
    }
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo, sharedMessageRepo)
    const data = toSessionListResult(await service.listSessions(query))
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

export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<CreateSessionResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.topic !== 'string' || typeof body.templateId !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'topic and templateId must be strings' }, requestId },
        { status: 400 }
      )
    }
    const params: CreateSessionParams = {
      topic: body.topic,
      templateId: body.templateId,
      modelStrategyId: typeof body.modelStrategyId === 'string' ? body.modelStrategyId : undefined,
    }
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.createSession(params)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const { code } = err
      const httpStatus = code === 'TEMPLATE_NOT_FOUND' || code === 'MODEL_STRATEGY_NOT_FOUND' ? 404 : 400
      if (code === 'TOPIC_REQUIRED' || code === 'TOPIC_TOO_LONG' || code === 'TEMPLATE_NOT_FOUND' || code === 'TEMPLATE_UNAVAILABLE' || code === 'MODEL_STRATEGY_NOT_FOUND' || code === 'MODEL_STRATEGY_UNAVAILABLE' || code === 'MODEL_STRATEGY_REQUIRED') {
        return NextResponse.json(
          { success: false, data: null, error: { code, message: err.message }, requestId },
          { status: httpStatus }
        )
      }
    }
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        requestId,
      },
      { status: 500 }
    )
  }
}
