import type { ReactNode } from 'react'
import React from 'react'
import { ViewErrorBoundary } from '../../components/ViewErrorBoundary'
import { EmptyState } from '../../components/EmptyState'

export type ViewState = 'idle' | 'loading' | 'ready' | 'error' | 'empty'

export interface BaseViewProps {
  children: ReactNode
  title?: string
  subtitle?: string
  state?: ViewState
  loadingMessage?: string
  errorMessage?: string
  emptyMessage?: string
  emptyDetail?: string
  className?: string
  errorBoundary?: boolean
  errorBoundaryName?: string
}

const DefaultLoading = ({ message }: { message?: string }) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState title={message || 'Loading...'} variant="loading" />
  </div>
)

const DefaultError = ({ message }: { message?: string }) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState title="Error" detail={message} variant="error" />
  </div>
)

const DefaultEmpty = ({ message, detail }: { message?: string; detail?: string }) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState title={message || 'No data'} detail={detail} variant="muted" />
  </div>
)

export const BaseView = React.memo(function BaseView({
  children,
  title,
  subtitle,
  state = 'ready',
  loadingMessage,
  errorMessage,
  emptyMessage,
  emptyDetail,
  className = '',
  errorBoundary = true,
  errorBoundaryName
}: BaseViewProps) {
  const renderHeader = () => {
    if (!title) return null
    return (
      <div className="bg-bg-surface border border-border-hard px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">{title}</div>
        {subtitle && <div className="mt-1 text-xl font-semibold text-fg-primary">{subtitle}</div>}
      </div>
    )
  }

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return <DefaultLoading message={loadingMessage} />
      case 'error':
        return <DefaultError message={errorMessage} />
      case 'empty':
        return <DefaultEmpty message={emptyMessage} detail={emptyDetail} />
      case 'ready':
      case 'idle':
      default:
        return <>{children}</>
    }
  }

  const content = renderContent()

  if (errorBoundary && errorBoundaryName) {
    return (
      <div className={`flex h-full min-h-0 flex-col ${className}`}>
        {renderHeader()}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ViewErrorBoundary viewName={errorBoundaryName}>
            {content}
          </ViewErrorBoundary>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {renderHeader()}
      <div className="min-h-0 flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  )
})

export { ViewErrorBoundary }
export { EmptyState }
