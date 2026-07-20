export class CreateCommentDto {
  postId: string;
  parentId?: string;
  content: string;
  attachments?: {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
}
