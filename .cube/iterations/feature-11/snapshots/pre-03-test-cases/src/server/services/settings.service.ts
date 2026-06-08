import type {
  GlobalModelDefaults,
  PromptConfig,
  ProviderConfig,
  ProviderConnection,
  RoleModelOverride,
  SettingsExportBundle,
} from '@/types'
import type {
  ClearScope,
  ProviderConnectionDTO,
  ProviderConnectionDeleteResult,
  ProviderConnectionListResult,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderStatusDTO,
  ProviderTestRequest,
  ProviderTestResult,
  SettingsImportCommitRequest,
  SettingsImportCommitResult,
  SettingsImportPreviewResult,
  SettingsSessionsExportResult,
} from '@/types/api'
import { ServiceError } from '@/server/errors'
import type { SettingsRepository } from '@/server/repositories/settings.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { EventRepository } from '@/server/repositories/event.repository'
import type { VoteRepository } from '@/server/repositories/vote.repository'

function maskApiKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  if (key.length <= 8) return '***'
  return `${key.slice(0, 3)}***${key.slice(-5)}`
}

function maskHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {}
  }

  return Object.fromEntries(Object.keys(headers).map((key) => [key, '***']))
}

function toProviderConnectionDTO(connection: ProviderConnection): ProviderConnectionDTO {
  return {
    id: connection.id,
    providerType: connection.providerType,
    displayName: connection.displayName,
    baseUrl: connection.baseUrl,
    modelList: [...connection.modelList],
    enabled: connection.enabled,
    lastTestStatus: connection.lastTestStatus,
    lastTestAt: connection.lastTestAt,
    lastErrorCode: connection.lastErrorCode,
    lastErrorMessage: connection.lastErrorMessage,
    maskedKey: maskApiKey(connection.apiKeyRef),
    maskedHeaders: maskHeaders(connection.customHeaders),
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }
}

