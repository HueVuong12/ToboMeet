import { baseApi } from "./baseApi";
import {
  DirectConversationResponse,
  DirectMessageResponse,
  ChatMessagesPaginationResponse,
  ChatAttachment,
} from "@/types/chat";

export interface SendMessagePayload {
  conversationId: string;
  content?: string;
  type?: "text" | "file" | "video" | "image";
  attachments?: ChatAttachment[];
  replyToId?: string;
}

export interface GetUploadUrlPayload {
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadUrlResponse {
  signedUrl: string;
  url: string;
  fileName: string;
  fileType: "image" | "video" | "file";
  fileSize: number;
  mimeType: string;
}

export const directChatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query<DirectConversationResponse[], void>({
      query: () => ({
        url: "/direct-chat/conversations",
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "DirectConversation" as const,
                id,
              })),
              { type: "DirectConversation", id: "LIST" },
            ]
          : [{ type: "DirectConversation", id: "LIST" }],
    }),

    getConversationById: builder.query<DirectConversationResponse, string>({
      query: (id) => ({
        url: `/direct-chat/conversations/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [
        { type: "DirectConversation", id },
      ],
    }),

    getMessages: builder.query<
      ChatMessagesPaginationResponse,
      { conversationId: string; before?: string; limit?: number }
    >({
      query: ({ conversationId, before, limit }) => ({
        url: `/direct-chat/conversations/${conversationId}/messages`,
        method: "GET",
        params: { before, limit },
      }),
      providesTags: (_result, _error, { conversationId }) => [
        { type: "DirectMessage", id: conversationId },
      ],
    }),

    createOrGetConversation: builder.mutation<
      DirectConversationResponse,
      { recipientId: string }
    >({
      query: (data) => ({
        url: "/direct-chat/conversations",
        method: "POST",
        data,
      }),
      invalidatesTags: [{ type: "DirectConversation", id: "LIST" }],
    }),

    sendMessage: builder.mutation<DirectMessageResponse, SendMessagePayload>({
      query: ({ conversationId, ...data }) => ({
        url: `/direct-chat/conversations/${conversationId}/messages`,
        method: "POST",
        data,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "DirectConversation", id: "LIST" },
        { type: "DirectConversation", id: conversationId },
      ],
    }),

    markAsRead: builder.mutation<{ success: boolean }, string>({
      query: (conversationId) => ({
        url: `/direct-chat/conversations/${conversationId}/read`,
        method: "PUT",
      }),
      invalidatesTags: (_result, _error, conversationId) => [
        { type: "DirectConversation", id: "LIST" },
        { type: "DirectConversation", id: conversationId },
      ],
    }),

    reactMessage: builder.mutation<
      { messageId: string; reactions: any[] },
      { messageId: string; emoji: string }
    >({
      query: ({ messageId, emoji }) => ({
        url: `/direct-chat/messages/${messageId}/react`,
        method: "POST",
        data: { emoji },
      }),
    }),

    deleteMessage: builder.mutation<
      { messageId: string; deletedAt: string },
      string
    >({
      query: (messageId) => ({
        url: `/direct-chat/messages/${messageId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "DirectConversation", id: "LIST" }],
    }),

    getChatUploadUrl: builder.mutation<UploadUrlResponse, GetUploadUrlPayload>({
      query: ({ conversationId, ...data }) => ({
        url: `/direct-chat/conversations/${conversationId}/upload`,
        method: "POST",
        data,
      }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetConversationsQuery,
  useGetConversationByIdQuery,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useCreateOrGetConversationMutation,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useReactMessageMutation,
  useDeleteMessageMutation,
  useGetChatUploadUrlMutation,
} = directChatApi;
