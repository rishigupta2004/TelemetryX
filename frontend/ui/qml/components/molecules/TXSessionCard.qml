import QtQuick 2.15
import QtQuick.Layouts 1.15
import "../atoms"

/*!
    TXSessionCard - Session Card Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.2
    
    Shows: Flag icon | Session name | Date/time | Status | Lap count | Winner
    States: default | hover | selected | loading
    
    Usage:
        TXSessionCard {
            sessionName: "Bahrain Grand Prix"
            sessionType: "Race"
            date: "2024-03-02"
            time: "15:00 UTC"
            status: "completed"
            lapCount: 57
            winner: "VER"
            state: "selected"
            onClicked: console.log("Session selected")
        }
*/

Rectangle {
    id: root
    
    // Public API
    property string sessionName: ""
    property string sessionType: ""
    property string date: ""
    property string time: ""
    property string status: "completed"  // completed | live | upcoming | cancelled
    property int lapCount: 0
    property string winner: ""
    property string state: "default"  // default | hover | selected
    
    // Signals
    signal clicked()
    
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
            property color borderEmphasis: "#3F3F46"
            property color accentDefault: "#E10600"
            property color successDefault: "#22C55E"
            property color warningDefault: "#F59E0B"
        }
    }
    
    // State styling
    property color backgroundColor: {
        if (state === "selected") return txTheme.colors.backgroundElevated
        return txTheme.colors.backgroundRaised
    }
    
    property color borderColor: {
        if (state === "selected") return txTheme.colors.borderEmphasis
        if (mouseArea.containsMouse) return txTheme.colors.borderDefault
        return "transparent"
    }
    
    // Sizing
    implicitWidth: 320
    implicitHeight: contentColumn.implicitHeight + 24
    radius: 8
    
    color: backgroundColor
    border.color: borderColor
    border.width: 1
    
    Behavior on color {
        ColorAnimation { duration: 100 }
    }
    
    // Content
    Column {
        id: contentColumn
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8
        
        // Header row: Flag + Name + Status
        Row {
            spacing: 8
            width: parent.width
            
            // Flag icon
            Text {
                text: "🏁"
                font.pixelSize: 16
                anchors.verticalCenter: parent.verticalCenter
            }
            
            // Session name and type
            Column {
                spacing: 2
                
                Text {
                    text: root.sessionName
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    color: txTheme.colors.foregroundPrimary
                }
                
                Text {
                    text: root.sessionType + " · " + root.date + " · " + root.time
                    font.pixelSize: 12
                    color: txTheme.colors.foregroundSecondary
                }
            }
            
            Item { Layout.fillWidth: true }
            
            // Status badge
            TXBadge {
                anchors.verticalCenter: parent.verticalCenter
                text: root.status === "completed" ? "Completed" : 
                      root.status === "live" ? "LIVE" :
                      root.status === "upcoming" ? "Upcoming" : "Cancelled"
                colorScheme: root.status === "completed" ? "neutral" :
                             root.status === "live" ? "success" :
                             root.status === "upcoming" ? "info" : "error"
                variant: root.status === "live" ? "solid" : "subtle"
                dot: root.status === "live"
            }
        }
        
        // Stats row
        Row {
            spacing: 16
            
            // Lap count
            Row {
                spacing: 4
                
                Text {
                    text: root.lapCount.toString()
                    font.pixelSize: 13
                    font.weight: Font.Medium
                    font.family: theme.typography.mono
                    color: txTheme.colors.foregroundPrimary
                }
                
                Text {
                    text: "Laps"
                    font.pixelSize: 11
                    color: txTheme.colors.foregroundTertiary
                }
            }
            
            // Winner
            Row {
                spacing: 4
                visible: root.winner !== ""
                
                Text {
                    text: "Winner:"
                    font.pixelSize: 11
                    color: txTheme.colors.foregroundTertiary
                }
                
                Text {
                    text: root.winner
                    font.pixelSize: 13
                    font.weight: Font.Medium
                    font.family: theme.typography.mono
                    color: txTheme.colors.foregroundPrimary
                }
            }
        }
    }
    
    // Hover/Click handler
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        hoverEnabled: true
        onClicked: root.clicked()
        onEntered: if (root.state === "default") root.state = "hover"
        onExited: if (root.state === "hover") root.state = "default"
    }
}
