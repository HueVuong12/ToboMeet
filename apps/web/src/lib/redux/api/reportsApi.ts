import { baseApi } from "./baseApi";

export interface EvidenceDto {
  url: string;
  fileName: string;
  fileSize: number;
}

export interface CreateReportDto {
  reportedUserId: string;
  reason: string;
  description?: string;
  createdAt: string;
  evidences?: EvidenceDto[];
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createReport: builder.mutation<void, CreateReportDto>({
      query: (body) => ({
        url: "/reports",
        method: "POST",
        data: body,
      }),
    }),
  }),
  overrideExisting: true,
});

export const { useCreateReportMutation } = reportsApi;
