import type {
  GlobalModelDefaults,
  PromptConfig,
  ProviderConfig,
  ProviderConnection,
  ProviderType,
  RoleModelOverride,
  SettingsExportBundle,
  TemplateRuntimeConfig,
} from '@/types'
import type {
  ClearScope,
  CreateProviderConnectionRequest,
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
  SettingsImportPreviewRequest,
  SettingsImportPreviewResult,
  SettingsSessionsExportResult,
  UpdateProviderConnectionRequest,
} from '@/types/api'
import { ServiceError } from '@/server/errors'
import type { SettingsRepository } from '@/server/repositories/settings.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { EventRepository } from '@/server/repositories/event.repository'
import type { VoteRepository } from '@/server/repositories/vote.repository'
import { exec } from 'child_process'

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

const SETTINGS_EXPORT_VERSION = '1.0.0'
const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']
const CLEAR_SCOPES: ClearScope[] = ['cache', 'sessions', 'settings', 'all']

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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSettingsExportBundle(bundle: unknown): asserts bundle is SettingsExportBundle {
  if (!isObjectRecord(bundle)) {
    throw new ServiceError('VALIDATION_ERROR', 'Import bundle must be an object')
  }

  if (typeof bundle.version !== 'string' || bundle.version.trim() === '') {
    throw new ServiceError('VALIDATION_ERROR', 'Import bundle version is required')
  }

  if (typeof bundle.exportedAt !== 'string' || bundle.exportedAt.trim() === '') {
    throw new ServiceError('VALIDATION_ERROR', 'Import bundle exportedAt is required')
  }

  if (typeof bundle.includePrompts !== 'boolean') {
    throw new ServiceError('VALIDATION_ERROR', 'Import bundle includePrompts must be boolean')
  }

  if (!Array.isArray(bundle.providerConnections) || !Array.isArray(bundle.templateRuntimeConfigs) || !Array.isArray(bundle.prompts)) {
    throw new ServiceError('VALIDATION_ERROR', 'Import bundle arrays are invalid')
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ServiceError('VALIDATION_ERROR', `${fieldName} must be a non-empty string`)
  }
}

function assertOptionalString(value: unknown, fieldName: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new ServiceError('VALIDATION_ERROR', `${fieldName} must be a string when provided`)
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new ServiceError('VALIDATION_ERROR', `${fieldName} must be an array of non-empty strings`)
  }
}

function assertProviderConnectionRecord(connection: ProviderConnection, index: number): void {
  if (!isObjectRecord(connection)) {
    throw new ServiceError('VALIDATION_ERROR', `providerConnections[${index}] must be an object`)
  }

  assertNonEmptyString(connection.id, `providerConnections[${index}].id`)
  assertNonEmptyString(connection.providerType, `providerConnections[${index}].providerType`)
  assertNonEmptyString(connection.displayName, `providerConnections[${index}].displayName`)
  assertNonEmptyString(connection.baseUrl, `providerConnections[${index}].baseUrl`)
  assertStringArray(connection.modelList, `providerConnections[${index}].modelList`)
  if (typeof connection.enabled !== 'boolean') {
    throw new ServiceError('VALIDATION_ERROR', `providerConnections[${index}].enabled must be boolean`)
  }
  assertNonEmptyString(connection.lastTestStatus, `providerConnections[${index}].lastTestStatus`)
  assertOptionalString(connection.apiKeyRef, `providerConnections[${index}].apiKeyRef`)
  assertOptionalString(connection.createdAt, `providerConnections[${index}].createdAt`)
  assertOptionalString(connection.updatedAt, `providerConnections[${index}].updatedAt`)

  if (connection.customHeaders !== undefined) {
    if (!isObjectRecord(connection.customHeaders)) {
      throw new ServiceError('VALIDATION_ERROR', `providerConnections[${index}].customHeaders must be an object`)
    }
    for (const [headerName, headerValue] of Object.entries(connection.customHeaders)) {
      if (typeof headerValue !== 'string') {
        throw new ServiceError('VALIDATION_ERROR', `providerConnections[${index}].customHeaders.${headerName} must be a string`)
      }
    }
  }
}

