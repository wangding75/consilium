import type { GlobalModelDefaults, PromptConfig, ProviderConfig, RoleModelOverride } from '@/types'

export interface SettingsRepository {
  getProviderConfigs(): Promise<ProviderConfig[]>
  upsertProviderConfig(config: ProviderConfig): Promise<ProviderConfig>
  getModelDefaults(): Promise<GlobalModelDefaults | null>
  saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults>
  getRoleModelOverrides(): Promise<RoleModelOverride[]>
  saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]>
  getPromptConfigs(): Promise<PromptConfig[]>
  savePromptConfig(prompt: PromptConfig): Promise<PromptConfig>
  clearAll(): Promise<void>
}
