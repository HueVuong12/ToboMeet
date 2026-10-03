const { app } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

/**
 * Normalizes Socket URL.
 * On Windows, Node.js in Electron resolves 'localhost' to IPv6 (::1),
 * which leads to ECONNREFUSED when backend binds to IPv4.
 */
function normalizeSocketUrl(url) {
  if (!url) return url;
  let cleanUrl = url.replace(/\/api\/?$/, "");
  if (isDev && cleanUrl.includes("localhost")) {
    cleanUrl = cleanUrl.replace("localhost", "127.0.0.1");
  }
  return cleanUrl;
}

const DEFAULT_SOCKET_URL = isDev
  ? process.env.SOCKET_URL || "http://127.0.0.1:3001"
  : "https://tobomeet.com";

const TARGET_URL = isDev
  ? "http://localhost:3000/login"
  : "https://tobomeet.com/login";

const CLIENT_ORIGIN = isDev ? "http://localhost:3000" : "https://tobomeet.com";

const APP_ID = "com.tobomeet.app";
const APP_NAME = "ToboMeet";
const ICON_PATH = path.join(__dirname, "../assets/icon.png");

module.exports = {
  isDev,
  normalizeSocketUrl,
  DEFAULT_SOCKET_URL,
  TARGET_URL,
  CLIENT_ORIGIN,
  APP_ID,
  APP_NAME,
  ICON_PATH,
};
