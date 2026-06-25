// Shared utility functions — dùng chung cho Web, Mobile, Desktop

/**
 * Gộp Tailwind class names (tương tự clsx/cn)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Tạo mã phòng họp ngẫu nhiên (format: xxx-xxxx-xxx)
 */
export function generateRoomCode(): string {
  const segment = (len: number) =>
    Math.random()
      .toString(36)
      .substring(2, 2 + len)
      .toLowerCase();
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

/**
 * Kiểm tra định dạng mã phòng họp hợp lệ
 */
export function validateRoomCode(code: string): boolean {
  return /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/.test(code.toLowerCase());
}

/**
 * Format thời gian cuộc họp (giây → mm:ss)
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Lấy chữ cái đầu từ tên người dùng (dùng cho avatar)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface PasswordValidationResult {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  noConsecutive: boolean;
  isValid: boolean;
}

export const validatePasswordPolicy = (
  password: string,
): PasswordValidationResult => {
  const pwd = password || "";

  const hasMinLength = pwd.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const noConsecutive = !/(.)\1{3}/.test(pwd) && pwd.length > 0;

  const isValid =
    hasMinLength &&
    hasLetter &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    noConsecutive;

  return {
    hasMinLength,
    hasLetter,
    hasUpper,
    hasLower,
    hasNumber,
    noConsecutive,
    isValid,
  };
};
