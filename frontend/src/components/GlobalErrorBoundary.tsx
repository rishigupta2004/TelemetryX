import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

const MAX_RETRIES = 3

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, retryCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[GlobalErrorBoundary] Uncaught error:', error, errorInfo)
  }

  private handleRetry = (): void => {
    if (this.state.retryCount < MAX_RETRIES) {
      this.setState(prev => ({ 
        hasError: false, 
        error: null, 
        errorInfo: null, 
        retryCount: prev.retryCount + 1 
      }))
    }
  }

  private handleReset = (): void => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      retryCount: 0 
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } }
      const isDev = typeof import.meta !== 'undefined' && Boolean(meta.env?.DEV)
      const canRetry = this.state.retryCount < MAX_RETRIES

      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-bg-void p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl text-red-400">
            ⚠
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-red-300">
              Application Error
            </div>
            <div className="mt-2 text-sm text-fg-muted">
              {canRetry 
                ? `An unexpected error occurred. Attempt ${this.state.retryCount + 1} of ${MAX_RETRIES}.`
                : 'Maximum retry attempts reached. Please refresh the application.'}
            </div>
            {isDev && this.state.error?.message && (
              <div className="mt-4 max-w-2xl break-all text-left font-mono text-xs text-red-300/70">
                <div className="font-semibold">Error:</div>
                <div className="whitespace-pre-wrap">{this.state.error.message}</div>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <div className="mt-2 font-semibold">Stack:</div>
                    <div className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {canRetry && (
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg border border-border-hard bg-bg-panel px-6 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-bg-elevated"
            >
              {canRetry ? 'Dismiss' : 'Refresh'}
            </button>
          </div>
          {isDev && (
            <div className="text-[10px] text-red-400/40">Check DevTools Console for full stack trace</div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
