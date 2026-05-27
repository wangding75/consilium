import type { DirectorDecisionRecord, DirectorInput } from '@/types'

export interface Director {
  decide(input: DirectorInput): Promise<DirectorDecisionRecord>
}

export class DefaultDirector implements Director {
  async decide(_input: DirectorInput): Promise<DirectorDecisionRecord> {
    throw new Error('not implemented')
  }
}
