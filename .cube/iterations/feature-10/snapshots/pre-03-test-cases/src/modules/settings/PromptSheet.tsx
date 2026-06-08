'use client'

import React from 'react'

export interface PromptSheetProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function PromptSheet(_props: PromptSheetProps): React.ReactElement | null {
  throw new Error('not implemented')
}

export default PromptSheet