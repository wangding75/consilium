import { describe, it, expect } from 'vitest'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import type { CreateTemplateRequest, CreateTemplateRoleRequest, UpdateTemplateRequest, UpdateTemplateRoleRequest } from '@/types/api'
import { ServiceError } from '@/server/errors'

// ─── MockTemplateRepository — template admin skeletons ─────────────────────────

describe('MockTemplateRepository — createTemplate skeleton', () => {
  it('throws NOT_IMPLEMENTED for create', async () => {
    const repo = new MockTemplateRepository()
    const req: CreateTemplateRequest = {
      name: 'New Template',
      description: 'A test template',
      defaultStrategy: 'smart_fallback',
    }
    await expect(repo.createTemplate(req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

describe('MockTemplateRepository — updateTemplate skeleton', () => {
  it('throws NOT_IMPLEMENTED for update', async () => {
    const repo = new MockTemplateRepository()
    const req: UpdateTemplateRequest = { name: 'Renamed' }
    await expect(repo.updateTemplate('startup-board', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

describe('MockTemplateRepository — createRole skeleton', () => {
  it('creates a role and returns updated roles list', async () => {
    const repo = new MockTemplateRepository()
    const req: CreateTemplateRoleRequest = {
      name: 'New Role',
      persona: 'Test',
      systemPrompt: 'You are a test.',
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
    }
    const result = await repo.createRole('startup-board', req)
    expect(result!.templateId).toBe('startup-board')
    expect(result!.roles.some((r: { name: string }) => r.name === 'New Role')).toBe(true)
  })
})

describe('MockTemplateRepository — updateRole skeleton', () => {
  it('throws NOT_IMPLEMENTED for update role', async () => {
    const repo = new MockTemplateRepository()
    const req: UpdateTemplateRoleRequest = { enabled: false }
    await expect(repo.updateRole('startup-board', 'ceo-host', req)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

describe('MockTemplateRepository — deleteRole skeleton', () => {
  it('deletes a role and returns confirmation', async () => {
    const repo = new MockTemplateRepository()
    const result = await repo.deleteRole('startup-board', 'ceo-host')
    expect(result).toEqual({ deletedRoleId: 'ceo-host' })
  })
})

describe('MockTemplateRepository — copyRole skeleton', () => {
  it('throws NOT_IMPLEMENTED for copy role', async () => {
    const repo = new MockTemplateRepository()
    await expect(repo.copyRole('startup-board', 'ceo-host')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── Legacy read methods remain functional ─────────────────────────────────────

describe('MockTemplateRepository — legacy methods still work', () => {
  it('findSummaries returns templates with roleCount', async () => {
    const repo = new MockTemplateRepository()
    const summaries = await repo.findSummaries()
    expect(summaries.length).toBeGreaterThan(0)
    expect(summaries[0]).toHaveProperty('roleCount')
    expect(summaries[0]).toHaveProperty('eventCount')
  })

  it('findRoles returns roles for startup-board', async () => {
    const repo = new MockTemplateRepository()
    const result = await repo.findRoles('startup-board')
    expect(result).not.toBeNull()
    expect(result!.templateId).toBe('startup-board')
    expect(result!.roles.length).toBeGreaterThan(0)
  })

  it('findRoles returns null for unknown template', async () => {
    const repo = new MockTemplateRepository()
    expect(await repo.findRoles('nonexistent')).toBeNull()
  })

  it('findDetailById finds startup-board', async () => {
    const repo = new MockTemplateRepository()
    const tpl = await repo.findDetailById('startup-board')
    expect(tpl).not.toBeNull()
    expect(tpl!.templateId).toBe('startup-board')
  })

  it('updateRoleConfig still works through legacy path', async () => {
    const repo = new MockTemplateRepository()
    const result = await repo.updateRoleConfig('startup-board', 'ceo-host', { temperature: 0.5 })
    expect(result!.roleId).toBe('ceo-host')
    expect(result!.config.temperature).toBe(0.5)
  })

  it('updateRoleConfig rejects empty patch', async () => {
    const repo = new MockTemplateRepository()
    await expect(repo.updateRoleConfig('startup-board', 'ceo-host', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})