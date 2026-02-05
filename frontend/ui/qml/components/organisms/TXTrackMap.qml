import QtQuick 2.15
import QtQuick.Layouts 1.15
import "../molecules"

/*!
    TXTrackMap - Track Map Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.3
    
    Features:
    - Track centerline geometry
    - Car dots at sampled position (from playback time)
    - Team color per car
    - Hover tooltip with driver info
    - Click to select driver
    - Selected car highlighted
    - Optional: sector shading, DRS zones
    
    Usage:
        TXTrackMap {
            trackPoints: [{x: 100, y: 200}, ...]  // Track geometry
            cars: [
                {code: "VER", x: 150, y: 250, teamColor: "#3671C6", isSelected: true},
                {code: "HAM", x: 120, y: 220, teamColor: "#27F4D2", isSelected: false}
            ]
            onCarClicked: (code) => console.log("Car clicked:", code)
        }
*/

Rectangle {
    id: root
    
    // Public API
    property var trackPoints: []  // Array of {x, y} points for track centerline
    property var cars: []  // Array of {code, x, y, teamColor, isSelected, isCompare}
    property bool showSectors: false
    property var sectorMarks: []  // Array of {x,y,color,label}
    property var corners: [] // Array of {x,y,number}
    property bool showCarLabels: true
    property var drsZones: [] // Array of {points:[{x,y}...]}
    property bool showDRSZones: false
    property var dominanceZones: [] // Array of {startDistance,endDistance,driver,color}
    
    // Signals
    signal carClicked(string driverCode)
    signal trackClicked(real x, real y)
    signal rotateChanged(real degrees)
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    clip: true

    // Auto-scaling for raw track coordinates (backend geometry is not in pixels)
    property real minX: 0
    property real maxX: 1
    property real minY: 0
    property real maxY: 1
    property bool autoRotate: true
    property real baseRotationDeg: 0
    property real userRotationDeg: 0

    function _ptX(p) { return (p && p.x !== undefined) ? Number(p.x) : (p && p.length >= 2 ? Number(p[0]) : 0) }
    function _ptY(p) { return (p && p.y !== undefined) ? Number(p.y) : (p && p.length >= 2 ? Number(p[1]) : 0) }

    function recalcBounds() {
        if (!root.trackPoints || root.trackPoints.length === 0) {
            minX = 0; maxX = 1; minY = 0; maxY = 1
            baseRotationDeg = 0
            return
        }
        var mnX = 1e18, mxX = -1e18, mnY = 1e18, mxY = -1e18
        var meanX = 0, meanY = 0
        for (var i = 0; i < root.trackPoints.length; i++) {
            var p = root.trackPoints[i]
            var x = _ptX(p), y = _ptY(p)
            if (x < mnX) mnX = x
            if (x > mxX) mxX = x
            if (y < mnY) mnY = y
            if (y > mxY) mxY = y
            meanX += x
            meanY += y
        }
        if (mnX === mxX) { mnX -= 1; mxX += 1 }
        if (mnY === mxY) { mnY -= 1; mxY += 1 }
        minX = mnX; maxX = mxX; minY = mnY; maxY = mxY

        if (!root.autoRotate) {
            baseRotationDeg = 0
            return
        }
        // Auto-rotate to a top-down orientation using the principal axis
        var n = Math.max(1, root.trackPoints.length)
        meanX = meanX / n
        meanY = meanY / n
        var cxx = 0, cyy = 0, cxy = 0
        for (var j = 0; j < root.trackPoints.length; j++) {
            var q = root.trackPoints[j]
            var dx = _ptX(q) - meanX
            var dy = _ptY(q) - meanY
            cxx += dx * dx
            cyy += dy * dy
            cxy += dx * dy
        }
        var angle = 0
        if (n > 2) {
            angle = 0.5 * Math.atan2(2 * cxy, (cxx - cyy))
        }
        baseRotationDeg = -angle * 180 / Math.PI
    }

    function mapX(x) {
        var pad = 8
        var span = (maxX - minX)
        return pad + ((Number(x) - minX) / span) * Math.max(1, trackCanvas.width - pad * 2)
    }

    function mapY(y) {
        var pad = 8
        var span = (maxY - minY)
        return pad + ((maxY - Number(y)) / span) * Math.max(1, trackCanvas.height - pad * 2)
    }

    onTrackPointsChanged: { recalcBounds(); trackCanvas.requestPaint() }
    onCornersChanged: trackCanvas.requestPaint()
    onBaseRotationDegChanged: trackCanvas.requestPaint()
    onUserRotationDegChanged: trackCanvas.requestPaint()
    onShowDRSZonesChanged: trackCanvas.requestPaint()
    onCarsChanged: trackCanvas.requestPaint()
    onShowCarLabelsChanged: trackCanvas.requestPaint()
    onDominanceZonesChanged: trackCanvas.requestPaint()
    Component.onCompleted: recalcBounds()
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundRaised: "#141417"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color borderDefault: "#27272A"
            property color accentDefault: "#E10600"
            property color drsZone: "#22C55E"
        }
        property var typography: QtObject {
            property string mono: "Menlo"
        }
    }
    
    color: txTheme.colors.backgroundRaised
    border.color: txTheme.colors.borderDefault
    border.width: 1
    radius: 8
    
    Item {
        id: mapLayer
        anchors.fill: parent
        rotation: root.baseRotationDeg + root.userRotationDeg
        transformOrigin: Item.Center

        // Canvas for drawing track and cars
        Canvas {
            id: trackCanvas
            anchors.fill: parent
            anchors.margins: 20
            onWidthChanged: trackCanvas.requestPaint()
            onHeightChanged: trackCanvas.requestPaint()
            
            onPaint: {
                var ctx = getContext("2d")
                ctx.clearRect(0, 0, width, height)
                
                // Draw track centerline
                if (root.trackPoints.length > 1) {
                    // Outer (broad) stroke
                    ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.45)
                    ctx.lineWidth = 28
                    ctx.lineCap = "round"
                    ctx.lineJoin = "round"
                    
                    ctx.beginPath()
                    ctx.moveTo(root.mapX(root._ptX(root.trackPoints[0])), root.mapY(root._ptY(root.trackPoints[0])))
                    
                    for (var i = 1; i < root.trackPoints.length; i++) {
                        var p = root.trackPoints[i]
                        ctx.lineTo(root.mapX(root._ptX(p)), root.mapY(root._ptY(p)))
                    }
                    
                    ctx.stroke()

                    // Dominance overlay (compare laps)
                    if ((root.dominanceZones || []).length > 0) {
                        var totalDist = (root.trackPoints[root.trackPoints.length - 1].distance !== undefined)
                                         ? Number(root.trackPoints[root.trackPoints.length - 1].distance)
                                         : (root.trackPoints.length - 1)
                        for (var z = 0; z < root.dominanceZones.length; z++) {
                            var zone = root.dominanceZones[z] || {}
                            var startD = Number(zone.startDistance || 0)
                            var endD = Number(zone.endDistance || 0)
                            if (totalDist <= 0 || endD <= startD) continue
                            ctx.strokeStyle = zone.color || Qt.rgba(1, 1, 1, 0.7)
                        ctx.lineWidth = 12
                            ctx.lineCap = "round"
                            ctx.lineJoin = "round"
                            var started = false
                            ctx.beginPath()
                            for (var zz = 0; zz < root.trackPoints.length; zz++) {
                                var pz = root.trackPoints[zz]
                                var dist = (pz.distance !== undefined) ? Number(pz.distance) : zz
                                if (dist < startD) continue
                                if (dist > endD) break
                                var zx = root.mapX(root._ptX(pz))
                                var zy = root.mapY(root._ptY(pz))
                                if (!started) { ctx.moveTo(zx, zy); started = true }
                                else ctx.lineTo(zx, zy)
                            }
                            ctx.stroke()
                        }
                    }

                    // Inner (brighter) stroke
                    ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.95)
                    ctx.lineWidth = 18
                    ctx.beginPath()
                    ctx.moveTo(root.mapX(root._ptX(root.trackPoints[0])), root.mapY(root._ptY(root.trackPoints[0])))
                    for (var k = 1; k < root.trackPoints.length; k++) {
                        var p3 = root.trackPoints[k]
                        ctx.lineTo(root.mapX(root._ptX(p3)), root.mapY(root._ptY(p3)))
                    }
                    ctx.stroke()

                    // Start/finish marker (simple perpendicular tick at first point)
                    if (root.trackPoints.length > 2) {
                        var a = root.trackPoints[0]
                        var b = root.trackPoints[1]
                        var ax = root.mapX(root._ptX(a)), ay = root.mapY(root._ptY(a))
                        var bx = root.mapX(root._ptX(b)), by = root.mapY(root._ptY(b))
                        var dx = bx - ax, dy = by - ay
                        var len = Math.sqrt(dx * dx + dy * dy)
                        if (len > 0.0001) {
                            var nx = -dy / len, ny = dx / len
                            var half = 10
                            ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.85)
                            ctx.lineWidth = 4
                            ctx.beginPath()
                            ctx.moveTo(ax - nx * half, ay - ny * half)
                            ctx.lineTo(ax + nx * half, ay + ny * half)
                            ctx.stroke()
                        }
                    }
                }
                
                // Sector marks
                if ((root.sectorMarks || []).length > 0) {
                    for (var m = 0; m < root.sectorMarks.length; m++) {
                        var s = root.sectorMarks[m]
                        var sx = root.mapX(s.x)
                        var sy = root.mapY(s.y)
                        ctx.fillStyle = s.color || Qt.rgba(1, 1, 1, 0.9)
                        ctx.beginPath()
                        ctx.arc(sx, sy, 4, 0, Math.PI * 2)
                        ctx.fill()
                        if (s.label) {
                            ctx.fillStyle = Qt.rgba(1, 1, 1, 0.8)
                            ctx.font = "10px " + txTheme.typography.mono
                            ctx.fillText(String(s.label), sx + 6, sy - 6)
                        }
                    }
                }

                // Corner numbers
                if ((root.corners || []).length > 0) {
                    ctx.font = "10px " + txTheme.typography.mono
                    for (var c = 0; c < root.corners.length; c++) {
                        var cc = root.corners[c]
                        var cx = root.mapX(cc.x)
                        var cy = root.mapY(cc.y)
                        ctx.fillStyle = Qt.rgba(1, 1, 1, 0.2)
                        ctx.beginPath()
                        ctx.arc(cx, cy, 8, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.fillStyle = Qt.rgba(1, 1, 1, 0.8)
                        ctx.fillText(String(cc.number || ""), cx - 3, cy + 3)
                    }
                }

                // Draw DRS zones if enabled
                if (root.showDRSZones) {
                    ctx.strokeStyle = txTheme.colors.drsZone
                    ctx.lineWidth = 8
                    ctx.globalAlpha = 0.4

                    if ((root.drsZones || []).length > 0) {
                        for (var z = 0; z < root.drsZones.length; z++) {
                            var zone = root.drsZones[z]
                            var pts = zone.points || []
                            if (pts.length < 2) continue
                            ctx.beginPath()
                            ctx.moveTo(root.mapX(root._ptX(pts[0])), root.mapY(root._ptY(pts[0])))
                            for (var j = 1; j < pts.length; j++) {
                                var p2 = pts[j]
                                ctx.lineTo(root.mapX(root._ptX(p2)), root.mapY(root._ptY(p2)))
                            }
                            ctx.stroke()
                        }
                    }

                    ctx.globalAlpha = 1.0
                }

                // Draw cars in same coordinate space (respects rotation)
                if ((root.cars || []).length > 0) {
                    for (var i2 = 0; i2 < root.cars.length; i2++) {
                        var c2 = root.cars[i2]
                        if (!c2.teamColor) continue
                        var cx2 = root.mapX(c2.x)
                        var cy2 = root.mapY(c2.y)
                        var r = c2.isSelected ? 7 : 5
                        ctx.fillStyle = c2.teamColor
                        ctx.beginPath()
                        ctx.arc(cx2, cy2, r, 0, Math.PI * 2)
                        ctx.fill()
                        if (c2.isSelected) {
                            ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.9)
                            ctx.lineWidth = 2
                            ctx.beginPath()
                            ctx.arc(cx2, cy2, r + 2, 0, Math.PI * 2)
                            ctx.stroke()
                        }
                        if (root.showCarLabels) {
                            ctx.fillStyle = Qt.rgba(1, 1, 1, 0.85)
                            ctx.font = "10px " + txTheme.typography.mono
                            ctx.fillText(String(c2.code || ""), cx2 + 6, cy2 - 6)
                        }
                    }
                }
            }
        }
        
        // Car dots are drawn in Canvas to respect rotation.
    }
    
    // Click/drag handler for track background (rotate)
    MouseArea {
        anchors.fill: parent
        z: -1
        property real startX: 0
        property real startRot: 0
        onPressed: function(mouse) {
            startX = mouse.x
            startRot = root.userRotationDeg
        }
        onPositionChanged: function(mouse) {
            if (mouse.buttons & Qt.LeftButton) {
                root.userRotationDeg = startRot + (mouse.x - startX) * 0.2
                root.rotateChanged(root.userRotationDeg)
            }
        }
        onDoubleClicked: function() { root.userRotationDeg = 0 }
        onClicked: function(mouse) { root.trackClicked(mouse.x, mouse.y) }
    }
}
