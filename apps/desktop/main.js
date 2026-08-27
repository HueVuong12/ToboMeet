const {
  app,
  BrowserWindow,
  shell,
  desktopCapturer,
  session,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

let writeStream = null;
let mainWindow;
let recordingConfig = { format: "webm", savePath: "" };
let tempFilePath = "";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ToboMeet",
    icon: path.join(__dirname, "assets/icon.png"),
    // Các cấu hình để cửa sổ trông giống ứng dụng Native
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:tobomeet", // Giữ lại cache/cookie giữa các lần mở
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // URL của Next.js (Localhost khi dev, Domain production khi build)
  const isDev = !app.isPackaged;
  // Trỏ trực tiếp vào /login để bỏ qua trang Landing page trên Desktop
  const targetUrl = isDev
    ? "http://localhost:3000/login"
    : "https://tobomeet.com/login"; // Thay đổi bằng domain thực tế sau này

  mainWindow.loadURL(targetUrl);

  // Cấu hình xử lý khi mở cửa sổ mới (window.open)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 1. Nếu là link phòng họp -> Cho phép Electron mở một Popup Window mới
    if (url.includes("/meeting")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 800,
          minWidth: 800,
          minHeight: 600,
          title: "Phòng họp ToboMeet",
          icon: path.join(__dirname, "assets/icon.png"),
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: "persist:tobomeet", // Kế thừa chung partition để chia sẻ thông tin đăng nhập/cache
            preload: path.join(__dirname, "preload.js"),
          },
        },
      };
    }

    // 2. Nếu là các link web thông thường (Google, Github...) -> Mở bằng Chrome/Edge
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  const meetingSession = session.fromPartition("persist:tobomeet");

  session
    .fromPartition("persist:tobomeet")
    .setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === "media") {
        callback(true);
      } else {
        callback(false);
      }
    });

  let autoApproveRecording = false;

  ipcMain.handle("prepare-recording", () => {
    autoApproveRecording = true;
    return true;
  });

  meetingSession.setDisplayMediaRequestHandler(async (request, callback) => {
    // Tạo một biến cờ để theo dõi xem callback đã được gọi chưa (Fix triệt để lỗi gọi 2 lần)
    let isCallbackCalled = false;

    // Hàm bọc callback an toàn
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

      // ==========================================
      // TRƯỜNG HỢP 1: NẾU ĐANG LÀ QUAY MÀN HÌNH (Tự duyệt)
      // ==========================================
      if (autoApproveRecording) {
        autoApproveRecording = false;
        return safeCallback({
          video: focusedWindow.webContents.mainFrame,
          audio: "loopback",
        });
      }

      // ==========================================
      // TRƯỜNG HỢP 2: NẾU ĐANG LÀ SHARE MÀN HÌNH (Hiện Popup)
      // ==========================================
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
      });

      const serializedSources = sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));

      // Bắn sự kiện sang cho React hiển thị Modal
      focusedWindow.webContents.send(
        "show-screen-share-dialog",
        serializedSources,
      );

      // Chờ React gửi lại ID
      ipcMain.once("screen-share-selected", (event, sourceId) => {
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
      console.error("Lỗi lấy danh sách màn hình:", err);
      safeCallback();
    }
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Mở hộp thoại chọn thư mục lưu file recording
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Bắt đầu ghi cuộc họp
ipcMain.on("start-recording", (event, config) => {
  recordingConfig = config || { format: "webm", savePath: "" };

  // Nếu người dùng không chọn, lưu mặc định vào thư mục Downloads
  const folder = recordingConfig.savePath || app.getPath("downloads");
  const fileName = `ToboMeet-Record-${Date.now()}`;

  // Nếu chọn MP4, lưu tạm thành WebM trước, tí nữa sẽ convert
  if (recordingConfig.format === "mp4") {
    tempFilePath = path.join(app.getPath("temp"), `${fileName}.webm`);
    writeStream = fs.createWriteStream(tempFilePath);
    console.log("Đang ghi file tạm tại:", tempFilePath);
  } else {
    // Nếu chọn WebM thì ghi thẳng ra thư mục đích luôn
    const finalPath = path.join(folder, `${fileName}.webm`);
    writeStream = fs.createWriteStream(finalPath);
    console.log("Bắt đầu ghi file WebM tại:", finalPath);
  }
});

// Lưu từng chunk video webM
ipcMain.on("save-video-chunk", (event, arrayBuffer) => {
  if (writeStream) {
    const buffer = Buffer.from(arrayBuffer);
    writeStream.write(buffer);
  }
});

// Dừng quay và kết xuất video định dạng .webM hoặc .mp4
ipcMain.on("stop-recording", (event) => {
  if (writeStream) {
    writeStream.end();
    writeStream = null;

    // Nếu định dạng là MP4, tiến hành transcode H.264
    if (recordingConfig.format === "mp4") {
      const folder = recordingConfig.savePath || app.getPath("downloads");
      const finalPath = path.join(folder, `ToboMeet-Record-${Date.now()}.mp4`);

      console.log("Bắt đầu chuyển đổi sang MP4...");
      convertWebMToMp4(tempFilePath, finalPath);
    } else {
      console.log("Đã lưu xong video WebM!");
    }
  }
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Helpers, utils

function convertWebMToMp4(inputPath, outputPath) {
  // Danh sách các bộ mã hóa phần cứng theo hệ điều hành
  const hwEncoders =
    process.platform === "darwin"
      ? ["h264_videotoolbox"] // Apple Silicon / Intel Mac
      : ["h264_nvenc", "h264_qsv", "h264_amf"]; // NVIDIA, Intel, AMD trên Windows/Linux

  const tryConvert = (encoders) => {
    // Nếu đã thử hết Card Đồ Họa mà vẫn xịt -> Fallback về CPU (Software Encoder)
    if (encoders.length === 0) {
      console.log("Sử dụng CPU (libx264) để encode...");
      runFfmpeg(inputPath, outputPath, "libx264", (err) => {
        if (!err) fs.unlinkSync(inputPath); // Xóa file tạm
      });
      return;
    }

    const encoder = encoders[0];
    runFfmpeg(inputPath, outputPath, encoder, (err) => {
      if (err) {
        console.log(
          `Hardware encoder [${encoder}] không khả dụng, đang thử cách khác...`,
        );
        tryConvert(encoders.slice(1)); // Thử encoder tiếp theo
      } else {
        console.log("Chuyển đổi MP4 bằng phần cứng thành công!");
        fs.unlinkSync(inputPath); // Xóa file tạm
      }
    });
  };

  tryConvert(hwEncoders);
}

function runFfmpeg(input, output, encoder, callback) {
  const args = [
    "-y", // Ghi đè nếu trùng tên
    "-i",
    input,
    "-c:v",
    encoder,
    "-preset",
    "fast", // Nén nhanh
    "-c:a",
    "aac", // Chuẩn âm thanh cho MP4
    output,
  ];

  const proc = spawn(ffmpegPath, args);

  proc.on("close", (code) => {
    if (code === 0) callback(null);
    else callback(new Error(`FFmpeg error code: ${code}`));
  });
}
