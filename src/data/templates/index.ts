import { threeKingdomsTemplate } from './three-kingdoms'
import { startupBoardTemplate } from './startup-board'
import { productDebateTemplate } from './product-debate'
import type { DiscussionTemplate } from '@/types'

export { threeKingdomsTemplate }
export { startupBoardTemplate }
export { productDebateTemplate }

export const BUILTIN_TEMPLATES: DiscussionTemplate[] = [
  threeKingdomsTemplate,
  startupBoardTemplate,
  productDebateTemplate,
]
