import { describe, it, expect } from 'vitest'
import {
  BUILTIN_TEMPLATES,
  startupBoardTemplate,
  productDebateTemplate,
  threeKingdomsTemplate,
} from '@/data/templates'
import { TemplateService } from '@/server/services/template.service'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { GET as listTemplates } from '@/app/api/templates/route'
import { GET as getTemplateDetail } from '@/app/api/templates/[templateId]/route'

describe('Task-02: 实现服务端模板版本数据源与模板查询能力', () => {
  it('has at least 3 built-in templates with expected ids', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.templateId)
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(3)
    expect(ids).toContain('startup-board')
    expect(ids).toContain('product-debate')
    expect(ids).toContain('three-kingdoms-advisors')
  })

  it('each built-in template has all required DiscussionTemplate fields', () => {
    const requiredFields = [
      'templateId',
      'version',
      'name',
      'description',
      'category',
      'tags',
      'overview',
      'roles',
      'events',
      'rhythm',
      'modelDefaults',
      'metrics',
      'visible',
      'availableForSessionCreation',
      'editable',
    ]
    for (const template of BUILTIN_TEMPLATES) {
      for (const field of requiredFields) {
        expect(template).toHaveProperty(field)
      }
    }
  })

  it('template versions follow semantic x.y.z format', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.version).toMatch(semverRegex)
    }
  })

  it('each template has at least one host role', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const hosts = template.roles.filter((r) => r.isHost)
      expect(hosts.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('templates are exported from the central index module', () => {
    expect(startupBoardTemplate).toBeDefined()
    expect(productDebateTemplate).toBeDefined()
    expect(threeKingdomsTemplate).toBeDefined()
    expect(Array.isArray(BUILTIN_TEMPLATES)).toBe(true)
  })

  it('TemplateService can list template summaries (TemplateListResult)', async () => {
    const service = new TemplateService(new MockTemplateRepository())
    const result = await service.listTemplateSummaries()
    expect(result).toHaveProperty('templates')
    expect(Array.isArray(result.templates)).toBe(true)
  })

  it('TemplateService can get template detail by id (TemplateDetailResult)', async () => {
    const service = new TemplateService(new MockTemplateRepository())
    const result = await service.getTemplateDetail('startup-board')
    expect(result).toHaveProperty('template')
    expect(result.template).toBeDefined()
  })

  it('TemplateService can list roles for a template (TemplateRolesResult)', async () => {
    const service = new TemplateService(new MockTemplateRepository())
    const result = await service.listTemplateRoles('startup-board')
    expect(result).toHaveProperty('templateId')
    expect(result).toHaveProperty('templateVersion')
    expect(result).toHaveProperty('roles')
    expect(Array.isArray(result.roles)).toBe(true)
  })

  it('TemplateRepository.findSummaries returns summaries with roleCount, eventCount, etc.', async () => {
    const repo = new MockTemplateRepository()
    const summaries = await repo.findSummaries()
    expect(summaries.length).toBeGreaterThan(0)
    const first = summaries[0]
    expect(first).toHaveProperty('roleCount')
    expect(first).toHaveProperty('eventCount')
    expect(first).toHaveProperty('usageCount')
    expect(first).toHaveProperty('sessionCount')
    expect(first).toHaveProperty('favoriteCount')
    expect(typeof first.roleCount).toBe('number')
    expect(typeof first.eventCount).toBe('number')
  })

  it('TemplateRepository.findById returns full template', async () => {
    const repo = new MockTemplateRepository()
    const template = await repo.findById('three-kingdoms-advisors')
    expect(template).not.toBeNull()
    expect(template).toHaveProperty('id', 'three-kingdoms-advisors')
    expect(Array.isArray(template!.roles)).toBe(true)
  })

  it('TemplateRepository.findRoles returns TemplateRolesResult with same version', async () => {
    const repo = new MockTemplateRepository()
    const rolesResult = await repo.findRoles('startup-board')
    expect(rolesResult).not.toBeNull()
    expect(rolesResult).toHaveProperty('templateId', 'startup-board')
    expect(rolesResult).toHaveProperty('templateVersion')
    expect(typeof rolesResult!.templateVersion).toBe('string')
    expect(Array.isArray(rolesResult!.roles)).toBe(true)
  })

  it('no version drift between findById and findRoles for the same template', async () => {
    const repo = new MockTemplateRepository()
    const template = await repo.findById('startup-board')
    const rolesResult = await repo.findRoles('startup-board')
    expect(template).not.toBeNull()
    expect(rolesResult).not.toBeNull()
    const templateVersion = (template as Record<string, unknown>).version
    expect(templateVersion).toBe(rolesResult!.templateVersion)
  })

  it('MockTemplateRepository uses shared instances (singleton)', () => {
    expect(sharedTemplateRepo).toBeInstanceOf(MockTemplateRepository)
    const anotherRef = sharedTemplateRepo
    expect(anotherRef).toBe(sharedTemplateRepo)
  })

  it('GET /api/templates returns TemplateListResult envelope', async () => {
    const response = await listTemplates()
    const body = await response.json()
    expect(body).toHaveProperty('success')
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('templates')
    expect(Array.isArray(body.data.templates)).toBe(true)
  })

  it('GET /api/templates/:id returns TemplateDetailResult envelope', async () => {
    const response = await getTemplateDetail(
      new Request('http://localhost/api/templates/startup-board'),
      { params: { templateId: 'startup-board' } }
    )
    const body = await response.json()
    expect(body).toHaveProperty('success')
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('template')
  })
})
