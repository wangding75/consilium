import type { Template } from '@/types'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import { ServiceError } from '@/server/errors'

export class TemplateService {
  constructor(private readonly repo: TemplateRepository) {}

  async listTemplates(): Promise<Template[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('TEMPLATE_LIST_FAILED', 'Failed to list templates', err)
    }
  }

  async getTemplate(id: string): Promise<Template | null> {
    try {
      return await this.repo.findById(id)
    } catch (err) {
      throw new ServiceError('TEMPLATE_GET_FAILED', 'Failed to get template', err)
    }
  }
}
