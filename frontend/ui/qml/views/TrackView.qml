import QtQuick 2.15
import QtQuick.Controls 2.15
import "../components/organisms"

/*!
    TrackView (minimal)
    - Uses real track geometry + positions from backend (rootStore.session.trackPoints/trackCars)
*/

Rectangle {
    color: theme.colors.backgroundBase
    property int gutter: 16

    Item {
        anchors.fill: parent
        anchors.margins: gutter

        Column {
            anchors.fill: parent
            spacing: gutter

            Row {
                spacing: 12
                Text { text: "Rotate"; color: theme.colors.foregroundSecondary; font.pixelSize: 12 }
                Slider {
                    width: 220
                    from: -180
                    to: 180
                    value: rootStore.session.trackRotationDeg
                    onValueChanged: rootStore.setTrackRotationDeg(value)
                }
                Text {
                    text: Math.round(rootStore.session.trackRotationDeg) + "°"
                    color: theme.colors.foregroundTertiary
                    font.pixelSize: 11
                }
            }

            TXPanelShell {
                id: mapPanel
                width: parent.width
                height: Math.max(320, Math.round(parent.height * 0.7))
                title: "Track Map"
                status: rootStore.session.trackPoints.length > 0 ? "live" : "stale"
                updatedText: "playback"

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
                    onCarClicked: function(code) { rootStore.driver.selectPrimaryDriver(code) }
                }
            }

            TXPanelShell {
                width: parent.width
                height: Math.max(180, parent.height - mapPanel.height - gutter)
                title: "Top 10"
                status: "ready"

                panelContent: ListView {
                    anchors.fill: parent
                    clip: true
                    model: rootStore.session.timingRows

                    delegate: Rectangle {
                        visible: (index < 10)
                        width: ListView.view ? ListView.view.width : 0
                        height: 30
                        color: Qt.rgba(1, 1, 1, 0.02)

                        Row {
                            anchors.fill: parent
                            anchors.margins: 10
                            spacing: 10

                            Text { text: String(modelData.position || ""); color: theme.colors.foregroundTertiary; font.pixelSize: 12; width: 22 }
                            Text { text: String(modelData.code || ""); color: theme.colors.foregroundPrimary; font.pixelSize: 12; width: 40 }
                            Text { text: String(modelData.lastLap || ""); color: theme.colors.foregroundSecondary; font.pixelSize: 12 }
                        }

                        MouseArea { anchors.fill: parent; onClicked: rootStore.driver.selectPrimaryDriver(String(modelData.code || "")) }
                    }
                }
            }
        }
    }
}
