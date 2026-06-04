import type { ModelStrategy, ModelStrategySnapshot, ResolvedRoleRuntimeConfig, TemplateRole, ModelDefaults } from '@/types'
import type { ModelStrategyRepository } from '@/server/repositories/model-strategy.repository'
import type { ModelStrategiesResult } from '@/types/api'
import { ServiceError } from '@/server/errors'

export class ModelStrategyService {
  constructor(private readonly repo: ModelStrategyRepository) {}

  async listStrategies(): Promise<ModelStrategiesResult> {
    throw new Error('not implemented')
  }

  async getStrategy(modelStrategyId: string): Promise<ModelStrategy> {
    throw new Error('not implemented')
  }

  async getDefaultStrategy(): Promise<ModelStrategy> {
    throw new Error('not implemented')
  }

  createStrategySnapshot(strategy: ModelStrategy, selectedByDefault: boolean): ModelStrategySnapshot {
    throw new Error('not implemented')
  }

  resolveRoleRuntimeConfig(
    role: TemplateRole,
    templateDefaults: ModelDefaults,
    snapshot: ModelStrategySnapshot
  ): ResolvedRoleRuntimeConfig {
    throw new Error('not implemented')
  }
}
