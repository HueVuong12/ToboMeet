import { baseApi } from "../../api/baseApi";

export interface CreateReportDto {
  reportedUserId: string;
  reason: string;
  description?: string;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  evidences?: { url: string; fileName?: string; fileType?: string }[];
}

export const reportsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    createReport: builder.mutation<any, CreateReportDto>({
      query: (body) => ({
        url: "/reports",
        method: "POST",
        body,
      }),
    }),
    createRoomReport: builder.mutation<
      any,
      {
        roomId: string;
        reason: string;
        description?: string;
        attachments?: { url: string; fileName?: string; fileSize?: number }[];
      }
    >({
      query: (body) => ({
        url: "/reports/room",
        method: "POST",
        body,
      }),
    }),
    getReportSignedUrl: builder.mutation<
      { signedUrl: string; url: string; fileName: string },
      { fileName: string; mimeType: string }
    >({
      query: (body) => ({
        url: "/uploads/report-evidence/signed-url",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useCreateReportMutation,
  useCreateRoomReportMutation,
  useGetReportSignedUrlMutation,
} = reportsApi;
