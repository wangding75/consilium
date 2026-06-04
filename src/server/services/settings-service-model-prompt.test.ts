import { describe, it, expect } from 'vitest'
import { SettingsService } from '@/server/services/settings.service'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { GlobalModelDefaults, RoleModelOverride, PromptConfig, Session } from '@/types'

function makeService(repo?: MockSettingsRepository) {
  const r = repo ?? new MockSettingsRepository()
  return new SettingsService(
    r,
    new MockSessionRepository(),
    new MockMessageRepository(),
    new MockEventRepository(),
    new MockVoteRepository()
  )
}

function makeRepoWithService() {
  const repo = new MockSettingsRepository()
  return { repo, svc: makeService(repo) }
}

// ─── Task-04: getModelDefaults / saveModelDefaults ───────────────────────────

describe('SettingsService.getModelDefaults / saveModelDefaults', () => {
  it('returns null when no defaults saved', async () => {
    const { svc } = makeRepoWithService()
    expect(await svc.getModelDefaults()).toBeNull()
  })

  it('saves and retrieves model defaults', async () => {
    const { svc } = makeRepoWithService()
    const input: GlobalModelDefaults = { providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }
    const saved = await svc.saveModelDefaults(input)
    expect(saved.providerId).toBe('openai')
    expect(saved.model).toBe('gpt-4o')

    const retrieved = await svc.getModelDefaults()
    expect(retrieved).toEqual(saved)
  })

  it('overwrites previous defaults', async () => {
    const { svc } = makeRepoWithService()
    await svc.saveModelDefaults({ providerId: 'openai', model: 'old', temperature: 0.5, maxTokens: 256 })
    await svc.saveModelDefaults({ providerId: 'anthropic', model: 'new', temperature: 0.8, maxTokens: 1024 })

    const stored = await svc.getModelDefaults()
    expect(stored!.providerId).toBe('anthropic')
    expect(stored!.model).toBe('new')
  })

  it('accepts boundary values', async () => {
    const { svc } = makeRepoWithService()
    const defaults: GlobalModelDefaults = { providerId: 'gemini', model: 'gemini-pro', temperature: 0, maxTokens: 1 }
    const saved = await svc.saveModelDefaults(defaults)
    expect(saved.temperature).toBe(0)
    expect(saved.maxTokens).toBe(1)
  })
})

// ─── Task-04: getRoleModelOverrides / saveRoleModelOverrides ─────────────────

describe('SettingsService.getRoleModelOverrides / saveRoleModelOverrides', () => {
  it('returns empty array when no overrides', async () => {
    const { svc } = makeRepoWithService()
    expect(await svc.getRoleModelOverrides()).toEqual([])
  })

  it('saves and retrieves role overrides', async () => {
    const { svc } = makeRepoWithService()
    const overrides: RoleModelOverride[] = [
      { roleId: 'role_001', providerId: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.8, maxTokens: 1024 },
    ]
    const saved = await svc.saveRoleModelOverrides(overrides)
    expect(saved).toHaveLength(1)
    expect(saved[0].roleId).toBe('role_001')

    const retrieved = await svc.getRoleModelOverrides()
    expect(retrieved).toHaveLength(1)
    expect(retrieved[0].model).toBe('claude-haiku-4-5-20251001')
  })

  it('saves multiple role overrides', async () => {
    const { svc } = makeRepoWithService()
    await svc.saveRoleModelOverrides([
      { roleId: 'a', model: 'm1' },
      { roleId: 'b', model: 'm2' },
      { roleId: 'c', temperature: 0.3 },
    ])
    const stored = await svc.getRoleModelOverrides()
    expect(stored).toHaveLength(3)
  })

  it('replaces all overrides on subsequent save', async () => {
    const { svc } = makeRepoWithService()
    await svc.saveRoleModelOverrides([{ roleId: 'a', model: 'm1' }])
    await svc.saveRoleModelOverrides([{ roleId: 'b', model: 'm2' }])

    const stored = await svc.getRoleModelOverrides()
    expect(stored).toHaveLength(1)
    expect(stored[0].roleId).toBe('b')
  })
})

