import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MoreSheet } from './more-sheet'

describe('MoreSheet summary trigger (Task-13)', () => {
  it('calls onRequestSummary when "总结当前结论" is clicked', () => {
    const onRequestSummary = vi.fn()
    render(<MoreSheet isOpen={true} onClose={() => {}} onRequestSummary={onRequestSummary} />)

    fireEvent.click(screen.getByText(/总结当前结论/))
    expect(onRequestSummary).toHaveBeenCalledTimes(1)
  })

  it('closes the sheet after triggering summary', () => {
    const onClose = vi.fn()
    render(<MoreSheet isOpen={true} onClose={onClose} onRequestSummary={() => {}} />)

    fireEvent.click(screen.getByText(/总结当前结论/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not show placeholder modal when onRequestSummary is provided', () => {
    render(<MoreSheet isOpen={true} onClose={() => {}} onRequestSummary={() => {}} />)

    fireEvent.click(screen.getByText(/总结当前结论/))
    expect(screen.queryByText(/后续迭代/)).not.toBeInTheDocument()
  })

  it('shows placeholder modal when onRequestSummary is not provided', async () => {
    render(<MoreSheet isOpen={true} onClose={() => {}} />)

    fireEvent.click(screen.getByText(/总结当前结论/))
    expect(await screen.findByText(/后续迭代/)).toBeInTheDocument()
  })

  it('disables summary button when canIntervene is false', () => {
    const onRequestSummary = vi.fn()
    render(<MoreSheet isOpen={true} onClose={() => {}} canIntervene={false} onRequestSummary={onRequestSummary} />)

    const button = screen.getByText(/总结当前结论/).closest('button')!
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(onRequestSummary).not.toHaveBeenCalled()
  })
})
