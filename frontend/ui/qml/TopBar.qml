import QtQuick 2.15
import QtQuick.Layouts 1.15
import "components/atoms"

/*!
    TopBar - Application Top Bar (48px height)
    
    From Frontend_ArchitectureOverview.md Part 4, Section 1.1
    
    Components:
    - Menu + Logo (click to toggle sidebar)
    - Session Selector dropdown
    - Status indicator
    - Notifications, Settings, Profile buttons
*/

Rectangle {
    id: root
    
    height: 48
    color: theme.colors.backgroundRaised
    border.color: theme.colors.borderDefault
    border.width: 1
    
    // Signals
    signal menuClicked()
    signal sessionSelectorClicked()
    signal notificationsClicked()
    signal settingsClicked()
    signal profileClicked()
    
    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 16
        anchors.rightMargin: 16
        spacing: 16
        
        // Menu + Logo
        Row {
            spacing: 12
            Layout.alignment: Qt.AlignVCenter
            
            Text {
                text: "≡"
                font.pixelSize: 20
                color: theme.colors.foregroundPrimary
                anchors.verticalCenter: parent.verticalCenter
                
                MouseArea {
                    anchors.fill: parent
                    onClicked: root.menuClicked()
                }
            }
            
            Text {
                text: "TX"
                font.pixelSize: 18
                font.bold: true
                color: theme.colors.accentDefault
                anchors.verticalCenter: parent.verticalCenter
            }
        }
        
        // Session Selector
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 32
            color: theme.colors.backgroundBase
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 6
            
            Row {
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 12
                spacing: 8
                
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "🏁"
                    font.pixelSize: 14
                }
                
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: rootStore.session.sessionName
                    font.pixelSize: 13
                    color: theme.colors.foregroundPrimary
                    elide: Text.ElideRight
                    maximumLineCount: 1
                    visible: rootStore.session.sessionName !== ""
                }
                
                Item { Layout.fillWidth: true }
                
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "▼"
                    font.pixelSize: 10
                    color: theme.colors.foregroundSecondary
                }
            }
            
            MouseArea {
                anchors.fill: parent
                onClicked: root.sessionSelectorClicked()
            }
        }

        // Quick session type switch (R/Q/S/SS) - tiny pills (avoid wide TXButton min-width)
        Row {
            spacing: 6
            Layout.alignment: Qt.AlignVCenter

            Repeater {
                model: rootStore.session.availableSessions.length > 0 ? rootStore.session.availableSessions : ["R", "Q", "S", "SR"]

                delegate: Rectangle {
                    width: 32
                    height: 24
                    radius: 6
                    color: String(modelData) === String(rootStore.session.session) ? theme.colors.accentDefault : theme.colors.backgroundBase
                    border.color: theme.colors.borderDefault
                    border.width: 1

                        Text {
                            anchors.centerIn: parent
                            text: String(modelData)
                            font.pixelSize: 11
                            font.family: theme.typography.mono
                            color: String(modelData) === String(rootStore.session.session) ? "#FFFFFF" : theme.colors.foregroundSecondary
                        }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: {
                            if (!rootStore.session.sessionName || rootStore.session.sessionName === "") {
                                rootStore.bootstrapFromBackend()
                                return
                            }
                            rootStore.loadSession(String(modelData))
                        }
                    }
                }
            }
        }
        
        // Right side actions
        Row {
            spacing: 12
            Layout.alignment: Qt.AlignVCenter
            
            // Connection status
            TXStatusIndicator {
                type: "online"
                size: 8
                anchors.verticalCenter: parent.verticalCenter
            }
            
            // Notifications
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: notifMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                anchors.verticalCenter: parent.verticalCenter
                
                Text {
                    anchors.centerIn: parent
                    text: "🔔"
                    font.pixelSize: 16
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: notifMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.notificationsClicked()
                }
            }
            
            // Settings
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: settingsMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                anchors.verticalCenter: parent.verticalCenter
                
                Text {
                    anchors.centerIn: parent
                    text: "⚙"
                    font.pixelSize: 16
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: settingsMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.settingsClicked()
                }
            }
            
            // Profile
            Rectangle {
                width: 32
                height: 32
                radius: 16
                color: profileMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : theme.colors.backgroundBase
                border.color: theme.colors.borderDefault
                border.width: 1
                anchors.verticalCenter: parent.verticalCenter
                
                Text {
                    anchors.centerIn: parent
                    text: "○"
                    font.pixelSize: 18
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: profileMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.profileClicked()
                }
            }
        }
    }
}
