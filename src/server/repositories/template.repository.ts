import type { DiscussionTemplate, TemplateSummary, TemplateRolesResult } from '@/types'
import type { RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'

export interface TemplateRepository {
  findAll(): Promise<DiscussionTemplate[]>
  findById(id: string): Promise<DiscussionTemplate | null>
  findSummaries(): Promise<TemplateSummary[]>
  findDetailById(templateId: string): Promise<DiscussionTemplate | null>
  findRoles(templateId: string): Promise<TemplateRolesResult | null>
  updateRoleConfig(templateId: string, roleId: string, patch: RoleConfigPatchRequest): Promise<RoleConfigPatchResult | null>
}
