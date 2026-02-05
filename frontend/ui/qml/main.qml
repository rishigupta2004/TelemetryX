import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "views"
import "components/atoms"

/*!
    Main application window
    
    Implements the complete shell structure from Frontend_ArchitectureOverview.md
    - Top Bar (48px)
    - Sidebar (280px expanded / 64px collapsed)
    - Main Content Area (View routing)
    - Playback Bar (56px)
*/

Window {
    id: root
    
    visible: true
    minimumWidth: 1280
    minimumHeight: 720
    width: 1920
    height: 1080
    title: qsTr("TelemetryX Desktop")
    color: theme.colors.backgroundBase

    // Sidebar behavior:
    // - When pinned open: content shifts right (280px)
    // - When pinned closed: content shifts right (64px) and sidebar can hover-expand on top
    property int sidebarCollapsedWidth: 64
    property int sidebarExpandedWidth: 280
    property bool sidebarHoverExpanded: false
    
    // Theme is provided as a global context property (`theme`) from Python (Theme.qml).
    
    // Main layout container
    ColumnLayout {
        anchors.fill: parent
        spacing: 0
        
        // Top Bar
        TopBar {
            Layout.fillWidth: true
            onMenuClicked: rootStore.ui.toggleSidebar()
            onSessionSelectorClicked: rootStore.ui.openModal("session")
            onNotificationsClicked: rootStore.ui.openModal("race_control")
            onSettingsClicked: rootStore.ui.switchView("settings")
            onProfileClicked: rootStore.ui.openModal("session")
        }
        
        // Main content area (Sidebar overlay + Content)
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            Sidebar {
                id: sidebar
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                z: 50

                hoverExpanded: root.sidebarHoverExpanded
            }

            // Hover expansion (doesn't affect layout)
            MouseArea {
                anchors.fill: sidebar
                hoverEnabled: true
                acceptedButtons: Qt.NoButton
                onEntered: root.sidebarHoverExpanded = true
                onExited: root.sidebarHoverExpanded = false
            }

        // Main content area - View routing
        StackLayout {
            id: viewStack
                anchors.top: parent.top
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.left: parent.left
                anchors.leftMargin: rootStore.ui.sidebarOpen ? root.sidebarExpandedWidth : root.sidebarCollapsedWidth
                currentIndex: getViewIndex(rootStore.ui.activeView)

                function getViewIndex(view) {
                    var v = String(view || "")
                    if (v === "compare") v = "telemetry"
                    var views = ["timing", "telemetry", "track", "compare", "strategy", "features", "settings"]
                    var idx = views.indexOf(v)
                    return idx < 0 ? 0 : idx
                }

                // 0: Timing View
                TimingView {}

                // 1: Telemetry View
                TelemetryView {}

                // 2: Track View
                TrackView {}

                // 3: Compare View
                CompareView {}

                // 4: Strategy View
                StrategyView {}

                // 5: Features View
                FeaturesView {}

                // 6: Settings View
                SettingsView {}
            }
        }
        
    // Playback Bar
    PlaybackBar {
            Layout.fillWidth: true
            currentTime: typeof playback !== "undefined" ? playback.currentTime : 0
            totalTime: rootStore.session.telemetryLapMode
                       ? (rootStore.session.telemetryLapDuration > 0 ? rootStore.session.telemetryLapDuration : 60)
                       : (rootStore.session.durationSeconds > 0 ? rootStore.session.durationSeconds : 5400)
            currentLap: rootStore.session.telemetryLapMode ? 1 : (typeof playback !== "undefined" ? playback.currentLap : 1)
            totalLaps: rootStore.session.telemetryLapMode ? 1 : (rootStore.session.totalLaps > 0 ? rootStore.session.totalLaps : 57)
            isPlaying: typeof playback !== "undefined" ? playback.isPlaying : false
            playbackRate: typeof playback !== "undefined" ? playback.rate : 1.0
            onPlayPauseClicked: if (typeof playback !== "undefined") playback.togglePlayPause()
            onStartClicked: if (typeof playback !== "undefined") playback.start()
            onEndClicked: if (typeof playback !== "undefined") playback.end()
            onStepBackClicked: if (typeof playback !== "undefined") playback.stepBack()
            onStepForwardClicked: if (typeof playback !== "undefined") playback.stepForward()
            onSeekRequested: function(time) { if (typeof playback !== "undefined") playback.seek(time) }
            onRateChanged: function(rate) { if (typeof playback !== "undefined") playback.setRate(rate) }
        }
    }

    Connections {
        target: rootStore.driver
        function onPrimaryDriverChanged() { rootStore.loadDriverSummary(); rootStore.reloadTelemetry() }
        function onCompareDriverChanged() { rootStore.loadDriverSummary(); rootStore.reloadTelemetry() }
    }

    function updateLapMode() {
        var enable = (String(rootStore.ui.activeView) === "telemetry") && rootStore.session.telemetryLapModeAvailable
        rootStore.setTelemetryLapMode(enable)
    }

    Connections {
        target: rootStore.ui
        function onActiveViewChanged() { root.updateLapMode() }
    }

    Connections {
        target: rootStore.session
        function onTelemetryLapModeAvailableChanged() { root.updateLapMode() }
    }

    // Minimal modal overlays (welcome + session switcher)
    Rectangle {
        anchors.fill: parent
        visible: rootStore.ui.activeModal !== ""
        color: Qt.rgba(0, 0, 0, 0.55)
        z: 1000

        Component.onCompleted: {
            if (visible && (rootStore.ui.activeModal === "welcome" || rootStore.ui.activeModal === "session")) {
                if (rootStore.session.catalogYears.length === 0) {
                    rootStore.refreshCatalog()
                }
            }
        }

        onVisibleChanged: {
            if (visible && (rootStore.ui.activeModal === "welcome" || rootStore.ui.activeModal === "session")) {
                if (rootStore.session.catalogYears.length === 0) {
                    rootStore.refreshCatalog()
                }
            }
        }

        MouseArea {
            anchors.fill: parent
            onClicked: rootStore.ui.closeModal()
        }

        Rectangle {
            width: 520
            height: rootStore.ui.activeModal === "race_control"
                    ? 520
                    : (rootStore.ui.activeModal === "welcome" ? 300 : 260)
            radius: 10
            anchors.centerIn: parent
            color: theme.colors.backgroundRaised
            border.color: theme.colors.borderDefault
            border.width: 1

            MouseArea { anchors.fill: parent } // block clicks-through

            Column {
                id: modalForm
                visible: rootStore.ui.activeModal === "welcome" || rootStore.ui.activeModal === "session"
                anchors.fill: parent
                anchors.margins: 20
                spacing: 14

                function raceIndexByName(name) {
                    var races = rootStore.session.catalogRaces
                    for (var i = 0; i < races.length; i++) {
                        if (String(races[i].name) === String(name)) return i
                    }
                    return 0
                }

                Text {
                    text: rootStore.ui.activeModal === "welcome" ? "Welcome to TelemetryX" : "Switch Session"
                    color: theme.colors.foregroundPrimary
                    font.pixelSize: 18
                    font.weight: Font.DemiBold
                }

                Text {
                    width: parent.width
                    wrapMode: Text.WordWrap
                    color: theme.colors.foregroundSecondary
                    font.pixelSize: 12
                    text: rootStore.session.sessionName !== ""
                          ? ("Current: " + rootStore.session.sessionName)
                          : ""
                    visible: rootStore.session.sessionName !== ""
                }

                Text {
                    width: parent.width
                    wrapMode: Text.WordWrap
                    color: theme.colors.foregroundTertiary
                    font.pixelSize: 11
                    visible: rootStore.session.backendStatus !== ""
                    text: rootStore.session.backendStatus
                }

                Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                Column {
                    width: parent.width
                    spacing: 10

                    // Season (year)
                    Row {
                        width: parent.width
                        spacing: 10

                        Text { text: "Season"; width: 70; color: theme.colors.foregroundTertiary; font.pixelSize: 12 }
                        ComboBox {
                            width: parent.width - 80
                            model: rootStore.session.catalogYears
                            currentIndex: Math.max(0, rootStore.session.catalogYears.indexOf(rootStore.session.catalogSelectedYear))
                            enabled: rootStore.session.catalogYears.length > 0
                            opacity: enabled ? 1.0 : 0.55
                            onActivated: function(index) { rootStore.selectCatalogYear(Number(model[index])) }
                        }
                    }

                    // Race
                    Row {
                        width: parent.width
                        spacing: 10

                        Text { text: "Race"; width: 70; color: theme.colors.foregroundTertiary; font.pixelSize: 12 }
                        ComboBox {
                            width: parent.width - 80
                            model: rootStore.session.catalogRaces
                            textRole: "name"
                            currentIndex: modalForm.raceIndexByName(rootStore.session.catalogSelectedRace)
                            enabled: rootStore.session.catalogRaces.length > 0
                            opacity: enabled ? 1.0 : 0.55
                            onActivated: function(index) { rootStore.selectCatalogRace(String(model[index].name)) }
                        }
                    }

                    // Session type
                    Row {
                        spacing: 8

                        Repeater {
                            model: (rootStore.session.catalogAvailableSessions.length > 0
                                    ? rootStore.session.catalogAvailableSessions
                                    : ["R", "Q", "S", "SR"])

                            delegate: TXButton {
                                text: modelData
                                size: "sm"
                                variant: "secondary"
                                enabled: rootStore.session.catalogSelectedYear > 0
                                         && rootStore.session.catalogSelectedRace !== ""
                                opacity: enabled ? 1.0 : 0.55
                                onClicked: rootStore.loadRaceSession(
                                               rootStore.session.catalogSelectedYear,
                                               rootStore.session.catalogSelectedRace,
                                               String(modelData)
                                           )
                            }
                        }
                    }
                }

                Item { height: 6; width: 1 }

                Row {
                    spacing: 10

                    TXButton {
                        text: rootStore.ui.activeModal === "welcome" ? "Continue" : "Close"
                        variant: "primary"
                        size: "md"
                        onClicked: rootStore.ui.closeModal()
                    }

                    TXButton {
                        visible: rootStore.ui.activeModal === "welcome"
                        text: "Switch Session…"
                        variant: "secondary"
                        size: "md"
                        onClicked: {
                            rootStore.ui.openModal("session")
                        }
                    }
                }
            }

            // Race Control modal (notifications)
            Column {
                id: raceControlModal
                visible: rootStore.ui.activeModal === "race_control"
                anchors.fill: parent
                anchors.margins: 20
                spacing: 12

                Text {
                    text: "Race Control"
                    color: theme.colors.foregroundPrimary
                    font.pixelSize: 18
                    font.weight: Font.DemiBold
                }

                Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.6 }

                ListView {
                    width: parent.width
                    height: Math.max(200, parent.height - 80)
                    clip: true
                    model: rootStore.session.raceControlLive
                    spacing: 8

                    delegate: Column {
                        width: ListView.view ? ListView.view.width : 0
                        spacing: 2

                        Text {
                            text: (modelData.time ? ("[" + modelData.time + "] ") : "") +
                                  (modelData.flag ? (String(modelData.flag).toUpperCase() + " • ") : "") +
                                  String(modelData.category || "")
                            font.pixelSize: 11
                            color: theme.colors.foregroundTertiary
                            elide: Text.ElideRight
                        }

                        Text {
                            width: parent.width
                            text: String(modelData.message || "")
                            font.pixelSize: 12
                            color: theme.colors.foregroundSecondary
                            wrapMode: Text.WordWrap
                        }

                        Rectangle { width: parent.width; height: 1; color: theme.colors.borderDefault; opacity: 0.35 }
                    }
                }

                TXButton {
                    text: "Close"
                    variant: "primary"
                    size: "md"
                    onClicked: rootStore.ui.closeModal()
                }
            }
        }
    }
}
