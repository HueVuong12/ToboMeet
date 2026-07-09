const {
  app,
  BrowserWindow,
  shell,
  desktopCapturer,
  session,
  ipcMain,
} = require("electron");
const path = require("path");

let mainWindow;

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

  // CẤP QUYỀN TỰ ĐỘNG
  session
    .fromPartition("persist:tobomeet")
    .setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === "media") {
        callback(true); // TỰ ĐỘNG ĐỒNG Ý QUYỀN CAMERA/MIC
      } else {
        callback(false);
      }
    });

  // CẤU HÌNH FIX LỖI SHARE MÀN HÌNH CHO ELECTRON
  meetingSession.setDisplayMediaRequestHandler((request, callback) => {
    // Lấy cả Màn hình (screen) và Ứng dụng đang mở (window)
    desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((sources) => {
        // Lấy cửa sổ hiện tại (chính là cửa sổ phòng họp đang được focus)
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (!focusedWindow) return callback();

        // Đóng gói danh sách nguồn (Biến ảnh thumbnail thành chuỗi Base64 để React đọc được)
        const serializedSources = sources.map((source) => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL(), // Ảnh xem trước
        }));

        // Bắn sự kiện sang cho React hiển thị Modal
        focusedWindow.webContents.send(
          "show-screen-share-dialog",
          serializedSources,
        );

        // Chờ React gửi lại ID của màn hình được chọn
        ipcMain.once("screen-share-selected", (event, sourceId) => {
          if (!sourceId) {
            return callback(); // Người dùng bấm Hủy
          }

          // Tìm đúng nguồn đã chọn và cấp quyền chia sẻ
          const selectedSource = sources.find((s) => s.id === sourceId);
          if (selectedSource) {
            callback({ video: selectedSource, audio: "loopback" });
          } else {
            callback();
          }
        });
      })
      .catch((err) => {
        console.error("Lỗi lấy danh sách màn hình:", err);
        callback();
      });
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
