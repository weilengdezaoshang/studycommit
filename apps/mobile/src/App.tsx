import { useFonts } from 'expo-font'
import notebookFont from '../assets/notebook/StudyCommitCasual-UI.ttf'
import drawerFont from '../assets/notebook/DrawerWenkai-Regular.ttf'
import { AppProviders } from './core/AppProviders'
import { AppShell } from './core/AppShell'
import { AppErrorBoundary } from './components/AppErrorBoundary'

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    NotebookHand: notebookFont,
    NotebookDrawer: drawerFont,
  })
  if (!fontsLoaded && !fontError) {
    return null
  }
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </AppErrorBoundary>
  )
}
