export class CreateReportDto {
  reportedUserId: string;
  reason: string;
  description?: string;
  createdAt?: string;
  evidences?: {
    url: string;
    fileName: string;
    fileSize: number;
  }[];
}
