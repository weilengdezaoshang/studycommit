import { vi } from 'vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

vi.mock('@umijs/max', () => ({
  history: {
    push: vi.fn(),
    replace: vi.fn(),
    location: { pathname: '/' },
    block: undefined,
  },
  useAccess: () => ({
    canView: true,
    canManageDraft: true,
    canPublish: true,
    canCompensate: true,
    canPublishPrice: true,
    canUpdateSwitch: true,
    canManageProvider: true,
    canManageRoles: true,
  }),
  useParams: () => ({ id: '33333333-3333-4333-8333-333333333333' }),
  useModel: () => ({ setInitialState: vi.fn() }),
}))
