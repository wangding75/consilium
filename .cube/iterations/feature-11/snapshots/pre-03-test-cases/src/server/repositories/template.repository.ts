import type { DiscussionTemplate, TemplateSummary, TemplateRolesResult } from '@/types'
import type {
  CreateTemplateRequest,
  CreateTemplateRoleRequest,
  DeleteTemplateRoleResult,
  RoleConfigPatchRequest,
  RoleConfigPatchResult,
  UpdateTemplateRequest,
  UpdateTemplateRoleRequest,
} from '@/types/api'

export interface TemplateRepository {
  findAll(): Promise<DiscussionTemplate[]>
  findById(id: string): Promise<DiscussionTemplate | null>
  findSummaries(): Promise<TemplateSummary[]>
  findDetailById(templateId: string): Promise<DiscussionTemplate | null>
  findRoles(templateId: string): Promise<TemplateRolesResult | null>
  updateRoleConfig(templateId: string, roleId: string, patch: RoleConfigPatchRequest): Promise<RoleConfigPatchResult | null>
  createTemplate(input: CreateTemplateRequest): Promise<DiscussionTemplate>
  updateTemplate(templateId: string, patch: UpdateTemplateRequest): Promise<DiscussionTemplate | null>
  createRole(templateId: string, input: CreateTemplateRoleRequest): Promise<TemplateRolesResult | null>
  updateRole(templateId: string, roleId: string, patch: UpdateTemplateRoleRequest): Promise<TemplateRolesResult | null>
  deleteRole(templateId: string, roleId: string): Promise<DeleteTemplateRoleResult | null>
  copyRole(templateId: string, roleId: string): Promise<TemplateRolesResult | null>
}
