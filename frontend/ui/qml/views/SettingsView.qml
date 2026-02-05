import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15
import "../components/atoms"

Rectangle {
    id: root
    color: theme.colors.backgroundBase

    property var sections: [
        { id: "appearance", label: "Appearance", items: [
            { key: "theme", label: "Theme", type: "select", options: ["dark", "light", "highContrast"], value: "dark" },
            { key: "density", label: "Density", type: "select", options: ["compact", "comfortable"], value: "compact" },
            { key: "reduceMotion", label: "Reduce motion", type: "toggle", value: false },
            { key: "highContrast", label: "High contrast focus", type: "toggle", value: false }
        ]},
        { id: "connection", label: "Connection", items: [
            { key: "apiBase", label: "API Base", type: "info", value: "auto" },
            { key: "refresh", label: "Refresh catalog", type: "action", actionLabel: "Refresh" }
        ]},
        { id: "data", label: "Data", items: [
            { key: "dataRoot", label: "Data root", type: "info", value: "backend/etl/data" },
            { key: "clearSession", label: "Clear session", type: "action", actionLabel: "Clear" }
        ]},
        { id: "about", label: "About", items: [
            { key: "version", label: "Version", type: "info", value: "0.1.0" },
            { key: "build", label: "Build", type: "info", value: "Desktop (PySide6/QML)" }
        ]}
    ]

    property string currentSection: "appearance"
    property var itemsModel: []
    property int gutter: 16

    function sectionById(sectionId) {
        for (var i = 0; i < sections.length; i++) {
            if (sections[i].id === sectionId) return sections[i]
        }
        return null
    }

    function syncItems() {
        var section = sectionById(currentSection)
        itemsModel = section ? (section.items || []) : []
        for (var i = 0; i < itemsModel.length; i++) {
            if (itemsModel[i].key === "theme") itemsModel[i].value = theme.variant
        }
    }

    function setItemValue(idx, value) {
        if (!itemsModel || idx < 0 || idx >= itemsModel.length) return
        itemsModel[idx].value = value
        if (itemsModel[idx].key === "theme") theme.setTheme(value)
    }

    Component.onCompleted: syncItems()
    onCurrentSectionChanged: syncItems()

    RowLayout {
        anchors.fill: parent
        anchors.margins: gutter
        spacing: gutter

        Rectangle {
            Layout.preferredWidth: 240
            Layout.fillHeight: true
            color: theme.colors.backgroundRaised
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 8

            Column {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 8

                Text {
                    text: "SETTINGS"
                    font.pixelSize: 14
                    font.weight: Font.Bold
                    color: theme.colors.foregroundPrimary
                }

                Repeater {
                    model: sections
                    delegate: Rectangle {
                        width: parent.width
                        height: 36
                        radius: 6
                        color: currentSection === modelData.id
                               ? Qt.rgba(theme.colors.accentDefault.r, theme.colors.accentDefault.g, theme.colors.accentDefault.b, 0.12)
                               : "transparent"
                        border.color: currentSection === modelData.id ? theme.colors.accentDefault : "transparent"
                        border.width: 1

                        Text {
                            anchors.centerIn: parent
                            text: modelData.label
                            font.pixelSize: 12
                            color: currentSection === modelData.id ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary
                        }

                        MouseArea {
                            anchors.fill: parent
                            onClicked: currentSection = modelData.id
                        }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: theme.colors.backgroundRaised
            border.color: theme.colors.borderDefault
            border.width: 1
            radius: 8

            Flickable {
                anchors.fill: parent
                anchors.margins: 16
                contentWidth: width
                contentHeight: contentColumn.implicitHeight
                clip: true

                ColumnLayout {
                    id: contentColumn
                    width: parent.width
                    spacing: 12

                    Text {
                        text: sectionById(currentSection) ? sectionById(currentSection).label : ""
                        font.pixelSize: 18
                        font.weight: Font.Bold
                        color: theme.colors.foregroundPrimary
                    }

                    Repeater {
                        model: itemsModel
                        delegate: RowLayout {
                            Layout.fillWidth: true
                            spacing: 12

                            Text {
                                text: modelData.label
                                font.pixelSize: 12
                                color: theme.colors.foregroundSecondary
                                Layout.fillWidth: true
                            }

                            Loader {
                                id: controlLoader
                                sourceComponent: modelData.type === "toggle" ? toggleComp
                                              : modelData.type === "select" ? selectComp
                                              : modelData.type === "action" ? actionComp
                                              : infoComp
                            }

                            Component {
                                id: toggleComp
                                Switch {
                                    checked: !!modelData.value
                                    onToggled: root.setItemValue(index, checked)
                                }
                            }

                            Component {
                                id: selectComp
                                ComboBox {
                                    model: modelData.options || []
                                    currentIndex: (modelData.options || []).indexOf(modelData.value)
                                    onActivated: root.setItemValue(index, modelData.options[currentIndex])
                                }
                            }

                            Component {
                                id: actionComp
                                TXButton {
                                    text: modelData.actionLabel || "Run"
                                    onClicked: {
                                        if (modelData.key === "refresh") rootStore.refreshCatalog()
                                        if (modelData.key === "clearSession") rootStore.clearSession()
                                    }
                                }
                            }

                            Component {
                                id: infoComp
                                Text {
                                    text: modelData.value || "—"
                                    font.pixelSize: 12
                                    color: theme.colors.foregroundPrimary
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
