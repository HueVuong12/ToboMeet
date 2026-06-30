const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ToboMeet",
    icon: path.join(__dirname, 'assets/icon.png'),
    // Các cấu hình để cửa sổ trông giống ứng dụng Native
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:tobomeet" // Giữ lại cache/cookie giữa các lần mở
    }
  });

  // URL của Next.js (Localhost khi dev, Domain production khi build)
  const isDev = !app.isPackaged;
  // Trỏ trực tiếp vào /login để bỏ qua trang Landing page trên Desktop
  const targetUrl = isDev 
    ? 'http://localhost:3000/login' 
    : 'https://tobomeet.com/login'; // Thay đổi bằng domain thực tế sau này

  mainWindow.loadURL(targetUrl);

  // Mở link bên ngoài bằng trình duyệt mặc định thay vì trong app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
