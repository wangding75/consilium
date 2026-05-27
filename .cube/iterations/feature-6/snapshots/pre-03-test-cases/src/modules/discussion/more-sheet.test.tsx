import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MoreSheet } from './more-sheet'

describe('MoreSheet', () => {
  // Task-15: renders three menu entries when open
  it('renders three menu entries when open', () => {
    render(<MoreSheet isOpen={true} onClose={() => {}} />)
    expect(screen.getByText(/总结当前结论/)).toBeInTheDocument()
    expect(screen.getByText(/触发投票/)).toBeInTheDocument()
    expect(screen.getByText(/归档会话/)).toBeInTheDocument()
  })

  // Task-15: does not render entries when closed
  it('does not render entries when closed', () => {
    render(<MoreSheet isOpen={false} onClose={() => {}} />)
    expect(screen.queryByText(/总结当前结论/)).not.toBeInTheDocument()
  })

  // Task-15: clicking entry opens modal with "后续支持" message
  it('shows modal with "后续支持" message when entry is clicked', async () => {
    render(<MoreSheet isOpen={true} onClose={() => {}} />)
    const summaryEntry = screen.getByText(/总结当前结论/)
    summaryEntry.click()
    // Modal should appear with the placeholder message
    expect(await screen.findByText(/后续迭代/)).toBeInTheDocument()
  })
})
