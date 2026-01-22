import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../../src/renderer/components/Layout'

describe('Layout safe-area', () => {
  it('applies pt-safe-50 to main content container', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/voice']}>
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>,
    )

    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect(main?.className).toContain('pt-safe-50')
  })
})

