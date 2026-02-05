import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "../atoms"
import "../molecules"

/*!
    TXTimingTower - Timing Tower Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.3
    
    Features:
    - Sticky header
    - Virtualized rows (20 drivers max)
    - Column sorting
    - Row selection (click to select primary, Ctrl+click for compare)
    - Team color bar per row
    - Sector time color coding (green/purple/yellow)
    - Position change animation
    
    Usage:
        TXTimingTower {
            drivers: [
                {position: 1, code: "VER", name: "Verstappen", teamColor: "#3671C6", 
                 gap: 0, interval: 0, lastLap: "1:32.456", sectors: [1, 1, 1]}
            ]
            onDriverClicked: (code) => console.log("Clicked:", code)
            onDriverCompareToggled: (code) => console.log("Compare:", code)
        }
*/

Rectangle {
    id: root
    
    // Public API
    property var drivers: []
    property string primaryDriver: ""
    property string compareDriver: ""
    property string sortColumn: "position"
    property bool sortAscending: true
    
    // Signals
    signal driverClicked(string driverCode)
    signal driverCompareToggled(string driverCode)
    signal sortRequested(string column)
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundRaised: "#141417"
            property color backgroundElevated: "#222228"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color foregroundTertiary: "#71717A"
            property color borderDefault: "#27272A"
            property color timingSessionBest: "#A855F7"
            property color timingPersonalBest: "#22C55E"
            property color warningDefault: "#F59E0B"
        }
    }
    
    // Row height
    property int rowHeight: 40
    property int headerHeight: 32
    
    color: txTheme.colors.backgroundRaised
    border.color: txTheme.colors.borderDefault
    border.width: 0
    
    ColumnLayout {
        anchors.fill: parent
        spacing: 0
        
        // Header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: root.headerHeight
            color: txTheme.colors.backgroundElevated
            border.color: txTheme.colors.borderDefault
            border.width: 1
            z: 1  // Keep above rows
            
            Row {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                spacing: 0
                
                // POS column
                HeaderCell {
                    width: 40
                    text: "POS"
                    sortable: true
                    isSorted: root.sortColumn === "position"
                    isAscending: root.sortAscending
                    onClicked: root.sortRequested("position")
                }
                
                // DRIVER column
                HeaderCell {
                    width: 140
                    text: "DRIVER"
                    sortable: true
                    isSorted: root.sortColumn === "code"
                    isAscending: root.sortAscending
                    onClicked: root.sortRequested("code")
                }
                
                // GAP column
                HeaderCell {
                    width: 70
                    text: "GAP"
                    sortable: true
                    isSorted: root.sortColumn === "gap"
                    isAscending: root.sortAscending
                    onClicked: root.sortRequested("gap")
                }
                
                // INT column
                HeaderCell {
                    width: 70
                    text: "INT"
                    sortable: true
                    isSorted: root.sortColumn === "interval"
                    isAscending: root.sortAscending
                    onClicked: root.sortRequested("interval")
                }
                
                // LAST column
                HeaderCell {
                    width: 80
                    text: "LAST"
                    sortable: true
                    isSorted: root.sortColumn === "lastLap"
                    isAscending: root.sortAscending
                    onClicked: root.sortRequested("lastLap")
                }
                
                // Sectors column
                HeaderCell {
                    width: 70
                    text: "S1-3"
                    sortable: false
                }
            }
        }
        
        // Drivers list
        ListView {
            id: driverList
            Layout.fillWidth: true
            Layout.fillHeight: true
            model: root.drivers
            clip: true
            
            delegate: Rectangle {
                width: ListView.view.width
                height: root.rowHeight
                color: {
                    if (modelData.code === root.primaryDriver) return Qt.rgba(0.21, 0.44, 0.78, 0.2)
                    if (modelData.code === root.compareDriver) return txTheme.colors.backgroundElevated
                    if (index % 2 === 0) return "transparent"
                    return Qt.rgba(1, 1, 1, 0.02)
                }
                
                // Team color bar
                Rectangle {
                    anchors.left: parent.left
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    width: 3
                    color: modelData.teamColor
                    opacity: 0.8
                    visible: modelData.teamColor !== undefined && modelData.teamColor !== ""
                }
                
                Row {
                    anchors.fill: parent
                    anchors.leftMargin: 16
                    anchors.rightMargin: 16
                    spacing: 0
                    
                    // Position
                    Text {
                        width: 40
                        height: parent.height
                        verticalAlignment: Text.AlignVCenter
                        text: modelData.position
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        font.family: theme.typography.mono
                        color: {
                            if (modelData.code === root.primaryDriver) return txTheme.colors.foregroundPrimary
                            return txTheme.colors.foregroundSecondary
                        }
                    }
                    
                    // Driver name
                    Text {
                        width: 140
                        height: parent.height
                        verticalAlignment: Text.AlignVCenter
                        text: modelData.name
                        font.pixelSize: 13
                        color: {
                            if (modelData.code === root.primaryDriver) return txTheme.colors.foregroundPrimary
                            return txTheme.colors.foregroundSecondary
                        }
                        elide: Text.ElideRight
                    }
                    
                    // Gap
                    TXGapIndicator {
                        width: 70
                        height: parent.height
                        type: modelData.gapType || "gap"
                        value: modelData.gap
                        isLeader: modelData.isLeader
                    }
                    
                    // Interval
                    TXGapIndicator {
                        width: 70
                        height: parent.height
                        type: modelData.intervalType || "interval"
                        value: modelData.interval
                    }
                    
                    // Last lap time
                    Text {
                        width: 80
                        height: parent.height
                        verticalAlignment: Text.AlignVCenter
                        text: modelData.lastLap || ""
                        font.pixelSize: 13
                        font.family: theme.typography.mono
                        color: {
                            if (modelData.lastLapStatus === "sessionBest") return txTheme.colors.timingSessionBest
                            if (modelData.lastLapStatus === "personalBest") return txTheme.colors.timingPersonalBest
                            return txTheme.colors.foregroundSecondary
                        }
                    }
                    
                    // Sector indicators
                    Row {
                        width: 70
                        height: parent.height
                        spacing: 4
                        visible: modelData.sectors && modelData.sectors.length > 0
                        
                        Repeater {
                            model: modelData.sectors || []
                            
                            Text {
                                width: 22
                                height: 16
                                verticalAlignment: Text.AlignVCenter
                                horizontalAlignment: Text.AlignHCenter
                                text: {
                                    var n = Number(modelData)
                                    return isNaN(n) ? "" : n.toFixed(3)
                                }
                                font.pixelSize: 10
                                font.family: theme.typography.mono
                                color: txTheme.colors.foregroundSecondary
                            }
                        }
                    }
                }
                
                // Click handler
                MouseArea {
                    anchors.fill: parent
                    onClicked: function(mouse) {
                        if (mouse.modifiers & Qt.ControlModifier) {
                            root.driverCompareToggled(modelData.code)
                        } else {
                            root.driverClicked(modelData.code)
                        }
                    }
                }
                
                // Divider
                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    height: 1
                    color: txTheme.colors.borderDefault
                    opacity: 0.5
                }
            }
        }
    }
    
    // Header cell component
    component HeaderCell: Item {
        property string text: ""
        property bool sortable: false
        property bool isSorted: false
        property bool isAscending: true
        signal clicked()
        
        height: parent.height
        
        Text {
            anchors.verticalCenter: parent.verticalCenter
            text: parent.text + (parent.sortable && parent.isSorted ? (parent.isAscending ? " ▲" : " ▼") : "")
            font.pixelSize: 11
            font.weight: Font.Bold
            color: txTheme.colors.foregroundTertiary
        }
        
        MouseArea {
            anchors.fill: parent
            enabled: parent.sortable
            onClicked: parent.clicked()
        }
    }
}
