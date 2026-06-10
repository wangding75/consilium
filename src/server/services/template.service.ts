import type { DiscussionTemplate, TemplateSnapshot, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { ModelStrategyRepository } from '@/server/repositories/model-strategy.repository'
import type {
  CreateTemplateRequest,
  CreateTemplateRoleRequest,
  RoleConfigPatchRequest,
  RoleConfigPatchResult,
  TemplateDetailResult,
  TemplateListResult,
  TemplateListSettingsResult,
  UpdateTemplateRequest,
  UpdateTemplateRoleRequest,
  DeleteTemplateRoleResult,
} from '@/types/api'
import { sharedModelStrategyRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export class TemplateService {
  constructor(
    private readonly repo: TemplateRepository,
    private readonly modelStrategyRepo: ModelStrategyRepository = sharedModelStrategyRepo,
  ) {}

  private async listAllowedModels(template: DiscussionTemplate, roleId: string): Promise<Set<string>> {
    const models = new Set<string>()
    const targetRole = template.roles.find((role) => role.roleId === roleId)

    if (template.modelDefaults.defaultModel) {
      models.add(template.modelDefaults.defaultModel)
    }

    if (targetRole?.runtimeConfig?.model) {
      models.add(targetRole.runtimeConfig.model)
    }

    const strategies = await this.modelStrategyRepo.findAll()
    for (const strategy of strategies) {
      if (strategy.active) {
        models.add(strategy.defaultModel)
      }
    }

    return models
  }

  async listTemplates(): Promise<DiscussionTemplate[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('TEMPLATE_LIST_FAILED', 'Failed to list templates', err)
    }
  }

  async getTemplate(id: string): Promise<DiscussionTemplate | null> {
    try {
      return await this.repo.findById(id)
    } catch (err) {
      throw new ServiceError('TEMPLATE_GET_FAILED', 'Failed to get template', err)
    }
  }

  async listTemplateSummaries(): Promise<TemplateListResult> {
    try {
      const templates = await this.repo.findAll()
      return {
        templates: templates
          .filter((template) => template.visible)
          .map((template) => ({
            templateId: template.templateId,
            version: template.version,
            name: template.name,
            description: template.description,
            category: template.category,
            tags: [...template.tags],
            roleCount: template.roles.length,
            eventCount: template.events.length,
            usageCount: template.metrics.usageCount,
            sessionCount: template.metrics.sessionCount,
            favoriteCount: template.metrics.favoriteCount,
            isBuiltin: template.isBuiltin,
            availableForSessionCreation: template.availableForSessionCreation,
          })),
      }
    } catch (err) {
      throw new ServiceError('TEMPLATE_LIST_FAILED', 'Failed to list template summaries', err)
    }
  }

  async listTemplateSummariesForSettings(): Promise<TemplateListSettingsResult> {
    try {
      const templates = await this.repo.findAll()
      return {
        templates: templates
          .filter((template) => template.visible)
          .map((template) => ({
            templateId: template.templateId,
            version: template.version,
            name: template.name,
            description: template.description,
            category: template.category,
            tags: [...template.tags],
            roleCount: template.roles.length,
            eventCount: template.events.length,
            usageCount: template.metrics.usageCount,
            sessionCount: template.metrics.sessionCount,
            favoriteCount: template.metrics.favoriteCount,
            isBuiltin: template.isBuiltin,
            availableForSessionCreation: template.availableForSessionCreation,
            defaultStrategy: 'smart_fallback',
            configStatus: template.roles.some((role) => role.configStatus === 'customized') ? 'customized' : 'default',
          })),
      }
    } catch (err) {
      throw new ServiceError('TEMPLATE_LIST_FAILED', 'Failed to list settings template summaries', err)
    }
  }

  async getTemplateDetail(templateId: string): Promise<TemplateDetailResult> {
    try {
      const template = await this.repo.findDetailById(templateId)
      if (!template) {
        throw new ServiceError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
      }
      if (!template.visible) {
        throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template ${templateId} is not available`)
      }
      return { template }
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('TEMPLATE_GET_FAILED', 'Failed to get template detail', err)
    }
  }

  async listTemplateRoles(templateId: string): Promise<TemplateRolesResult> {
    try {
      const template = await this.repo.findDetailById(templateId)
      if (!template) {
        throw new ServiceError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
      }
      if (!template.visible) {
        throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template ${templateId} is not available`)
      }
      return {
        templateId: template.templateId,
        templateVersion: template.version,
        roles: template.roles.map((role) => ({ ...role })),
      }
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('TEMPLATE_ROLES_FAILED', 'Failed to list template roles', err)
    }
  }

  async updateRoleConfig(
    templateId: string,
    roleId: string,
    patch: RoleConfigPatchRequest
  ): Promise<RoleConfigPatchResult> {
    const normalizedPatch: RoleConfigPatchRequest = {
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.temperature !== undefined ? { temperature: patch.temperature } : {}),
      ...(patch.maxCharsPerTurn !== undefined ? { maxCharsPerTurn: patch.maxCharsPerTurn } : {}),
    }

    if (Object.keys(normalizedPatch).length === 0) {
      throw new ServiceError('VALIDATION_ERROR', 'At least one config field must be provided')
    }

    if (normalizedPatch.model !== undefined && (typeof normalizedPatch.model !== 'string' || normalizedPatch.model.trim() === '')) {
      throw new ServiceError('VALIDATION_ERROR', 'model must be a non-empty string')
    }

    const template = await this.repo.findDetailById(templateId)
    if (!template) {
      throw new ServiceError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
    }
    if (!template.editable) {
      throw new ServiceError('TEMPLATE_NOT_EDITABLE', `Template ${templateId} is not editable`)
    }
    if (!template.availableForSessionCreation) {
      throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template ${templateId} is not available`)
    }
    if (!template.roles.some((role) => role.roleId === roleId)) {
      throw new ServiceError('ROLE_NOT_FOUND', `Role ${roleId} not found in template ${templateId}`)
    }

    if (normalizedPatch.model !== undefined) {
      const allowedModels = await this.listAllowedModels(template, roleId)
      if (!allowedModels.has(normalizedPatch.model)) {
        throw new ServiceError('VALIDATION_ERROR', `model must be one of: ${Array.from(allowedModels).sort().join(', ')}`)
      }
    }

    if (
      normalizedPatch.temperature !== undefined &&
      (typeof normalizedPatch.temperature !== 'number' || !Number.isFinite(normalizedPatch.temperature) || normalizedPatch.temperature < 0 || normalizedPatch.temperature > 2)
    ) {
      throw new ServiceError('VALIDATION_ERROR', `temperature must be between 0 and 2, got ${normalizedPatch.temperature}`)
    }

    if (
      normalizedPatch.maxCharsPerTurn !== undefined &&
      (typeof normalizedPatch.maxCharsPerTurn !== 'number' || !Number.isInteger(normalizedPatch.maxCharsPerTurn) || normalizedPatch.maxCharsPerTurn <= 0)
    ) {
      throw new ServiceError('VALIDATION_ERROR', `maxCharsPerTurn must be a positive integer, got ${normalizedPatch.maxCharsPerTurn}`)
    }

    try {
      const result = await this.repo.updateRoleConfig(templateId, roleId, normalizedPatch)
      if (!result) {
        throw new ServiceError('ROLE_CONFIG_UPDATE_FAILED', 'Failed to update role config')
      }
      return result
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('ROLE_CONFIG_UPDATE_FAILED', 'Failed to update role config', err)
    }
  }

  async createTemplate(_input: CreateTemplateRequest): Promise<TemplateDetailResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Template creation skeleton is not implemented yet')
  }

  async updateTemplateMeta(_templateId: string, _patch: UpdateTemplateRequest): Promise<TemplateDetailResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Template metadata update skeleton is not implemented yet')
  }

  async createRole(templateId: string, input: CreateTemplateRoleRequest): Promise<TemplateRolesResult> {
    if (typeof input !== 'object' || input === null) {
      throw new ServiceError('VALIDATION_ERROR', 'Role request must be an object')
    }

    if (typeof input.name !== 'string' || input.name.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'name is required')
    }
    if (typeof input.persona !== 'string' || input.persona.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'persona is required')
    }
    if (typeof input.systemPrompt !== 'string' || input.systemPrompt.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'systemPrompt is required')
    }
    if (typeof input.providerConnectionId !== 'string' || input.providerConnectionId.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'providerConnectionId is required')
    }
    if (typeof input.model !== 'string' || input.model.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'model is required')
    }

    try {
      const result = await this.repo.createRole(templateId, {
        ...input,
        name: input.name.trim(),
        persona: input.persona.trim(),
        systemPrompt: input.systemPrompt.trim(),
        providerConnectionId: input.providerConnectionId.trim(),
        model: input.model.trim(),
      })
      if (!result) {
        throw new ServiceError('ROLE_CREATE_FAILED', 'Failed to create role')
      }
      return result
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('ROLE_CREATE_FAILED', 'Failed to create role', err)
    }
  }

  async updateRole(_templateId: string, _roleId: string, _patch: UpdateTemplateRoleRequest): Promise<TemplateRolesResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Template role update skeleton is not implemented yet')
  }

  async deleteRole(templateId: string, roleId: string): Promise<DeleteTemplateRoleResult> {
    if (typeof roleId !== 'string' || roleId.trim() === '') {
      throw new ServiceError('VALIDATION_ERROR', 'roleId is required')
    }

    try {
      const result = await this.repo.deleteRole(templateId, roleId)
      if (!result) {
        throw new ServiceError('ROLE_DELETE_FAILED', 'Failed to delete role')
      }
      return result
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err
      }
      throw new ServiceError('ROLE_DELETE_FAILED', 'Failed to delete role', err)
    }
  }

  async copyRole(_templateId: string, _roleId: string): Promise<TemplateRolesResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'Template role copy skeleton is not implemented yet')
  }

  createTemplateSnapshot(template: DiscussionTemplate): TemplateSnapshot {
    throw new Error(`not implemented: snapshot creation for ${template.templateId}`)
  }
}
