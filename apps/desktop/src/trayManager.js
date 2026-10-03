const { Tray, Menu } = require("electron");
const { ICON_PATH, APP_NAME } = require("./constants");

let tray = null;

/**
 * Initializes the system tray with context menu and click handlers.
 * @param {Object} handlers
 * @param {Function} handlers.onOpen - Callback when user clicks 'Open' or clicks tray icon
 * @param {Function} handlers.onQuit - Callback when user clicks 'Quit'
 */
function createTray({ onOpen, onQuit }) {
  if (tray) return tray;

  tray = new Tray(ICON_PATH);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open ${APP_NAME}`,
      click: () => {
        if (typeof onOpen === "function") onOpen();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        if (typeof onQuit === "function") onQuit();
      },
    },
  ]);

  tray.setToolTip(`${APP_NAME} - Video Conferencing Platform`);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (typeof onOpen === "function") onOpen();
  });

  tray.on("double-click", () => {
    if (typeof onOpen === "function") onOpen();
  });

  return tray;
}

function getTray() {
  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  createTray,
  getTray,
  destroyTray,
};
