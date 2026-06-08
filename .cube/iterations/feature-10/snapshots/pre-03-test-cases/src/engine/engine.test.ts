import { DefaultOrchestrator } from '@/engine/orchestrator'
import { mockSession } from '@/tests/utils/mock-factories'

it('DefaultOrchestrator.start resolves without error', async () => {
  const orchestrator = new DefaultOrchestrator()
  const session = mockSession()
  await expect(orchestrator.start(session)).resolves.toBeUndefined()
})

it('DefaultOrchestrator.next returns null when no more turns', async () => {
  const orchestrator = new DefaultOrchestrator()
  const session = mockSession()
  await expect(orchestrator.next(session)).resolves.toBeNull()
})