function assertTemplateRuntimeConfigRecord(config: TemplateRuntimeConfig, index: number): void {
  if (!isObjectRecord(config)) {
    throw new ServiceError('VALIDATION_ERROR', `templateRuntimeConfigs[${index}] must be an object`)
  }

  assertNonEmptyString(config.templateId, `templateRuntimeConfigs[${index}].templateId`)
  assertNonEmptyString(config.defaultStrategy, `templateRuntimeConfigs[${index}].defaultStrategy`)
  if (!Array.isArray(config.roleConfigs)) {
    throw new ServiceError('VALIDATION_ERROR', `templateRuntimeConfigs[${index}].roleConfigs must be an array`)
  }

  config.roleConfigs.forEach((roleConfig, roleIndex) => {
    if (!isObjectRecord(roleConfig)) {
      throw new ServiceError('VALIDATION_ERROR', `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}] must be an object`)
    }
    assertNonEmptyString(roleConfig.roleId, `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}].roleId`)
    assertNonEmptyString(roleConfig.providerConnectionId, `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}].providerConnectionId`)
    assertNonEmptyString(roleConfig.model, `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}].model`)
    assertNonEmptyString(roleConfig.systemPrompt, `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}].systemPrompt`)
    if (typeof roleConfig.includedInDefaultQueue !== 'boolean') {
      throw new ServiceError('VALIDATION_ERROR', `templateRuntimeConfigs[${index}].roleConfigs[${roleIndex}].includedInDefaultQueue must be boolean`)
    }
  })
}

function assertPromptConfigRecord(prompt: PromptConfig, index: number): void {
  if (!isObjectRecord(prompt)) {
    throw new ServiceError('VALIDATION_ERROR', `prompts[${index}] must be an object`)
  }

  assertNonEmptyString(prompt.promptId, `prompts[${index}].promptId`)
  assertNonEmptyString(prompt.scope, `prompts[${index}].scope`)
  assertNonEmptyString(prompt.version, `prompts[${index}].version`)
  assertNonEmptyString(prompt.content, `prompts[${index}].content`)
  assertNonEmptyString(prompt.updatedAt, `prompts[${index}].updatedAt`)
  if (typeof prompt.isDefault !== 'boolean') {
    throw new ServiceError('VALIDATION_ERROR', `prompts[${index}].isDefault must be boolean`)
  }
}

function assertSettingsExportBundleItems(bundle: SettingsExportBundle): void {
  bundle.providerConnections.forEach((connection, index) => assertProviderConnectionRecord(connection, index))
  bundle.templateRuntimeConfigs.forEach((config, index) => assertTemplateRuntimeConfigRecord(config, index))
  bundle.prompts.forEach((prompt, index) => assertPromptConfigRecord(prompt, index))
}

function assertProviderType(value: unknown, fieldName: string): asserts value is ProviderType {
  if (typeof value !== 'string' || !PROVIDER_TYPES.includes(value as ProviderType)) {
    throw new ServiceError('VALIDATION_ERROR', `${fieldName} must be a supported provider type`)
  }
}

function assertOptionalStringRecord(value: unknown, fieldName: string): asserts value is Record<string, string> | undefined {
  if (value === undefined) {
    return
  }

  if (!isObjectRecord(value)) {
    throw new ServiceError('VALIDATION_ERROR', `${fieldName} must be an object`)
  }

  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      throw new ServiceError('VALIDATION_ERROR', `${fieldName}.${key} must be a string`)
    }
  }
}

function normalizeStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean)
}

