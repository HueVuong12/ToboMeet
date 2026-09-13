import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { axiosInstance } from "../../../lib/axios";
import { supabase } from "../../../lib/supabase";

/**
 * Xuất file Excel kết quả nhiệm vụ trên Mobile
 * Sử dụng FileSystem.downloadAsync trực tiếp từ Native stream để đảm bảo:
 * - Dữ liệu nhị phân không bị qua tầng biến đổi chuỗi JS / Base64
 * - File .xlsx tạo ra hoàn toàn hợp lệ, không bị lỗi corrupted khi mở bằng Microsoft Excel
 */
export async function downloadAssignmentExcel(
  assignmentId: string,
  assignmentTitle: string
): Promise<string> {
  const rawTitle = (assignmentTitle || "nhiem-vu")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `ket-qua-nhiem-vu-${rawTitle}-${nowStr}.xlsx`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  // Lấy token xác thực từ Supabase session (kèm proactive refresh nếu cần)
  let token: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
    if (session?.expires_at) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (session.expires_at - nowInSeconds < 60) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token || token;
      }
    }
  } catch (authErr) {
    console.warn("[ExcelExport] Error getting auth token:", authErr);
  }

  const baseUrl =
    axiosInstance.defaults.baseURL ||
    "https://dolphin-paternity-estrogen.ngrok-free.dev/api";
  const downloadUrl = `${baseUrl}/assignments/${assignmentId}/export-excel`;

  // Download trực tiếp luồng nhị phân native
  const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (downloadResult.status !== 200) {
    let errorMsg = "Không thể xuất file Excel";
    try {
      const content = await FileSystem.readAsStringAsync(fileUri);
      const parsed = JSON.parse(content);
      errorMsg = parsed.message || errorMsg;
    } catch {}
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {}
    throw new Error(errorMsg);
  }

  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    throw new Error("File Excel tải về không có dữ liệu");
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloadResult.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: fileName,
      UTI: "com.microsoft.excel.xlsx",
    });
  }

  return fileUri;
}
