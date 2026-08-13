import { AppProviders } from './core/AppProviders'
import { AppShell } from './core/AppShell'
import { AppErrorBoundary } from './components/AppErrorBoundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </AppErrorBoundary>
  )
}