// ─── Task-04: getPromptConfigs / updatePrompt / resetPromptToDefault ─────────

describe('SettingsService.getPromptConfigs', () => {
  it('returns empty array when no prompts', async () => {
    const { svc } = makeRepoWithService()
    expect(await svc.getPromptConfigs()).toEqual([])
  })

  it('returns saved prompts', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.0',
      content: 'You are helpful.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })
    const prompts = await svc.getPromptConfigs()
    expect(prompts).toHaveLength(1)
    expect(prompts[0].promptId).toBe('global_system')
  })
})

describe('SettingsService.updatePrompt', () => {
  it('updates prompt content and bumps version', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.0',
      content: 'Original.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })

    const updated = await svc.updatePrompt('global_system', 'New content.')
    expect(updated.content).toBe('New content.')
    expect(updated.version).toBe('1.0.1')
    expect(updated.isDefault).toBe(false)
    expect(updated.updatedAt).not.toBe('2026-06-04T00:00:00.000Z')
  })

  it('throws NOT_FOUND when promptId does not exist', async () => {
    const { svc } = makeRepoWithService()
    await expect(svc.updatePrompt('nonexistent', 'content')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws VALIDATION_ERROR when content is empty', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'p1',
      scope: 'global',
      version: '1.0.0',
      content: 'Original.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })
    await expect(svc.updatePrompt('p1', '')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('throws VALIDATION_ERROR when content is whitespace only', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'p1',
      scope: 'global',
      version: '1.0.0',
      content: 'Original.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })
    await expect(svc.updatePrompt('p1', '   ')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('bumps patch version correctly', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'p1',
      scope: 'global',
      version: '2.3.9',
      content: 'x',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })
    const updated = await svc.updatePrompt('p1', 'y')
    expect(updated.version).toBe('2.3.10')
  })
})

describe('SettingsService.resetPromptToDefault', () => {
  it('resets isDefault flag and bumps version', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.2',
      content: 'Modified.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: false,
    })

    const reset = await svc.resetPromptToDefault('global_system')
    expect(reset.isDefault).toBe(true)
    expect(reset.version).toBe('1.0.3')
    expect(reset.updatedAt).not.toBe('2026-06-04T00:00:00.000Z')
  })

  it('throws NOT_FOUND when promptId does not exist', async () => {
    const { svc } = makeRepoWithService()
    await expect(svc.resetPromptToDefault('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('preserves existing content after reset', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.savePromptConfig({
      promptId: 'p1',
      scope: 'role',
      targetId: 'role_host',
      version: '1.0.0',
      content: 'Custom prompt.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: false,
    })
    const reset = await svc.resetPromptToDefault('p1')
    expect(reset.content).toBe('Custom prompt.')
  })
})

// ─── Task-04: clearData ──────────────────────────────────────────────────────

describe('SettingsService.clearData', () => {
  it('scope=sessions clears session-related repos but not settings', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.saveModelDefaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 })
    await svc.clearData('sessions')

    // settings repo should NOT be cleared
    const defaults = await repo.getModelDefaults()
    expect(defaults).not.toBeNull()
  })

  it('scope=settings clears only settings repo', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.saveModelDefaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 })
    await repo.savePromptConfig({
      promptId: 'p1',
      scope: 'global',
      version: '1.0.0',
      content: 'test',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    })

    await svc.clearData('settings')

    expect(await repo.getModelDefaults()).toBeNull()
    expect(await repo.getPromptConfigs()).toEqual([])
  })

  it('scope=all clears all repos', async () => {
    const { repo, svc } = makeRepoWithService()
    await repo.saveModelDefaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 })
    await repo.upsertProviderConfig({
      providerId: 'openai',
      enabled: true,
      modelList: ['gpt-4o'],
      lastTestStatus: 'untested',
    })

    await svc.clearData('all')

    expect(await repo.getModelDefaults()).toBeNull()
    expect(await repo.getProviderConfigs()).toEqual([])
  })
})