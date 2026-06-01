import type { Template } from '@/types'
import type { TemplateRepository } from '../template.repository'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

export class MockTemplateRepository implements TemplateRepository {
  private readonly templates: Template[] = [threeKingdomsTemplate]

  async findAll(): Promise<Template[]> {
    return this.templates
  }

  async findById(id: string): Promise<Template | null> {
    return this.templates.find((t) => t.id === id) ?? null
  }
}
