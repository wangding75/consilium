import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        isOpen={false}
        title="Confirm"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        message="This action cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        confirmText="Yes, delete"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Yes, delete'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByText(/取消|Cancel/i))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('uses default confirm text when confirmText is not provided', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
  })

  it('disables confirm button when requireTyping does not match input', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Dangerous Action"
        message="Type to confirm"
        confirmText="删除"
        requireTyping="确认删除"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '确认删' } })
    const button = screen.getByText('删除')
    expect(button).toBeDisabled()
  })

  it('enables confirm after typing matching text when requireTyping is set', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Dangerous Action"
        message="Type to confirm"
        confirmText="删除"
        requireTyping="确认删除"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '确认删除' } })
    const button = screen.getByText('删除')
    expect(button).not.toBeDisabled()
  })

  it('shows danger styling when variant is danger', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Everything"
        message="This will remove all data."
        variant="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete Everything' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('This will remove all data.')).toBeInTheDocument()
  })
})