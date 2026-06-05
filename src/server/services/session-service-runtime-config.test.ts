import { describe, it, expect, beforeEach } from 'vitest'
import { SessionService } from '@/server/services/session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'

function makeService() {
  const sessionRepo = new MockSessionRepository()
  const templateRepo = new MockTemplateRepository() // pre-seeded with threeKingdomsTemplate (templateId: 'three-kingdoms-advisors')
  return { svc: new SessionService(sessionRepo, templateRepo), sessionRepo }
}

beforeEach(async () => {
  await sharedSettingsRepo.clearAll()
})

// ─── Task-09: SessionService.createSession writes runtimeConfigSnapshot ──────

describe('SessionService.createSession — runtimeConfigSnapshot', () => {
  it('createSession writes runtimeConfigSnapshot to session', async () => {
    const { svc, sessionRepo } = makeService()

    const result = await svc.createSession({ topic: '测试讨论', templateId: 'three-kingdoms-advisors' })
    const session = await sessionRepo.findById(result.sessionId)
    expect(session).not.toBeNull()
    expect(session!.runtimeConfigSnapshot).toBeDefined()
  })

  it('runtimeConfigSnapshot contains globalDefaults', async () => {
    await sharedSettingsRepo.saveModelDefaults({ providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 512 })
    const { svc, sessionRepo } = makeService()

    const result = await svc.createSession({ topic: '测试', templateId: 'three-kingdoms-advisors' })
    const session = await sessionRepo.findById(result.sessionId)

    expect(session!.runtimeConfigSnapshot!.globalDefaults).toBeDefined()
    expect(session!.runtimeConfigSnapshot!.globalDefaults.providerId).toBeDefined()
  })

  it('runtimeConfigSnapshot contains roleOverrides array', async () => {
    await sharedSettingsRepo.saveRoleModelOverrides([{ roleId: 'role_001', model: 'claude-haiku-4-5-20251001' }])
    const { svc, sessionRepo } = makeService()

    const result = await svc.createSession({ topic: '测试', templateId: 'three-kingdoms-advisors' })
    const session = await sessionRepo.findById(result.sessionId)

    expect(session!.runtimeConfigSnapshot!.roleOverrides).toBeDefined()
    expect(Array.isArray(session!.runtimeConfigSnapshot!.roleOverrides)).toBe(true)
  })

  it('runtimeConfigSnapshot contains snapshotAt ISO timestamp', async () => {
    const { svc, sessionRepo } = makeService()

    const result = await svc.createSession({ topic: '测试', templateId: 'three-kingdoms-advisors' })
    const session = await sessionRepo.findById(result.sessionId)

    expect(session!.runtimeConfigSnapshot!.snapshotAt).toBeTruthy()
    expect(() => new Date(session!.runtimeConfigSnapshot!.snapshotAt)).not.toThrow()
  })

  it('each new session gets independent snapshot', async () => {
    const { svc, sessionRepo } = makeService()

    const r1 = await svc.createSession({ topic: '第一个会话', templateId: 'three-kingdoms-advisors' })
    const r2 = await svc.createSession({ topic: '第二个会话', templateId: 'three-kingdoms-advisors' })

    const s1 = await sessionRepo.findById(r1.sessionId)
    const s2 = await sessionRepo.findById(r2.sessionId)

    expect(s1!.runtimeConfigSnapshot).toBeDefined()
    expect(s2!.runtimeConfigSnapshot).toBeDefined()
    // Each session has its own snapshot (different snapshotAt at minimum)
    expect(s1!.runtimeConfigSnapshot!.snapshotAt).toBeDefined()
    expect(s2!.runtimeConfigSnapshot!.snapshotAt).toBeDefined()
  })

  it('createSession returns CreateSessionResult with correct fields', async () => {
    const { svc } = makeService()

    const result = await svc.createSession({ topic: '测试', templateId: 'three-kingdoms-advisors' })
    expect(result.sessionId).toBeDefined()
    expect(result.topic).toBe('测试')
    expect(result.status).toBe('running')
    expect(result.template.templateId).toBe('three-kingdoms-advisors')
  })
})