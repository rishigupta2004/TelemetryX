import QtQuick 2.15
import QtQuick.Layouts 1.15
import "../atoms"
import "../molecules"

/*!
    TXPanelShell - Universal Panel Container Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.3
    
    Header components:
    - Color bar (optional, left edge)
    - Title
    - Status pill (Live/Stale/Error)
    - "Updated" timestamp
    - Action buttons (Popout, Refresh, Settings)
    
    Content states: loading | empty | error | stale | ready
    
    Usage:
        TXPanelShell {
            title: "Timing Tower"
            status: "live"
            updatedText: "2s ago"
            
            content: Item {
                // Your content here
            }
        }
*/

Rectangle {
    id: root
    
    // Public API
    property string title: ""
    property string status: "ready"  // loading | ready | stale | error
    property string updatedText: ""
    property color accentColor: "transparent"
    // Hide non-functional header actions by default; enable per-panel when wired.
    property bool showPopout: false
    property bool showRefresh: false
    property bool showSettings: false
    
    // Content - set to your actual content component
    property var panelContent: null
    
    // Signals
    signal popoutClicked()
    signal refreshClicked()
    signal settingsClicked()
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundRaised: "#141417"
            property color backgroundBase: "#0D0D0F"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color foregroundTertiary: "#71717A"
            property color borderDefault: "#27272A"
            property color accentDefault: "#E10600"
            property color successDefault: "#22C55E"
            property color warningDefault: "#F59E0B"
            property color errorDefault: "#EF4444"
        }
    }
    
    // Main styling
    color: txTheme.colors.backgroundRaised
    border.color: txTheme.colors.borderDefault
    border.width: 1
    radius: 8
    
    // Layout
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 1  // Account for border
        spacing: 0
        
        // Header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            color: "transparent"
            
            // Accent color bar on left
            Rectangle {
                visible: root.accentColor !== "transparent"
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 4
                radius: root.radius
                color: root.accentColor
                
                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    anchors.leftMargin: parent.radius
                    color: parent.color
                }
            }
            
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: root.accentColor !== "transparent" ? 16 : 16
                anchors.rightMargin: 12
                spacing: 12
                
                // Title
                Text {
                    text: root.title
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    color: txTheme.colors.foregroundPrimary
                    Layout.alignment: Qt.AlignVCenter
                }
                
                Item { Layout.fillWidth: true }
                
                // Status badge
                TXBadge {
                    visible: root.status !== "ready"
                    text: root.status === "live" ? "LIVE" : 
                          root.status === "stale" ? "STALE" : 
                          root.status === "error" ? "ERROR" : ""
                    colorScheme: root.status === "live" ? "success" : 
                                 root.status === "stale" ? "warning" : "error"
                    variant: root.status === "live" ? "solid" : "subtle"
                    dot: root.status === "live"
                    Layout.alignment: Qt.AlignVCenter
                }
                
                // Updated timestamp
                Text {
                    visible: root.updatedText !== ""
                    text: "Updated: " + root.updatedText
                    font.pixelSize: 11
                    color: txTheme.colors.foregroundTertiary
                    Layout.alignment: Qt.AlignVCenter
                }
                
                // Action buttons
                Row {
                    spacing: 4
                    Layout.alignment: Qt.AlignVCenter
                    
                    // Popout button
                    Rectangle {
                        visible: root.showPopout
                        width: 28
                        height: 28
                        radius: 4
                        color: popoutMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                        
                        Text {
                            anchors.centerIn: parent
                            text: "↗"
                            font.pixelSize: 14
                            color: txTheme.colors.foregroundSecondary
                        }
                        
                        MouseArea {
                            id: popoutMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            onClicked: root.popoutClicked()
                        }
                    }
                    
                    // Refresh button
                    Rectangle {
                        visible: root.showRefresh
                        width: 28
                        height: 28
                        radius: 4
                        color: refreshMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                        
                        Text {
                            anchors.centerIn: parent
                            text: "⟳"
                            font.pixelSize: 14
                            color: txTheme.colors.foregroundSecondary
                        }
                        
                        MouseArea {
                            id: refreshMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            onClicked: root.refreshClicked()
                        }
                    }
                    
                    // Settings button
                    Rectangle {
                        visible: root.showSettings
                        width: 28
                        height: 28
                        radius: 4
                        color: settingsMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                        
                        Text {
                            anchors.centerIn: parent
                            text: "⚙"
                            font.pixelSize: 14
                            color: txTheme.colors.foregroundSecondary
                        }
                        
                        MouseArea {
                            id: settingsMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            onClicked: root.settingsClicked()
                        }
                    }
                }
            }
            
            // Header divider
            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: txTheme.colors.borderDefault
            }
        }
        
        // Content area
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            
            // Loading state
            Rectangle {
                visible: root.status === "loading"
                anchors.fill: parent
                color: root.color
                
                Column {
                    anchors.centerIn: parent
                    spacing: 12
                    
                    // Spinner
                    Rectangle {
                        width: 32
                        height: 32
                        radius: 16
                        color: "transparent"
                        border.color: txTheme.colors.accentDefault
                        border.width: 3
                        anchors.horizontalCenter: parent.horizontalCenter
                        
                        RotationAnimation on rotation {
                            loops: Animation.Infinite
                            from: 0
                            to: 360
                            duration: 1000
                        }
                        
                        Rectangle {
                            anchors.fill: parent
                            anchors.margins: 4
                            radius: parent.radius - 4
                            color: parent.parent.parent.color
                        }
                    }
                    
                    Item { visible: false }
                }
            }
            
            // Error state
            Rectangle {
                visible: root.status === "error"
                anchors.fill: parent
                color: root.color
                
                Column {
                    anchors.centerIn: parent
                    spacing: 12
                    
                    Text {
                        text: "⚠"
                        font.pixelSize: 32
                        color: txTheme.colors.errorDefault
                        anchors.horizontalCenter: parent.horizontalCenter
                    }
                    
                    Text {
                        text: "Error loading data"
                        font.pixelSize: 14
                        color: txTheme.colors.foregroundPrimary
                        anchors.horizontalCenter: parent.horizontalCenter
                    }
                    
                    TXButton {
                        text: "Retry"
                        variant: "secondary"
                        size: "sm"
                        anchors.horizontalCenter: parent.horizontalCenter
                        onClicked: root.refreshClicked()
                    }
                }
            }
            
            // Empty state
            Rectangle { visible: false }
            
            // Actual content
            Item {
                visible: root.status !== "loading" && root.status !== "error"
                anchors.fill: parent
                anchors.margins: 12
                
                children: root.panelContent ? [root.panelContent] : []
            }
        }
    }
}
