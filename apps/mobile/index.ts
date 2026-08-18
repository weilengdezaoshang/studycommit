import { registerRootComponent } from 'expo'
import { installMobileUuidProvider } from './src/infrastructure/crypto/install-mobile-uuid-provider'
import App from './src/App'

installMobileUuidProvider()
registerRootComponent(App)
