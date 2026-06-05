'use client'

import React from 'react'

export interface ProviderSheetProps {
  isOpen: boolean
  providerId: string
  onClose: () => void
  onSaved: () => void
}

export function ProviderSheet(_props: ProviderSheetProps): React.ReactElement | null {
  throw new Error('not implemented')
}

export default ProviderSheet