import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'

describe('ProviderSheet', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ProviderSheet
        isOpen={false}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders provider sheet with title when open', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByText(/Provider|配置/i)).toBeInTheDocument()
  })

  it('renders providerId as a read-only field', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const providerIdField = screen.getByDisplayValue('openai')
    expect(providerIdField).toHaveAttribute('readonly')
  })

  it('renders enabled toggle as an interactive control', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('checkbox', { name: /启用|enabled/i })).toBeInTheDocument()
  })

  it('renders baseUrl input field', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/base.*url|Base.*URL|地址/i)).toBeInTheDocument()
  })

  it('renders apiKey input field', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/api.*key|API.*Key|密钥/i)).toBeInTheDocument()
  })

  it('renders modelList as an editable control', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/model.*list|模型.*列表/i)).toBeInTheDocument()
  })

  it('renders customHeaders as an editable control', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/custom.*header|Header|自定义.*头/i)).toBeInTheDocument()
  })

  it('shows save button', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /保存|save/i })).toBeInTheDocument()
  })

  it('shows test connection button', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /测试|test.*(连接|connection)/i })).toBeInTheDocument()
  })

  it('disables save button when providerId is empty', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId=""
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /保存|save/i })).toBeDisabled()
  })

  it('disables save button when modelList is empty', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /保存|save/i })).toBeDisabled()
  })

  it('shows an inline error when baseUrl is not a valid URL', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const baseUrlInput = screen.getByLabelText(/base.*url|Base.*URL|地址/i)
    fireEvent.change(baseUrlInput, { target: { value: 'not-a-valid-url' } })

    expect(screen.getByText(/invalid|无效|格式.*错|url/i)).toBeInTheDocument()
  })

  it('shows an inline error when customHeaders is not valid JSON', () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const headersInput = screen.getByLabelText(/custom.*header|Header|自定义.*头/i)
    fireEvent.change(headersInput, { target: { value: '{invalid json' } })

    expect(screen.getByText(/json|JSON|格式.*错/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()

    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={onClose}
        onSaved={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /✕|关闭|close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
