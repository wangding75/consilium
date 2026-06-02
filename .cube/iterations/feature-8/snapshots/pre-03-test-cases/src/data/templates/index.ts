export { threeKingdomsTemplate } from './three-kingdoms'
export { startupBoardTemplate } from './startup-board'
export { productDebateTemplate } from './product-debate'

import { startupBoardTemplate } from './startup-board'
import { productDebateTemplate } from './product-debate'
import type { DiscussionTemplate } from '@/types'

export const BUILTIN_TEMPLATES: DiscussionTemplate[] = [
  startupBoardTemplate,
  productDebateTemplate,
]
