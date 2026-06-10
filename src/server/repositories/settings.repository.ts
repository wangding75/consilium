import type {
  GlobalModelDefaults,
  PromptConfig,
  ProviderConfig,
  ProviderConnection,
  RoleModelOverride,
  SettingsExportBundle,
  SettingsImportPreview,
  TemplateRuntimeConfig,
} from '@/types'

export interface SettingsRepository {
  getProviderConfigs(): Promise<ProviderConfig[]>
  upsertProviderConfig(config: ProviderConfig): Promise<ProviderConfig>
  getProviderConnections(): Promise<ProviderConnection[]>
  getProviderConnectionById(connectionId: string): Promise<ProviderConnection | null>
  saveProviderConnection(connection: ProviderConnection): Promise<ProviderConnection>
  deleteProviderConnection(connectionId: string): Promise<boolean>
  getTemplateRuntimeConfigs(): Promise<TemplateRuntimeConfig[]>
  saveTemplateRuntimeConfigs(configs: TemplateRuntimeConfig[]): Promise<TemplateRuntimeConfig[]>
  saveImportPreview(previewToken: string, bundle: SettingsExportBundle, preview: SettingsImportPreview): Promise<void>
  getImportPreview(previewToken: string): Promise<{ bundle: SettingsExportBundle; preview: SettingsImportPreview } | null>
  deleteImportPreview(previewToken: string): Promise<void>
  getModelDefaults(): Promise<GlobalModelDefaults | null>
  saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults>
  getRoleModelOverrides(): Promise<RoleModelOverride[]>
  saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]>
  getPromptConfigs(): Promise<PromptConfig[]>
  savePromptConfig(prompt: PromptConfig): Promise<PromptConfig>
  clearAll(): Promise<void>
}
