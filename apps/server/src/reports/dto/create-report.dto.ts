export class CreateReportDto {
  reportedUserId: string;
  reason: string;
  description?: string;
  createdAt?: string;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  evidences?: {
    url: string;
    fileName: string;
    fileSize: number;
  }[];
}
