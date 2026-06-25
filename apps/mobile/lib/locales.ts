export const translations = {
  vi: {
    // Tiêu đề & Gợi ý chung
    forgotPassword: "Quên mật khẩu?",
    forgotPasswordDesc: "Vui lòng nhập địa chỉ email của bạn để nhận mã xác minh đặt lại mật khẩu.",
    enterOtp: "Nhập mã xác minh",
    enterOtpDesc: "Mã xác minh gồm 6 chữ số đã được gửi đến ",
    createNewPassword: "Tạo mật khẩu mới",
    createNewPasswordDesc: "Vui lòng đặt mật khẩu mới mạnh và an toàn.",
    success: "Thành công!",
    successDesc: "Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại.",
    
    // Nhãn & Placeholder
    email: "Email",
    emailPlaceholder: "Nhập email của bạn",
    newPassword: "Mật khẩu mới",
    newPasswordPlaceholder: "Nhập mật khẩu mới",
    confirmPassword: "Xác nhận mật khẩu mới",
    confirmPasswordPlaceholder: "Nhập lại mật khẩu mới",
    
    // Nút bấm
    sendOtp: "Gửi mã xác minh",
    verify: "Xác nhận",
    updatePassword: "Cập nhật mật khẩu",
    backToLogin: "Quay lại đăng nhập",
    
    // Lỗi & Cảnh báo
    errorEmailRequired: "Vui lòng nhập email",
    errorPasswordMismatch: "Mật khẩu xác nhận không khớp",
    errorOtpLength: "Mã xác minh phải đủ 6 ký tự",
    errorSendOtpFailed: "Lỗi khi gửi email xác minh",
    errorVerifyFailed: "Mã xác minh không hợp lệ",
    errorResetFailed: "Lỗi khi cập nhật mật khẩu",
    
    // Ràng buộc mật khẩu
    reqTitle: "Yêu cầu mật khẩu:",
    reqMinLength: "Ít nhất 8 ký tự",
    reqLetters: "Có chứa chữ cái (a-z, A-Z)",
    reqUppercase: "Có chứa chữ in hoa (A-Z)",
    reqLowercase: "Có chứa chữ in thường (a-z)",
    reqNumbers: "Có chứa chữ số (0-9)",
    ruleTitle: "Quy tắc an toàn:",
    ruleConsecutive: "Không sử dụng 4 ký tự giống nhau liên tiếp (ví dụ: aaaa, 1111)",
  },
  en: {
    // Titles & General Hints
    forgotPassword: "Forgot Password?",
    forgotPasswordDesc: "Please enter your email address to receive a verification code.",
    enterOtp: "Enter Verification Code",
    enterOtpDesc: "A 6-digit verification code has been sent to ",
    createNewPassword: "Create New Password",
    createNewPasswordDesc: "Please set a strong and secure new password.",
    success: "Success!",
    successDesc: "Your password has been updated successfully. Please log in again.",
    
    // Labels & Placeholders
    email: "Email",
    emailPlaceholder: "Enter your email",
    newPassword: "New Password",
    newPasswordPlaceholder: "Enter new password",
    confirmPassword: "Confirm New Password",
    confirmPasswordPlaceholder: "Re-enter new password",
    
    // Buttons
    sendOtp: "Send Code",
    verify: "Verify",
    updatePassword: "Update Password",
    backToLogin: "Back to Login",
    
    // Errors & Warnings
    errorEmailRequired: "Please enter email address",
    errorPasswordMismatch: "Passwords do not match",
    errorOtpLength: "Verification code must be 6 digits",
    errorSendOtpFailed: "Failed to send verification email",
    errorVerifyFailed: "Invalid verification code",
    errorResetFailed: "Failed to update password",
    
    // Password Constraints
    reqTitle: "Password requirements:",
    reqMinLength: "At least 8 characters",
    reqLetters: "Contains letters (a-z, A-Z)",
    reqUppercase: "Contains uppercase letter (A-Z)",
    reqLowercase: "Contains lowercase letter (a-z)",
    reqNumbers: "Contains number (0-9)",
    ruleTitle: "Security rules:",
    ruleConsecutive: "No 4 identical consecutive characters (e.g., aaaa, 1111)",
  }
};

export type Language = "vi" | "en";
