'use client'

import { useState } from 'react'

interface MoreSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function MoreSheet({ isOpen, onClose }: MoreSheetProps) {
  const [modalOpen, setModalOpen] = useState(false)

  if (!isOpen) return null

  const entries = [
    '总结当前结论',
    '触发投票',
    '归档会话',
  ]

  return (
    <>
      <div>
        {entries.map((entry) => (
          <div key={entry} onClick={() => setModalOpen(true)} style={{ cursor: 'pointer', padding: '8px 0' }}>
            {entry}
          </div>
        ))}
      </div>
      {modalOpen && (
        <div>
          <p>此功能将在后续迭代中支持</p>
          <button onClick={() => { setModalOpen(false); onClose() }}>关闭</button>
        </div>
      )}
    </>
  )
}
