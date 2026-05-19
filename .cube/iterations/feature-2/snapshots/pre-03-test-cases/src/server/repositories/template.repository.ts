import type { Template } from '@/types'

export interface TemplateRepository {
  findAll(): Promise<Template[]>
  findById(id: string): Promise<Template | null>
}
