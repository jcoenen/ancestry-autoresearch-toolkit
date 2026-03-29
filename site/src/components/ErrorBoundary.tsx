import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-stone-800 mb-4">
          {this.props.fallbackTitle || 'Something went wrong'}
        </h2>
        <p className="text-stone-500 mb-2">
          This page encountered an error while rendering.
        </p>
        {this.state.error && (
          <pre className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-left text-xs text-red-700 overflow-auto max-h-40">
            {this.state.error.message}
          </pre>
        )}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg bg-stone-800 text-white text-sm hover:bg-stone-700 transition-colors"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="px-4 py-2 rounded-lg border border-stone-300 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }
}
