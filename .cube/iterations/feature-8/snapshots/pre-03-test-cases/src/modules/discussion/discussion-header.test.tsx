import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DiscussionHeader } from './discussion-header'

describe('DiscussionHeader', () => {
  // Task-16: renders topic and template name
  it('renders topic and template name', () => {
    render(
      <DiscussionHeader
        topic="三国战略讨论"
        templateName="三国谋士"
        onBack={() => {}}
        onMore={() => {}}
      />
    )
    expect(screen.getByText(/三国战略讨论/)).toBeInTheDocument()
    expect(screen.getByText(/三国谋士/)).toBeInTheDocument()
  })

  // Task-16: back button calls onBack
  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(
      <DiscussionHeader
        topic="Test"
        templateName="Template"
        onBack={onBack}
        onMore={() => {}}
      />
    )
    // Find back button (could be an aria-label or text)
    const backButton = screen.getByRole('button', { name: /返回/ }) ?? screen.getByLabelText(/返回/)
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalled()
  })

  // Task-16: more button calls onMore
  it('calls onMore when more button is clicked', () => {
    const onMore = vi.fn()
    render(
      <DiscussionHeader
        topic="Test"
        templateName="Template"
        onBack={() => {}}
        onMore={onMore}
      />
    )
    // Find more button
    const moreButton = screen.getByRole('button', { name: /更多/ }) ?? screen.getByLabelText(/更多/)
    fireEvent.click(moreButton)
    expect(onMore).toHaveBeenCalled()
  })
})
