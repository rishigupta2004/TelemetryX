import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

/*!
    TXButton - Atomic Button Component
    
    Implements button atoms from Frontend_ArchitectureOverview.md Part 3, Section 3.1
    
    Variants: primary | secondary | ghost | danger | icon
    Sizes: xs (24px) | sm (32px) | md (40px) | lg (48px) | xl (56px)
    States: default | hover | active | disabled | loading
    
    Usage:
        TXButton {
            text: "Click me"
            variant: "primary"
            size: "md"
            onClicked: console.log("Clicked")
        }
*/

Button {
    id: root
    
    // Public API
    property string variant: "primary"  // primary | secondary | ghost | danger | icon
    property string size: "md"          // xs | sm | md | lg | xl
    property bool loading: false
    property string iconText: ""        // Optional icon (emoji or text)
    
    // Theme reference (will be injected from parent or use defaults)
    property var txTheme: (typeof theme !== 'undefined') ? theme : defaultTheme
    
    // Default theme values inline
    QtObject {
        id: defaultTheme
        property var colors: QtObject {
            property color accentDefault: "#E10600"
            property color accentHover: "#FF1E00"
            property color backgroundRaised: "#141417"
            property color backgroundElevated: "#222228"
            property color foregroundPrimary: "#FFFFFF"
            property color foregroundSecondary: "#A1A1AA"
            property color errorDefault: "#EF4444"
            property color borderDefault: "#27272A"
        }
    }
    
    // Size mappings
    property var sizeConfig: ({
        "xs": { height: 24, fontSize: 11, padding: 8, radius: 4 },
        "sm": { height: 32, fontSize: 12, padding: 12, radius: 4 },
        "md": { height: 40, fontSize: 14, padding: 16, radius: 6 },
        "lg": { height: 48, fontSize: 16, padding: 20, radius: 6 },
        "xl": { height: 56, fontSize: 18, padding: 24, radius: 8 }
    })
    
    // Computed properties
    property var currentSize: sizeConfig[size] || sizeConfig["md"]
    property bool isIconOnly: variant === "icon" || (iconText && !text)
    
    // Button configuration
    implicitHeight: currentSize.height
    implicitWidth: isIconOnly ? currentSize.height : Math.max(contentItem.implicitWidth + currentSize.padding * 2, 80)
    
    // Visual styling
    background: Rectangle {
        implicitWidth: root.implicitWidth
        implicitHeight: root.implicitHeight
        radius: currentSize.radius
        
        color: {
            if (!root.enabled) return txTheme.colors.backgroundRaised
            if (root.loading) return txTheme.colors.backgroundRaised
            
            switch(root.variant) {
                case "primary":
                    return root.down ? Qt.darker(txTheme.colors.accentDefault, 1.2) :
                           root.hovered ? txTheme.colors.accentHover : txTheme.colors.accentDefault
                case "secondary":
                    return root.down ? txTheme.colors.backgroundElevated :
                           root.hovered ? Qt.lighter(txTheme.colors.backgroundRaised, 1.2) : txTheme.colors.backgroundRaised
                case "ghost":
                    return root.down ? Qt.rgba(1, 1, 1, 0.1) :
                           root.hovered ? Qt.rgba(1, 1, 1, 0.05) : "transparent"
                case "danger":
                    return root.down ? Qt.darker(txTheme.colors.errorDefault, 1.2) :
                           root.hovered ? Qt.lighter(txTheme.colors.errorDefault, 1.2) : txTheme.colors.errorDefault
                case "icon":
                    return root.down ? Qt.rgba(1, 1, 1, 0.2) :
                           root.hovered ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                default:
                    return txTheme.colors.backgroundRaised
            }
        }

        Behavior on color {
            ColorAnimation { duration: 100 }
        }
        
        border.color: {
            if (root.variant === "secondary" || (root.variant === "ghost" && !root.hovered && !root.down)) {
                return txTheme.colors.borderDefault
            }
            return "transparent"
        }
        border.width: (root.variant === "secondary" || root.variant === "ghost") ? 1 : 0
        
        // Loading spinner
        Rectangle {
            id: loadingIndicator
            visible: root.loading
            anchors.centerIn: parent
            width: 16
            height: 16
            radius: 8
            color: "transparent"
            border.color: root.variant === "primary" ? "white" : txTheme.colors.foregroundSecondary
            border.width: 2
            
            Rectangle {
                anchors.fill: parent
                radius: parent.radius
                color: parent.border.color
                
                SequentialAnimation on rotation {
                    loops: Animation.Infinite
                    PropertyAnimation { from: 0; to: 360; duration: 1000 }
                }
                
                // Hide part of the circle to create spinner effect
                Rectangle {
                    anchors.fill: parent
                    color: root.background.color
                    radius: parent.radius
                    anchors.margins: 3
                }
            }
        }
    }
    
    // Content
    contentItem: Row {
        anchors.centerIn: parent
        spacing: 6
        visible: !root.loading
        
        // Icon
        Text {
            visible: root.iconText !== ""
            text: root.iconText
            font.pixelSize: currentSize.fontSize
            color: {
                if (root.variant === "primary" || root.variant === "danger") return "white"
                return root.down || root.hovered ? txTheme.colors.foregroundPrimary : txTheme.colors.foregroundSecondary
            }
            anchors.verticalCenter: parent.verticalCenter
        }
        
        // Label
        Text {
            visible: !isIconOnly
            text: root.text
            font.pixelSize: currentSize.fontSize
            font.weight: root.variant === "primary" || root.variant === "danger" ? Font.DemiBold : Font.Normal
            color: {
                if (root.variant === "primary" || root.variant === "danger") return "white"
                return root.down || root.hovered ? txTheme.colors.foregroundPrimary : txTheme.colors.foregroundSecondary
            }
            anchors.verticalCenter: parent.verticalCenter
        }
    }
    
    // Focus ring
    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.color: txTheme.colors.accentDefault
        border.width: root.activeFocus ? 2 : 0
        radius: currentSize.radius + 2
        anchors.margins: -2
        visible: root.activeFocus
        opacity: 0.5
    }
}
