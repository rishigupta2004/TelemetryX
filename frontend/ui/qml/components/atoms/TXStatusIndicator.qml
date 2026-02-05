import QtQuick 2.15

/*!
    TXStatusIndicator - Status Indicator Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.1
    
    Types: online | offline | loading | error | warning
    
    Usage:
        TXStatusIndicator { type: "online" }
        TXStatusIndicator { type: "loading" }
        TXStatusIndicator { type: "error" }
*/

Item {
    id: root
    
    // Public API
    property string type: "online"  // online | offline | loading | error | warning
    property int size: 8           // dot size in pixels
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color successDefault: "#22C55E"
            property color errorDefault: "#EF4444"
            property color warningDefault: "#F59E0B"
            property color foregroundSecondary: "#A1A1AA"
            property color accentDefault: "#E10600"
        }
    }
    
    // Color mapping
    property var colorMap: ({
        "online": txTheme.colors.successDefault,
        "offline": txTheme.colors.foregroundSecondary,
        "loading": txTheme.colors.accentDefault,
        "error": txTheme.colors.errorDefault,
        "warning": txTheme.colors.warningDefault
    })
    
    property color indicatorColor: colorMap[type] || txTheme.colors.foregroundSecondary
    
    // Size
    implicitWidth: size
    implicitHeight: size
    
    // Static dot (online, offline, error)
    Rectangle {
        id: staticDot
        visible: type !== "loading"
        anchors.fill: parent
        radius: size / 2
        color: indicatorColor
    }
    
    // Animated spinner (loading)
    Rectangle {
        id: spinner
        visible: type === "loading"
        anchors.fill: parent
        radius: size / 2
        color: "transparent"
        border.color: indicatorColor
        border.width: 2
        
        // Cut out a section for spinner effect
        Rectangle {
            anchors.fill: parent
            color: "transparent"
            anchors.margins: 1
            radius: parent.radius - 1
        }
        
        RotationAnimation on rotation {
            loops: Animation.Infinite
            from: 0
            to: 360
            duration: 1000
            running: type === "loading"
        }
    }
    
    // Pulse animation for online status
    Rectangle {
        visible: type === "online"
        anchors.fill: parent
        radius: size / 2
        color: indicatorColor
        opacity: 0.5
        scale: 1
        
        SequentialAnimation on scale {
            loops: Animation.Infinite
            PropertyAnimation { from: 1; to: 2; duration: 1000; easing.type: Easing.OutQuad }
            PropertyAnimation { from: 2; to: 1; duration: 0 }
        }
        
        SequentialAnimation on opacity {
            loops: Animation.Infinite
            PropertyAnimation { from: 0.5; to: 0; duration: 1000; easing.type: Easing.OutQuad }
            PropertyAnimation { from: 0; to: 0.5; duration: 0 }
        }
    }
}
