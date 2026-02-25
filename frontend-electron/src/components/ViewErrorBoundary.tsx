import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  viewName: string
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: unknown): void {
    console.error(`[ViewErrorBoundary] ${this.props.viewName} crashed:`, error, info)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-400">
            ⚠
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-red-300">
              {this.props.fallbackMessage || `${this.props.viewName} failed to render`}
            </div>
            {isDev && this.state.error?.message && (
              <div className="mt-2 max-w-xl break-all text-center font-mono text-xs text-red-300/70">
                {this.state.error.message}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
          >
            Retry
          </button>
          {isDev && (
            <div className="text-[10px] text-red-400/40">Check DevTools Console for full stack trace</div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
