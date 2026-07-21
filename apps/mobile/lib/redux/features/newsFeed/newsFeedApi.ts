import { baseApi } from "../../api/baseApi";

export interface AttachmentDto {
  url: string;
  fileName: string;
  fileType: "image" | "video" | "file";
  fileSize: number;
  thumbnail?: string;
}

export interface ReactionDto {
  userId: string;
  type: string;
}

export interface AuthorDto {
  userId: string;
  displayName: string;
  avatarUrl: string;
  role: "owner" | "admin" | "member";
}

export interface ReactionStatDto {
  reaction: string;
  count: number;
}

export interface PostReactionUserDto {
  userId: string;
  reaction: string;
  reactedAt: string;
  user: AuthorDto;
}

export interface PostDto {
  _id: string;
  roomId: string;
  channelId: string;
  authorId: string;
  content: string;
  attachments: AttachmentDto[];
  reactionStats: ReactionStatDto[];
  userReaction: string | null;
  isEdited: boolean;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  author: AuthorDto;
}

export interface CommentDto {
  _id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  attachments: AttachmentDto[];
  reactions: ReactionDto[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: AuthorDto;
}

export const newsFeedApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPosts: builder.query<PostDto[], { roomId: string; channelId: string }>({
      query: ({ roomId, channelId }) => ({
        url: "/news-feed/posts",
        method: "GET",
        params: { roomId, channelId },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Post" as const, id: _id })),
              { type: "Post", id: "LIST" },
            ]
          : [{ type: "Post", id: "LIST" }],
    }),
    createPost: builder.mutation<
      PostDto,
      { roomId: string; channelId: string; content: string; attachments?: AttachmentDto[] }
    >({
      query: (body) => ({
        url: "/news-feed/posts",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Post", id: "LIST" }],
    }),
    updatePost: builder.mutation<
      PostDto,
      { postId: string; content: string; attachments?: AttachmentDto[] }
    >({
      query: ({ postId, ...body }) => ({
        url: `/news-feed/posts/${postId}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (result, error, { postId }) => [{ type: "Post", id: postId }],
    }),
    deletePost: builder.mutation<{ success: boolean }, string>({
      query: (postId) => ({
        url: `/news-feed/posts/${postId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Post", id: "LIST" }],
    }),
    togglePostReaction: builder.mutation<
      { reactionStats: ReactionStatDto[]; userReaction: string | null },
      { postId: string; type: string }
    >({
      query: ({ postId, type }) => ({
        url: `/news-feed/posts/${postId}/reactions`,
        method: "POST",
        data: { type },
      }),
      invalidatesTags: (result, error, { postId }) => [{ type: "Post", id: postId }],
    }),
    getPostReactions: builder.query<PostReactionUserDto[], string>({
      query: (postId) => ({
        url: `/news-feed/posts/${postId}/reactions`,
        method: "GET",
      }),
    }),
    getSignedUploadUrl: builder.mutation<
      { signedUrl: string; url: string; fileName: string },
      { fileName: string }
    >({
      query: (body) => ({
        url: "/news-feed/posts/signed-url",
        method: "POST",
        data: body,
      }),
    }),
    getComments: builder.query<CommentDto[], string>({
      query: (postId) => ({
        url: `/news-feed/posts/${postId}/comments`,
        method: "GET",
      }),
      providesTags: (result, error, postId) => [
        { type: "Comment" as const, id: `POST_${postId}` },
      ],
    }),
    createComment: builder.mutation<
      CommentDto,
      { postId: string; parentId?: string; content: string; attachments?: AttachmentDto[] }
    >({
      query: (body) => ({
        url: "/news-feed/comments",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (result, error, { postId }) => [
        { type: "Comment", id: `POST_${postId}` },
        { type: "Post", id: postId },
      ],
    }),
    updateComment: builder.mutation<CommentDto, { commentId: string; postId: string; content: string }>({
      query: ({ commentId, content }) => ({
        url: `/news-feed/comments/${commentId}`,
        method: "PATCH",
        data: { content },
      }),
      invalidatesTags: (result, error, { postId }) => [{ type: "Comment", id: `POST_${postId}` }],
    }),
    deleteComment: builder.mutation<{ success: boolean }, { commentId: string; postId: string }>({
      query: ({ commentId }) => ({
        url: `/news-feed/comments/${commentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { postId }) => [
        { type: "Comment", id: `POST_${postId}` },
        { type: "Post", id: postId },
      ],
    }),
    toggleCommentReaction: builder.mutation<
      ReactionDto[],
      { commentId: string; postId: string; type: string }
    >({
      query: ({ commentId, type }) => ({
        url: `/news-feed/comments/${commentId}/reactions`,
        method: "POST",
        data: { type },
      }),
      invalidatesTags: (result, error, { postId }) => [{ type: "Comment", id: `POST_${postId}` }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetPostsQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useTogglePostReactionMutation,
  useGetSignedUploadUrlMutation,
  useGetCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useToggleCommentReactionMutation,
  useGetPostReactionsQuery,
} = newsFeedApi;
