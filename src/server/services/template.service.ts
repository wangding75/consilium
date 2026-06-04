import type { DiscussionTemplate, TemplateSnapshot, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { ModelStrategyRepository } from '@/server/repositories/model-strategy.repository'
import type { RoleConfigPatchRequest, RoleConfigPatchResult, TemplateListResult, TemplateDetailResult } from '@/types/api'
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

  createTemplateSnapshot(template: DiscussionTemplate): TemplateSnapshot {
    throw new Error('not implemented')
  }
}
