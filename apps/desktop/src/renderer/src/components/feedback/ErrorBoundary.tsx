import React from 'react'
import { ErrorFallback } from './ErrorFallback'

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
