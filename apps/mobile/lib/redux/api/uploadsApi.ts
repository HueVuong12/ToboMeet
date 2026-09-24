import { baseApi } from "./baseApi";

export const uploadsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createEvidenceSignedUrl: builder.mutation<
      { signedUrl: string; url: string; fileName: string },
      { fileName: string; mimeType?: string }
    >({
      query: (body) => ({
        url: "/uploads/report-evidence/signed-url",
        method: "POST",
        data: body,
      }),
    }),
  }),
  overrideExisting: true,
});

export const { useCreateEvidenceSignedUrlMutation } = uploadsApi;
