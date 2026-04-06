import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/**
 * コンポーネントテスト用のレンダーヘルパー
 * MemoryRouter でラップし、userEvent インスタンスも返す
 */
export function renderPage(Component, { route = '/' } = {}) {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <Component />
    </MemoryRouter>
  )
  return { user, ...result }
}
