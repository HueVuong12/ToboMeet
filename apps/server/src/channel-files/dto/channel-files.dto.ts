export class SignedUrlRequestDto {
  roomId: string;
  channelId: string;
  fileName: string;
}

export class CreateFileMetaDto {
  roomId: string;
  channelId: string;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
}

export class RenameFileDto {
  newName: string;
}
