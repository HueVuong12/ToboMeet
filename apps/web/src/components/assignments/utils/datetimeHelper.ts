/**
 * Tiện ích chuyển đổi thời gian an toàn cho thẻ <input type="datetime-local">
 * Đảm bảo:
 * - Hiển thị đúng giờ địa phương (Local Time) trên input value, không bị lệch múi giờ UTC
 * - Chuyển đổi chính xác sang chuỗi UTC ISO string khi lưu trữ
 * - Giữ nguyên tính nhất quán với backend và các bộ đếm thời gian
 */

/**
 * Chuyển đổi Date hoặc chuỗi ISO string sang định dạng "YYYY-MM-DDTHH:mm" theo GIỜ ĐỊA PHƯƠNG.
 * Dùng làm thuộc tính `value` cho thẻ <input type="datetime-local">.
 */
export function toLocalDatetimeInputString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Chuyển đổi chuỗi "YYYY-MM-DDTHH:mm" từ <input type="datetime-local"> (Giờ địa phương)
 * sang chuỗi UTC ISO string ("YYYY-MM-DDTHH:mm:ss.sssZ") để lưu trữ vào cơ sở dữ liệu.
 */
export function fromLocalDatetimeInputString(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
  const [datePart, timePart] = trimmed.split("T");
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes)
  ) {
    return null;
  }

  // Khởi tạo theo local timezone của người dùng (tháng 0-indexed)
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (isNaN(localDate.getTime())) return null;

  return localDate.toISOString();
}
