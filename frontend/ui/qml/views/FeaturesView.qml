import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15
import "../components/organisms"

Rectangle {
    id: root
    color: theme.colors.backgroundBase
    property int gutter: 16
    property real playbackTime: (typeof playback !== "undefined") ? Number(playback.currentTime || 0) : 0
    property int playbackLap: (typeof playback !== "undefined") ? Number(playback.currentLap || 0) : 0

    function primaryCode() { return String(rootStore.driver.primaryDriver || "") }

    function driverMeta(code) {
        var drivers = rootStore.driver.allDrivers || []
        for (var i = 0; i < drivers.length; i++) {
            if (String(drivers[i].code) === String(code)) return drivers[i]
        }
        return {}
    }

    function driverColor(code) {
        return (driverMeta(code).teamColor || "")
    }

    function timingRow(code) {
        var rows = rootStore.session.timingRows || []
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].code) === String(code)) return rows[i]
        }
        return null
    }

    function lapHistory(code) {
        var hist = rootStore.session.driverLapHistory || {}
        return hist[code] || []
    }

    function fmtLapSeconds(s) {
        var n = Number(s)
        if (isNaN(n) || n <= 0) return "—"
        var m = Math.floor(n / 60)
        var r = (n - m * 60).toFixed(3)
        return m + ":" + (r.length < 6 ? ("0" + r) : r)
    }

    function positionSeries() {
        var rows = rootStore.session.timingRows || []
        var hist = rootStore.session.driverLapHistory || {}
        var series = []
        var maxLap = 0
        var top = rows.slice(0, 8)
        for (var i = 0; i < top.length; i++) {
            var code = String(top[i].code || "")
            var laps = hist[code] || []
            var pts = []
            for (var j = 0; j < laps.length; j++) {
                var lap = laps[j] || {}
                if (lap.lapNumber && lap.position) {
                    pts.push({ lap: Number(lap.lapNumber), pos: Number(lap.position) })
                    if (Number(lap.lapNumber) > maxLap) maxLap = Number(lap.lapNumber)
                }
            }
            if (pts.length > 1) {
                series.push({ code: code, color: driverColor(code), points: pts })
            }
        }
        return { series: series, maxLap: maxLap }
    }

    function tyreRows() {
        var rows = rootStore.session.tyreStints || []
        var out = []
        var total = Math.max(1, Number(rootStore.session.totalLaps || 0))
        var seen = {}
        for (var i = 0; i < rows.length; i++) {
            var s = rows[i] || {}
            var code = String(s.code || "")
            if (!code) continue
            if (!seen[code]) {
                seen[code] = []
                out.push({ code: code, stints: seen[code] })
            }
            seen[code].push({
                compound: String(s.compound || ""),
                first: Number(s.firstLap || 0),
                last: Number(s.lastLap || 0),
                total: total
            })
        }
        return out.slice(0, 8)
    }

    function sectorText(row) {
        if (!row || !row.sectors || row.sectors.length < 3) return "—"
        return "S1 " + Number(row.sectors[0]).toFixed(2) +
               "  S2 " + Number(row.sectors[1]).toFixed(2) +
               "  S3 " + Number(row.sectors[2]).toFixed(2)
    }

    function currentStint(code) {
        var stints = rootStore.session.tyreStints || []
        if (!stints.length) return null
        var lap = Number(playbackLap || 0)
        var best = null
        for (var i = 0; i < stints.length; i++) {
            var s = stints[i]
            if (String(s.code) !== String(code)) continue
            if (lap > 0 && lap >= Number(s.firstLap) && lap <= Number(s.lastLap)) return s
            best = s
        }
        return best
    }

    function telemetryPrimary() {
        var snap = rootStore.session.telemetrySnapshot || {}
        return snap.primary || {}
    }

    function weather() {
        return rootStore.session.weatherSnapshot || {}
    }

    function raceControlLatest() {
        var rc = rootStore.session.raceControlLive || []
        if (!rc.length) return null
        return rc[rc.length - 1]
    }

    function featureKeys() {
        var feats = (rootStore.session.featuresSummary && rootStore.session.featuresSummary.features)
                   ? rootStore.session.featuresSummary.features : {}
        var keys = Object.keys(feats || {})
        keys.sort()
        return keys
    }

    function ensureDefault() {
        var keys = featureKeys()
        if (!rootStore.session.featuresActiveType && keys.length > 0) {
            rootStore.loadFeatureData(keys[0])
        }
    }

    function isRowLive(row) {
        if (!row) return false
        if (row.timestamp !== undefined) return Number(row.timestamp) <= playbackTime
        if (row.lap !== undefined) return Number(row.lap) <= playbackLap
        if (row.lap_number !== undefined) return Number(row.lap_number) <= playbackLap
        return true
    }

    function filteredRows() {
        var rows = rootStore.session.featuresData || []
        var out = []
        for (var i = 0; i < rows.length; i++) {
            if (isRowLive(rows[i])) out.push(rows[i])
        }
        return out
    }

    Component.onCompleted: ensureDefault()

    Connections {
        target: rootStore.session
        function onFeaturesSummaryChanged() { root.ensureDefault() }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: gutter
        spacing: gutter

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            columns: 2
            columnSpacing: gutter
            rowSpacing: gutter

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 140
                title: "Lap Analysis"
                panelContent: ColumnLayout {
                    spacing: 6
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Last lap"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text { text: (timingRow(primaryCode()) || {}).lastLap || "—"; font.pixelSize: 12; color: theme.colors.foregroundPrimary }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Sectors"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text { text: sectorText(timingRow(primaryCode())); font.pixelSize: 12; color: theme.colors.foregroundSecondary }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 180
                title: "Position Changes"
                panelContent: Canvas {
                    anchors.fill: parent
                    anchors.margins: 10
                    onPaint: {
                        var ctx = getContext("2d")
                        ctx.clearRect(0, 0, width, height)
                        var pack = positionSeries()
                        var series = pack.series || []
                        var maxLap = pack.maxLap || 1
                        if (series.length === 0) return
                        var pad = 16
                        var w = Math.max(1, width - pad * 2)
                        var h = Math.max(1, height - pad * 2)
                        ctx.strokeStyle = Qt.rgba(1,1,1,0.12)
                        ctx.lineWidth = 1
                        ctx.strokeRect(pad, pad, w, h)
                        for (var i = 0; i < series.length; i++) {
                            var s = series[i]
                            var pts = s.points || []
                            if (pts.length < 2) continue
                            ctx.strokeStyle = s.color || Qt.rgba(1,1,1,0.6)
                            ctx.lineWidth = 1.5
                            ctx.beginPath()
                            for (var j = 0; j < pts.length; j++) {
                                var p = pts[j]
                                var x = pad + (Number(p.lap) / maxLap) * w
                                var y = pad + (1 - (Number(p.pos) / 20.0)) * h
                                if (j === 0) ctx.moveTo(x, y)
                                else ctx.lineTo(x, y)
                            }
                            ctx.stroke()
                        }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 180
                title: "Tyre Strategy"
                panelContent: ColumnLayout {
                    spacing: 6
                    Repeater {
                        model: tyreRows()
                        delegate: RowLayout {
                            Layout.fillWidth: true
                            spacing: 6
                            Text {
                                text: String(modelData.code || "")
                                font.pixelSize: 10
                                color: theme.colors.foregroundSecondary
                                Layout.preferredWidth: 30
                            }
                            Rectangle {
                                Layout.fillWidth: true
                                height: 8
                                radius: 4
                                color: Qt.rgba(1,1,1,0.08)
                                border.color: theme.colors.borderDefault
                                border.width: 1
                                Row {
                                    anchors.fill: parent
                                    spacing: 0
                                    Repeater {
                                        model: modelData.stints || []
                                        delegate: Rectangle {
                                            height: parent.height
                                            width: Math.max(2, (Number(modelData.last || 0) - Number(modelData.first || 0)) / Number(modelData.total || 1) * parent.width)
                                            color: modelData.compound === "SOFT" ? "#E11D48"
                                                   : modelData.compound === "MEDIUM" ? "#F59E0B"
                                                   : modelData.compound === "HARD" ? "#E5E7EB"
                                                   : "#64748B"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 140
                title: "Telemetry Analysis"
                panelContent: ColumnLayout {
                    spacing: 6
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Speed"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: telemetryPrimary().speed !== undefined ? (Number(telemetryPrimary().speed).toFixed(1) + " km/h") : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundPrimary
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Throttle"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: telemetryPrimary().throttle !== undefined ? (Number(telemetryPrimary().throttle).toFixed(0) + "%") : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundSecondary
                        }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 140
                title: "Race Context"
                panelContent: ColumnLayout {
                    spacing: 6
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Weather"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: (weather().airTemp !== undefined)
                                  ? (weather().airTemp + "°C / " + weather().trackTemp + "°C")
                                  : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundPrimary
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Race control"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: raceControlLatest()
                                  ? (String(raceControlLatest().flag || "") + " " + String(raceControlLatest().message || "").slice(0, 32))
                                  : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundSecondary
                            elide: Text.ElideRight
                        }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 140
                title: "Strategic Analysis"
                panelContent: ColumnLayout {
                    spacing: 6
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Undercut"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: (rootStore.session.undercutPrediction && rootStore.session.undercutPrediction.result)
                                  ? (rootStore.session.undercutPrediction.result.success_probability * 100).toFixed(0) + "%"
                                  : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundPrimary
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Confidence"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: (rootStore.session.undercutPrediction && rootStore.session.undercutPrediction.result)
                                  ? String(rootStore.session.undercutPrediction.result.confidence || "")
                                  : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundSecondary
                        }
                    }
                }
            }

            TXPanelShell {
                Layout.fillWidth: true
                Layout.preferredHeight: 140
                title: "Comparison"
                panelContent: ColumnLayout {
                    spacing: 6
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Compare"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: rootStore.session.telemetryCompareEnabled
                                  ? (rootStore.driver.primaryDriver + " vs " + rootStore.driver.compareDriver)
                                  : "Off"
                            font.pixelSize: 12
                            color: theme.colors.foregroundPrimary
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "Δ telemetry"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: rootStore.session.telemetryCompareEnabled
                                  ? (rootStore.session.telemetryDelta.toFixed(3) + "s")
                                  : "—"
                            font.pixelSize: 12
                            color: theme.colors.foregroundSecondary
                        }
                    }
                }
            }
        }

        TXPanelShell {
            Layout.fillWidth: true
            Layout.preferredHeight: 220
            title: "Live Feature Feed"
            status: "live"

            panelContent: ColumnLayout {
                anchors.fill: parent
                spacing: 8

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10
                    Text { text: "Dataset"; font.pixelSize: 11; color: theme.colors.foregroundTertiary }
                    ComboBox {
                        Layout.preferredWidth: 160
                        model: featureKeys()
                        currentIndex: Math.max(0, model.indexOf(String(rootStore.session.featuresActiveType)))
                        onActivated: function(index) { rootStore.loadFeatureData(String(model[index])) }
                    }
                    Item { Layout.fillWidth: true }
                    Text {
                        text: rootStore.session.featuresActiveType !== "" ? "Live" : ""
                        font.pixelSize: 11
                        color: theme.colors.accentDefault
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 8

                    Repeater {
                        model: filteredRows().slice(0, 6)
                        delegate: Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 90
                            radius: 8
                            color: theme.colors.backgroundElevated
                            border.color: theme.colors.borderDefault
                            border.width: 1

                            Column {
                                anchors.fill: parent
                                anchors.margins: 10
                                spacing: 4
                                Text {
                                    text: String(modelData.driver_name || modelData.driver || modelData.driver_1 || modelData.race_name || "Row")
                                    font.pixelSize: 12
                                    font.weight: Font.DemiBold
                                    color: theme.colors.foregroundPrimary
                                }
                                Text {
                                    text: (function() {
                                        var keys = ["lap_number","lap","position","gap","delta","overtake_count","pit_stop_count","tyre_compound"]
                                        var parts = []
                                        for (var i = 0; i < keys.length; i++) {
                                            var k = keys[i]
                                            if (modelData[k] !== undefined) parts.push(k + ": " + modelData[k])
                                            if (parts.length >= 3) break
                                        }
                                        if (parts.length === 0) parts.push("updated")
                                        return parts.join(" • ")
                                    })()
                                    font.pixelSize: 10
                                    color: theme.colors.foregroundSecondary
                                    elide: Text.ElideRight
                                    wrapMode: Text.NoWrap
                                }
                            }
                        }
                    }

                    Text {
                        visible: filteredRows().length === 0
                        text: "No feature data loaded."
                        font.pixelSize: 12
                        color: theme.colors.foregroundTertiary
                    }
                }
            }
        }
    }
}
