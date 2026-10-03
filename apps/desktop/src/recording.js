const { app, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

let writeStream = null;
let recordingConfig = { format: "webm", savePath: "" };
let tempFilePath = "";

/**
 * Executes FFmpeg command with given arguments.
 */
function runFfmpeg(input, output, encoder, callback) {
  const args = [
    "-y",
    "-i",
    input,
    "-c:v",
    encoder,
    "-preset",
    "fast",
    "-c:a",
    "aac",
    output,
  ];

  const proc = spawn(ffmpegPath, args);

  proc.on("close", (code) => {
    if (code === 0) callback(null);
    else callback(new Error(`FFmpeg error code: ${code}`));
  });
}

/**
 * Converts recorded WebM video into MP4 using hardware acceleration when available.
 */
function convertWebMToMp4(inputPath, outputPath) {
  const hwEncoders =
    process.platform === "darwin"
      ? ["h264_videotoolbox"]
      : ["h264_nvenc", "h264_qsv", "h264_amf"];

  const tryConvert = (encoders) => {
    if (encoders.length === 0) {
      console.log("[Recording] Using CPU software encoder (libx264)...");
      runFfmpeg(inputPath, outputPath, "libx264", (err) => {
        if (!err && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      });
      return;
    }

    const encoder = encoders[0];
    runFfmpeg(inputPath, outputPath, encoder, (err) => {
      if (err) {
        console.log(`[Recording] Hardware encoder [${encoder}] unavailable, trying fallback...`);
        tryConvert(encoders.slice(1));
      } else {
        console.log("[Recording] Hardware MP4 conversion completed successfully.");
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      }
    });
  };

  tryConvert(hwEncoders);
}

/**
 * Registers IPC handlers for meeting recording and saving files.
 */
function setupRecordingIpc() {
  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.on("start-recording", (_event, config) => {
    recordingConfig = config || { format: "webm", savePath: "" };

    const folder = recordingConfig.savePath || app.getPath("downloads");
    const fileName = `ToboMeet-Record-${Date.now()}`;

    if (recordingConfig.format === "mp4") {
      tempFilePath = path.join(app.getPath("temp"), `${fileName}.webm`);
      writeStream = fs.createWriteStream(tempFilePath);
      console.log(`[Recording] Writing temporary file to: ${tempFilePath}`);
    } else {
      const finalPath = path.join(folder, `${fileName}.webm`);
      writeStream = fs.createWriteStream(finalPath);
      console.log(`[Recording] Recording WebM directly to: ${finalPath}`);
    }
  });

  ipcMain.on("save-video-chunk", (_event, arrayBuffer) => {
    if (writeStream) {
      const buffer = Buffer.from(arrayBuffer);
      writeStream.write(buffer);
    }
  });

  ipcMain.on("stop-recording", () => {
    if (writeStream) {
      writeStream.end();
      writeStream = null;

      if (recordingConfig.format === "mp4") {
        const folder = recordingConfig.savePath || app.getPath("downloads");
        const finalPath = path.join(folder, `ToboMeet-Record-${Date.now()}.mp4`);

        console.log("[Recording] Starting MP4 transcoding...");
        convertWebMToMp4(tempFilePath, finalPath);
      } else {
        console.log("[Recording] WebM video saved successfully.");
      }
    }
  });
}

module.exports = {
  setupRecordingIpc,
  convertWebMToMp4,
};
