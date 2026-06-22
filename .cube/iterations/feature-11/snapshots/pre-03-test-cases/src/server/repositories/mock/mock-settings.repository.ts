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
import type { SettingsRepository } from '../settings.repository'

function cloneProviderConnection(connection: ProviderConnection): ProviderConnection {
  return {
    ...connection,
    modelList: [...connection.modelList],
    ...(connection.customHeaders ? { customHeaders: { ...connection.customHeaders } } : {}),
  }
}

function cloneTemplateRuntimeConfig(config: TemplateRuntimeConfig): TemplateRuntimeConfig {
  return {
    ...config,
    roleConfigs: config.roleConfigs.map((roleConfig) => ({ ...roleConfig })),
  }
}

function cloneExportBundle(bundle: SettingsExportBundle): SettingsExportBundle {
  return {
    ...bundle,
    providerConnections: bundle.providerConnections.map(cloneProviderConnection),
    templateRuntimeConfigs: bundle.templateRuntimeConfigs.map(cloneTemplateRuntimeConfig),
    prompts: bundle.prompts.map((prompt) => ({ ...prompt })),
  }
}

function cloneImportPreview(preview: SettingsImportPreview): SettingsImportPreview {
  return {
    additions: [...preview.additions],
    updates: [...preview.updates],
    conflicts: [...preview.conflicts],
    invalidItems: [...preview.invalidItems],
  }
}

export class MockSettingsRepository implements SettingsRepository {
  private providerConfigs = new Map<string, ProviderConfig>()
  private providerConnections = new Map<string, ProviderConnection>()
  private templateRuntimeConfigs = new Map<string, TemplateRuntimeConfig>()
  private importPreviews = new Map<string, { bundle: SettingsExportBundle; preview: SettingsImportPreview }>()
  private modelDefaults: GlobalModelDefaults | null = null
  private roleModelOverrides: RoleModelOverride[] = []
  private promptConfigs = new Map<string, PromptConfig>()

  async getProviderConfigs(): Promise<ProviderConfig[]> {
    return Array.from(this.providerConfigs.values()).map((config) => ({
      ...config,
      modelList: [...config.modelList],
      ...(config.customHeaders ? { customHeaders: { ...config.customHeaders } } : {}),
    }))
  }

  async upsertProviderConfig(config: ProviderConfig): Promise<ProviderConfig> {
    const copy = {
      ...config,
      modelList: [...config.modelList],
      ...(config.customHeaders ? { customHeaders: { ...config.customHeaders } } : {}),
    }
    this.providerConfigs.set(config.providerId, copy)
    return {
      ...copy,
      modelList: [...copy.modelList],
      ...(copy.customHeaders ? { customHeaders: { ...copy.customHeaders } } : {}),
    }
  }

  async getProviderConnections(): Promise<ProviderConnection[]> {
    return Array.from(this.providerConnections.values()).map(cloneProviderConnection)
  }

  async getProviderConnectionById(connectionId: string): Promise<ProviderConnection | null> {
    const connection = this.providerConnections.get(connectionId)
    return connection ? cloneProviderConnection(connection) : null
  }

  async saveProviderConnection(connection: ProviderConnection): Promise<ProviderConnection> {
    const copy = cloneProviderConnection(connection)
    this.providerConnections.set(connection.id, copy)
    return cloneProviderConnection(copy)
  }

  async deleteProviderConnection(connectionId: string): Promise<boolean> {
    return this.providerConnections.delete(connectionId)
  }

  async getTemplateRuntimeConfigs(): Promise<TemplateRuntimeConfig[]> {
    return Array.from(this.templateRuntimeConfigs.values()).map(cloneTemplateRuntimeConfig)
  }

  async saveTemplateRuntimeConfigs(configs: TemplateRuntimeConfig[]): Promise<TemplateRuntimeConfig[]> {
    this.templateRuntimeConfigs = new Map(configs.map((config) => [config.templateId, cloneTemplateRuntimeConfig(config)]))
    return Array.from(this.templateRuntimeConfigs.values()).map(cloneTemplateRuntimeConfig)
  }

  async saveImportPreview(previewToken: string, bundle: SettingsExportBundle, preview: SettingsImportPreview): Promise<void> {
    this.importPreviews.set(previewToken, {
      bundle: cloneExportBundle(bundle),
      preview: cloneImportPreview(preview),
    })
  }

  async getImportPreview(previewToken: string): Promise<{ bundle: SettingsExportBundle; preview: SettingsImportPreview } | null> {
    const saved = this.importPreviews.get(previewToken)
    if (!saved) {
      return null
    }

    return {
      bundle: cloneExportBundle(saved.bundle),
      preview: cloneImportPreview(saved.preview),
    }
  }

  async deleteImportPreview(previewToken: string): Promise<void> {
    this.importPreviews.delete(previewToken)
  }

  async getModelDefaults(): Promise<GlobalModelDefaults | null> {
    return this.modelDefaults ? { ...this.modelDefaults } : null
  }

  async saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults> {
    this.modelDefaults = { ...defaults }
    return { ...defaults }
  }

  async getRoleModelOverrides(): Promise<RoleModelOverride[]> {
    return this.roleModelOverrides.map((override) => ({ ...override }))
  }

  async saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]> {
    this.roleModelOverrides = overrides.map((override) => ({ ...override }))
    return this.roleModelOverrides.map((override) => ({ ...override }))
  }

  async getPromptConfigs(): Promise<PromptConfig[]> {
    return Array.from(this.promptConfigs.values()).map((prompt) => ({ ...prompt }))
  }

  async savePromptConfig(prompt: PromptConfig): Promise<PromptConfig> {
    this.promptConfigs.set(prompt.promptId, { ...prompt })
    return { ...prompt }
  }

  async clearAll(): Promise<void> {
    this.providerConfigs.clear()
    this.providerConnections.clear()
    this.templateRuntimeConfigs.clear()
    this.importPreviews.clear()
    this.modelDefaults = null
    this.roleModelOverrides = []
    this.promptConfigs.clear()
  }
}