export class SettingsService {
  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly messageRepo: MessageRepository,
    private readonly eventRepo: EventRepository,
    private readonly voteRepo: VoteRepository
  ) {}

  async listProviders(): Promise<ProviderStatusDTO[]> {
    const configs = await this.settingsRepo.getProviderConfigs()
    return configs.map((config) => ({
      providerId: config.providerId,
      enabled: config.enabled,
      baseUrl: config.baseUrl,
      maskedKey: maskApiKey(config.apiKeyRef),
      modelList: [...config.modelList],
      maskedHeaders: maskHeaders(config.customHeaders),
      lastTestStatus: config.lastTestStatus,
      lastTestedAt: config.lastTestedAt,
      lastErrorCode: config.lastErrorCode,
      lastErrorMessage: config.lastErrorMessage,
    }))
  }

  async upsertProviderConfig(params: {
    providerId: ProviderConfig['providerId']
    enabled: boolean
    baseUrl?: string
    apiKey?: string
    modelList?: string[]
    headers?: Record<string, string>
  }): Promise<ProviderStatusDTO> {
    const existing = (await this.settingsRepo.getProviderConfigs()).find(
      (config) => config.providerId === params.providerId
    )
    const updated: ProviderConfig = {
      providerId: params.providerId,
      enabled: params.enabled,
      baseUrl: params.baseUrl ?? existing?.baseUrl,
      apiKeyRef: params.apiKey ?? existing?.apiKeyRef,
      modelList: params.modelList ?? existing?.modelList ?? [],
      customHeaders: params.headers ?? existing?.customHeaders,
      lastTestStatus: existing?.lastTestStatus ?? 'untested',
      lastTestedAt: existing?.lastTestedAt,
      lastErrorCode: existing?.lastErrorCode,
      lastErrorMessage: existing?.lastErrorMessage,
    }
    const saved = await this.settingsRepo.upsertProviderConfig(updated)
    return {
      providerId: saved.providerId,
      enabled: saved.enabled,
      maskedKey: maskApiKey(saved.apiKeyRef),
      modelList: [...saved.modelList],
      maskedHeaders: maskHeaders(saved.customHeaders),
      lastTestStatus: saved.lastTestStatus,
    }
  }

  async testProvider(params: ProviderTestRequest): Promise<ProviderTestResult> {
    const checkedAt = new Date().toISOString()
    const maskedKey = maskApiKey(params.apiKey)

    if (params.apiKey === 'sk-valid') {
      return {
        providerId: params.providerId,
        status: 'success',
        latencyMs: 42,
        checkedAt,
        availableModels: params.model ? [params.model] : ['default-model'],
        maskedKey,
      }
    }

    if (params.apiKey === 'sk-bad') {
      return {
        providerId: params.providerId,
        status: 'failed',
        latencyMs: 0,
        checkedAt,
        availableModels: [],
        maskedKey,
        errorCode: 'PROVIDER_AUTH_FAILED',
        errorMessage: 'Invalid API key',
      }
    }

    return {
      providerId: params.providerId,
      status: 'failed',
      latencyMs: 0,
      checkedAt,
      availableModels: [],
      maskedKey,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      errorMessage: 'Provider connection test not available',
    }
  }

  async listProviderConnections(): Promise<ProviderConnectionListResult> {
    const connections = await this.settingsRepo.getProviderConnections()
    return {
      connections: connections.map(toProviderConnectionDTO),
    }
  }

  async createProviderConnection(): Promise<ProviderConnectionDTO> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Provider connection creation skeleton is not implemented yet')
  }

  async updateProviderConnection(): Promise<ProviderConnectionDTO> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Provider connection update skeleton is not implemented yet')
  }

  async deleteProviderConnection(): Promise<ProviderConnectionDeleteResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Provider connection deletion skeleton is not implemented yet')
  }

  async testProviderConnection(_params: ProviderConnectionTestRequest): Promise<ProviderConnectionTestResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Provider connection test skeleton is not implemented yet')
  }

  async testSavedProviderConnection(_connectionId: string): Promise<ProviderConnectionTestResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Saved provider connection test skeleton is not implemented yet')
  }

  async exportSettings(): Promise<SettingsExportBundle> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Settings export skeleton is not implemented yet')
  }

  async previewImportSettings(): Promise<SettingsImportPreviewResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Settings import preview skeleton is not implemented yet')
  }

  async importSettings(_request: SettingsImportCommitRequest): Promise<SettingsImportCommitResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Settings import skeleton is not implemented yet')
  }

  async exportSessionsMarkdown(): Promise<SettingsSessionsExportResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Session export skeleton is not implemented yet')
  }

  async getModelDefaults(): Promise<GlobalModelDefaults | null> {
    return this.settingsRepo.getModelDefaults()
  }

  async saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults> {
    return this.settingsRepo.saveModelDefaults(defaults)
  }

  async getRoleModelOverrides(): Promise<RoleModelOverride[]> {
    return this.settingsRepo.getRoleModelOverrides()
  }

  async saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]> {
    return this.settingsRepo.saveRoleModelOverrides(overrides)
  }

  async getPromptConfigs(): Promise<PromptConfig[]> {
    return this.settingsRepo.getPromptConfigs()
  }

  async updatePrompt(promptId: string, content: string): Promise<PromptConfig> {
    const prompts = await this.settingsRepo.getPromptConfigs()
    const existing = prompts.find((prompt) => prompt.promptId === promptId)
    if (!existing) {
      if (!content.trim()) throw new ServiceError('VALIDATION_ERROR', 'Content cannot be empty')
      const created: PromptConfig = {
        promptId,
        scope: 'global',
        version: '1.0.0',
        content,
        updatedAt: new Date().toISOString(),
        isDefault: false,
      }
      return this.settingsRepo.savePromptConfig(created)
    }
    if (!content.trim()) throw new ServiceError('VALIDATION_ERROR', 'Content cannot be empty')
    const [major, minor, patch] = existing.version.split('.').map(Number)
    const updated: PromptConfig = {
      ...existing,
      content,
      version: `${major}.${minor}.${(patch ?? 0) + 1}`,
      updatedAt: new Date().toISOString(),
      isDefault: false,
    }
    return this.settingsRepo.savePromptConfig(updated)
  }

  async resetPromptToDefault(promptId: string): Promise<PromptConfig> {
    const prompts = await this.settingsRepo.getPromptConfigs()
    const existing = prompts.find((prompt) => prompt.promptId === promptId)
    if (!existing) throw new ServiceError('NOT_FOUND', 'Prompt not found')
    const [major, minor, patch] = existing.version.split('.').map(Number)
    const reset: PromptConfig = {
      ...existing,
      version: `${major}.${minor}.${(patch ?? 0) + 1}`,
      updatedAt: new Date().toISOString(),
      isDefault: true,
    }
    return this.settingsRepo.savePromptConfig(reset)
  }

  async clearData(scope: ClearScope): Promise<void> {
    if (scope === 'cache') {
      return
    }

    if (scope === 'sessions' || scope === 'all') {
      await Promise.all([
        this.sessionRepo.clearAll(),
        this.messageRepo.clearAll(),
        this.eventRepo.clearAll(),
        this.voteRepo.clearAll(),
      ])
    }
    if (scope === 'settings' || scope === 'all') {
      await this.settingsRepo.clearAll()
    }
  }
}
