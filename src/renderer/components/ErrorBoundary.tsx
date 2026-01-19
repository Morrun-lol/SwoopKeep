import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-900 h-screen overflow-auto">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <div className="bg-white p-4 rounded shadow mb-4">
            <h2 className="font-bold text-red-600 mb-2">{this.state.error?.toString()}</h2>
            <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>
          <button 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
