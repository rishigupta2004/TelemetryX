import QtQuick 2.15

/*!
  TXLineChart (minimal)
  - Draws a simple line chart using Canvas
  - Expects `windowData` shaped like SessionStore.telemetryWindow
*/

Rectangle {
    id: root

    property var windowData: ({})
    property string metric: "speed"
    property string title: ""
    property color colorA: "#22C55E"
    property color colorB: "#60A5FA"
    property real yMin: 0
    property real yMax: 100
    property int smoothWindow: 3

    color: theme.colors.backgroundBase
    border.color: theme.colors.borderDefault
    border.width: 1
    radius: 6

    function arr(o, key) {
        if (!o) return []
        var v = o[key]
        return (v && v.length !== undefined) ? v : []
    }

    function num(x, fallback) {
        var n = Number(x)
        return isNaN(n) ? (fallback || 0) : n
    }
    
    function smooth(values) {
        var win = Math.max(1, root.smoothWindow)
        if (!values || values.length <= 2 || win <= 1) return values || []
        var out = []
        for (var i = 0; i < values.length; i++) {
            var sum = 0
            var n = 0
            var a = Math.max(0, i - Math.floor(win / 2))
            var b = Math.min(values.length - 1, i + Math.floor(win / 2))
            for (var j = a; j <= b; j++) {
                sum += root.num(values[j], 0)
                n++
            }
            out.push(sum / Math.max(1, n))
        }
        return out
    }

    onWindowDataChanged: chart.requestPaint()
    onMetricChanged: chart.requestPaint()
    onWidthChanged: chart.requestPaint()
    onHeightChanged: chart.requestPaint()

    Text {
        anchors.left: parent.left
        anchors.leftMargin: 10
        anchors.top: parent.top
        anchors.topMargin: 8
        text: title
        font.pixelSize: 11
        color: theme.colors.foregroundTertiary
        z: 2
    }

    Canvas {
        id: chart
        anchors.fill: parent
        anchors.margins: 8

        onPaint: {
            var ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)

            var w = root.windowData || {}
            var winS = root.num(w.windowS, 0)
            if (winS <= 0) return

            var pad = 18
            var x0 = pad
            var y0 = pad
            var wPlot = Math.max(1, width - pad * 2)
            var hPlot = Math.max(1, height - pad * 2)

            // axes + grid
            ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.12)
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x0, y0)
            ctx.lineTo(x0, y0 + hPlot)
            ctx.lineTo(x0 + wPlot, y0 + hPlot)
            ctx.stroke()

            ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.06)
            ctx.lineWidth = 1
            for (var g = 1; g <= 3; g++) {
                var yy = y0 + (hPlot * g / 4)
                ctx.beginPath()
                ctx.moveTo(x0, yy)
                ctx.lineTo(x0 + wPlot, yy)
                ctx.stroke()
            }

            // axis labels
            ctx.fillStyle = Qt.rgba(1, 1, 1, 0.45)
            ctx.font = "10px " + theme.typography.mono
            var yMid = (root.yMin + root.yMax) / 2
            ctx.fillText(String(root.yMax), x0 + 4, y0 + 10)
            ctx.fillText(String(Math.round(yMid)), x0 + 4, y0 + hPlot / 2 + 4)
            ctx.fillText(String(root.yMin), x0 + 4, y0 + hPlot - 2)

            var tMid = (winS / 2).toFixed(1)
            ctx.fillText("0.0s", x0, y0 + hPlot + 12)
            ctx.fillText(tMid + "s", x0 + wPlot / 2 - 10, y0 + hPlot + 12)
            ctx.fillText(winS.toFixed(1) + "s", x0 + wPlot - 24, y0 + hPlot + 12)

            function drawLine(tArr, yArr, stroke) {
                if (!tArr || !yArr || tArr.length < 2) return
                var ys = root.smooth(yArr)
                var spanY = (root.yMax - root.yMin)
                if (spanY === 0) spanY = 1
                ctx.strokeStyle = stroke
                ctx.lineWidth = 2
                ctx.lineJoin = "round"
                ctx.lineCap = "round"
                ctx.beginPath()
                for (var i = 0; i < tArr.length; i++) {
                    var tx = root.num(tArr[i], 0)
                    var vy = root.num(ys[i], root.yMin)
                    var px = x0 + (tx / winS) * wPlot
                    var py = y0 + (1 - ((vy - root.yMin) / spanY)) * hPlot
                    if (i === 0) ctx.moveTo(px, py)
                    else ctx.lineTo(px, py)
                }
                ctx.stroke()
            }

            var primary = w.primary
            var compare = w.compare
            drawLine(root.arr(primary, "t"), root.arr(primary, root.metric), root.colorA)
            drawLine(root.arr(compare, "t"), root.arr(compare, root.metric), root.colorB)

            // Current-time marker at center of window
            ctx.strokeStyle = Qt.rgba(1, 1, 1, 0.2)
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x0 + wPlot / 2, y0)
            ctx.lineTo(x0 + wPlot / 2, y0 + hPlot)
            ctx.stroke()
        }
    }
}
