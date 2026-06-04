import type { ModelStrategy, ModelStrategySnapshot, ResolvedRoleRuntimeConfig, TemplateRole, ModelDefaults } from '@/types'
import type { ModelStrategyRepository } from '@/server/repositories/model-strategy.repository'
import type { ModelStrategiesResult } from '@/types/api'
import { ServiceError } from '@/server/errors'

function cloneStrategy(strategy: ModelStrategy): ModelStrategy {
  return structuredClone(strategy)
}

export class ModelStrategyService {
  constructor(private readonly repo: ModelStrategyRepository) {}

  async listStrategies(): Promise<ModelStrategiesResult> {
    try {
      const strategies = await this.repo.findAll()
      const defaultStrategy = await this.repo.findDefault()
      if (!defaultStrategy) {
        throw new ServiceError('MODEL_STRATEGY_REQUIRED', 'Default model strategy is required')
      }

      return {
        strategies: strategies.map((strategy) => cloneStrategy(strategy)),
        defaultModelStrategyId: defaultStrategy.modelStrategyId,
      }
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('MODEL_STRATEGY_LIST_FAILED', 'Failed to list model strategies', err)
    }
  }

  async getStrategy(modelStrategyId: string): Promise<ModelStrategy> {
    try {
      const strategy = await this.repo.findById(modelStrategyId)
      if (!strategy) {
        throw new ServiceError('MODEL_STRATEGY_NOT_FOUND', `Model strategy ${modelStrategyId} not found`)
      }
      if (!strategy.active) {
        throw new ServiceError('MODEL_STRATEGY_UNAVAILABLE', `Model strategy ${modelStrategyId} is unavailable`)
      }
      return cloneStrategy(strategy)
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('MODEL_STRATEGY_GET_FAILED', 'Failed to get model strategy', err)
    }
  }

  async getDefaultStrategy(): Promise<ModelStrategy> {
    try {
      const strategy = await this.repo.findDefault()
      if (!strategy) {
        throw new ServiceError('MODEL_STRATEGY_REQUIRED', 'Default model strategy is required')
      }
      if (!strategy.active) {
        throw new ServiceError('MODEL_STRATEGY_UNAVAILABLE', `Model strategy ${strategy.modelStrategyId} is unavailable`)
      }
      return cloneStrategy(strategy)
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('MODEL_STRATEGY_GET_FAILED', 'Failed to get default model strategy', err)
    }
  }

  createStrategySnapshot(strategy: ModelStrategy, selectedByDefault: boolean): ModelStrategySnapshot {
    const cloned = cloneStrategy(strategy)
    return {
      modelStrategyId: cloned.modelStrategyId,
      name: cloned.name,
      selectedByDefault,
      defaultModel: cloned.defaultModel,
      roleOverrides: structuredClone(cloned.roleOverrides),
      fallbackChain: [...cloned.fallbackChain],
      temperature: cloned.temperature,
      maxTokens: cloned.maxTokens,
      snapshotAt: new Date().toISOString(),
    }
  }

  resolveRoleRuntimeConfig(
    role: TemplateRole,
    templateDefaults: ModelDefaults,
    snapshot: ModelStrategySnapshot
  ): ResolvedRoleRuntimeConfig {
    const roleOverride = snapshot.roleOverrides[role.roleId]
    const roleConfig = role.runtimeConfig

    const model = roleConfig?.model ?? roleOverride?.model ?? snapshot.defaultModel ?? templateDefaults.defaultModel
    const temperature = roleConfig?.temperature ?? roleOverride?.temperature ?? snapshot.temperature ?? templateDefaults.temperature ?? 0.7
    const maxTokens = roleOverride?.maxTokens ?? snapshot.maxTokens ?? templateDefaults.maxTokens ?? 512
    const maxCharsPerTurn = roleConfig?.maxCharsPerTurn ?? templateDefaults.maxCharsPerTurn
    const resolvedModelSource =
      roleConfig?.model !== undefined
        ? 'roleConfig'
        : roleOverride?.model !== undefined
          ? 'roleOverride'
          : snapshot.defaultModel !== undefined
            ? 'default'
            : 'templateDefaults'

    return {
      roleId: role.roleId,
      model,
      temperature,
      maxTokens,
      ...(maxCharsPerTurn !== undefined ? { maxCharsPerTurn } : {}),
      fallbackChain: [...snapshot.fallbackChain],
      resolvedModelSource,
    }
  }
}
