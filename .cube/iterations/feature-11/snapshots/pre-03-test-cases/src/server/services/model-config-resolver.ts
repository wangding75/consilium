import type {
  GlobalModelDefaults,
  ModelDefaults,
  ModelStrategySnapshot,
  ResolvedModelConfig,
  RoleModelOverride,
  SessionRuntimeConfigSnapshot,
} from '@/types'

export class ModelConfigResolver {
  resolveForRole(
    roleId: string,
    runtimeConfigSnapshot: SessionRuntimeConfigSnapshot | undefined,
    templateDefaults: ModelDefaults,
    strategySnapshot: ModelStrategySnapshot | undefined,
    globalDefaults: GlobalModelDefaults | null,
    providerDefault?: string
  ): ResolvedModelConfig {
    // Priority 1: role-specific override from session snapshot
    if (runtimeConfigSnapshot) {
      const roleOverride = runtimeConfigSnapshot.roleOverrides.find((o) => o.roleId === roleId)
      if (roleOverride?.model) {
        return {
          providerId: roleOverride.providerId ?? runtimeConfigSnapshot.globalDefaults.providerId,
          model: roleOverride.model,
          temperature: roleOverride.temperature ?? runtimeConfigSnapshot.globalDefaults.temperature,
          maxTokens: roleOverride.maxTokens ?? runtimeConfigSnapshot.globalDefaults.maxTokens,
          source: 'roleOverride',
        }
      }
      // Priority 2: session runtime config snapshot (global defaults at session creation time)
      const snap = runtimeConfigSnapshot.globalDefaults
      if (snap.model) {
        return {
          providerId: snap.providerId,
          model: snap.model,
          temperature: snap.temperature,
          maxTokens: snap.maxTokens,
          source: 'sessionSnapshot',
        }
      }
    }

    // Priority 3: strategy snapshot role override
    if (strategySnapshot) {
      const strategyRoleOverride = strategySnapshot.roleOverrides[roleId] as RoleModelOverride | undefined
      if (strategyRoleOverride?.model) {
        return {
          providerId: '',
          model: strategyRoleOverride.model,
          temperature: strategyRoleOverride.temperature ?? strategySnapshot.temperature,
          maxTokens: strategyRoleOverride.maxTokens ?? strategySnapshot.maxTokens,
          source: 'strategyDefaults',
        }
      }
      if (strategySnapshot.defaultModel) {
        return {
          providerId: '',
          model: strategySnapshot.defaultModel,
          temperature: strategySnapshot.temperature,
          maxTokens: strategySnapshot.maxTokens,
          source: 'strategyDefaults',
        }
      }
    }

    // Priority 3b: template defaults
    if (templateDefaults.defaultModel) {
      return {
        providerId: '',
        model: templateDefaults.defaultModel,
        temperature: templateDefaults.temperature ?? 0.7,
        maxTokens: templateDefaults.maxTokens ?? 512,
        source: 'templateDefaults',
      }
    }

    // Priority 4: global defaults
    if (globalDefaults?.model) {
      return {
        providerId: globalDefaults.providerId,
        model: globalDefaults.model,
        temperature: globalDefaults.temperature,
        maxTokens: globalDefaults.maxTokens,
        source: 'globalDefaults',
      }
    }

    // Priority 5: provider default
    return {
      providerId: '',
      model: providerDefault ?? '',
      temperature: 0.7,
      maxTokens: 512,
      source: 'providerDefault',
    }
  }
}
