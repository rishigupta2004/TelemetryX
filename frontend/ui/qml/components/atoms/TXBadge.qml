import QtQuick 2.15

/*!
    TXBadge - Atomic Badge/Pill Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.1
    
    Variants: solid | outline | subtle
    Colors: LIVE (green), STALE (yellow), ERROR (red), P1 (neutral), +2 (positive)
    
    Usage:
        TXBadge { text: "LIVE"; variant: "solid"; colorScheme: "success" }
        TXBadge { text: "STALE"; variant: "outline"; colorScheme: "warning" }
        TXBadge { text: "P1"; variant: "subtle"; colorScheme: "neutral" }
*/

Rectangle {
    id: root
    
    // Public API
    property string text: ""
    property string variant: "solid"    // solid | outline | subtle
    property string colorScheme: "neutral"  // neutral | success | warning | error | info | accent
    property bool dot: false            // Show colored dot prefix
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color successDefault: "#22C55E"
            property color warningDefault: "#F59E0B"
            property color errorDefault: "#EF4444"
            property color infoDefault: "#3B82F6"
            property color accentDefault: "#E10600"
            property color backgroundRaised: "#141417"
            property color borderDefault: "#27272A"
        }
    }
    
    // Color scheme mappings
    property var colorMap: ({
        "neutral": txTheme.colors.foregroundSecondary,
        "success": txTheme.colors.successDefault,
        "warning": txTheme.colors.warningDefault,
        "error": txTheme.colors.errorDefault,
        "info": txTheme.colors.infoDefault,
        "accent": txTheme.colors.accentDefault
    })
    
    property color schemeColor: colorMap[colorScheme] || txTheme.colors.foregroundSecondary
    
    // Sizing
    implicitWidth: contentRow.implicitWidth + 12
    implicitHeight: 20
    radius: 10
    
    // Background based on variant
    color: {
        switch(variant) {
            case "solid": return schemeColor
            case "outline": return "transparent"
            case "subtle": return Qt.rgba(schemeColor.r, schemeColor.g, schemeColor.b, 0.15)
            default: return "transparent"
        }
    }
    
    border.color: variant === "outline" ? schemeColor : "transparent"
    border.width: variant === "outline" ? 1 : 0
    
    // Content
    Row {
        id: contentRow
        anchors.centerIn: parent
        spacing: 4
        
        // Dot indicator
        Rectangle {
            visible: root.dot
            width: 6
            height: 6
            radius: 3
            color: schemeColor
            anchors.verticalCenter: parent.verticalCenter
        }
        
        // Text
        Text {
            text: root.text
            font.pixelSize: 11
            font.weight: Font.Medium
            color: {
                if (variant === "solid") return "white"
                return schemeColor
            }
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
