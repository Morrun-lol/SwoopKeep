import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExpenseDetailTable from '../../src/renderer/components/ExpenseDetailTable'

const getHeaderText = (container: HTMLElement) => {
  const el = container.querySelector('div.text-sm.text-gray-500')
  return el?.textContent || ''
}

describe('ExpenseDetailTable date parsing', () => {
  it('renders title for quarter key', () => {
    const { container } = render(
      <MemoryRouter>
        <ExpenseDetailTable filter={{ date: '2025-Q2', dimension: 'quarter', category: null }} />
      </MemoryRouter>,
    )

    expect(getHeaderText(container)).toContain('2025-Q2')
  })

  it('renders title for month key', () => {
    const { container } = render(
      <MemoryRouter>
        <ExpenseDetailTable filter={{ date: '2025-04', dimension: 'month', category: null }} />
      </MemoryRouter>,
    )

    expect(getHeaderText(container)).toContain('2025-04')
  })
})

