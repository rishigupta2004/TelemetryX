import React from 'react'
import { FiaDocumentsView } from '../FiaDocumentsView'

export function FiaDocsPanel() {
  return (
    <section className="bg-gradient-to-br from-bg-surface/80 to-bg-surface/60 border border-border-hard/50 min-h-[980px] feature-card" style={{ borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
      <FiaDocumentsView />
    </section>
  )
}
