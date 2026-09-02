import { toast } from "sonner";

/**
 * Tải trực tiếp file về máy người dùng không mở tab mới, không redirect, giữ đúng tên file
 */
export async function downloadFileDirectly(url: string, filename: string): Promise<void> {
  if (!url) {
    toast.error("Không tìm thấy đường dẫn tệp");
    return;
  }

  const cleanFilename = filename || url.split("/").pop()?.split("?")[0] || "downloaded-file";

  try {
    // 1. Thử tải qua fetch + blob để ép buộc trình duyệt tải về
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Không thể kết nối đến máy chủ lưu trữ tệp");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = cleanFilename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    toast.success(`Đã tải xuống: ${cleanFilename}`);
  } catch (err: any) {
    console.warn("Fetch blob failed (possibly CORS), fallback to direct download anchor:", err);

    try {
      // 2. Fallback nếu gặp chính sách CORS: tạo thẻ <a> download trực tiếp không mở tab mới
      const link = document.createElement("a");
      link.href = url;
      link.download = cleanFilename;
      link.target = "_self";
      link.rel = "noopener noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

      toast.success(`Đang tải xuống: ${cleanFilename}`);
    } catch (fallbackErr: any) {
      toast.error(fallbackErr?.message || "Lỗi khi tải tệp tin về máy");
    }
  }
}
