import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, PromptConfigDTO, UpdatePromptRequest } from '@/types/api'
import { SettingsService } from '@/server/services/settings.service'
import { sharedSettingsRepo, sharedSessionRepo, sharedMessageRepo, sharedEventRepo, sharedVoteRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): SettingsService {
  return new SettingsService(
    sharedSettingsRepo,
    sharedSessionRepo,
    sharedMessageRepo,
    sharedEventRepo,
    sharedVoteRepo
  )
}

export async function GET(): Promise<NextResponse<ApiResponse<PromptConfigDTO[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().getPromptConfigs()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<PromptConfigDTO>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await req.json()) as UpdatePromptRequest
    if (!body.promptId) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'promptId is required' }, requestId },
        { status: 400 }
      )
    }
    const service = getService()
    const data = body.reset
      ? await service.resetPromptToDefault(body.promptId)
      : await service.updatePrompt(body.promptId, body.content ?? '')
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'VALIDATION_ERROR' ? 400 : 500
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
