import QtQuick 2.15

/*!
    TXTooltip - Tooltip Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.2
    
    Positions: top | bottom | left | right (auto-flip at edges)
    
    Usage:
        TXTooltip {
            target: parent
            text: "Gap to leader: +12.4s"
            visible: mouseArea.containsMouse
        }
*/

Rectangle {
    id: root
    
    // Public API
    property var target: null
    property string text: ""
    property string position: "top"  // top | bottom | left | right
    property int margin: 8
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color backgroundOverlay: "#1A1A1E"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color borderDefault: "#27272A"
        }
    }
    
    // Styling
    implicitWidth: content.implicitWidth + 16
    implicitHeight: content.implicitHeight + 12
    radius: 6
    color: txTheme.colors.backgroundOverlay
    border.color: txTheme.colors.borderDefault
    border.width: 1
    
    // Shadow
    Rectangle {
        anchors.fill: parent
        color: "transparent"
        radius: parent.radius
        z: -1
        
        Rectangle {
            anchors.fill: parent
            anchors.margins: -2
            color: "black"
            radius: parent.radius + 2
            opacity: 0.3
        }
    }
    
    // Content
    Text {
        id: content
        anchors.centerIn: parent
        text: root.text
        font.pixelSize: 12
        color: txTheme.colors.foregroundPrimary
        wrapMode: Text.Wrap
        maximumLineCount: 5
    }
    
    // Position calculation
    function updatePosition() {
        if (!target || !parent) return
        
        var targetPos = target.mapToItem(parent, 0, 0)
        var targetWidth = target.width
        var targetHeight = target.height
        
        switch(position) {
            case "top":
                x = targetPos.x + (targetWidth - width) / 2
                y = targetPos.y - height - margin
                break
            case "bottom":
                x = targetPos.x + (targetWidth - width) / 2
                y = targetPos.y + targetHeight + margin
                break
            case "left":
                x = targetPos.x - width - margin
                y = targetPos.y + (targetHeight - height) / 2
                break
            case "right":
                x = targetPos.x + targetWidth + margin
                y = targetPos.y + (targetHeight - height) / 2
                break
        }
        
        // Auto-flip if going off screen
        if (x < 0) {
            x = 0
        }
        if (x + width > parent.width) {
            x = parent.width - width
        }
        if (y < 0) {
            y = targetPos.y + targetHeight + margin
        }
        if (y + height > parent.height) {
            y = targetPos.y - height - margin
        }
    }
    
    onVisibleChanged: if (visible) updatePosition()
    onTargetChanged: if (visible) updatePosition()
    
    // Triangle pointer
    Rectangle {
        width: 8
        height: 8
        color: root.color
        rotation: 45
        
        // Position based on tooltip position
        anchors.horizontalCenter: position === "top" || position === "bottom" ? parent.horizontalCenter : undefined
        anchors.verticalCenter: position === "left" || position === "right" ? parent.verticalCenter : undefined
        
        anchors.top: position === "bottom" ? parent.top : undefined
        anchors.topMargin: position === "bottom" ? -4 : 0
        
        anchors.bottom: position === "top" ? parent.bottom : undefined
        anchors.bottomMargin: position === "top" ? -4 : 0
        
        anchors.left: position === "right" ? parent.left : undefined
        anchors.leftMargin: position === "right" ? -4 : 0
        
        anchors.right: position === "left" ? parent.right : undefined
        anchors.rightMargin: position === "left" ? -4 : 0
        
        z: -1
    }
}