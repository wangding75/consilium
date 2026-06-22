import type { ModelStrategy } from '@/types'

export interface ModelStrategyRepository {
  findAll(): Promise<ModelStrategy[]>
  findById(modelStrategyId: string): Promise<ModelStrategy | null>
  findDefault(): Promise<ModelStrategy | null>
}
