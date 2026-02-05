import QtQuick 2.15
import "../components/organisms"

/*!
    TimingView - Timing Tower + Track Map + Lap Info
    
    From Frontend_ArchitectureOverview.md Part 4, Section 2
    
    Layout:
    - Left: Timing Tower (60%)
    - Right: Track Map + Lap Info panels (40%)
*/

Rectangle {
    id: root
    color: theme.colors.backgroundBase

    function rowByCode(code) {
        var rows = rootStore.session.timingRows
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].code) === String(code)) return rows[i]
        }
        return null
    }

    function lastLapText() {
        var r = rowByCode(rootStore.driver.primaryDriver)
        return r ? ("Last lap: " + String(r.lastLap || "")) : ""
    }

    function weatherText() {
        var w = rootStore.session.weatherSnapshot || {}
        return (w && w.airTemp !== undefined)
              ? ("Air " + w.airTemp + "°C • Track " + w.trackTemp + "°C • Wind " + w.windSpeed + " m/s • " +
                 (Number(w.rainfall || 0) ? "Rain" : "Dry"))
              : ""
    }

    function fmt(v, digits) {
        var n = Number(v)
        if (isNaN(n)) return ""
        return n.toFixed(digits !== undefined ? digits : 1)
    }

    property int gutter: 16

    Item {
        anchors.fill: parent
        anchors.margins: gutter

        Row {
            anchors.fill: parent
            spacing: gutter

            // Left: Timing Tower (60%)
            TXPanelShell {
                id: timingPanel
                width: Math.max(0, Math.round((parent.width - gutter) * 0.6))
                height: parent.height
                title: "Broadcast View"
                status: rootStore.session.timingRows.length > 0 ? "live" : "stale"
                updatedText: rootStore.session.sessionName !== "" ? "playback" : ""

            panelContent: TXTimingTower {
                anchors.fill: parent
                drivers: rootStore.session.timingRows
                primaryDriver: rootStore.driver.primaryDriver
                compareDriver: rootStore.driver.compareDriver
                onDriverClicked: function(driverCode) { rootStore.driver.selectPrimaryDriver(driverCode) }
                onDriverCompareToggled: function(driverCode) { rootStore.driver.toggleCompareDriver(driverCode) }
            }
        }

            // Right: Track Map + Lap Info (40%)
            Column {
                width: Math.max(0, parent.width - timingPanel.width - gutter)
                height: parent.height
                spacing: gutter

                TXPanelShell {
                    id: trackPanel
                    width: parent.width
                    height: Math.max(0, Math.round((parent.height - gutter) * 0.6))
                    title: "Track Map"
                    status: rootStore.session.trackPoints.length > 0 ? "ready" : "stale"
                    updatedText: rootStore.session.sessionName !== "" ? "playback" : ""

                    panelContent: TXTrackMap {
                        anchors.fill: parent
                        autoRotate: rootStore.session.trackAutoRotate
                        userRotationDeg: rootStore.session.trackRotationDeg
                        trackPoints: rootStore.session.trackPoints
                        sectorMarks: rootStore.session.trackSectorMarks
                        drsZones: rootStore.session.trackDrsZones
                        showDRSZones: rootStore.session.trackDrsZones.length > 0
                        corners: rootStore.session.trackCorners
                        cars: rootStore.session.trackCars
                    }
                }

                TXPanelShell {
                    width: parent.width
                    height: Math.max(0, parent.height - trackPanel.height - gutter)
                    title: "Race Info"
                    status: "ready"

                    panelContent: Rectangle {
                        anchors.fill: parent
                        color: "transparent"

                        Column {
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 12

                            // Driver snapshot
                            Column {
                                width: parent.width
                                spacing: 4

                                Text {
                                    text: "Driver: " + rootStore.driver.primaryDriver
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                    color: theme.colors.foregroundPrimary
                                    visible: rootStore.driver.primaryDriver !== ""
                                }

                                Text {
                                    text: root.lastLapText()
                                    font.pixelSize: 12
                                    color: theme.colors.foregroundSecondary
                                    visible: root.rowByCode(rootStore.driver.primaryDriver) !== null
                                }

                                Text {
                                    text: (typeof playback !== "undefined")
                                          ? ("Lap: " + playback.currentLap + " / " + (rootStore.session.totalLaps || 0))
                                          : ""
                                    visible: typeof playback !== "undefined"
                                    font.pixelSize: 12
                                    color: theme.colors.foregroundTertiary
                                }
                            }

                            Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                            // Weather snapshot
                            Column {
                                width: parent.width
                                spacing: 4

                                Text { text: "Weather"; font.pixelSize: 12; color: theme.colors.foregroundTertiary }

                                Text {
                                    text: root.weatherText()
                                    font.pixelSize: 12
                                    color: theme.colors.foregroundSecondary
                                    elide: Text.ElideRight
                                    visible: !!(rootStore.session.weatherSnapshot && rootStore.session.weatherSnapshot.airTemp !== undefined)
                                }
                            }

                            Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                            // Race control (latest messages)
                            Column {
                                width: parent.width
                                spacing: 6
                                visible: !!(rootStore.session.raceControlLive && rootStore.session.raceControlLive.length > 0)

                                Text { text: "Race Control"; font.pixelSize: 12; color: theme.colors.foregroundTertiary }

                                Flickable {
                                    width: parent.width
                                    height: 90
                                    clip: true
                                    contentWidth: width
                                    contentHeight: rcCol.implicitHeight

                                    Column {
                                        id: rcCol
                                        width: parent.width
                                        spacing: 6

                                        Repeater {
                                            model: rootStore.session.raceControlLive

                                            delegate: Text {
                                                width: parent.width
                                                visible: !!(rootStore.session.raceControlLive
                                                          && rootStore.session.raceControlLive.length > 0
                                                          && index >= Math.max(0, rootStore.session.raceControlLive.length - 8))
                                                text: (modelData.time ? ("[" + modelData.time + "] ") : "") +
                                                      (modelData.flag ? (String(modelData.flag).toUpperCase() + " • ") : "") +
                                                      String(modelData.message || "")
                                                font.pixelSize: 11
                                                color: theme.colors.foregroundSecondary
                                                wrapMode: Text.WordWrap
                                            }
                                        }

                                        Item { visible: false }
                                    }
                                }
                            }

                            Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                            // Driver details (lap history)
                            Column {
                                width: parent.width
                                spacing: 6
                                visible: !!(rootStore.session.driverLapHistory && rootStore.driver.primaryDriver &&
                                           rootStore.session.driverLapHistory[rootStore.driver.primaryDriver] &&
                                           rootStore.session.driverLapHistory[rootStore.driver.primaryDriver].length > 0)

                                Text { text: "Driver Details"; font.pixelSize: 12; color: theme.colors.foregroundTertiary }

                                Flickable {
                                    width: parent.width
                                    height: 90
                                    clip: true
                                    contentWidth: width
                                    contentHeight: lapCol.implicitHeight

                                    Column {
                                        id: lapCol
                                        width: parent.width
                                        spacing: 4

                                        Repeater {
                                            model: {
                                                var code = rootStore.driver.primaryDriver
                                                var hist = (rootStore.session.driverLapHistory && code) ? rootStore.session.driverLapHistory[code] : []
                                                if (!hist || hist.length === 0) return []
                                                var tail = hist.slice(Math.max(0, hist.length - 6))
                                                return tail.reverse()
                                            }

                                            delegate: Text {
                                                width: parent.width
                                                text: "Lap " + (modelData.lapNumber || "") + " • " + (modelData.lapTime || "")
                                                font.pixelSize: 11
                                                color: theme.colors.foregroundSecondary
                                            }
                                        }

                                        Item { visible: false }
                                    }
                                }
                            }

                            Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                            // Driver insights (feature summaries)
                            Column {
                                width: parent.width
                                spacing: 6
                                visible: rootStore.session.driverSummary && rootStore.session.driverSummary.driver

                                Text { text: "Driver Insights"; font.pixelSize: 12; color: theme.colors.foregroundTertiary }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.lap_analysis || {}
                                        var secs = s.sector_times || []
                                        var secText = (secs.length === 3)
                                            ? ("S1 " + root.fmt(secs[0]) + " / S2 " + root.fmt(secs[1]) + " / S3 " + root.fmt(secs[2]))
                                            : ""
                                        var lap = s.last_lap_time || ""
                                        var pb = s.personal_best
                                        var sb = s.session_best
                                        var extras = (pb !== undefined || sb !== undefined)
                                            ? (" • PB " + root.fmt(pb, 3) + "s • SB " + root.fmt(sb, 3) + "s")
                                            : ""
                                        return lap ? ("Lap: " + lap + (secText ? " • " + secText : "") + extras) : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.driver_performance || {}
                                        var start = s.start_position
                                        var end = s.end_position
                                        var led = s.laps_led
                                        var pts = s.points
                                        var ovs = s.overtakes_made
                                        var pos = (start !== undefined && end !== undefined) ? ("P" + start + " → P" + end) : ""
                                        var extra = ""
                                        if (led !== undefined) extra += " • Laps led " + led
                                        if (pts !== undefined) extra += " • Pts " + pts
                                        if (ovs !== undefined) extra += " • Overtakes " + ovs
                                        return pos ? ("Performance: " + pos + extra) : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.tyre_analysis || {}
                                        var comp = s.current_compound || ""
                                        var life = s.tyre_life_remaining
                                        var deg = s.tyre_degradation_rate
                                        var pit = s.pit_stop_count
                                        var extra = ""
                                        if (life !== undefined) extra += " • Life " + root.fmt(life, 0) + " laps"
                                        if (deg !== undefined) extra += " • Deg " + root.fmt(deg, 3)
                                        if (pit !== undefined) extra += " • Pits " + root.fmt(pit, 0)
                                        return comp ? ("Tyre: " + comp + extra) : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.telemetry_analysis || {}
                                        var max = s.speed_max
                                        var avg = s.speed_avg
                                        var br = s.brake_avg
                                        var drs = s.drs_usage_pct
                                        var extra = ""
                                        if (br !== undefined) extra += " • Brake " + root.fmt(br, 2)
                                        if (drs !== undefined) extra += " • DRS " + root.fmt(drs * 100, 0) + "%"
                                        return (max !== undefined || avg !== undefined)
                                            ? ("Telemetry: Max " + root.fmt(max, 0) + " km/h • Avg " + root.fmt(avg, 0) + " km/h" + extra)
                                            : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.race_context || {}
                                        var status = s.track_status || ""
                                        var weather = s.weather || ""
                                        var wind = s.wind_speed
                                        var hum = s.humidity
                                        var extra = ""
                                        if (wind !== undefined) extra += " • Wind " + root.fmt(wind, 1) + " m/s"
                                        if (hum !== undefined) extra += " • Hum " + root.fmt(hum, 0) + "%"
                                        return (status || weather) ? ("Race: " + status + (weather ? (" • " + weather) : "") + extra) : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    text: {
                                        var s = rootStore.session.driverSummary.strategic_analysis || {}
                                        var pit = s.optimal_pit_window
                                        var traffic = s.traffic_time_lost
                                        var deg = s.tyre_degradation_rate
                                        var extra = ""
                                        if (deg !== undefined) extra += " • Deg " + root.fmt(deg, 3)
                                        return (pit !== undefined || traffic !== undefined)
                                            ? ("Strategy: Pit " + root.fmt(pit, 0) + " • Traffic " + root.fmt(traffic, 1) + "s" + extra)
                                            : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }

                                Text {
                                    visible: rootStore.session.driverSummary.comparison !== undefined
                                    text: {
                                        var c = rootStore.session.driverSummary.comparison || {}
                                        var delta = c.pace_delta_seconds
                                        var win = c.head_to_head_winner || ""
                                        return (delta !== undefined || win) ? ("Compare: Δ " + root.fmt(delta, 3) + "s • " + win) : ""
                                    }
                                    font.pixelSize: 11
                                    color: theme.colors.foregroundSecondary
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
