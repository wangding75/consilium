import { describe, it, expect } from 'vitest'
import { TemplateService } from '@/server/services/template.service'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import type { CreateTemplateRequest, CreateTemplateRoleRequest, UpdateTemplateRequest, UpdateTemplateRoleRequest } from '@/types/api'
import { ServiceError } from '@/server/errors'

// ─── createTemplate (skeleton → NOT_IMPLEMENTED) ──────────────────────────────

describe('TemplateService.createTemplate (RED)', () => {
  it('throws NOT_IMPLEMENTED for valid create request', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: CreateTemplateRequest = {
      name: 'My Template',
      description: 'A custom template',
      category: 'brainstorm',
      defaultStrategy: 'quality_first',
    }
    await expect(svc.createTemplate(req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── updateTemplateMeta (skeleton → NOT_IMPLEMENTED) ──────────────────────────

describe('TemplateService.updateTemplateMeta (RED)', () => {
  it('throws NOT_IMPLEMENTED for name update', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRequest = { name: 'Renamed Template' }
    await expect(svc.updateTemplateMeta('startup-board', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('throws NOT_IMPLEMENTED for strategy update', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRequest = { defaultStrategy: 'cost_first' }
    await expect(svc.updateTemplateMeta('startup-board', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('throws NOT_IMPLEMENTED for fallback config update', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRequest = {
      fallbackProviderConnectionId: 'conn-fb',
      fallbackModel: 'gpt-4o-mini',
    }
    await expect(svc.updateTemplateMeta('startup-board', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── createRole (skeleton → NOT_IMPLEMENTED) ──────────────────────────────────

describe('TemplateService.createRole (RED)', () => {
  it('creates a role with full params', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: CreateTemplateRoleRequest = {
      name: 'Expert',
      persona: 'Domain expert',
      systemPrompt: 'You are an expert.',
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      includedInDefaultQueue: true,
      enabled: true,
    }
    const result = await svc.createRole('startup-board', req)
    expect(result.templateId).toBe('startup-board')
    expect(result.roles.some((r) => r.name === 'Expert')).toBe(true)
  })

  it('creates a role with minimal params', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: CreateTemplateRoleRequest = {
      name: 'Critic',
      persona: 'Critical reviewer',
      systemPrompt: 'Review everything.',
      providerConnectionId: 'conn-002',
      model: 'claude-sonnet-4-6',
    }
    const result = await svc.createRole('startup-board', req)
    expect(result.templateId).toBe('startup-board')
    expect(result.roles.some((r) => r.name === 'Critic')).toBe(true)
  })
})

// ─── updateRole (skeleton → NOT_IMPLEMENTED) ──────────────────────────────────

describe('TemplateService.updateRole (RED)', () => {
  it('throws NOT_IMPLEMENTED for enabled toggle', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRoleRequest = { enabled: false }
    await expect(svc.updateRole('startup-board', 'ceo-host', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })

  it('throws NOT_IMPLEMENTED for full role update', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const req: UpdateTemplateRoleRequest = {
      name: 'Updated Role',
      persona: 'Updated persona',
      systemPrompt: 'Updated prompt',
      providerConnectionId: 'conn-003',
      model: 'gemini-pro',
      temperature: 1.0,
      maxTokens: 8192,
      includedInDefaultQueue: false,
      enabled: true,
    }
    await expect(svc.updateRole('startup-board', 'ceo-host', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── deleteRole (skeleton → NOT_IMPLEMENTED) ──────────────────────────────────

describe('TemplateService.deleteRole (RED)', () => {
  it('deletes a role successfully', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.deleteRole('startup-board', 'ceo-host')
    expect(result).toEqual({ deletedRoleId: 'ceo-host' })
  })
})

// ─── copyRole (skeleton → NOT_IMPLEMENTED) ────────────────────────────────────

describe('TemplateService.copyRole (RED)', () => {
  it('throws NOT_IMPLEMENTED for copy', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    await expect(svc.copyRole('startup-board', 'ceo-host')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── listTemplateSummariesForSettings (working, enriched) ──────────────────────

describe('TemplateService.listTemplateSummariesForSettings', () => {
  it('returns templates with defaultStrategy and configStatus', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummariesForSettings()
    expect(result.templates.length).toBeGreaterThan(0)
    for (const tpl of result.templates) {
      expect(tpl).toHaveProperty('defaultStrategy')
      expect(['smart_fallback', 'quality_first', 'cost_first']).toContain(tpl.defaultStrategy)
      expect(tpl).toHaveProperty('configStatus')
      expect(['default', 'customized']).toContain(tpl.configStatus)
    }
  })

  it('returns all fields from base TemplateSummary', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummariesForSettings()
    const tpl = result.templates[0]
    expect(tpl).toHaveProperty('templateId')
    expect(tpl).toHaveProperty('version')
    expect(tpl).toHaveProperty('name')
    expect(tpl).toHaveProperty('description')
    expect(tpl).toHaveProperty('category')
    expect(tpl).toHaveProperty('tags')
    expect(tpl).toHaveProperty('roleCount')
    expect(tpl).toHaveProperty('eventCount')
    expect(tpl).toHaveProperty('usageCount')
    expect(tpl).toHaveProperty('isBuiltin')
    expect(tpl).toHaveProperty('availableForSessionCreation')
  })

  it('defaultStrategy is smart_fallback for builtin templates', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummariesForSettings()
    const builtin = result.templates.filter((t) => t.isBuiltin)
    expect(builtin.length).toBeGreaterThan(0)
    for (const tpl of builtin) {
      expect(tpl.defaultStrategy).toBe('smart_fallback')
    }
  })
})

// ─── Existing read methods remain functional ───────────────────────────────────

describe('TemplateService — existing read methods (no regression)', () => {
  it('listTemplateSummaries returns standard summaries', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateSummaries()
    expect(result.templates.length).toBeGreaterThan(0)
    expect(result.templates[0]).not.toHaveProperty('defaultStrategy')
  })

  it('getTemplateDetail returns full template', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.getTemplateDetail('startup-board')
    expect(result.template.templateId).toBe('startup-board')
    expect(result.template.roles.length).toBeGreaterThan(0)
  })

  it('getTemplateDetail throws TEMPLATE_NOT_FOUND for unknown id', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    await expect(svc.getTemplateDetail('nonexistent')).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' })
  })

  it('listTemplateRoles returns roles with version', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.listTemplateRoles('startup-board')
    expect(result.templateId).toBe('startup-board')
    expect(result.templateVersion).toBeDefined()
    expect(result.roles.length).toBeGreaterThan(0)
  })

  it('updateRoleConfig still works (legacy)', async () => {
    const svc = new TemplateService(new MockTemplateRepository())
    const result = await svc.updateRoleConfig('startup-board', 'ceo-host', { temperature: 0.3 })
    expect(result.roleId).toBe('ceo-host')
    expect(result.config.temperature).toBe(0.3)
  })
})