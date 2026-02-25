const fs = require('fs')

let code = fs.readFileSync('frontend-electron/src/components/TrackMap.tsx', 'utf-8')

// Add useEffect and useRef
code = code.replace("import React, { useMemo, useState } from 'react'", "import React, { useMemo, useState, useEffect, useRef } from 'react'")

// Export pitLanePoints
code = code.replace(
  "pitLanePolylinePoints =\\n      pitLanePoints.length >= 2 ? toPolylinePoints(pitLanePoints) : null",
  "pitLanePolylinePoints =\n      pitLanePoints.length >= 2 ? toPolylinePoints(pitLanePoints) : null"
)
code = code.replace(
  "return {\n      points,\n      trackLookup,\n      mainPolylinePoints,",
  "return {\n      points,\n      trackLookup,\n      mainPolylinePoints,\n      pitLanePoints,"
)

// Add segment to drsPolylines
code = code.replace(
  "zone,\n        points: segment.length >= 2 ? toPolylinePoints(segment) : null,\n        midPoint",
  "zone,\n        segment,\n        points: segment.length >= 2 ? toPolylinePoints(segment) : null,\n        midPoint"
)

// Replace TrackMap rendering component body
const trackMapRegex = /export function TrackMap\(\{ compact = false \}: TrackMapProps\) \{([\s\S]*)/
const body = code.match(trackMapRegex)[1]

// ... actually it might be easier to just overwrite the file entirely with a complete script.
fs.writeFileSync('rewrite-test.log', 'ok')
