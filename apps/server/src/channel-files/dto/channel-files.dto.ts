export class SignedUrlRequestDto {
  roomId: string;
  channelId: string;
  fileName: string;
}

export class CreateFileMetaDto {
  roomId: string;
  channelId: string;
  fileName: string;
  storagePath?: string;
  publicUrl?: string;
  mimeType?: string;
  fileSize?: number;
  isFolder?: boolean;
  parentFolderId?: string | null;
}

export class RenameFileDto {
  newName: string;
}
