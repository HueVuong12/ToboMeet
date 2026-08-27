export class CreateChannelDto {
  name: string;
  isPrivate?: boolean;
  initialMemberIds?: string[];
}
