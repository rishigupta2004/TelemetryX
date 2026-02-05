import QtQuick 2.15
import QtQuick.Controls 2.15
import "../components/organisms"
import "../components/atoms"

/*!
    StrategyView (minimal)

    Goals:
    - Keep QML short and real-data driven
    - Show feature output: tyre stints
    - Trigger ML: undercut predictor
*/

Rectangle {
    id: root
    color: theme.colors.backgroundBase

    property int gutter: 16
    property string attackerCode: ""
    property string defenderCode: ""
    property bool showRaceStrategy: ["R", "S", "SR"].indexOf(String(rootStore.session.session || "")) !== -1

    function compoundColor(compound) {
        var c = String(compound || "").toUpperCase()
        if (c === "SOFT") return "#EF4444"
        if (c === "MEDIUM") return "#F59E0B"
        if (c === "HARD") return "#FFFFFF"
        if (c === "INTER") return "#22C55E"
        if (c === "WET") return "#3B82F6"
        return theme.colors.foregroundTertiary
    }

    Component.onCompleted: {
        if (!attackerCode) attackerCode = rootStore.driver.primaryDriver
        if (!defenderCode) defenderCode = rootStore.driver.compareDriver

        if (!attackerCode && rootStore.driver.allDrivers.length > 0)
            attackerCode = rootStore.driver.allDrivers[0].code

        if (!defenderCode && rootStore.driver.allDrivers.length > 1)
            defenderCode = rootStore.driver.allDrivers[1].code
    }

    Item {
        anchors.fill: parent
        anchors.margins: gutter

        Column {
            anchors.fill: parent
            spacing: gutter

            TXPanelShell {
                id: stintsPanel
                width: parent.width
                height: root.showRaceStrategy ? Math.max(220, Math.round(parent.height * 0.55)) : parent.height
                title: "Tyre Stints"
                status: rootStore.session.tyreStints.length > 0 ? "ready" : "stale"
                updatedText: "backend"

                panelContent: Flickable {
                    anchors.fill: parent
                    contentWidth: width
                    contentHeight: listCol.implicitHeight
                    clip: true

                    Column {
                        id: listCol
                        width: parent.width
                        spacing: 8

                        Item { visible: false }

                        Repeater {
                            model: rootStore.session.tyreStints

                            Rectangle {
                                width: parent.width
                                height: 34
                                radius: 6
                                color: Qt.rgba(1, 1, 1, 0.03)
                                border.color: theme.colors.borderDefault
                                border.width: 1

                                Row {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 10

                                    Rectangle {
                                        width: 10
                                        height: 10
                                        radius: 2
                                        anchors.verticalCenter: parent.verticalCenter
                                        color: root.compoundColor(modelData.compound)
                                    }

                                    Text {
                                        width: 44
                                        text: String(modelData.code || "")
                                        color: theme.colors.foregroundPrimary
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        elide: Text.ElideRight
                                        anchors.verticalCenter: parent.verticalCenter
                                    }

                                    Text {
                                        text: "Stint " + String(modelData.stintNumber || "")
                                        color: theme.colors.foregroundSecondary
                                        font.pixelSize: 12
                                        anchors.verticalCenter: parent.verticalCenter
                                    }

                                    Text {
                                        text: String(modelData.compound || "").toUpperCase() + " • Lap " +
                                              String(modelData.firstLap || "") + "-" + String(modelData.lastLap || "") +
                                              " • " + String(modelData.laps || "") + " laps"
                                        color: theme.colors.foregroundSecondary
                                        font.pixelSize: 12
                                        elide: Text.ElideRight
                                        anchors.verticalCenter: parent.verticalCenter
                                    }
                                }
                            }
                        }
                    }
                }
            }

            TXPanelShell {
                id: mlPanel
                width: parent.width
                height: root.showRaceStrategy ? Math.max(220, parent.height - (stintsPanel.height + gutter)) : 0
                title: "Undercut Predictor (ML)"
                status: "ready"
                updatedText: "backend"
                showPopout: false
                visible: root.showRaceStrategy

                panelContent: Column {
                    anchors.fill: parent
                    spacing: 12

                    Row {
                        width: parent.width
                        spacing: 12

                        Column {
                            width: Math.max(220, Math.round((parent.width - 12) * 0.4))
                            spacing: 6

                            Text { text: "Attacker"; color: theme.colors.foregroundTertiary; font.pixelSize: 11 }
                            TextField {
                                width: parent.width
                                placeholderText: "e.g. VER"
                                text: attackerCode
                                onTextEdited: attackerCode = text.trim().toUpperCase()
                            }
                        }

                        Column {
                            width: Math.max(220, parent.width - (parent.children[0].width + 12))
                            spacing: 6

                            Text { text: "Defender"; color: theme.colors.foregroundTertiary; font.pixelSize: 11 }
                            TextField {
                                width: parent.width
                                placeholderText: "e.g. LEC"
                                text: defenderCode
                                onTextEdited: defenderCode = text.trim().toUpperCase()
                            }
                        }
                    }

                    Row {
                        width: parent.width
                        spacing: 10

                        TXButton {
                            text: "Predict Undercut"
                            variant: "primary"
                            size: "sm"
                            enabled: attackerCode.length > 0
                            onClicked: rootStore.session.predictUndercut(attackerCode, defenderCode)
                        }

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            color: theme.colors.foregroundTertiary
                            font.pixelSize: 11
                            text: rootStore.session.undercutPrediction && rootStore.session.undercutPrediction.error
                                  ? String(rootStore.session.undercutPrediction.error)
                                  : ""
                            elide: Text.ElideRight
                        }
                    }

                    Rectangle {
                        width: parent.width
                        height: 1
                        color: theme.colors.borderDefault
                        opacity: 0.6
                    }

                    Item {
                        id: mlResult
                        width: parent.width
                        height: Math.max(80, parent.height - 120)

                        property var predObj: rootStore.session.undercutPrediction
                        property var resultObj: predObj && predObj.result ? predObj.result : null
                        property real prob: (resultObj && resultObj.success_probability !== undefined) ? Number(resultObj.success_probability) : 0

                        Rectangle {
                            anchors.fill: parent
                            radius: 8
                            color: Qt.rgba(1, 1, 1, 0.03)
                            border.color: theme.colors.borderDefault
                            border.width: 1

                            Column {
                                anchors.fill: parent
                                anchors.margins: 12
                                spacing: 10

                                Text {
                                    color: theme.colors.foregroundPrimary
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                    text: mlResult.resultObj
                                          ? (String(mlResult.resultObj.prediction || "").toUpperCase() === "SUCCESS"
                                             ? "UNDERCUT LIKELY TO SUCCEED"
                                             : "UNDERCUT UNLIKELY TO SUCCEED")
                                          : ""
                                    visible: !!mlResult.resultObj
                                }

                                // Probability bar
                                Rectangle {
                                    width: parent.width
                                    height: 10
                                    radius: 5
                                    color: theme.colors.backgroundBase
                                    border.color: theme.colors.borderDefault
                                    border.width: 1

                                    Rectangle {
                                        width: Math.max(0, Math.min(1, mlResult.prob)) * parent.width
                                        height: parent.height
                                        radius: parent.radius
                                        color: Math.max(0, Math.min(1, mlResult.prob)) >= 0.6 ? "#22C55E" : "#F59E0B"
                                    }
                                }

                                Text {
                                    color: theme.colors.foregroundSecondary
                                    font.pixelSize: 12
                                    text: mlResult.resultObj
                                          ? ("Confidence: " + String(mlResult.resultObj.confidence || "") +
                                             " • Probability: " + Math.round(Math.max(0, Math.min(1, mlResult.prob)) * 100) + "%")
                                          : ""
                                    visible: !!mlResult.resultObj
                                }

                                Text {
                                    visible: !!(mlResult.predObj && mlResult.predObj.inputs)
                                    color: theme.colors.foregroundTertiary
                                    font.pixelSize: 11
                                    wrapMode: Text.WordWrap
                                    text: mlResult.predObj && mlResult.predObj.inputs
                                          ? ("Inputs: pos " + String(mlResult.predObj.inputs.position_before_pit || "") +
                                             " • age " + String(mlResult.predObj.inputs.tyre_age || "") +
                                             " • stint " + String(mlResult.predObj.inputs.stint_length || "") +
                                             " • " + String(mlResult.predObj.inputs.compound || "").toUpperCase())
                                          : ""
                                }

                                Text {
                                    visible: !!(mlResult.resultObj && mlResult.resultObj.recommendations && mlResult.resultObj.recommendations.length > 0)
                                    color: theme.colors.foregroundSecondary
                                    font.pixelSize: 11
                                    wrapMode: Text.WordWrap
                                    text: mlResult.resultObj && mlResult.resultObj.recommendations
                                          ? ("Notes: " + String(mlResult.resultObj.recommendations.join(" • ")))
                                          : ""
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
