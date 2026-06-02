import type { Template, DiscussionTemplate, TemplateSummary, TemplateSnapshot, TemplateRolesResult } from '@/types'
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
    throw new Error('not implemented')
  }

  async getTemplateDetail(templateId: string): Promise<TemplateDetailResult> {
    throw new Error('not implemented')
  }

  async listTemplateRoles(templateId: string): Promise<TemplateRolesResult> {
    throw new Error('not implemented')
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
