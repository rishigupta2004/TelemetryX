import QtQuick 2.15
import "../components/organisms"

/*!
    CompareView (minimal)
    - Real data: last-lap time + delta from rootStore.session.timingRows
    - Telemetry: shows snapshot values from playback sync
*/

Rectangle {
    color: theme.colors.backgroundBase
    property int gutter: 16

    function rowByCode(code) {
        var rows = rootStore.session.timingRows
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].code) === String(code)) return rows[i]
        }
        return null
    }

    function deltaSeconds(a, b) {
        var ra = rowByCode(a)
        var rb = rowByCode(b)
        if (!ra || !rb) return null
        return (ra.lastLapSeconds || 0) - (rb.lastLapSeconds || 0)
    }

    Item {
        anchors.fill: parent
        anchors.margins: gutter

        Column {
            anchors.fill: parent
            spacing: gutter

            TXPanelShell {
                id: header
                width: parent.width
                height: 120
                title: "Comparison"
                status: "ready"

                panelContent: Column {
                    anchors.fill: parent
                    spacing: 10

                    Text {
                        text: rootStore.driver.primaryDriver && rootStore.driver.compareDriver
                              ? (rootStore.driver.primaryDriver + " vs " + rootStore.driver.compareDriver)
                              : ""
                        color: theme.colors.foregroundPrimary
                        font.pixelSize: 16
                        font.weight: Font.DemiBold
                        visible: rootStore.driver.primaryDriver && rootStore.driver.compareDriver
                    }

                    Text {
                        text: (rootStore.driver.primaryDriver && rootStore.driver.compareDriver && deltaSeconds(rootStore.driver.primaryDriver, rootStore.driver.compareDriver) !== null)
                              ? ("Last lap delta: " + deltaSeconds(rootStore.driver.primaryDriver, rootStore.driver.compareDriver).toFixed(3) + "s")
                              : ""
                        color: theme.colors.foregroundSecondary
                        font.pixelSize: 12
                        visible: rootStore.driver.primaryDriver && rootStore.driver.compareDriver
                    }
                }
            }

            TXPanelShell {
                width: parent.width
                height: Math.max(240, parent.height - header.height - gutter)
                title: "Telemetry Snapshot"
                status: "ready"
                updatedText: "playback"

                panelContent: Column {
                    id: snapPanel
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 10

                    property var snap: rootStore.session.telemetrySnapshot || ({})
                    property var a: snap.primary || null
                    property var b: snap.compare || null

                    function fmt(v, suffix) {
                        if (v === undefined || v === null) return ""
                        var n = Number(v)
                        if (!isNaN(n)) return (suffix ? (String(n) + suffix) : String(n))
                        return String(v)
                    }

                    Text {
                        width: parent.width
                        wrapMode: Text.WordWrap
                        color: theme.colors.foregroundTertiary
                        font.pixelSize: 11
                        text: (rootStore.driver.primaryDriver && rootStore.driver.compareDriver)
                              ? ("Primary: " + rootStore.driver.primaryDriver + " • Compare: " + rootStore.driver.compareDriver)
                              : ""
                        visible: rootStore.driver.primaryDriver && rootStore.driver.compareDriver
                    }

                    Column {
                        width: parent.width
                        spacing: 8

                        Repeater {
                            model: [
                                { key: "speed", label: "Speed", suffix: " km/h" },
                                { key: "throttle", label: "Throttle", suffix: "%" },
                                { key: "brake", label: "Brake", suffix: "%" },
                                { key: "gear", label: "Gear", suffix: "" },
                                { key: "rpm", label: "RPM", suffix: "" },
                                { key: "drs", label: "DRS", suffix: "" }
                            ]

                            delegate: Row {
                                width: parent.width
                                spacing: 12

                                Text {
                                    width: 80
                                    text: modelData.label
                                    color: theme.colors.foregroundTertiary
                                    font.pixelSize: 12
                                }
                                Text {
                                    width: 140
                                    text: snapPanel.fmt(snapPanel.a ? snapPanel.a[modelData.key] : null, modelData.suffix)
                                    color: theme.colors.foregroundSecondary
                                    font.pixelSize: 12
                                }
                                Text {
                                    width: 140
                                    text: snapPanel.fmt(snapPanel.b ? snapPanel.b[modelData.key] : null, modelData.suffix)
                                    color: theme.colors.foregroundSecondary
                                    font.pixelSize: 12
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
