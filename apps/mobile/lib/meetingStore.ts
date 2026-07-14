// src/lib/meetingStore.ts

// Object này tồn tại trong RAM của ứng dụng Mobile.
// Nó sẽ giữ Token khi chuyển màn hình và xóa đi khi không cần thiết.
export type MeetingPayload = {
  token: string;
  roomId: string;
  channelId: string;
  isCamOn: boolean;
  isMicOn: boolean;
  cameraFacing?: "front" | "back";
};

export const MeetingStore = {
  data: null as MeetingPayload | null,

  set: (payload: MeetingPayload) => {
    MeetingStore.data = payload;
  },
  get: () => MeetingStore.data,
  clear: () => {
    MeetingStore.data = null;
  },
};
