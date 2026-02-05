import QtQuick 2.15
import QtQuick.Layouts 1.15
import "components/atoms"
import "components/molecules"

/*!
    Sidebar - Application Sidebar
    
    From Frontend_ArchitectureOverview.md Part 4, Section 1.2
    
    Width: 280px expanded, 64px collapsed
    
    Sections:
    - Search input
    - Navigation (Timing, Telemetry, Track, Compare, Strategy)
    - Primary Driver chip
    - Compare Driver chip (optional)
    - All Drivers list
    - Settings button
*/

Rectangle {
    id: root
    
    // Allow hover-expand overlay without stealing layout space.
    property bool hoverExpanded: false
    property bool isExpanded: rootStore.ui.sidebarOpen || hoverExpanded

    width: isExpanded ? 280 : 64
    color: theme.colors.backgroundRaised
    border.color: theme.colors.borderDefault
    border.width: 1
    
    Behavior on width {
        NumberAnimation { duration: 200; easing.type: Easing.OutCubic }
    }
    
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 24
        
        // Search input (icon only when collapsed)
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 32
            color: theme.colors.backgroundBase
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 6
            visible: root.isExpanded
            
            Row {
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 12
                spacing: 8
                
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "🔍"
                    font.pixelSize: 14
                    color: theme.colors.foregroundSecondary
                }
                
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "Search drivers..."
                    font.pixelSize: 12
                    color: theme.colors.foregroundTertiary
                }
            }
        }
        
        // Collapsed search icon
        Rectangle {
            visible: !root.isExpanded
            width: 32
            height: 32
            radius: 6
            color: theme.colors.backgroundBase
            border.color: theme.colors.borderDefault
            border.width: 1
            Layout.alignment: Qt.AlignHCenter
            
            Text {
                anchors.centerIn: parent
                text: "🔍"
                font.pixelSize: 14
                color: theme.colors.foregroundSecondary
            }
        }
        
        // Navigation
        Column {
            spacing: 8
            Layout.fillWidth: true
            
            Text {
                visible: root.isExpanded
                text: "NAVIGATION"
                font.pixelSize: 10
                font.bold: true
                color: theme.colors.foregroundSecondary
            }
            
            // Navigation items
            Column {
                spacing: 4
                
                Repeater {
                    model: [
                        { icon: "📡", label: "Broadcast", view: "timing" },
                        { icon: "📈", label: "Telemetry", view: "telemetry" },
                        { icon: "🗺", label: "Track", view: "track" },
                        { icon: "🎯", label: "Strategy", view: "strategy" },
                        { icon: "🧩", label: "Features", view: "features" }
                    ]
                    
                    delegate: Rectangle {
                        width: root.isExpanded ? root.width - 32 : 40
                        height: 36
                        color: rootStore.ui.activeView === modelData.view ? 
                               theme.colors.backgroundElevated : "transparent"
                        radius: 6
                        
                        Row {
                            anchors.fill: parent
                            anchors.leftMargin: root.isExpanded ? 12 : 10
                            spacing: 12
                            
                            Text {
                                text: modelData.icon
                                font.pixelSize: 14
                                anchors.verticalCenter: parent.verticalCenter
                            }
                            
                            Text {
                                visible: root.isExpanded
                                text: modelData.label
                                font.pixelSize: 13
                                color: rootStore.ui.activeView === modelData.view ? 
                                       theme.colors.foregroundPrimary : theme.colors.foregroundSecondary
                                anchors.verticalCenter: parent.verticalCenter
                            }
                        }
                        
                        MouseArea {
                            anchors.fill: parent
                            onClicked: rootStore.ui.switchView(modelData.view)
                        }
                    }
                }
            }
        }
        
        // Drivers section
        Column {
            spacing: 8
            Layout.fillWidth: true
            visible: root.isExpanded
                     && rootStore.driver.allDrivers.length > 0
                     && (rootStore.ui.activeView === "telemetry")
            
            Text {
                text: "DRIVERS"
                font.pixelSize: 10
                font.bold: true
                color: theme.colors.foregroundSecondary
            }
            
            // Primary Driver
            Column {
                spacing: 4
                visible: rootStore.driver.primaryDriver !== ""
                
                Text {
                    text: "Primary"
                    font.pixelSize: 10
                    color: theme.colors.foregroundTertiary
                }
                
                TXDriverChip {
                    driverCode: rootStore.driver.primaryDriver
                    driverName: rootStore.driver.getDriverByCode(rootStore.driver.primaryDriver)?.name || ""
                    teamColor: rootStore.driver.getDriverByCode(rootStore.driver.primaryDriver)?.teamColor || ""
                    state: "selected"
                }
            }
            
            // Compare Driver
            Column {
                spacing: 4
                visible: rootStore.driver.compareDriver !== ""
                
                Text {
                    text: "Compare"
                    font.pixelSize: 10
                    color: theme.colors.foregroundTertiary
                }
                
                TXDriverChip {
                    driverCode: rootStore.driver.compareDriver
                    driverName: rootStore.driver.getDriverByCode(rootStore.driver.compareDriver)?.name || ""
                    teamColor: rootStore.driver.getDriverByCode(rootStore.driver.compareDriver)?.teamColor || ""
                    state: "compared"
                    removable: true
                    onRemoveClicked: rootStore.driver.selectCompareDriver("")
                }
            }

            // All drivers (click = primary, Ctrl+click = toggle compare)
            Flickable {
                width: parent.width
                height: Math.max(140, Math.min(320, root.height - 520))
                clip: true
                contentWidth: width
                contentHeight: allDriversCol.implicitHeight

                Column {
                    id: allDriversCol
                    width: parent.width
                    spacing: 6

                    Repeater {
                        model: rootStore.driver.allDrivers

                        TXDriverChip {
                            width: parent.width
                            driverCode: String(modelData.code || "")
                            driverName: String(modelData.name || "")
                            teamColor: String(modelData.teamColor || "")
                            state: (driverCode === rootStore.driver.primaryDriver) ? "selected"
                                   : (driverCode === rootStore.driver.compareDriver) ? "compared"
                                   : "default"

                            onClicked: function(mouse) {
                                if (mouse.modifiers & Qt.ControlModifier) {
                                    rootStore.driver.toggleCompareDriver(driverCode)
                                } else {
                                    rootStore.driver.selectPrimaryDriver(driverCode)
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // No session message (removed; hide when empty)
        Item { visible: false }
        
        Item { Layout.fillHeight: true }
        
        // Settings button
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            color: settingsMouse.containsMouse ? theme.colors.backgroundElevated : "transparent"
            radius: 6
            visible: root.isExpanded
            
            Row {
                anchors.fill: parent
                anchors.leftMargin: 12
                spacing: 12
                
                Text {
                    text: "⚙"
                    font.pixelSize: 14
                    anchors.verticalCenter: parent.verticalCenter
                }
                
                Text {
                    text: "Settings"
                    font.pixelSize: 13
                    color: theme.colors.foregroundSecondary
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
            
            MouseArea {
                id: settingsMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: rootStore.ui.switchView("settings")
            }
        }
        
        // Collapsed settings icon
        Rectangle {
            visible: !root.isExpanded
            width: 40
            height: 36
            color: settingsIconMouse.containsMouse ? theme.colors.backgroundElevated : "transparent"
            radius: 6
            Layout.alignment: Qt.AlignHCenter
            
            Text {
                anchors.centerIn: parent
                text: "⚙"
                font.pixelSize: 14
                color: theme.colors.foregroundSecondary
            }
            
            MouseArea {
                id: settingsIconMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: rootStore.ui.switchView("settings")
            }
        }
    }
}
