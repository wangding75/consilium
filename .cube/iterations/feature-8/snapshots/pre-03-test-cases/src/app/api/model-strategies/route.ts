import { NextResponse } from 'next/server'
import type { ApiResponse, ModelStrategiesResult } from '@/types/api'
import { ModelStrategyService } from '@/server/services/model-strategy.service'
import { sharedModelStrategyRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<ModelStrategiesResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new ModelStrategyService(sharedModelStrategyRepo)
    const data = await service.listStrategies()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
