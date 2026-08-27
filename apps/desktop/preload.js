const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Lắng nghe danh sách màn hình từ Electron gửi sang
  onScreenShareRequest: (callback) =>
    ipcRenderer.on("show-screen-share-dialog", (_event, sources) =>
      callback(sources),
    ),

  // Gửi ID màn hình người dùng đã chọn ngược lại cho Electron
  selectScreenShare: (sourceId) =>
    ipcRenderer.send("screen-share-selected", sourceId),

  // Mở hộp thoại chọn thư mục lưu
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  prepareRecording: () => ipcRenderer.invoke("prepare-recording"),
  startRecording: (config) => ipcRenderer.send("start-recording", config),
  saveVideoChunk: (buffer) => ipcRenderer.send("save-video-chunk", buffer),
  stopRecording: () => ipcRenderer.send("stop-recording"),
});
