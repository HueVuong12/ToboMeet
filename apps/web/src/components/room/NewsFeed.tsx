"use client";

import React, { useState, useEffect } from "react";
import {
  useGetPostsQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  PostDto,
} from "@/lib/redux/api/newsFeedApi";
import { useNewsFeedSocket } from "@/hooks/useNewsFeedSocket";
import PostCard from "./PostCard";
import CreatePostModal from "./CreatePostModal";
import { Loader2, PenSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface NewsFeedProps {
  roomId: string;
  channelId: string;
  userId: string;
  userRole: "owner" | "admin" | "member";
  channelName: string;
}

export default function NewsFeed({
  roomId,
  channelId,
  userId,
  userRole,
  channelName,
}: NewsFeedProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPostData, setEditPostData] = useState<PostDto | null>(null);
  const t = useTranslations("news_feed");

  // Kích hoạt socket realtime lắng nghe sự thay đổi của kênh bảng tin này
  useNewsFeedSocket(roomId, channelId);

  const {
    data: posts = [],
    isLoading,
    isError,
    error,
  } = useGetPostsQuery({ roomId, channelId });

  const [createPost] = useCreatePostMutation();
  const [updatePost] = useUpdatePostMutation();

  const handleCreateOrUpdatePost = async (payload: { content: string; attachments: any[] }) => {
    try {
      if (editPostData) {
        // Chế độ chỉnh sửa bài viết
        await updatePost({
          postId: editPostData._id,
          content: payload.content,
          attachments: payload.attachments,
        }).unwrap();
        toast.success(t("success_update_post"));
      } else {
        // Chế độ đăng bài mới
        await createPost({
          roomId,
          channelId,
          content: payload.content,
          attachments: payload.attachments,
        }).unwrap();
        toast.success(t("success_create_post"));
      }
      setEditPostData(null);
    } catch (err: any) {
      toast.error(err?.data?.message || t("failed_create_post"));
    }
  };

  const handleEditClick = (post: PostDto) => {
    setEditPostData(post);
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Dòng bài viết (Feed List) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-6">
        {/* Nút CTA Thông báo mới đặt thẳng hàng trên đầu list feed (thụt lề max-w-5xl giống card bài viết) */}
        <div className="max-w-5xl mx-auto mb-4 flex justify-start">
          <button
            onClick={() => {
              setEditPostData(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 h-[44px] px-6 bg-brand-600 hover:bg-brand-700 text-white rounded-full text-sm font-semibold transition-all duration-200 shadow-sm shrink-0 cursor-pointer"
          >
            <PenSquare size={16} />
            <span>{t("post_announcement_btn", { fallback: "Thông báo mới" })}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <Loader2 className="animate-spin text-brand-600" size={24} />
            <span>{t("loading_posts")}</span>
          </div>
        ) : isError ? (
          <div className="text-center text-red-500 py-20 text-sm font-semibold">
            {(error as any)?.data?.message || t("load_error")}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm text-center max-w-md mx-auto mt-6">
            <PenSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">{t("empty_feed_title")}</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t("empty_feed_desc", { channelName })}
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-4 pt-2">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                userId={userId}
                userRole={userRole}
                onEdit={handleEditClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal đăng/sửa bài */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditPostData(null);
        }}
        roomId={roomId}
        channelId={channelId}
        onSuccess={handleCreateOrUpdatePost}
        editPostData={
          editPostData
            ? {
                id: editPostData._id,
                content: editPostData.content,
                attachments: editPostData.attachments,
              }
            : null
        }
      />
    </div>
  );
}
