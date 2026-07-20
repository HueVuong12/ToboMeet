export class CreatePostDto {
  roomId: string;
  channelId: string;
  content: string;
  attachments?: {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    thumbnail?: string;
  }[];
}
