import * as nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import * as path from "path";

// Load file .env
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testSMTP() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"ToboMeet Support" <noreply@tobomeet.com>';

  console.log("=== THÔNG TIN SMTP CONFIG ===");
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Pass: ${pass ? "********" : "TRỐNG"}`);
  console.log(`From: ${from}`);
  console.log("=============================");

  if (!host || !user || !pass) {
    console.error("❌ LỖI: Thiếu thông tin SMTP trong file .env!");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    console.log("⏳ Đang thử kết nối SMTP...");
    await transporter.verify();
    console.log("✅ KẾT NỐI SMTP THÀNH CÔNG!");
  } catch (err: any) {
    console.error("❌ LỖI KẾT NỐI SMTP:");
    console.error(err);
  }
}

testSMTP();
