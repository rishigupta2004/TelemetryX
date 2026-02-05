import QtQuick 2.15
import QtQuick.Layouts 1.15

/*!
    TXTyreIndicator - Tyre Compound Indicator Component
    
    From Frontend_ArchitectureOverview.md Part 3, Section 3.2
    
    Shows: Compound color dot | Compound name | Laps on tyre | Age indicator
    
    Usage:
        TXTyreIndicator {
            compound: "SOFT"  // SOFT | MEDIUM | HARD | INTERMEDIATE | WET
            lapsOnTyre: 23
            isNew: false
        }
*/

Row {
    id: root
    
    // Public API
    property string compound: "SOFT"
    property int lapsOnTyre: 0
    property bool isNew: false
    property int stintNumber: 1
    
    // Theme reference
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color foregroundTertiary: "#71717A"
            property color tyreSoft: "#EF4444"
            property color tyreMedium: "#FACC15"
            property color tyreHard: "#FFFFFF"
            property color tyreIntermediate: "#22C55E"
            property color tyreWet: "#3B82F6"
            property color backgroundRaised: "#141417"
            property color borderDefault: "#27272A"
        }
    }
    
    // Compound color mapping
    property var compoundColors: ({
        "SOFT": txTheme.colors.tyreSoft,
        "MEDIUM": txTheme.colors.tyreMedium,
        "HARD": txTheme.colors.tyreHard,
        "INTERMEDIATE": txTheme.colors.tyreIntermediate,
        "WET": txTheme.colors.tyreWet
    })
    
    property color compoundColor: compoundColors[compound] || txTheme.colors.foregroundSecondary
    
    spacing: 8
    
    // Compound color dot
    Rectangle {
        width: 10
        height: 10
        radius: 5
        color: root.compoundColor
        border.color: compound === "HARD" ? txTheme.colors.borderDefault : "transparent"
        border.width: compound === "HARD" ? 1 : 0
        anchors.verticalCenter: parent.verticalCenter
    }
    
    // Compound name
    Text {
        text: root.compound
        font.pixelSize: 12
        font.weight: Font.Medium
        color: root.compoundColor
        anchors.verticalCenter: parent.verticalCenter
    }
    
    // Separator
    Text {
        text: "|"
        font.pixelSize: 11
        color: txTheme.colors.borderDefault
        anchors.verticalCenter: parent.verticalCenter
    }
    
    // Laps on tyre
    Text {
        text: root.lapsOnTyre + " laps"
        font.pixelSize: 11
        color: txTheme.colors.foregroundSecondary
        font.family: theme.typography.mono
        anchors.verticalCenter: parent.verticalCenter
    }
    
    // Age indicator (NEW or used indicator)
    Rectangle {
        visible: root.isNew
        width: newText.implicitWidth + 8
        height: 16
        radius: 8
        color: Qt.rgba(root.compoundColor.r, root.compoundColor.g, root.compoundColor.b, 0.2)
        anchors.verticalCenter: parent.verticalCenter
        
        Text {
            id: newText
            anchors.centerIn: parent
            text: "NEW"
            font.pixelSize: 9
            font.weight: Font.Bold
            color: root.compoundColor
        }
    }
}
