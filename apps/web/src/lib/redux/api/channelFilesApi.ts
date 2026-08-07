import { baseApi } from "./baseApi";
import { ChannelFileResponse } from "@tobomeet/shared/types";

export const channelFilesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChannelFiles: builder.query<
      ChannelFileResponse[],
      { roomId: string; channelId: string }
    >({
      query: ({ roomId, channelId }) => ({
        url: `/channel-files?roomId=${roomId}&channelId=${channelId}`,
        method: "GET",
      }),
      providesTags: (_result, _error, { channelId }) => [
        { type: "ChannelFile", id: channelId },
      ],
    }),

    createSignedUploadUrl: builder.mutation<
      { signedUrl: string; publicUrl: string; storagePath: string },
      { roomId: string; channelId: string; fileName: string }
    >({
      query: (body) => ({
        url: "/channel-files/signed-url",
        method: "POST",
        data: body,
      }),
    }),

    saveFileMeta: builder.mutation<
      ChannelFileResponse,
      {
        roomId: string;
        channelId: string;
        fileName: string;
        storagePath: string;
        publicUrl: string;
        mimeType: string;
        fileSize: number;
      }
    >({
      query: (body) => ({
        url: "/channel-files",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, { channelId }) => [
        { type: "ChannelFile", id: channelId },
      ],
    }),

    renameFile: builder.mutation<
      ChannelFileResponse,
      { fileId: string; newName: string; channelId: string }
    >({
      query: ({ fileId, newName }) => ({
        url: `/channel-files/${fileId}/rename`,
        method: "PATCH",
        data: { newName },
      }),
      invalidatesTags: (_result, _error, { channelId }) => [
        { type: "ChannelFile", id: channelId },
      ],
    }),

    deleteFile: builder.mutation<
      { success: boolean },
      { fileId: string; channelId: string }
    >({
      query: ({ fileId }) => ({
        url: `/channel-files/${fileId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { channelId }) => [
        { type: "ChannelFile", id: channelId },
      ],
    }),

    getDownloadUrl: builder.query<
      { downloadUrl: string; fileName: string },
      { fileId: string; download?: boolean }
    >({
      query: ({ fileId, download }) => ({
        url: `/channel-files/${fileId}/download-url${download ? "?download=true" : ""}`,
        method: "GET",
      }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetChannelFilesQuery,
  useCreateSignedUploadUrlMutation,
  useSaveFileMetaMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useLazyGetDownloadUrlQuery,
} = channelFilesApi;
