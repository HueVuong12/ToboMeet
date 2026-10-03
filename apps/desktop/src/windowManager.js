const { BrowserWindow, shell } = require("electron");
const path = require("path");
const { TARGET_URL, ICON_PATH } = require("./constants");

let mainWindow = null;

/**
 * Creates the primary application window.
 * @param {Object} options
 * @param {Function} options.onCloseRequested - Callback when user attempts to close the window
 */
function createMainWindow({ onCloseRequested }) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ToboMeet",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:tobomeet",
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "../preload.js"),
    },
  });

  mainWindow.loadURL(TARGET_URL);

  // Prevent standard window destroy on close, hide to tray instead unless quitting
  mainWindow.on("close", (event) => {
    if (typeof onCloseRequested === "function") {
      onCloseRequested(event);
    }
  });

  // Handle popup windows and external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 1. Allow meeting rooms in a dedicated popup window
    if (url.includes("/meeting")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 800,
          minWidth: 800,
          minHeight: 600,
          title: "ToboMeet Meeting Room",
          icon: ICON_PATH,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: "persist:tobomeet",
            preload: path.join(__dirname, "../preload.js"),
          },
        },
      };
    }

    // 2. Open standard external web links in default system browser
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

/**
 * Checks whether the application window is running in the background (hidden or minimized).
 */
function isAppInBackground() {
  if (!mainWindow) return true;
  return !mainWindow.isVisible() || mainWindow.isMinimized();
}

/**
 * Shows and brings the main window to the front.
 */
function restoreAndFocus() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

/**
 * Sends a navigation event to the Next.js renderer process.
 * @param {string} destinationPath
 */
function navigateTo(destinationPath) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("navigate-to", destinationPath);
  }
}

module.exports = {
  createMainWindow,
  getMainWindow,
  isAppInBackground,
  restoreAndFocus,
  navigateTo,
};