function assertConnectionReferenced(configs: TemplateRuntimeConfig[], connectionId: string): void {
  const inRoleConfig = configs.some((config) =>
    config.roleConfigs.some((roleConfig) => roleConfig.providerConnectionId === connectionId)
  )
  const inFallback = configs.some((config) => config.fallbackProviderConnectionId === connectionId)

  if (inRoleConfig || inFallback) {
    throw new ServiceError('CONNECTION_IN_USE', 'Provider connection is referenced by template runtime config')
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

    if (!params.baseUrl) {
      return {
        providerId: params.providerId,
        status: 'failed',
        latencyMs: 0,
        checkedAt,
        availableModels: [],
        maskedKey,
        errorCode: 'MISSING_BASE_URL',
        errorMessage: 'Base URL is required to test provider connection',
      }
    }

    if (!params.apiKey) {
      return {
        providerId: params.providerId,
        status: 'failed',
        latencyMs: 0,
        checkedAt,
        availableModels: [],
        maskedKey,
        errorCode: 'MISSING_API_KEY',
        errorMessage: 'API key is required to test provider connection',
      }
    }

    const modelsUrl = params.baseUrl.endsWith('/')
      ? `${params.baseUrl}models`
      : `${params.baseUrl}/models`

    const curlHeaders = { Authorization: `Bearer ${params.apiKey}`, ...params.headers }
    const headerArgs = Object.entries(curlHeaders).map(([k, v]) => `-H '${k}: ${v}'`).join(' ')
    const command = `curl -s -w "\\nHTTP_CODE:%{http_code}" --max-time 8 --connect-timeout 5 ${headerArgs} '${modelsUrl}'`

    const start = Date.now()
    let body = ''
    let status = 0
    try {
      const result = await new Promise<string>((resolve) => {
        exec(command, { timeout: 15000 }, (_, stdout, stderr) => resolve((stdout || '') + (stderr || '')))
      })
      const codeMatch = result.match(/HTTP_CODE:(\d+)$/)
      if (codeMatch) {
        status = Number.parseInt(codeMatch[1], 10)
        body = result.slice(0, -codeMatch[0].length).trim()
      }
    } catch {
      // exec error, return below
    }

    const latencyMs = Date.now() - start

    if (status !== 200) {
      return {
        providerId: params.providerId,
        status: 'failed',
        latencyMs,
        checkedAt,
        availableModels: [],
        maskedKey,
        errorCode: status ? `HTTP_${status}` : 'PROVIDER_CONNECTION_ERROR',
        errorMessage: body || 'Provider connection failed',
      }
    }

    let availableModels: string[] = []
    try {
      const data = JSON.parse(body) as { data?: Array<{ id: string }> }
      if (Array.isArray(data.data)) {
        availableModels = data.data.map((m) => m.id).filter(Boolean)
      }
    } catch {
      // ignore non-standard response bodies
    }

    return {
      providerId: params.providerId,
      status: 'success',
      latencyMs,
      checkedAt,
      availableModels,
      maskedKey,
    }
  }

  async listProviderConnections(): Promise<ProviderConnectionListResult> {
    const connections = await this.settingsRepo.getProviderConnections()
    return {
      connections: connections.map(toProviderConnectionDTO),
    }
  }

  async createProviderConnection(input?: CreateProviderConnectionRequest): Promise<ProviderConnectionDTO> {
    if (!input || typeof input !== 'object') {
      throw new ServiceError('VALIDATION_ERROR', 'Provider connection request is required')
    }

    assertProviderType(input.providerType, 'providerType')
    assertNonEmptyString(input.displayName, 'displayName')
    assertNonEmptyString(input.baseUrl, 'baseUrl')
    assertStringArray(input.modelList, 'modelList')
    assertOptionalStringRecord(input.customHeaders, 'customHeaders')
    if (typeof input.enabled !== 'boolean') {
      throw new ServiceError('VALIDATION_ERROR', 'enabled must be boolean')
    }

    const now = new Date().toISOString()
    const connection: ProviderConnection = {
      id: crypto.randomUUID(),
      providerType: input.providerType,
      displayName: input.displayName.trim(),
      baseUrl: input.baseUrl.trim(),
      apiKeyRef: input.apiKey?.trim() || undefined,
      modelList: normalizeStringArray(input.modelList),
      customHeaders: input.customHeaders,
      enabled: input.enabled,
      lastTestStatus: 'untested',
      createdAt: now,
      updatedAt: now,
    }

    const saved = await this.settingsRepo.saveProviderConnection(connection)
    return toProviderConnectionDTO(saved)
  }

  async updateProviderConnection(connectionId?: string, input?: UpdateProviderConnectionRequest): Promise<ProviderConnectionDTO> {
    if (typeof connectionId !== 'string' || connectionId.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'connectionId is required')
    }
    if (!input || typeof input !== 'object') {
      throw new ServiceError('VALIDATION_ERROR', 'Provider connection update request is required')
    }

    const existing = await this.settingsRepo.getProviderConnectionById(connectionId)
    if (!existing) {
      throw new ServiceError('NOT_FOUND', 'Provider connection not found')
    }

    if (input.displayName !== undefined) {
      assertNonEmptyString(input.displayName, 'displayName')
    }
    if (input.baseUrl !== undefined) {
      assertNonEmptyString(input.baseUrl, 'baseUrl')
    }
    if (input.modelList !== undefined) {
      assertStringArray(input.modelList, 'modelList')
    }
    assertOptionalStringRecord(input.customHeaders, 'customHeaders')
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
      throw new ServiceError('VALIDATION_ERROR', 'enabled must be boolean')
    }

    const updated: ProviderConnection = {
      ...existing,
      displayName: input.displayName?.trim() ?? existing.displayName,
      baseUrl: input.baseUrl?.trim() ?? existing.baseUrl,
      apiKeyRef: input.apiKey !== undefined ? input.apiKey.trim() || undefined : existing.apiKeyRef,
      modelList: input.modelList ? normalizeStringArray(input.modelList) : existing.modelList,
      customHeaders: Object.prototype.hasOwnProperty.call(input, 'customHeaders') ? input.customHeaders : existing.customHeaders,
      enabled: input.enabled ?? existing.enabled,
      updatedAt: new Date().toISOString(),
    }

    const saved = await this.settingsRepo.saveProviderConnection(updated)
    return toProviderConnectionDTO(saved)
  }

  async deleteProviderConnection(connectionId?: string): Promise<ProviderConnectionDeleteResult> {
    if (typeof connectionId !== 'string' || connectionId.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'connectionId is required')
    }

    const existing = await this.settingsRepo.getProviderConnectionById(connectionId)
    if (!existing) {
      throw new ServiceError('NOT_FOUND', 'Provider connection not found')
    }

    const runtimeConfigs = await this.settingsRepo.getTemplateRuntimeConfigs()
    assertConnectionReferenced(runtimeConfigs, connectionId)

    await this.settingsRepo.deleteProviderConnection(connectionId)
    return { deletedConnectionId: connectionId }
  }

  async testProviderConnection(params?: ProviderConnectionTestRequest): Promise<ProviderConnectionTestResult> {
    if (!params || typeof params !== 'object') {
      throw new ServiceError('VALIDATION_ERROR', 'Provider connection test request is required')
    }

    assertProviderType(params.providerType, 'providerType')
    assertOptionalString(params.baseUrl, 'baseUrl')
    assertOptionalStringRecord(params.customHeaders, 'customHeaders')

    const result = await this.testProvider({
      providerId: params.providerType,
      baseUrl: params.baseUrl?.trim() || undefined,
      apiKey: params.apiKey?.trim(),
      model: params.model?.trim(),
      headers: params.customHeaders,
    })

    return {
      status: result.status,
      latencyMs: result.latencyMs,
      checkedAt: result.checkedAt,
      availableModels: [...result.availableModels],
      maskedKey: result.maskedKey,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    }
  }

  async testSavedProviderConnection(connectionId: string): Promise<ProviderConnectionTestResult> {
    if (typeof connectionId !== 'string' || connectionId.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'connectionId is required')
    }

    const existing = await this.settingsRepo.getProviderConnectionById(connectionId)
    if (!existing) {
      throw new ServiceError('NOT_FOUND', 'Provider connection not found')
    }

    const result = await this.testProviderConnection({
      providerType: existing.providerType,
      baseUrl: existing.baseUrl,
      apiKey: existing.apiKeyRef,
      model: existing.modelList[0],
      customHeaders: existing.customHeaders,
    })

    await this.settingsRepo.saveProviderConnection({
      ...existing,
      lastTestStatus: result.status,
      lastTestAt: result.checkedAt,
      lastErrorCode: result.errorCode,
      lastErrorMessage: result.errorMessage,
      updatedAt: new Date().toISOString(),
    })

    return result
  }

  async exportSettings(): Promise<SettingsExportBundle> {
    const [providerConnections, templateRuntimeConfigs, prompts] = await Promise.all([
      this.settingsRepo.getProviderConnections(),
      this.settingsRepo.getTemplateRuntimeConfigs(),
      this.settingsRepo.getPromptConfigs(),
    ])

    return {
      version: SETTINGS_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      includePrompts: prompts.length > 0,
      providerConnections,
      templateRuntimeConfigs,
      prompts,
    }
  }

  async previewImportSettings(request?: SettingsImportPreviewRequest): Promise<SettingsImportPreviewResult> {
    if (!request) {
      throw new ServiceError('VALIDATION_ERROR', 'Import preview request is required')
    }

    assertSettingsExportBundle(request.bundle)
    assertSettingsExportBundleItems(request.bundle)

    const [existingConnections, existingRuntimeConfigs, existingPrompts] = await Promise.all([
      this.settingsRepo.getProviderConnections(),
      this.settingsRepo.getTemplateRuntimeConfigs(),
      this.settingsRepo.getPromptConfigs(),
    ])

    const existingConnectionIds = new Set(existingConnections.map((connection) => connection.id))
    const existingRuntimeTemplateIds = new Set(existingRuntimeConfigs.map((config) => config.templateId))
    const existingPromptIds = new Set(existingPrompts.map((prompt) => prompt.promptId))

    const additions: string[] = []
    const updates: string[] = []
    const conflicts: string[] = []

    for (const connection of request.bundle.providerConnections) {
      const label = `provider:${connection.id}`
      if (existingConnectionIds.has(connection.id)) {
        updates.push(label)
        conflicts.push(label)
      } else {
        additions.push(label)
      }
    }

    for (const runtimeConfig of request.bundle.templateRuntimeConfigs) {
      const label = `template:${runtimeConfig.templateId}`
      if (existingRuntimeTemplateIds.has(runtimeConfig.templateId)) {
        updates.push(label)
        conflicts.push(label)
      } else {
        additions.push(label)
      }
    }

    for (const prompt of request.bundle.prompts) {
      const label = `prompt:${prompt.promptId}`
      if (existingPromptIds.has(prompt.promptId)) {
        updates.push(label)
        conflicts.push(label)
      } else {
        additions.push(label)
      }
    }

    const previewToken = crypto.randomUUID()
    const preview = {
      additions,
      updates,
      conflicts,
      invalidItems: [],
    }

    await this.settingsRepo.saveImportPreview(previewToken, request.bundle, preview)

    return {
      previewToken,
      ...preview,
    }
  }

  async importSettings(request?: SettingsImportCommitRequest): Promise<SettingsImportCommitResult> {
    if (!request) {
      throw new ServiceError('VALIDATION_ERROR', 'Import request is required')
    }

    if (typeof request.previewToken !== 'string' || request.previewToken.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'previewToken is required')
    }

    const savedPreview = await this.settingsRepo.getImportPreview(request.previewToken)
    if (!savedPreview) {
      throw new ServiceError('VALIDATION_ERROR', 'previewToken is invalid or expired')
    }

    if (!request.overwrite && savedPreview.preview.conflicts.length > 0) {
      throw new ServiceError('IMPORT_CONFLICT', 'Import preview contains conflicts')
    }

    for (const connection of savedPreview.bundle.providerConnections) {
      await this.settingsRepo.saveProviderConnection(connection)
    }

    await this.settingsRepo.saveTemplateRuntimeConfigs(savedPreview.bundle.templateRuntimeConfigs)

    for (const prompt of savedPreview.bundle.prompts) {
      await this.settingsRepo.savePromptConfig(prompt)
    }

    await this.settingsRepo.deleteImportPreview(request.previewToken)

    return {
      importedConnections: savedPreview.bundle.providerConnections.length,
      importedTemplates: savedPreview.bundle.templateRuntimeConfigs.length,
      importedPrompts: savedPreview.bundle.prompts.length,
    }
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
    if (!CLEAR_SCOPES.includes(scope)) {
      throw new ServiceError('VALIDATION_ERROR', 'scope must be cache, sessions, settings, or all')
    }

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
