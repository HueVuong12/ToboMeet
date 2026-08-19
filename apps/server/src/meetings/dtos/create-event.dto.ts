export class InviteeDto {
  email: string;
  userId?: string;
}

export class CreateEventDto {
  title: string;
  description?: string;
  roomId?: string;
  channelId?: string;
  roomType?: "meeting" | "classroom" | "channel_meeting";
  startDate: string;
  endDate: string;
  timezone?: string;
  location?: string;
  meetingPassword?: string;
  recurrenceRule?: string;
  invitees?: InviteeDto[];
}
