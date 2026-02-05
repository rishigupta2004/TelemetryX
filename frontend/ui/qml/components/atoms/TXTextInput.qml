import QtQuick 2.15
import QtQuick.Controls 2.15

/*!
    TXTextInput - Atomic Text Input Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.1
    
    Features: icon prefix, placeholder, clear button, keyboard shortcut hint
    
    Usage:
        TXTextInput {
            placeholder: "Search sessions..."
            icon: "🔍"
            shortcut: "⌘K"
            onTextChanged: console.log(text)
        }
*/

TextField {
    id: root
    
    // Public API
    property string icon: ""           // Optional icon prefix
    property string shortcut: ""      // Keyboard shortcut hint (e.g., "⌘K")
    property bool showClear: true     // Show clear button when text present
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundBase: "#0D0D0F"
            property color backgroundRaised: "#141417"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color foregroundTertiary: "#71717A"
            property color borderDefault: "#27272A"
            property color borderEmphasis: "#3F3F46"
            property color accentDefault: "#E10600"
        }
    }
    
    // Default styling
    implicitHeight: 40
    leftPadding: icon ? 36 : 16
    rightPadding: shortcut ? 50 : (showClear && text ? 32 : 16)
    topPadding: 0
    bottomPadding: 0
    
    // Visual styling
    background: Rectangle {
        implicitWidth: 200
        implicitHeight: 40
        radius: 6
        color: root.enabled ? txTheme.colors.backgroundRaised : txTheme.colors.backgroundBase
        border.color: root.activeFocus ? txTheme.colors.accentDefault : txTheme.colors.borderDefault
        border.width: root.activeFocus ? 2 : 1
        
        Behavior on border.color {
            ColorAnimation { duration: 100 }
        }
    }
    
    // Text styling
    color: txTheme.colors.foregroundPrimary
    font.pixelSize: 14
    placeholderTextColor: txTheme.colors.foregroundTertiary
    selectionColor: Qt.rgba(0.88, 0.02, 0, 0.3)  // Accent with opacity
    selectedTextColor: txTheme.colors.foregroundPrimary
    verticalAlignment: TextInput.AlignVCenter
    
    // Icon
    Text {
        id: iconLabel
        anchors.left: parent.left
        anchors.leftMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        text: root.icon
        font.pixelSize: 14
        color: txTheme.colors.foregroundSecondary
        visible: root.icon !== ""
    }
    
    // Clear button
    Rectangle {
        id: clearButton
        anchors.right: shortcutLabel.visible ? shortcutLabel.left : parent.right
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        width: 20
        height: 20
        radius: 10
        color: root.hovered ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
        visible: root.showClear && root.text.length > 0
        
        Text {
            anchors.centerIn: parent
            text: "✕"
            font.pixelSize: 10
            color: txTheme.colors.foregroundSecondary
        }
        
        MouseArea {
            anchors.fill: parent
            onClicked: root.text = ""
        }
    }
    
    // Shortcut hint
    Text {
        id: shortcutLabel
        anchors.right: parent.right
        anchors.rightMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        text: root.shortcut
        font.pixelSize: 11
        font.family: theme.typography.mono
        color: txTheme.colors.foregroundTertiary
        visible: root.shortcut !== "" && !root.text && !root.activeFocus
    }
    
    // Focus ring
    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.color: txTheme.colors.accentDefault
        border.width: root.activeFocus ? 2 : 0
        radius: 8
        anchors.margins: -2
        visible: root.activeFocus
        opacity: 0.3
    }
}
