export class CreateRoomReportDto {
  roomId: string;
  reason: string;
  description?: string;
  attachments?: {
    url: string;
    fileName: string;
    fileSize: number;
  }[];
}

export class UpdateRoomReportStatusDto {
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
  actionResult?: "none" | "blocked" | "disbanded" | "warning";
  note?: string; // Lý do xử lý của Admin
  adminId?: string;
  adminEmail?: string;
}
