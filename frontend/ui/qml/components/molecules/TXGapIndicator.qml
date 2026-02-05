import QtQuick 2.15

/*!
    TXGapIndicator - Gap/Delta Indicator Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.2
    
    Displays: Gap to leader | Interval | LAP (lapped) | PIT (in pit)
    
    Usage:
        TXGapIndicator {
            type: "gap"  // gap | interval | lap | pit
            value: 2.345
        }
*/

Rectangle {
    id: root
    
    // Public API
    property string type: "gap"  // gap | interval | lap | pit
    property var value: null
    property bool isLeader: false
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color foregroundTertiary: "#71717A"
            property color successDefault: "#22C55E"
            property color warningDefault: "#F59E0B"
            property color errorDefault: "#EF4444"
            property color backgroundRaised: "#141417"
            property color borderDefault: "#27272A"
        }
    }
    
    // Compute display text
    property string displayText: {
        if (type === "pit") return "PIT"
        if (type === "lap") return "LAP"
        if (isLeader) return "LEADER"
        if (value === null || value === undefined || value === "") return ""
        var n = Number(value)
        if (isNaN(n)) return ""
        
        // Format based on magnitude
        var absVal = Math.abs(n)
        if (absVal < 1) {
            return (n > 0 ? "+" : "") + n.toFixed(3)
        } else {
            return (n > 0 ? "+" : "") + n.toFixed(1)
        }
    }
    
    // Color based on type and value
    property color textColor: {
        if (type === "pit") return txTheme.colors.warningDefault
        if (type === "lap") return txTheme.colors.foregroundTertiary
        if (isLeader) return txTheme.colors.successDefault
        if (value === null || value === undefined || value === "") return "transparent"
        var n = Number(value)
        if (isNaN(n)) return "transparent"
        
        var absVal = Math.abs(n)
        if (absVal < 1) return txTheme.colors.successDefault
        if (absVal < 3) return txTheme.colors.foregroundSecondary
        return txTheme.colors.foregroundTertiary
    }
    
    // Sizing - dynamic based on content
    implicitWidth: textLabel.implicitWidth + 8
    implicitHeight: 20
    radius: 4
    
    color: type === "pit" ? Qt.rgba(0.96, 0.59, 0.04, 0.15) : "transparent"
    border.color: type === "pit" ? txTheme.colors.warningDefault : "transparent"
    border.width: type === "pit" ? 1 : 0
    
    // Text content
    Text {
        id: textLabel
        anchors.centerIn: parent
        text: root.displayText
        font.pixelSize: 12
        font.weight: Font.Medium
        font.family: theme.typography.mono
        color: root.textColor
    }
}
