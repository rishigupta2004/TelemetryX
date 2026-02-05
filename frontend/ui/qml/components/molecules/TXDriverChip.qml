import QtQuick 2.15
import QtQuick.Layouts 1.15
import "../atoms"

/*!
    TXDriverChip - Driver Chip Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.2
    
    Shows: Team color bar | 3-letter code | Full name | Remove action
    States: default | selected | compared | disabled
    
    Usage:
        TXDriverChip {
            driverCode: "VER"
            driverName: "M. Verstappen"
            teamColor: "#3671C6"
            state: "selected"  // "default" | "selected" | "compared"
            onRemoveClicked: console.log("Remove")
            onClicked: console.log("Select")
        }
*/

Rectangle {
    id: root
    
    // Public API
    property string driverCode: ""
    property string driverName: ""
    property string teamColor: ""
    property string state: "default"  // default | selected | compared
    property bool removable: false
    property bool clickable: true
    
    // Signals
    signal clicked(var mouse)
    signal removeClicked()
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundRaised: "#141417"
            property color backgroundElevated: "#222228"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color borderDefault: "#27272A"
            property color accentDefault: "#E10600"
        }
    }
    
    // State styling
    property color backgroundColor: {
        if (state === "selected" && teamColor !== "") return Qt.rgba(
            parseInt(teamColor.slice(1, 3), 16) / 255,
            parseInt(teamColor.slice(3, 5), 16) / 255,
            parseInt(teamColor.slice(5, 7), 16) / 255,
            0.2
        )
        if (state === "compared") return txTheme.colors.backgroundElevated
        return txTheme.colors.backgroundRaised
    }
    
    property color borderColor: {
        if (state === "selected" && teamColor !== "") return teamColor
        if (state === "compared") return txTheme.colors.borderDefault
        return "transparent"
    }
    
    // Sizing
    implicitWidth: contentRow.implicitWidth + 16
    implicitHeight: 36
    radius: 6
    
    color: backgroundColor
    border.color: borderColor
    border.width: state === "selected" ? 2 : (state === "compared" ? 1 : 0)
    
    Behavior on color {
        ColorAnimation { duration: 100 }
    }
    
    // Team color bar
    Rectangle {
        id: teamBar
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 4
        radius: root.radius
        color: root.teamColor
        visible: root.teamColor !== ""
        
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.leftMargin: parent.radius
            color: parent.color
        }
    }
    
    // Content
    Row {
        id: contentRow
        anchors.left: teamBar.right
        anchors.leftMargin: 10
        anchors.right: parent.right
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        spacing: 8
        
        // Driver code (3 letters)
        Text {
            text: root.driverCode
            font.pixelSize: 13
            font.weight: Font.Bold
            font.family: theme.typography.mono
            color: root.state === "selected" ? root.teamColor : txTheme.colors.foregroundPrimary
            anchors.verticalCenter: parent.verticalCenter
        }
        
        // Driver name
        Text {
            text: root.driverName
            font.pixelSize: 13
            color: txTheme.colors.foregroundSecondary
            anchors.verticalCenter: parent.verticalCenter
            elide: Text.ElideRight
            maximumLineCount: 1
        }
        
        // Remove button
        Rectangle {
            visible: root.removable
            width: 16
            height: 16
            radius: 8
            color: removeMouseArea.containsMouse ? Qt.rgba(1, 1, 1, 0.2) : "transparent"
            anchors.verticalCenter: parent.verticalCenter
            
            Text {
                anchors.centerIn: parent
                text: "✕"
                font.pixelSize: 10
                color: txTheme.colors.foregroundSecondary
            }
            
            MouseArea {
                id: removeMouseArea
                anchors.fill: parent
                hoverEnabled: true
                onClicked: root.removeClicked()
            }
        }
    }
    
    // Hover effect
    Rectangle {
        anchors.fill: parent
        radius: parent.radius
        color: mouseArea.containsMouse ? Qt.rgba(1, 1, 1, 0.05) : "transparent"
        visible: mouseArea.containsMouse && root.state !== "selected"
    }
    
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: root.clickable
        hoverEnabled: true
        onClicked: function(mouse) { root.clicked(mouse) }
    }
}
