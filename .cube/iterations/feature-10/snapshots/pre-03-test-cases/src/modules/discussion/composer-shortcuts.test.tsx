import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageInput } from '@/modules/discussion/message-input'

describe('Discussion composer shortcut fill — Task-07', () => {
  it('fills the composer when toolbar shortcut buttons are clicked without sending', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)

    fireEvent.click(screen.getByRole('button', { name: '@' }))

    expect(screen.getByRole('textbox')).toHaveValue('@')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('consumes draftContent from MoreSheet into the composer and focuses the input', () => {
    const onDraftConsumed = vi.fn()
    render(<MessageInput onSend={vi.fn()} draftContent="总结当前结论" onDraftConsumed={onDraftConsumed} />)

    expect(screen.getByRole('textbox')).toHaveValue('总结当前结论')
    expect(screen.getByRole('textbox')).toHaveFocus()
    expect(onDraftConsumed).toHaveBeenCalled()
  })
})
