import * as nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";

async function generateAccount() {
  console.log("⏳ Đang khởi tạo tài khoản SMTP test trên Ethereal.email...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    
    console.log("✅ Khởi tạo thành công!");
    console.log(`User: ${testAccount.user}`);
    console.log(`Pass: ${testAccount.pass}`);
    console.log(`Web check mail: ${testAccount.web}`);

    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Thay thế các dòng placeholder cũ bằng cấu hình thực tế của Ethereal
    envContent = envContent.replace(/SMTP_HOST=.*/, `SMTP_HOST=${testAccount.smtp.host}`);
    envContent = envContent.replace(/SMTP_PORT=.*/, `SMTP_PORT=${testAccount.smtp.port}`);
    envContent = envContent.replace(/SMTP_USER=.*/, `SMTP_USER=${testAccount.user}`);
    envContent = envContent.replace(/SMTP_PASS=.*/, `SMTP_PASS=${testAccount.pass}`);
    envContent = envContent.replace(/SMTP_FROM=.*/, `SMTP_FROM="ToboMeet Support" <${testAccount.user}>`);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("💾 Đã tự động cập nhật thông tin cấu hình vào file apps/server/.env!");
  } catch (err) {
    console.error("❌ Lỗi khi khởi tạo tài khoản test:", err);
  }
}

generateAccount();
