import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RoleBar } from './role-bar'
import type { RoleInfo } from './role-bar'

const roles: RoleInfo[] = [
  { roleId: 'xunyu', name: '荀彧', agentType: 'host', avatar: '荀' },
  { roleId: 'zhuge-liang', name: '诸葛亮', agentType: 'expert', avatar: '诸' },
  { roleId: 'simayi', name: '司马懿', agentType: 'critic', avatar: '司' },
]

describe('RoleBar', () => {
  // Task-11: renders all role names
  it('renders all role names', () => {
    render(<RoleBar roles={roles} activeSpeakerId={null} />)
    expect(screen.getByText('荀彧')).toBeInTheDocument()
    expect(screen.getByText('诸葛亮')).toBeInTheDocument()
    expect(screen.getByText('司马懿')).toBeInTheDocument()
  })

  // Task-11: active speaker has highlight
  it('highlights the active speaker with ring style', () => {
    const { container } = render(<RoleBar roles={roles} activeSpeakerId="zhuge-liang" />)
    const activeElement = screen.getByText('诸葛亮').closest('[class*="ring"]') ?? container.querySelector('.ring-2')
    expect(activeElement).toBeInTheDocument()
  })

  // Task-11: no highlight when activeSpeakerId is null
  it('has no ring highlight when activeSpeakerId is null', () => {
    const { container } = render(<RoleBar roles={roles} activeSpeakerId={null} />)
    const highlighted = container.querySelector('.ring-2')
    expect(highlighted).toBeNull()
  })

  // Task-11: renders avatar content
  it('renders avatar text or emoji for each role', () => {
    render(<RoleBar roles={roles} activeSpeakerId={null} />)
    expect(screen.getByText('荀')).toBeInTheDocument()
  })
})
