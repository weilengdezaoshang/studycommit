import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  OfflineBanner,
  Screen,
  TextField,
} from '../src/components'

describe('component public exports', () => {
  it('exports the complete RN-002 public surface', () => {
    expect(
      [
        AppText,
        Button,
        Card,
        EmptyState,
        ErrorState,
        IconButton,
        LoadingState,
        OfflineBanner,
        Screen,
        TextField,
      ].every(Boolean),
    ).toBe(true)
  })
})
