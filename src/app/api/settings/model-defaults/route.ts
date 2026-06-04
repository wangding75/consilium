import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, ModelDefaultsDTO } from '@/types/api'
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

export async function GET(): Promise<NextResponse<ApiResponse<ModelDefaultsDTO | null>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().getModelDefaults()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<ModelDefaultsDTO>>> {
  const requestId = crypto.randomUUID()
  try {
    const raw = await req.json()
    const body: ModelDefaultsDTO = {
      providerId: raw.providerId,
      model: raw.model,
      temperature: raw.temperature ?? 0.7,
      maxTokens: raw.maxTokens ?? 512,
    }
    if (!body.providerId || !body.model) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'providerId and model are required' }, requestId },
        { status: 400 }
      )
    }
    const data = await getService().saveModelDefaults(body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
