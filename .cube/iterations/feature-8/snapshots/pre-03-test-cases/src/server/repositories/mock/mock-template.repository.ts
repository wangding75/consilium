import type { Template, DiscussionTemplate, TemplateSummary, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '../template.repository'
import type { RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

export class MockTemplateRepository implements TemplateRepository {
  private readonly templates: Template[] = [threeKingdomsTemplate]

  async findAll(): Promise<Template[]> {
    return this.templates
  }

  async findById(id: string): Promise<Template | null> {
    return this.templates.find((t) => t.id === id) ?? null
  }

  async findSummaries(): Promise<TemplateSummary[]> {
    throw new Error('not implemented')
  }

  async findDetailById(templateId: string): Promise<DiscussionTemplate | null> {
    throw new Error('not implemented')
  }

  async findRoles(templateId: string): Promise<TemplateRolesResult | null> {
    throw new Error('not implemented')
  }

  async updateRoleConfig(
    templateId: string,
    roleId: string,
    patch: RoleConfigPatchRequest
  ): Promise<RoleConfigPatchResult | null> {
    throw new Error('not implemented')
  }
}
