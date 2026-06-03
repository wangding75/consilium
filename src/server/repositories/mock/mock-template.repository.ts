import type { DiscussionTemplate, TemplateSummary, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '../template.repository'
import type { RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'
import { ServiceError } from '@/server/errors'
import { threeKingdomsTemplate, startupBoardTemplate, productDebateTemplate } from '@/data/templates'

export class MockTemplateRepository implements TemplateRepository {
  private readonly templates: DiscussionTemplate[] = [
    { ...threeKingdomsTemplate },
    { ...startupBoardTemplate },
    { ...productDebateTemplate },
  ]

  async findAll(): Promise<DiscussionTemplate[]> {
    return [...this.templates]
  }

  async findById(id: string): Promise<DiscussionTemplate | null> {
    return this.templates.find((t) => t.templateId === id) ?? null
  }

  async findSummaries(): Promise<TemplateSummary[]> {
    return this.templates.map((t) => ({
      templateId: t.templateId,
      version: t.version,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: [...t.tags],
      roleCount: t.roles.length,
      eventCount: t.events.length,
      usageCount: t.metrics.usageCount,
      sessionCount: t.metrics.sessionCount,
      favoriteCount: t.metrics.favoriteCount,
      isBuiltin: t.isBuiltin,
      availableForSessionCreation: t.availableForSessionCreation,
    }))
  }

  async findDetailById(templateId: string): Promise<DiscussionTemplate | null> {
    const template = this.templates.find((t) => t.templateId === templateId)
    if (!template) return null
    return { ...template }
  }

  async findRoles(templateId: string): Promise<TemplateRolesResult | null> {
    const template = this.templates.find((t) => t.templateId === templateId)
    if (!template) return null
    return {
      templateId: template.templateId,
      templateVersion: template.version,
      roles: template.roles.map((r) => ({ ...r })),
    }
  }

  async updateRoleConfig(
    templateId: string,
    roleId: string,
    patch: RoleConfigPatchRequest
  ): Promise<RoleConfigPatchResult | null> {
    const templateIndex = this.templates.findIndex((t) => t.templateId === templateId)
    if (templateIndex === -1) {
      throw new ServiceError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
    }

    const template = this.templates[templateIndex]
    if (!template.editable) {
      throw new ServiceError('TEMPLATE_NOT_EDITABLE', `Template ${templateId} is not editable`)
    }
    if (!template.availableForSessionCreation) {
      throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template ${templateId} is not available`)
    }

    const roleIndex = template.roles.findIndex((r) => r.roleId === roleId)
    if (roleIndex === -1) {
      throw new ServiceError('ROLE_NOT_FOUND', `Role ${roleId} not found in template ${templateId}`)
    }

    const patchFields = Object.keys(patch).filter((k) => k !== 'maxCharsPerTurn')
    if (patchFields.length === 0) {
      throw new ServiceError('VALIDATION_ERROR', 'Empty patch: at least one field must be provided')
    }

    if (patch.temperature !== undefined && (patch.temperature < 0 || patch.temperature > 2)) {
      throw new ServiceError('VALIDATION_ERROR', `temperature must be between 0 and 2, got ${patch.temperature}`)
    }

    if (patch.maxCharsPerTurn !== undefined && patch.maxCharsPerTurn <= 0) {
      throw new ServiceError('VALIDATION_ERROR', `maxCharsPerTurn must be positive, got ${patch.maxCharsPerTurn}`)
    }

    const [major, minor, patchVer] = template.version.split('.').map(Number)
    const newVersion = `${major}.${minor}.${patchVer + 1}`

    const newTemplate: DiscussionTemplate = {
      ...template,
      version: newVersion,
      roles: template.roles.map((r, i) =>
        i === roleIndex ? { ...r, runtimeConfig: { ...r.runtimeConfig, ...patch } as any, configStatus: 'customized' as const } : { ...r }
      ),
    }

    this.templates[templateIndex] = newTemplate

    const updatedRole = newTemplate.roles[roleIndex]

    return {
      templateId,
      templateVersion: newVersion,
      roleId,
      config: {
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.temperature !== undefined ? { temperature: patch.temperature } : {}),
        ...(patch.maxCharsPerTurn !== undefined ? { maxCharsPerTurn: patch.maxCharsPerTurn } : {}),
      },
      effectScope: 'future_sessions_only',
    }
  }
}
