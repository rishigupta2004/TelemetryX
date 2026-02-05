import QtQuick 2.15
import QtQuick.Layouts 1.15
import "components/atoms"

/*!
    PlaybackBar - Playback Control Bar (56px height)
    
    From Frontend_ArchitectureOverview.md Part 4, Section 1.3
    
    Components:
    - Transport controls (Start, Step back, Play/Pause, Step forward, End)
    - Timeline with lap markers
    - Playback rate dropdown (0.25x - 4x)
    - Live indicator (when in live mode)
*/

Rectangle {
    id: root
    
    height: 56
    color: theme.colors.backgroundRaised
    border.color: theme.colors.borderDefault
    border.width: 1
    
    // Properties
    property real currentTime: 0
    property real totalTime: 5725  // 1:32:45 in seconds
    property real currentLap: 25
    property real totalLaps: 57
    property bool isPlaying: false
    property real playbackRate: 1.0
    property bool isLive: false
    
    // Signals
    signal startClicked()
    signal stepBackClicked()
    signal playPauseClicked()
    signal stepForwardClicked()
    signal endClicked()
    signal seekRequested(real time)
    signal rateChanged(real rate)
    
    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 16
        anchors.rightMargin: 16
        spacing: 16
        
        // Transport controls
        Row {
            spacing: 8
            Layout.alignment: Qt.AlignVCenter
            
            // Start
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: startMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                
                Text {
                    anchors.centerIn: parent
                    text: "⏮"
                    font.pixelSize: 16
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: startMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.startClicked()
                }
            }
            
            // Step back
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: backMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                
                Text {
                    anchors.centerIn: parent
                    text: "◀◀"
                    font.pixelSize: 14
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: backMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.stepBackClicked()
                }
            }
            
            // Play/Pause
            Rectangle {
                width: 40
                height: 40
                radius: 20
                color: playMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.15) : Qt.rgba(1, 1, 1, 0.1)
                
                Text {
                    anchors.centerIn: parent
                    text: root.isPlaying ? "⏸" : "▶"
                    font.pixelSize: root.isPlaying ? 16 : 18
                    color: theme.colors.foregroundPrimary
                }
                
                MouseArea {
                    id: playMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.playPauseClicked()
                }
            }
            
            // Step forward
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: forwardMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                
                Text {
                    anchors.centerIn: parent
                    text: "▶▶"
                    font.pixelSize: 14
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: forwardMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.stepForwardClicked()
                }
            }
            
            // End
            Rectangle {
                width: 32
                height: 32
                radius: 6
                color: endMouse.containsMouse ? Qt.rgba(1, 1, 1, 0.1) : "transparent"
                
                Text {
                    anchors.centerIn: parent
                    text: "⏭"
                    font.pixelSize: 16
                    color: theme.colors.foregroundSecondary
                }
                
                MouseArea {
                    id: endMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.endClicked()
                }
            }
        }
        
        // Timeline
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 32
            color: theme.colors.backgroundBase
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 4
            
            Column {
                anchors.fill: parent
                anchors.margins: 6
                spacing: 2
                
                // Time display and progress
                Row {
                    width: parent.width
                    spacing: 8
                    
                    Text {
                        text: formatTime(root.currentTime)
                        font.pixelSize: 11
                        font.family: theme.typography.mono
                        color: theme.colors.foregroundSecondary
                    }
                    
                    Item {
                        width: parent.width - 160
                        height: 12
                        
                        // Progress bar background
                        Rectangle {
                            anchors.verticalCenter: parent.verticalCenter
                            width: parent.width
                            height: 4
                            radius: 2
                            color: theme.colors.borderDefault
                            
                            // Progress fill
                            Rectangle {
                                width: parent.width * (root.currentTime / root.totalTime)
                                height: parent.height
                                radius: parent.radius
                                color: theme.colors.accentDefault
                            }
                            
                            // Lap markers
                            Repeater {
                                model: root.totalLaps
                                
                                Rectangle {
                                    x: (index / (root.totalLaps - 1)) * parent.width - 1
                                    y: -2
                                    width: 2
                                    height: 8
                                    color: theme.colors.borderDefault
                                    visible: index % 5 === 0
                                }
                            }
                        }
                        
                        // Handle
                        Rectangle {
                            x: (parent.width * (root.currentTime / root.totalTime)) - 6
                            anchors.verticalCenter: parent.verticalCenter
                            width: 12
                            height: 12
                            radius: 6
                            color: theme.colors.accentDefault
                            border.color: "white"
                            border.width: 2
                        }
                    }
                    
                    Text {
                        text: formatTime(root.totalTime)
                        font.pixelSize: 11
                        font.family: theme.typography.mono
                        color: theme.colors.foregroundSecondary
                    }
                }
                
                // Lap indicator
                Text {
                    text: "LAP " + Math.floor(root.currentLap) + "/" + root.totalLaps
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    font.family: theme.typography.mono
                    color: theme.colors.foregroundSecondary
                }
            }
            
            MouseArea {
                anchors.fill: parent
                onClicked: function(mouse) {
                    var clickX = mouse.x - 50  // Adjust for time labels
                    var progress = Math.max(0, Math.min(1, clickX / (width - 100)))
                    root.seekRequested(progress * root.totalTime)
                }
            }
        }
        
        // Rate selector
        Rectangle {
            Layout.preferredWidth: 60
            Layout.preferredHeight: 28
            color: rateMouse.pressed ? theme.colors.backgroundElevated : theme.colors.backgroundBase
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 4
            
            Text {
                anchors.centerIn: parent
                text: root.playbackRate + "x"
                font.pixelSize: 12
                font.family: theme.typography.mono
                color: theme.colors.foregroundSecondary
            }
            
            MouseArea {
                id: rateMouse
                anchors.fill: parent
                onClicked: function() {
                    var rates = [0.25, 0.5, 1, 2, 4]
                    var currentIndex = rates.indexOf(root.playbackRate)
                    var nextIndex = (currentIndex + 1) % rates.length
                    root.rateChanged(rates[nextIndex])
                }
            }
        }
        
        // Live indicator
        TXBadge {
            visible: root.isLive
            text: "LIVE"
            colorScheme: "success"
            variant: "solid"
            dot: true
            Layout.alignment: Qt.AlignVCenter
        }
    }
    
    function formatTime(seconds) {
        var h = Math.floor(seconds / 3600)
        var m = Math.floor((seconds % 3600) / 60)
        var s = Math.floor(seconds % 60)
        return pad(h) + ":" + pad(m) + ":" + pad(s)
    }
    
    function pad(num) {
        return num < 10 ? "0" + num : num
    }
}
