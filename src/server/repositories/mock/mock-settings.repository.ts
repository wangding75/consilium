import type { GlobalModelDefaults, PromptConfig, ProviderConfig, RoleModelOverride } from '@/types'
import type { SettingsRepository } from '../settings.repository'

export class MockSettingsRepository implements SettingsRepository {
  private providerConfigs = new Map<string, ProviderConfig>()
  private modelDefaults: GlobalModelDefaults | null = null
  private roleModelOverrides: RoleModelOverride[] = []
  private promptConfigs = new Map<string, PromptConfig>()

  async getProviderConfigs(): Promise<ProviderConfig[]> {
    return Array.from(this.providerConfigs.values()).map((c) => ({ ...c, modelList: [...c.modelList] }))
  }

  async upsertProviderConfig(config: ProviderConfig): Promise<ProviderConfig> {
    const copy = { ...config, modelList: [...config.modelList] }
    this.providerConfigs.set(config.providerId, copy)
    return { ...copy, modelList: [...copy.modelList] }
  }

  async getModelDefaults(): Promise<GlobalModelDefaults | null> {
    return this.modelDefaults ? { ...this.modelDefaults } : null
  }

  async saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults> {
    this.modelDefaults = { ...defaults }
    return { ...defaults }
  }

  async getRoleModelOverrides(): Promise<RoleModelOverride[]> {
    return this.roleModelOverrides.map((o) => ({ ...o }))
  }

  async saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]> {
    this.roleModelOverrides = overrides.map((o) => ({ ...o }))
    return this.roleModelOverrides.map((o) => ({ ...o }))
  }

  async getPromptConfigs(): Promise<PromptConfig[]> {
    return Array.from(this.promptConfigs.values()).map((p) => ({ ...p }))
  }

  async savePromptConfig(prompt: PromptConfig): Promise<PromptConfig> {
    this.promptConfigs.set(prompt.promptId, { ...prompt })
    return { ...prompt }
  }

  async clearAll(): Promise<void> {
    this.providerConfigs.clear()
    this.modelDefaults = null
    this.roleModelOverrides = []
    this.promptConfigs.clear()
  }
}
