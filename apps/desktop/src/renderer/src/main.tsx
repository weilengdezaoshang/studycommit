import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { observeSystemTheme } from './theme/css-variables'
import './styles.css'

const stopObservingTheme = observeSystemTheme(
  document.documentElement.style,
  window.matchMedia('(prefers-color-scheme: dark)'),
)
window.addEventListener('beforeunload', stopObservingTheme, { once: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
