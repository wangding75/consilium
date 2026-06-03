import type { Template, DiscussionTemplate, TemplateSnapshot, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { RoleConfigPatchRequest, RoleConfigPatchResult, TemplateListResult, TemplateDetailResult } from '@/types/api'
import { ServiceError } from '@/server/errors'

export class TemplateService {
  constructor(private readonly repo: TemplateRepository) {}

  async listTemplates(): Promise<Template[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('TEMPLATE_LIST_FAILED', 'Failed to list templates', err)
    }
  }

  async getTemplate(id: string): Promise<Template | null> {
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
    throw new Error('not implemented')
  }

  createTemplateSnapshot(template: DiscussionTemplate): TemplateSnapshot {
    throw new Error('not implemented')
  }
}
