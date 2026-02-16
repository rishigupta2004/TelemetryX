import React from 'react'
import { PitStrategy } from '../components/PitStrategy'

export const StrategyView = React.memo(function StrategyView() {
  return (
    <div className="h-full flex flex-col p-3 gap-3">
      <div className="flex-1 min-h-0">
        <PitStrategy />
      </div>
    </div>
  )
})
