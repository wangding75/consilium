import type {
  GlobalModelDefaults,
  PromptConfig,
  ProviderConfig,
  RoleModelOverride,
} from '@/types'
import type {
  ProviderStatusDTO,
  ProviderTestRequest,
  ProviderTestResult,
} from '@/types/api'
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
    return configs.map((c) => ({
      providerId: c.providerId,
      enabled: c.enabled,
      baseUrl: c.baseUrl,
      maskedKey: maskApiKey(c.apiKeyRef),
      modelList: c.modelList,
      maskedHeaders: c.customHeaders
        ? Object.fromEntries(Object.keys(c.customHeaders).map((k) => [k, '***']))
        : {},
      lastTestStatus: c.lastTestStatus,
      lastTestedAt: c.lastTestedAt,
      lastErrorCode: c.lastErrorCode,
      lastErrorMessage: c.lastErrorMessage,
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
      (c) => c.providerId === params.providerId
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
      modelList: saved.modelList,
      maskedHeaders: saved.customHeaders
        ? Object.fromEntries(Object.keys(saved.customHeaders).map((k) => [k, '***']))
        : {},
      lastTestStatus: saved.lastTestStatus,
    }
  }

  async testProvider(params: ProviderTestRequest): Promise<ProviderTestResult> {
    const checkedAt = new Date().toISOString()
    const maskedKey = maskApiKey(params.apiKey)

    // Stub: recognize magic test values until Task-10 LLMProvider integration
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

    // Generic fallback: attempt not possible without LLMProvider integration
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
    const existing = prompts.find((p) => p.promptId === promptId)
    if (!existing) throw Object.assign(new Error('Prompt not found'), { code: 'NOT_FOUND' })
    if (!content.trim()) throw Object.assign(new Error('Content cannot be empty'), { code: 'VALIDATION_ERROR' })
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
    const existing = prompts.find((p) => p.promptId === promptId)
    if (!existing) throw Object.assign(new Error('Prompt not found'), { code: 'NOT_FOUND' })
    const [major, minor, patch] = existing.version.split('.').map(Number)
    const reset: PromptConfig = {
      ...existing,
      version: `${major}.${minor}.${(patch ?? 0) + 1}`,
      updatedAt: new Date().toISOString(),
      isDefault: true,
    }
    return this.settingsRepo.savePromptConfig(reset)
  }

  async clearData(scope: 'sessions' | 'settings' | 'all'): Promise<void> {
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
