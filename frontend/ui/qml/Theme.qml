pragma Singleton
import QtQuick 2.15

/*!
    Theme Singleton - Design Tokens for TelemetryX Desktop
    
    Implements the design system from Frontend_ArchitectureOverview.md Part 3
    
    Usage:
        import TelemetryX.Theme 1.0
        
        Rectangle {
            color: Theme.colors.background.base
            border.color: Theme.colors.border.default
        }
*/

QtObject {
    id: theme
    
    // Theme variant: "dark" | "light" | "highContrast"
    property string variant: "dark"
    
    // Animation timing tokens
    property var animation: QtObject {
        property int instant: 0
        property int fast: 100
        property int normal: 200
        property int slow: 300
        property int slower: 500
    }
    
    // Easing curves
    property var easing: QtObject {
        property var easeOut: Easing.OutCubic
        property var easeIn: Easing.InCubic
        property var easeInOut: Easing.InOutCubic
        property var spring: Easing.OutBack
    }
    
    // Spacing scale (4px grid)
    property var space: QtObject {
        property int px: 1
        property int _0_5: 2
        property int _1: 4
        property int _1_5: 6
        property int _2: 8
        property int _3: 12
        property int _4: 16
        property int _5: 20
        property int _6: 24
        property int _8: 32
        property int _10: 40
        property int _12: 48
        property int _16: 64
    }
    
    // Component sizing
    property var size: QtObject {
        property int xs: 24
        property int sm: 32
        property int md: 40
        property int lg: 48
        property int xl: 56
    }
    
    // Border radius
    property var radius: QtObject {
        property int none: 0
        property int sm: 4
        property int md: 6
        property int lg: 8
        property int xl: 12
        property int full: 9999
    }
    
    // Layout constants
    property var layout: QtObject {
        property int topbarHeight: 48
        property int sidebarWidth: 280
        property int sidebarCollapsed: 64
        property int playbackHeight: 56
        property int panelMinWidth: 320
        property int panelHeader: 44
    }
    
    // Typography
    property var typography: QtObject {
        // Use broadly-available system fonts by default (custom fonts can be bundled later).
        property string display: "Helvetica Neue"
        property string primary: "Helvetica Neue"
        // Use a built-in monospace font by default (JetBrains Mono may not be installed).
        property string mono: "Menlo"
        
        // Font sizes
        property int displayXl: 48
        property int displayLg: 36
        property int displayMd: 28
        property int displaySm: 24
        property int headingLg: 20
        property int headingMd: 18
        property int headingSm: 16
        property int bodyLg: 16
        property int bodyMd: 14
        property int bodySm: 13
        property int labelLg: 14
        property int labelMd: 12
        property int labelSm: 11
        property int dataXl: 28
        property int dataLg: 20
        property int dataMd: 14
        property int dataSm: 12
        property int dataXs: 11
        
        // Timing tower specific
        property int timingPosition: 28
        property int timingGap: 14
        property int timingLaptime: 16
        property int timingSector: 14
    }
    
    // Colors based on theme variant
    property var colors: QtObject {
        // Background scale
        property color backgroundBase: variant === "dark" ? "#0D0D0F" : 
                                       variant === "light" ? "#FAFAFA" : "#000000"
        property color backgroundRaised: variant === "dark" ? "#141417" : 
                                         variant === "light" ? "#FFFFFF" : "#111111"
        property color backgroundOverlay: variant === "dark" ? "#1A1A1E" : 
                                          variant === "light" ? "#F5F5F5" : "#222222"
        property color backgroundElevated: variant === "dark" ? "#222228" : 
                                           variant === "light" ? "#E5E5E5" : "#333333"
        property color backgroundMuted: variant === "dark" ? "#2A2A32" : 
                                        variant === "light" ? "#D4D4D8" : "#444444"
        
        // Foreground scale
        property color foregroundPrimary: variant === "dark" ? "#FFFFFF" : 
                                          variant === "light" ? "#171717" : "#FFFFFF"
        property color foregroundSecondary: variant === "dark" ? "#A1A1AA" : 
                                            variant === "light" ? "#52525B" : "#CCCCCC"
        property color foregroundTertiary: variant === "dark" ? "#71717A" : 
                                           variant === "light" ? "#71717A" : "#999999"
        property color foregroundMuted: variant === "dark" ? "#52525B" : 
                                        variant === "light" ? "#A1A1AA" : "#666666"
        
        // Border scale
        property color borderDefault: variant === "dark" ? "#27272A" : 
                                      variant === "light" ? "#E4E4E7" : "#FFFFFF"
        property color borderMuted: variant === "dark" ? "#1F1F23" : 
                                    variant === "light" ? "#F4F4F5" : "#FFFFFF"
        property color borderEmphasis: variant === "dark" ? "#3F3F46" : 
                                       variant === "light" ? "#D4D4D8" : "#FFFFFF"
        
        // Accent (F1 Red)
        property color accentDefault: "#E10600"
        property color accentHover: "#FF1E00"
        property color accentMuted: "#33E10600"  // 20% opacity
        
        // Semantic colors
        property color successDefault: "#22C55E"
        property color successMuted: "#3322C55E"
        property color warningDefault: "#F59E0B"
        property color warningMuted: "#33F59E0B"
        property color errorDefault: "#EF4444"
        property color errorMuted: "#33EF4444"
        property color infoDefault: "#3B82F6"
        property color infoMuted: "#333B82F6"
        
        // F1 Special Colors
        property color timingSessionBest: "#A855F7"  // Purple
        property color timingPersonalBest: "#22C55E"  // Green
        property color flagYellow: "#FACC15"
        property color flagRed: "#EF4444"
        
        // Tyre compounds
        property color tyreSoft: "#EF4444"
        property color tyreMedium: "#FACC15"
        property color tyreHard: "#FFFFFF"
        property color tyreIntermediate: "#22C55E"
        property color tyreWet: "#3B82F6"
        
        // Team colors (2024 season)
        property color teamRedbull: "#3671C6"
        property color teamMercedes: "#27F4D2"
        property color teamFerrari: "#E80020"
        property color teamMclaren: "#FF8000"
        property color teamAstonmartin: "#229971"
        property color teamAlpine: "#FF87BC"
        property color teamWilliams: "#64C4FF"
        property color teamHaas: "#B6BABD"
        property color teamSauber: "#52E252"
        property color teamRb: "#6692FF"
    }
    
    // Elevation (shadows)
    property var elevation: QtObject {
        property string none: "none"
        property string sm: "0 1px 2px rgba(0,0,0,0.3)"
        property string md: "0 4px 8px rgba(0,0,0,0.4)"
        property string lg: "0 8px 16px rgba(0,0,0,0.5)"
        property string xl: "0 16px 32px rgba(0,0,0,0.6)"
    }
    
    // Focus ring
    property var focus: QtObject {
        property int width: 2
        property color color: colors.accentDefault
        property int offset: 2
    }
    
    // Function to get team color
    function teamColor(teamId) {
        var colors = {
            "redbull": colors.teamRedbull,
            "mercedes": colors.teamMercedes,
            "ferrari": colors.teamFerrari,
            "mclaren": colors.teamMclaren,
            "aston_martin": colors.teamAstonmartin,
            "alpine": colors.teamAlpine,
            "williams": colors.teamWilliams,
            "haas": colors.teamHaas,
            "sauber": colors.teamSauber,
            "rb": colors.teamRb
        }
        return colors[teamId] || colors.foregroundSecondary
    }
    
    // Function to get tyre compound color
    function tyreColor(compound) {
        var colors = {
            "SOFT": colors.tyreSoft,
            "MEDIUM": colors.tyreMedium,
            "HARD": colors.tyreHard,
            "INTERMEDIATE": colors.tyreIntermediate,
            "WET": colors.tyreWet
        }
        return colors[compound] || colors.foregroundSecondary
    }
    
    // Function to switch theme
    function setTheme(newVariant) {
        if (["dark", "light", "highContrast"].indexOf(newVariant) !== -1) {
            variant = newVariant
        }
    }
}
