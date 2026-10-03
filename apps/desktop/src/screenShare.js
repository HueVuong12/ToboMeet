const { BrowserWindow, desktopCapturer, ipcMain } = require("electron");

let autoApproveRecording = false;

function setAutoApproveRecording(enabled) {
  autoApproveRecording = Boolean(enabled);
}

/**
 * Configures display media request handlers for screen sharing and meeting recording.
 * @param {Electron.Session} meetingSession
 */
function setupScreenShareHandler(meetingSession) {
  ipcMain.handle("prepare-recording", () => {
    setAutoApproveRecording(true);
    return true;
  });

  meetingSession.setDisplayMediaRequestHandler(async (request, callback) => {
    let isCallbackCalled = false;
    const safeCallback = (data) => {
      if (!isCallbackCalled) {
        isCallbackCalled = true;
        callback(data);
      }
    };

    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow) {
        return safeCallback();
      }

      // 1. Screen recording (auto-approved without modal prompt)
      if (autoApproveRecording) {
        autoApproveRecording = false;
        return safeCallback({
          video: focusedWindow.webContents.mainFrame,
          audio: "loopback",
        });
      }

      // 2. Screen sharing in meeting (shows picker dialog to user)
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
      });

      const serializedSources = sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));

      focusedWindow.webContents.send(
        "show-screen-share-dialog",
        serializedSources,
      );

      ipcMain.once("screen-share-selected", (_event, sourceId) => {
        if (!sourceId) {
          return safeCallback();
        }

        const selectedSource = sources.find((s) => s.id === sourceId);
        if (selectedSource) {
          return safeCallback({ video: selectedSource, audio: "loopback" });
        } else {
          return safeCallback();
        }
      });
    } catch (err) {
      console.error("[ScreenShare] Error retrieving screen sources:", err);
      safeCallback();
    }
  });
}

module.exports = {
  setupScreenShareHandler,
  setAutoApproveRecording,
};
