import React from 'react'
import { TrackMap } from '../components/TrackMap'
import { ViewErrorBoundary } from '../components/ViewErrorBoundary'

export const TrackView = React.memo(function TrackView() {
  return (
    <div className="flex h-full min-h-0 flex-col p-3 xl:p-4">
      <div className="glass-panel relative min-h-0 min-w-0 flex-1 rounded-2xl p-2.5">
        <ViewErrorBoundary viewName="Track Map">
          <TrackMap />
        </ViewErrorBoundary>
      </div>
    </div>
  )
})
