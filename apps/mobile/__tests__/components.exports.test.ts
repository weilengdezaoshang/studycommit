import {
  AppText,
  Button,
  Card,
  Dialog,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  OfflineBanner,
  Screen,
  TextField,
  useDialog,
} from '../src/components'

describe('component public exports', () => {
  it('exports the complete RN-002 public surface', () => {
    expect(
      [
        AppText,
        Button,
        Card,
        Dialog,
        Dropdown,
        EmptyState,
        ErrorState,
        IconButton,
        LoadingState,
        OfflineBanner,
        Screen,
        TextField,
        useDialog,
      ].every(Boolean),
    ).toBe(true)
  })
})
