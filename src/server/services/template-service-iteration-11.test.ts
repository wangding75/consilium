import { describe, it, expect } from 'vitest'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import { TemplateService } from '@/server/services/template.service'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import type { CreateTemplateRequest, CreateTemplateRoleRequest, UpdateTemplateRequest, UpdateTemplateRoleRequest } from '@/types/api'
import { ServiceError } from '@/server/errors'

// ─── TemplateRepository contract shape check ───────────────────────────────────

describe('TemplateRepository interface (contract check)', () => {
  it('declares createTemplate', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.createTemplate).toBe('function')
  })

  it('declares updateTemplate', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.updateTemplate).toBe('function')
  })

  it('declares createRole', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.createRole).toBe('function')
  })

  it('declares updateRole', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.updateRole).toBe('function')
  })

  it('declares deleteRole', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.deleteRole).toBe('function')
  })

  it('declares copyRole', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.copyRole).toBe('function')
  })

  it('retains legacy read methods', () => {
    const repo: TemplateRepository = new MockTemplateRepository()
    expect(typeof repo.findAll).toBe('function')
    expect(typeof repo.findById).toBe('function')
    expect(typeof repo.findSummaries).toBe('function')
    expect(typeof repo.findDetailById).toBe('function')
    expect(typeof repo.findRoles).toBe('function')
    expect(typeof repo.updateRoleConfig).toBe('function')
  })
})

// ─── TemplateService.createTemplate (NOT_IMPLEMENTED skeleton) ─────────────────

describe('TemplateService.createTemplate (skeleton)', () => {
  it('throws NOT_IMPLEMENTED for create skeleton', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: CreateTemplateRequest = {
      name: 'New Template',
      description: 'A test template',
      defaultStrategy: 'smart_fallback',
    }
    await expect(svc.createTemplate(req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── TemplateService.updateTemplateMeta (NOT_IMPLEMENTED skeleton) ─────────────

describe('TemplateService.updateTemplateMeta (skeleton)', () => {
  it('throws NOT_IMPLEMENTED for update meta skeleton', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRequest = { name: 'Renamed' }
    await expect(svc.updateTemplateMeta('startup-board', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── TemplateService.createRole (NOT_IMPLEMENTED skeleton) ─────────────────────

describe('TemplateService.createRole (skeleton)', () => {
  it('creates a role and returns updated roles', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: CreateTemplateRoleRequest = {
      name: 'New Role',
      persona: 'Test persona',
      systemPrompt: 'You are a test.',
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
    }
    const result = await svc.createRole('startup-board', req)
    expect(result.templateId).toBe('startup-board')
    expect(result.roles.some((r) => r.name === 'New Role')).toBe(true)
  })
})

// ─── TemplateService.updateRole (NOT_IMPLEMENTED skeleton) ─────────────────────

describe('TemplateService.updateRole (skeleton)', () => {
  it('throws NOT_IMPLEMENTED for update role skeleton', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRoleRequest = { enabled: false }
    await expect(svc.updateRole('startup-board', 'ceo-host', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── TemplateService.deleteRole (NOT_IMPLEMENTED skeleton) ─────────────────────

describe('TemplateService.deleteRole (skeleton)', () => {
  it('deletes a role and returns confirmation', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.deleteRole('startup-board', 'ceo-host')
    expect(result).toEqual({ deletedRoleId: 'ceo-host' })
  })
})

// ─── TemplateService.copyRole (NOT_IMPLEMENTED skeleton) ───────────────────────

describe('TemplateService.copyRole (skeleton)', () => {
  it('throws NOT_IMPLEMENTED for copy role skeleton', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    await expect(svc.copyRole('startup-board', 'ceo-host')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── Existing read methods remain functional ───────────────────────────────────

describe('TemplateService existing methods (no regression)', () => {
  it('listTemplateSummaries still works', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummaries()
    expect(result.templates.length).toBeGreaterThan(0)
  })

  it('listTemplateSummariesForSettings returns settings fields', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummariesForSettings()
    expect(result.templates.length).toBeGreaterThan(0)
    const tpl = result.templates[0]
    expect(tpl).toHaveProperty('defaultStrategy')
    expect(tpl).toHaveProperty('configStatus')
    expect(['default', 'customized']).toContain(tpl.configStatus)
  })

  it('getTemplateDetail still works', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.getTemplateDetail('startup-board')
    expect(result.template.templateId).toBe('startup-board')
  })

  it('getTemplateDetail throws TEMPLATE_NOT_FOUND for unknown id', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    await expect(svc.getTemplateDetail('nonexistent')).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' })
  })

  it('listTemplateRoles still works', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateRoles('startup-board')
    expect(result.templateId).toBe('startup-board')
    expect(result.roles.length).toBeGreaterThan(0)
  })

  it('updateRoleConfig still works (legacy path)', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.updateRoleConfig('startup-board', 'ceo-host', { temperature: 0.5 })
    expect(result.roleId).toBe('ceo-host')
    expect(result.config.temperature).toBe(0.5)
  })
})