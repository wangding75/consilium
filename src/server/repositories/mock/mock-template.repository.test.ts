import { describe, it, expect } from 'vitest'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import type { DiscussionTemplate, TemplateRole } from '@/types'
import { ServiceError } from '@/server/errors'

const makeRole = (overrides: Partial<TemplateRole> = {}): TemplateRole => ({
  roleId: 'role-1',
  name: 'Test Role',
  persona: 'A test role persona',
  isHost: false,
  agentType: 'expert',
  systemPrompt: 'You are a test role.',
  visible: true,
  configStatus: 'default',
  ...overrides,
})

const makeTemplate = (overrides: Partial<DiscussionTemplate> = {}): DiscussionTemplate => ({
  templateId: 'tpl-1',
  version: '1.0.0',
  name: 'Test Template',
  description: 'A test template for iteration 8',
  category: 'test',
  tags: ['test'],
  overview: {
    worldview: 'Test worldview',
    userIdentity: 'test-user',
    applicableScenarios: ['testing'],
  },
  roles: [
    makeRole({ roleId: 'role-1', name: 'Role One' }),
    makeRole({ roleId: 'role-2', name: 'Role Two' }),
  ],
  events: [],
  rhythm: {
    maxTurnsPerStage: {},
    minTurnsBeforeClimax: 4,
  },
  modelDefaults: {
    defaultModel: 'gpt-4',
  },
  metrics: {
    usageCount: 0,
    sessionCount: 0,
    favoriteCount: 0,
  },
  isBuiltin: false,
  visible: true,
  availableForSessionCreation: true,
  editable: true,
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

function createRepo(templates: DiscussionTemplate[] = [makeTemplate()]): MockTemplateRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (MockTemplateRepository as any)(templates)
}

async function assertThrowsCode(
  fn: () => Promise<unknown>,
  expectedCode: string
): Promise<void> {
  try {
    await fn()
    expect.fail(`Expected error with code ${expectedCode} but none was thrown`)
  } catch (err) {
    expect(err).toBeInstanceOf(ServiceError)
    expect((err as ServiceError).code).toBe(expectedCode)
  }
}

describe('MockTemplateRepository — updateRoleConfig (Task-03)', () => {
  it('accepts templateId, roleId, and patch with model/temperature/maxCharsPerTurn', async () => {
    const repo = createRepo()
    const result = await repo.updateRoleConfig('tpl-1', 'role-1', {
      model: 'gpt-4o',
      temperature: 0.7,
      maxCharsPerTurn: 500,
    })
    expect(result).not.toBeNull()
  })

  it('valid patch creates a new template version (patch version increments, e.g., 1.0.0 -> 1.0.1)', async () => {
    const repo = createRepo()
    await repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 0.8 })
    const updated = await repo.findById('tpl-1')
    expect(updated).not.toBeNull()
    expect(updated!.version).toBe('1.0.1')
  })

  it('returns RoleConfigPatchResult with templateId, templateVersion, roleId, config, effectScope=future_sessions_only', async () => {
    const repo = createRepo()
    const result = await repo.updateRoleConfig('tpl-1', 'role-1', {
      model: 'gpt-4o',
      temperature: 0.7,
      maxCharsPerTurn: 500,
    })
    expect(result).not.toBeNull()
    expect(result!.templateId).toBe('tpl-1')
    expect(result!.templateVersion).toBe('1.0.1')
    expect(result!.roleId).toBe('role-1')
    expect(result!.config).toEqual({
      model: 'gpt-4o',
      temperature: 0.7,
      maxCharsPerTurn: 500,
    })
    expect(result!.effectScope).toBe('future_sessions_only')
  })

  it('empty patch returns VALIDATION_ERROR', async () => {
    const repo = createRepo()
    await assertThrowsCode(() => repo.updateRoleConfig('tpl-1', 'role-1', {}), 'VALIDATION_ERROR')
  })

  it('invalid temperature (>2) returns VALIDATION_ERROR', async () => {
    const repo = createRepo()
    await assertThrowsCode(
      () => repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 2.1 }),
      'VALIDATION_ERROR'
    )
  })

  it('invalid maxCharsPerTurn (<=0) returns VALIDATION_ERROR', async () => {
    const repo = createRepo()
    await assertThrowsCode(
      () => repo.updateRoleConfig('tpl-1', 'role-1', { maxCharsPerTurn: 0 }),
      'VALIDATION_ERROR'
    )
  })

  it('nonexistent template returns TEMPLATE_NOT_FOUND', async () => {
    const repo = createRepo()
    await assertThrowsCode(
      () => repo.updateRoleConfig('nonexistent', 'role-1', { temperature: 0.5 }),
      'TEMPLATE_NOT_FOUND'
    )
  })

  it('nonexistent role returns ROLE_NOT_FOUND', async () => {
    const repo = createRepo()
    await assertThrowsCode(
      () => repo.updateRoleConfig('tpl-1', 'nonexistent', { temperature: 0.5 }),
      'ROLE_NOT_FOUND'
    )
  })

  it('template that is not editable returns TEMPLATE_NOT_EDITABLE', async () => {
    const repo = createRepo([makeTemplate({ editable: false })])
    await assertThrowsCode(
      () => repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 0.5 }),
      'TEMPLATE_NOT_EDITABLE'
    )
  })

  it('template that is unavailable returns TEMPLATE_UNAVAILABLE', async () => {
    const repo = createRepo([makeTemplate({ availableForSessionCreation: false })])
    await assertThrowsCode(
      () => repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 0.5 }),
      'TEMPLATE_UNAVAILABLE'
    )
  })

  it('the old template version is preserved (immutable update)', async () => {
    const store = [makeTemplate()]
    const repo = createRepo(store)
    await repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 0.8 })
    expect(store).toHaveLength(2)
    expect(store[0].version).toBe('1.0.0')
    const oldRole = store[0].roles.find((r) => r.roleId === 'role-1')
    expect(oldRole!.runtimeConfig).toBeUndefined()
  })

  it('sessions created before the update still reference the old snapshot', async () => {
    const store = [makeTemplate()]
    const repo = createRepo(store)
    const beforeTemplate = await repo.findById('tpl-1')
    expect(beforeTemplate).not.toBeNull()
    const beforeRole = beforeTemplate!.roles.find((r) => r.roleId === 'role-1')
    expect(beforeRole!.runtimeConfig).toBeUndefined()

    await repo.updateRoleConfig('tpl-1', 'role-1', { temperature: 0.8 })

    // The original object reference obtained before update is unchanged
    expect(beforeTemplate!.version).toBe('1.0.0')
    expect(beforeRole!.runtimeConfig).toBeUndefined()
  })
})
