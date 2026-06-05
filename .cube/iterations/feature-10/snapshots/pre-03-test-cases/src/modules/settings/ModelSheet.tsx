'use client'

import React from 'react'

export interface ModelSheetProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function ModelSheet(_props: ModelSheetProps): React.ReactElement | null {
  throw new Error('not implemented')
}

export default ModelSheet