import { HashRouter } from 'react-router'
import { AppRoutes } from './AppRouter'

export function App(): React.JSX.Element {
  return <HashRouter><AppRoutes /></HashRouter>
}
