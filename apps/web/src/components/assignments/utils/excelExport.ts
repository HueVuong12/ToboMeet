import { axiosInstance } from "@/lib/axios";
import { toast } from "sonner";

export async function downloadAssignmentExcel(assignmentId: string, assignmentTitle: string) {
  try {
    toast.info("Đang chuẩn bị file Excel...");
    const response: any = await axiosInstance.get(
      `/assignments/${assignmentId}/export-excel`,
      {
        responseType: "blob",
      }
    );

    const nowStr = new Date().toISOString().slice(0, 10);
    const rawTitle = (assignmentTitle || "nhiem-vu")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    const fileName = `ket-qua-nhiem-vu-${rawTitle}-${nowStr}.xlsx`;

    const blob = new Blob([response], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    toast.success("Tải file Excel thành công!");
  } catch (err: any) {
    toast.error(err?.response?.data?.message || err?.message || "Không thể xuất file Excel");
  }
}
