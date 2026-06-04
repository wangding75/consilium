import type { DiscussionTemplate, TemplateSummary, TemplateRolesResult } from '@/types'
import type { TemplateRepository } from '../template.repository'
import type { RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'
import { ServiceError } from '@/server/errors'
import { threeKingdomsTemplate, startupBoardTemplate, productDebateTemplate } from '@/data/templates'

const DEFAULT_TEMPLATES: DiscussionTemplate[] = [
  threeKingdomsTemplate,
  startupBoardTemplate,
  productDebateTemplate,
]

const MAX_TEMPLATE_VERSIONS_PER_TEMPLATE = 20

function cloneTemplate(template: DiscussionTemplate): DiscussionTemplate {
  return structuredClone(template)
}

function cloneTemplates(templates: DiscussionTemplate[]): DiscussionTemplate[] {
  return templates.map((template) => cloneTemplate(template))
}

export class MockTemplateRepository implements TemplateRepository {
  private readonly templates: DiscussionTemplate[]
  private readonly mirroredStore?: DiscussionTemplate[]

  constructor(templates: DiscussionTemplate[] = DEFAULT_TEMPLATES) {
    this.templates = cloneTemplates(templates)
    this.mirroredStore = templates === DEFAULT_TEMPLATES ? undefined : templates
  }

  private findLatestTemplate(templateId: string): DiscussionTemplate | null {
    const matches = this.templates.filter((template) => template.templateId === templateId)
    if (matches.length === 0) {
      return null
    }

    return matches[matches.length - 1]
  }

  private listLatestTemplates(): DiscussionTemplate[] {
    const latestTemplates = new Map<string, DiscussionTemplate>()

    for (const template of this.templates) {
      latestTemplates.set(template.templateId, template)
    }

    return Array.from(latestTemplates.values())
  }

  async findAll(): Promise<DiscussionTemplate[]> {
    return cloneTemplates(this.listLatestTemplates())
  }

  async findById(id: string): Promise<DiscussionTemplate | null> {
    const template = this.findLatestTemplate(id)
    return template ? cloneTemplate(template) : null
  }

  async findSummaries(): Promise<TemplateSummary[]> {
    return this.listLatestTemplates().map((template) => ({
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
    }))
  }

  async findDetailById(templateId: string): Promise<DiscussionTemplate | null> {
    const template = this.findLatestTemplate(templateId)
    return template ? cloneTemplate(template) : null
  }

  async findRoles(templateId: string): Promise<TemplateRolesResult | null> {
    const template = this.findLatestTemplate(templateId)
    if (!template) return null
    return {
      templateId: template.templateId,
      templateVersion: template.version,
      roles: template.roles.map((role) => structuredClone(role)),
    }
  }

  private pruneTemplateHistory(store: DiscussionTemplate[], templateId: string): void {
    const matchingIndexes = store
      .map((template, index) => ({ template, index }))
      .filter(({ template }) => template.templateId === templateId)
      .map(({ index }) => index)

    const overflowCount = matchingIndexes.length - MAX_TEMPLATE_VERSIONS_PER_TEMPLATE
    if (overflowCount <= 0) {
      return
    }

    for (const index of matchingIndexes.slice(0, overflowCount).reverse()) {
      store.splice(index, 1)
    }
  }

  async updateRoleConfig(
    templateId: string,
    roleId: string,
    patch: RoleConfigPatchRequest
  ): Promise<RoleConfigPatchResult | null> {
    const template = this.findLatestTemplate(templateId)
    if (!template) {
      throw new ServiceError('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`)
    }

    if (!template.editable) {
      throw new ServiceError('TEMPLATE_NOT_EDITABLE', `Template ${templateId} is not editable`)
    }
    if (!template.availableForSessionCreation) {
      throw new ServiceError('TEMPLATE_UNAVAILABLE', `Template ${templateId} is not available`)
    }

    const roleIndex = template.roles.findIndex((role) => role.roleId === roleId)
    if (roleIndex === -1) {
      throw new ServiceError('ROLE_NOT_FOUND', `Role ${roleId} not found in template ${templateId}`)
    }

    if (Object.keys(patch).length === 0) {
      throw new ServiceError('VALIDATION_ERROR', 'Empty patch: at least one field must be provided')
    }

    if (patch.model !== undefined && (typeof patch.model !== 'string' || patch.model.trim() === '')) {
      throw new ServiceError('VALIDATION_ERROR', 'model must be a non-empty string')
    }

    if (
      patch.temperature !== undefined &&
      (typeof patch.temperature !== 'number' || !Number.isFinite(patch.temperature) || patch.temperature < 0 || patch.temperature > 2)
    ) {
      throw new ServiceError('VALIDATION_ERROR', `temperature must be between 0 and 2, got ${patch.temperature}`)
    }

    if (
      patch.maxCharsPerTurn !== undefined &&
      (typeof patch.maxCharsPerTurn !== 'number' || !Number.isInteger(patch.maxCharsPerTurn) || patch.maxCharsPerTurn <= 0)
    ) {
      throw new ServiceError('VALIDATION_ERROR', `maxCharsPerTurn must be a positive integer, got ${patch.maxCharsPerTurn}`)
    }

    const [major, minor, patchVersion] = template.version.split('.').map(Number)
    const nextVersion = `${major}.${minor}.${patchVersion + 1}`
    const updatedTemplate: DiscussionTemplate = {
      ...cloneTemplate(template),
      version: nextVersion,
      roles: template.roles.map((role, index) => {
        if (index !== roleIndex) {
          return structuredClone(role)
        }

        return {
          ...structuredClone(role),
          runtimeConfig: {
            ...(role.runtimeConfig ? structuredClone(role.runtimeConfig) : {}),
            ...(patch.model !== undefined ? { model: patch.model } : {}),
            ...(patch.temperature !== undefined ? { temperature: patch.temperature } : {}),
            ...(patch.maxCharsPerTurn !== undefined ? { maxCharsPerTurn: patch.maxCharsPerTurn } : {}),
          },
          configStatus: 'customized',
        }
      }),
    }

    this.templates.push(updatedTemplate)
    this.pruneTemplateHistory(this.templates, templateId)

    this.mirroredStore?.push(cloneTemplate(updatedTemplate))
    if (this.mirroredStore) {
      this.pruneTemplateHistory(this.mirroredStore, templateId)
    }

    return {
      templateId,
      templateVersion: nextVersion,
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
