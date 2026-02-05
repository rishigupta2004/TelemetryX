import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15
import "../components/organisms"
import "../components/atoms"

/*!
    TelemetryView - Telemetry Charts + Track Map + Delta Chart
    
    From Frontend_ArchitectureOverview.md Part 4, Section 3
    
    Layout:
    - Top: Telemetry Charts (Speed, Throttle, Brake, Gear) (60%)
    - Bottom: Track Map + Delta Chart (40%)
*/

Rectangle {
    id: root
    color: theme.colors.backgroundBase

    property int gutter: 16
    property bool showTrackOverlay: false
    property var chartDefs: ([
        { key: "speed", title: "Speed (km/h)", yMin: 0, yMax: 360 },
        { key: "throttle", title: "Throttle (%)", yMin: 0, yMax: 100 },
        { key: "brake", title: "Brake (%)", yMin: 0, yMax: 100 },
        { key: "gear", title: "Gear", yMin: 0, yMax: 8 }
    ])

    function driverModel() {
        var out = []
        var drivers = rootStore.driver.allDrivers || []
        for (var i = 0; i < drivers.length; i++) {
            var d = drivers[i] || {}
            out.push({ label: String(d.code || ""), code: String(d.code || ""), name: String(d.name || "") })
        }
        return out
    }

    function segmentModel() {
        return rootStore.session.telemetrySegments || []
    }

    function lapModel(code, segment) {
        var catalog = rootStore.session.telemetryLapCatalog || {}
        var entry = catalog[code] || {}
        var laps = []
        if (segment && entry.segments && entry.segments[segment]) laps = entry.segments[segment]
        else if (entry.laps) laps = entry.laps
        var out = []
        for (var i = 0; i < laps.length; i++) {
            var lap = laps[i] || {}
            out.push({
                label: "Lap " + lap.lapNumber + " • " + (lap.lapTime || ""),
                lapNumber: lap.lapNumber
            })
        }
        return out
    }

    function lapIndex(code, segment, lapNumber) {
        var laps = lapModel(code, segment)
        for (var i = 0; i < laps.length; i++) {
            if (Number(laps[i].lapNumber) === Number(lapNumber)) return i
        }
        return 0
    }

    function driverIndex(model, code) {
        for (var i = 0; i < model.length; i++) {
            if (String(model[i].code) === String(code)) return i
        }
        return 0
    }

    Item {
        anchors.fill: parent
        anchors.margins: gutter

        Row {
            anchors.top: parent.top
            anchors.right: parent.right
            spacing: 8
            z: 5

            TXButton {
                text: root.showTrackOverlay ? "Hide Track" : "Show Track"
                size: "sm"
                variant: "secondary"
                onClicked: root.showTrackOverlay = !root.showTrackOverlay
            }
        }

        TXPanelShell {
            id: chartsPanel
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            height: parent.height
            title: "Telemetry Charts"
            status: "ready"

            panelContent: ColumnLayout {
                anchors.fill: parent
                spacing: 8

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10

                    Text {
                        text: "Primary"
                        font.pixelSize: 11
                        color: theme.colors.foregroundTertiary
                        Layout.alignment: Qt.AlignVCenter
                    }

                    ComboBox {
                        id: primaryDriverCombo
                        Layout.preferredWidth: 90
                        model: root.driverModel()
                        textRole: "label"
                        currentIndex: root.driverIndex(model, rootStore.driver.primaryDriver)
                        onActivated: function(index) {
                            var code = model[index].code
                            rootStore.driver.selectPrimaryDriver(code)
                            rootStore.reloadTelemetry()
                            if (rootStore.session.telemetrySegments.length > 0) {
                                rootStore.selectTelemetryPrimarySegment(rootStore.session.telemetryPrimarySegment || rootStore.session.telemetrySegments[0])
                            }
                        }
                    }

                    ComboBox {
                        Layout.preferredWidth: 70
                        visible: rootStore.session.telemetryLapModeAvailable && rootStore.session.telemetrySegments.length > 0
                        model: root.segmentModel()
                        currentIndex: Math.max(0, rootStore.session.telemetrySegments.indexOf(rootStore.session.telemetryPrimarySegment))
                        onActivated: function(index) {
                            rootStore.selectTelemetryPrimarySegment(model[index])
                        }
                    }

                    ComboBox {
                        Layout.preferredWidth: 160
                        visible: rootStore.session.telemetryLapModeAvailable
                        model: root.lapModel(rootStore.driver.primaryDriver, rootStore.session.telemetryPrimarySegment)
                        textRole: "label"
                        currentIndex: root.lapIndex(
                            rootStore.driver.primaryDriver,
                            rootStore.session.telemetryPrimarySegment,
                            (rootStore.session.telemetryPrimaryLap || {}).lapNumber
                        )
                        onActivated: function(index) {
                            var lap = model[index]
                            if (lap) rootStore.selectTelemetryPrimaryLap(lap.lapNumber)
                        }
                    }

                    Item { Layout.fillWidth: true }

                    TXButton {
                        visible: rootStore.session.telemetryLapModeAvailable
                        text: rootStore.session.telemetryCompareEnabled ? "Compare: ON" : "Compare"
                        size: "sm"
                        variant: rootStore.session.telemetryCompareEnabled ? "primary" : "secondary"
                        onClicked: rootStore.setTelemetryCompareEnabled(!rootStore.session.telemetryCompareEnabled)
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10
                    visible: rootStore.session.telemetryCompareEnabled && rootStore.session.telemetryLapModeAvailable

                    Text {
                        text: "Compare"
                        font.pixelSize: 11
                        color: theme.colors.foregroundTertiary
                        Layout.alignment: Qt.AlignVCenter
                    }

                    ComboBox {
                        Layout.preferredWidth: 90
                        model: root.driverModel()
                        textRole: "label"
                        currentIndex: root.driverIndex(model, rootStore.driver.compareDriver)
                        onActivated: function(index) {
                            var code = model[index].code
                            rootStore.driver.selectCompareDriver(code)
                            rootStore.reloadTelemetry()
                            if (rootStore.session.telemetrySegments.length > 0) {
                                rootStore.selectTelemetryCompareSegment(rootStore.session.telemetryCompareSegment || rootStore.session.telemetrySegments[0])
                            }
                        }
                    }

                    ComboBox {
                        Layout.preferredWidth: 70
                        visible: rootStore.session.telemetrySegments.length > 0
                        model: root.segmentModel()
                        currentIndex: Math.max(0, rootStore.session.telemetrySegments.indexOf(rootStore.session.telemetryCompareSegment))
                        onActivated: function(index) {
                            rootStore.selectTelemetryCompareSegment(model[index])
                        }
                    }

                    ComboBox {
                        Layout.preferredWidth: 160
                        model: root.lapModel(rootStore.driver.compareDriver, rootStore.session.telemetryCompareSegment)
                        textRole: "label"
                        currentIndex: root.lapIndex(
                            rootStore.driver.compareDriver,
                            rootStore.session.telemetryCompareSegment,
                            (rootStore.session.telemetryCompareLap || {}).lapNumber
                        )
                        onActivated: function(index) {
                            var lap = model[index]
                            if (lap) rootStore.selectTelemetryCompareLap(lap.lapNumber)
                        }
                    }

                    Text {
                        Layout.alignment: Qt.AlignVCenter
                        text: rootStore.session.telemetryDelta !== 0
                              ? ("Δ " + rootStore.session.telemetryDelta.toFixed(3) + "s"
                                 + (rootStore.session.telemetryDeltaDistance > 0
                                    ? (" • " + (rootStore.session.telemetryDeltaDistance / 1000.0).toFixed(2) + " km")
                                    : ""))
                              : ""
                        font.pixelSize: 11
                        color: theme.colors.foregroundSecondary
                    }
                }

                Repeater {
                    model: root.chartDefs
                    TXLineChart {
                        Layout.fillWidth: true
                        Layout.preferredHeight: Math.max(120, (chartsPanel.height - 24) / 4)
                        windowData: rootStore.session.telemetryWindow
                        metric: modelData.key
                        title: modelData.title
                        yMin: modelData.yMin
                        yMax: modelData.yMax
                        smoothWindow: 5
                        colorA: "#22C55E"
                        colorB: "#60A5FA"
                    }
                }

                Item { Layout.fillWidth: true; visible: false }
            }
        }

        // Floating track overlay (toggle)
        TXPanelShell {
            visible: root.showTrackOverlay
            width: 360
            height: 240
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            title: "Track"
            status: "live"

            panelContent: TXTrackMap {
                anchors.fill: parent
                autoRotate: rootStore.session.trackAutoRotate
                userRotationDeg: rootStore.session.trackRotationDeg
                trackPoints: rootStore.session.trackPoints
                sectorMarks: rootStore.session.trackSectorMarks
                drsZones: rootStore.session.trackDrsZones
                showDRSZones: rootStore.session.trackDrsZones.length > 0
                corners: rootStore.session.trackCorners
                dominanceZones: rootStore.session.telemetryDominanceZones
                cars: rootStore.session.telemetryLapMode ? rootStore.session.telemetryTrackCars : rootStore.session.trackCars
                showCarLabels: false
            }
        }
    }
}
