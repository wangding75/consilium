import { NextResponse } from 'next/server'
import type { ApiResponse, UpdateSessionStatusRequest } from '@/types/api'
import type { Session, SessionStatusAction } from '@/types'
import { SessionService } from '@/server/services/session.service'
import { sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

const VALID_ACTIONS = new Set<SessionStatusAction>(['archive', 'complete', 'resume'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<Session>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const body = (await request.json()) as UpdateSessionStatusRequest
    if (!body.action || !VALID_ACTIONS.has(body.action)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: `Invalid action: ${body.action}` }, requestId },
        { status: 400 }
      )
    }
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.updateSessionStatus(sessionId, body.action)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'SESSION_NOT_FOUND' ? 404 : err.code === 'SUMMARY_REQUIRED' ? 409 : 400
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status }
      )
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
