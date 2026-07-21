"use client";

import React, { useState } from "react";
import {
  MoreVertical,
  ThumbsUp,
  MessageSquare,
  Share2,
  Trash2,
  Edit,
  Download,
  FileText,
  CornerDownRight,
  Send,
  Loader2,
  Heart,
  Laugh,
  CheckCircle,
} from "lucide-react";
import {
  PostDto,
  CommentDto,
  useTogglePostReactionMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useToggleCommentReactionMutation,
} from "@/lib/redux/api/newsFeedApi";
import { parseMarkdownToHtml } from "@/utils/markdownParser";
import ReactionsListModal from "./ReactionsListModal";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/providers/ConfirmProvider";

interface PostCardProps {
  post: PostDto;
  userId: string;
  userRole: "owner" | "admin" | "member";
  onEdit: (post: PostDto) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉"];

const REACTION_LABELS: Record<string, string> = {
  "👍": "Thích",
  "❤️": "Yêu thích",
  "😂": "Haha",
  "😮": "Wow",
  "😢": "Buồn",
  "👏": "Vỗ tay",
  "🎉": "Chúc mừng",
};

export default function PostCard({ post, userId, userRole, onEdit }: PostCardProps) {
  const t = useTranslations("news_feed");
  const confirm = useConfirm();
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);

  // Comments State
  const [commentText, setCommentText] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [togglePostReaction] = useTogglePostReactionMutation();
  const [deletePost, { isLoading: isDeletingPost }] = useDeletePostMutation();

  const { data: comments = [], isLoading: isLoadingComments } = useGetCommentsQuery(post._id, {
    skip: !showComments,
  });

  const [createComment, { isLoading: isCreatingComment }] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [toggleCommentReaction] = useToggleCommentReactionMutation();

  const isTeacher = userRole === "owner" || userRole === "admin";
  const isAuthor = post.authorId === userId;

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?postId=${post._id}`;
    navigator.clipboard.writeText(link);
    toast.success(t("copy_link_success"));
    setShowMenu(false);
  };

  const handleDeletePost = () => {
    confirm({
      title: t("delete_post"),
      message: t("delete_post_confirm"),
      onConfirm: async () => {
        try {
          await deletePost(post._id).unwrap();
          toast.success(t("success_delete_post"));
        } catch (err: any) {
          toast.error(err?.data?.message || t("failed_delete_post"));
          throw err;
        }
      },
    });
  };

  const handleToggleReaction = async (emoji: string) => {
    try {
      await togglePostReaction({
        postId: post._id,
        type: emoji,
        roomId: post.roomId,
        channelId: post.channelId,
      }).unwrap();
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  const handleCreateComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const text = parentId ? replyText : commentText;
    if (!text.trim()) return;

    try {
      await createComment({
        postId: post._id,
        parentId: parentId || undefined,
        content: text.trim(),
      }).unwrap();

      if (parentId) {
        setReplyText("");
        setReplyToId(null);
      } else {
        setCommentText("");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || t("failed_create_comment"));
    }
  };

  const handleDeleteComment = (commentId: string) => {
    confirm({
      title: t("delete"),
      message: t("delete_comment_confirm"),
      onConfirm: async () => {
        try {
          await deleteComment(commentId).unwrap();
          toast.success(t("success_delete_comment"));
        } catch (err: any) {
          toast.error(err?.data?.message || "Error deleting comment.");
          throw err;
        }
      },
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffMs < 0 || diffSec < 60) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;

    // Quá 24h thì hiển thị ngày giờ đầy đủ
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateFormatted = date.toLocaleDateString("vi-VN");
    return `${time} ${dateFormatted}`;
  };

  // Attachments Filter
  const images = post.attachments.filter((a) => a.fileType === "image");
  const videos = post.attachments.filter((a) => a.fileType === "video");
  const docs = post.attachments.filter((a) => a.fileType === "file");

  // Render Image Grid
  const renderImagesGrid = () => {
    if (images.length === 0) return null;
    if (images.length === 1) {
      return (
        <img
          src={images[0].url}
          alt=""
          onClick={() => window.open(images[0].url, "_blank")}
          className="w-full max-h-[320px] object-cover rounded-xl cursor-pointer border border-slate-100"
        />
      );
    }
    if (images.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt=""
              onClick={() => window.open(img.url, "_blank")}
              className="w-full h-48 object-cover rounded-xl cursor-pointer border border-slate-100"
            />
          ))}
        </div>
      );
    }
    if (images.length === 3) {
      return (
        <div className="grid grid-cols-3 gap-2 h-56">
          <img
            src={images[0].url}
            alt=""
            onClick={() => window.open(images[0].url, "_blank")}
            className="col-span-2 w-full h-full object-cover rounded-l-xl cursor-pointer border border-slate-100"
          />
          <div className="grid grid-rows-2 gap-2 h-full">
            {images.slice(1).map((img, idx) => (
              <img
                key={idx}
                src={img.url}
                alt=""
                onClick={() => window.open(img.url, "_blank")}
                className="w-full h-[106px] object-cover rounded-r-xl cursor-pointer border border-slate-100"
              />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-4 gap-2 h-44">
        {images.slice(0, 3).map((img, idx) => (
          <img
            key={idx}
            src={img.url}
            alt=""
            onClick={() => window.open(img.url, "_blank")}
            className="w-full h-full object-cover rounded-xl cursor-pointer border border-slate-100"
          />
        ))}
        <div className="relative w-full h-full">
          <img
            src={images[3].url}
            alt=""
            className="w-full h-full object-cover rounded-xl border border-slate-100"
          />
          {images.length > 4 && (
            <div
              onClick={() => window.open(images[3].url, "_blank")}
              className="absolute inset-0 bg-black/60 text-white flex items-center justify-center font-bold text-sm rounded-xl cursor-pointer"
            >
              +{images.length - 4}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getRoleLabel = (role: string) => {
    if (role === "owner" || role === "admin") {
      return (
        <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
          {t("teacher_label")}
        </span>
      );
    }
    return (
      <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">
        {t("student_label")}
      </span>
    );
  };

  const totalReactionsCount = post.reactionStats?.reduce((sum, curr) => sum + curr.count, 0) || 0;
  const userReaction = post.userReaction;

  // Root Comments (parentId === null)
  const rootComments = comments.filter((c) => !c.parentId);

  // Replies map
  const repliesMap = comments.reduce((acc, curr) => {
    if (curr.parentId) {
      acc[curr.parentId] = acc[curr.parentId] || [];
      acc[curr.parentId].push(curr);
    }
    return acc;
  }, {} as Record<string, CommentDto[]>);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-100"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm uppercase">
              {post.author?.displayName?.charAt(0)}
            </div>
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {post.author?.displayName}
              </span>
              {getRoleLabel(post.author?.role)}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
              <span>{formatTimeAgo(post.createdAt)}</span>
              {post.isEdited && (
                <>
                  <span>•</span>
                  <span>{t("edited")}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Menu Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                {(isAuthor || isTeacher) && (
                  <>
                    {isAuthor && (
                      <button
                        onClick={() => {
                          onEdit(post);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                      >
                        <Edit size={14} />
                        <span>{t("edit")}</span>
                      </button>
                    )}
                    <button
                      onClick={handleDeletePost}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <Trash2 size={14} />
                      <span>{t("delete_post")}</span>
                    </button>
                    <div className="h-[1px] bg-slate-100 my-1" />
                  </>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <Share2 size={14} />
                  <span>{t("copy_link")}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Text */}
      <div className="text-sm text-slate-700 text-left leading-relaxed">
        {post.content.length > 300 && !isContentExpanded ? (
          <div>
            <div
              className="rich-text-content"
              dangerouslySetInnerHTML={{
                __html: parseMarkdownToHtml(post.content.substring(0, 300) + "..."),
              }}
            />
            <button
              onClick={() => setIsContentExpanded(true)}
              className="text-xs font-bold text-brand-600 hover:underline mt-1"
            >
              {t("view_more")}
            </button>
          </div>
        ) : (
          <div>
            <div
              className="rich-text-content"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(post.content) }}
            />
            {post.content.length > 300 && (
              <button
                onClick={() => setIsContentExpanded(false)}
                className="text-xs font-bold text-brand-600 hover:underline mt-1"
              >
                {t("show_less")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid Images */}
      {renderImagesGrid()}

      {/* Video Players */}
      {videos.map((vid, idx) => (
        <div key={idx} className="rounded-xl overflow-hidden border border-slate-100 bg-black">
          <video src={vid.url} controls className="w-full max-h-[300px]" />
        </div>
      ))}

      {/* Document File Cards */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 border border-slate-100 hover:border-slate-200 bg-slate-50/50 rounded-xl transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-white border border-slate-100 flex items-center justify-center rounded-lg text-slate-500 shrink-0">
                  <FileText size={18} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{doc.fileName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatFileSize(doc.fileSize)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.open(doc.url, "_blank")}
                className="p-2 bg-white hover:bg-brand-50 border border-slate-100 hover:border-brand-100 hover:text-brand-600 rounded-lg shadow-sm transition-all"
              >
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Post Actions Stats & Interaction Buttons */}
      <div className="border-t border-b border-slate-100 py-2.5 flex items-center justify-start gap-2 bg-white">
        {/* Reaction Hover Tray & Reaction Count */}
        <div className="flex items-center gap-1.5 relative group">
          <button
            type="button"
            onClick={() => handleToggleReaction(userReaction ? userReaction : "👍")}
            className={`flex items-center gap-1.5 cursor-pointer py-1.5 px-3 hover:bg-slate-50 rounded-xl transition-colors ${
              userReaction ? "text-brand-600 font-bold" : "text-slate-500 font-semibold"
            }`}
          >
            {userReaction ? (
              <span className="text-base">{userReaction}</span>
            ) : (
              <ThumbsUp size={16} />
            )}
            <span className="text-xs">
              {userReaction ? REACTION_LABELS[userReaction] || "Đã thích" : t("like")}
            </span>
          </button>

          {/* Emoji Popover Tray (Có padding-bottom làm cầu nối hover liên tục) */}
          <div className="absolute bottom-full left-0 pb-2 hidden group-hover:flex z-20 animate-fade-in">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full shadow-xl px-2.5 py-1.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggleReaction(emoji)}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Total Reaction Badge counts */}
          {totalReactionsCount > 0 && (
            <div
              onClick={() => setIsReactionsModalOpen(true)}
              title="Xem danh sách bày tỏ cảm xúc"
              className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-100 px-2 py-0.5 rounded-full shrink-0 transition-colors"
            >
              <span className="flex items-center gap-0.5">
                {post.reactionStats?.slice(0, 3).map((s) => s.reaction)}
              </span>
              <span className="font-bold text-slate-600 ml-0.5">{totalReactionsCount}</span>
            </div>
          )}
        </div>

        {/* Comment Switch Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 py-1.5 px-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-500"
        >
          <MessageSquare size={16} />
          <span className="text-xs font-semibold">{t("add_comment_with_count", { count: post.commentsCount || 0 })}</span>
        </button>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <div className="pt-2 space-y-4 border-t border-slate-100 animate-slide-down">
          {/* Comments Loader */}
          {isLoadingComments ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-1.5">
              <Loader2 className="animate-spin" size={14} />
              <span>{t("loading_comments")}</span>
            </div>
          ) : rootComments.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-4">{t("no_comments")}</p>
          ) : (
            <div className="space-y-4 pr-1">
              {rootComments.map((comment) => {
                const commentReplies = repliesMap[comment._id] || [];
                const isCommentAuthor = comment.authorId === userId;

                return (
                  <div key={comment._id} className="space-y-3">
                    {/* Parent Comment */}
                    <div className="flex gap-2.5 text-left items-start group/comment">
                      {comment.author?.avatarUrl ? (
                        <img
                          src={comment.author.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs uppercase shrink-0 text-slate-500 border border-slate-200">
                          {comment.author?.displayName?.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="bg-slate-50/80 hover:bg-slate-50 rounded-2xl px-3.5 py-2 inline-block max-w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {comment.author?.displayName}
                            </span>
                            {getRoleLabel(comment.author?.role)}
                            <span className="text-[10px] text-slate-400">
                              {formatTimeAgo(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>

                        {/* Comment Action Links */}
                        <div className="flex items-center gap-3 mt-1 pl-2 text-[10px] text-slate-400 font-semibold">
                          <button
                            onClick={() => {
                              setReplyToId(comment._id);
                              setReplyText("");
                            }}
                            className="hover:text-brand-600 transition-colors"
                          >
                            {t("reply")}
                          </button>
                          {(isCommentAuthor || isTeacher) && (
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              className="hover:text-red-500 transition-colors"
                            >
                              {t("delete")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nested Replies List */}
                    {commentReplies.map((reply) => {
                      const isReplyAuthor = reply.authorId === userId;
                      return (
                        <div key={reply._id} className="flex gap-2.5 text-left items-start pl-8">
                          <CornerDownRight size={14} className="text-slate-300 shrink-0 mt-1.5" />
                          {reply.author?.avatarUrl ? (
                            <img
                              src={reply.author.avatarUrl}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] uppercase shrink-0 text-slate-500 border border-slate-200">
                              {reply.author?.displayName?.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="bg-slate-50/50 hover:bg-slate-50 rounded-2xl px-3 py-1.5 inline-block max-w-full">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800">
                                  {reply.author?.displayName}
                                </span>
                                {getRoleLabel(reply.author?.role)}
                                <span className="text-[10px] text-slate-400">
                                  {formatTimeAgo(reply.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            </div>
                            {(isReplyAuthor || isTeacher) && (
                              <div className="flex items-center gap-3 mt-0.5 pl-2 text-[10px] text-slate-400 font-semibold">
                                <button
                                  onClick={() => handleDeleteComment(reply._id)}
                                  className="hover:text-red-500 transition-colors"
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline Reply Input Box */}
                    {replyToId === comment._id && (
                      <form
                        onSubmit={(e) => handleCreateComment(e, comment._id)}
                        className="pl-8 flex gap-2"
                      >
                        <input
                          type="text"
                          placeholder={t("write_reply")}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-xl transition-colors shadow-sm shrink-0"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyToId(null)}
                          className="border border-slate-200 hover:bg-slate-50 text-slate-500 px-2 py-1.5 rounded-xl text-[10px] font-bold"
                        >
                          {t("cancel")}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Root Comment Input Box */}
          <form onSubmit={(e) => handleCreateComment(e, null)} className="flex items-center gap-2.5 pt-2">
            <input
              type="text"
              placeholder={t("comment_placeholder")}
              value={commentText}
              disabled={isCreatingComment}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
            <button
              type="submit"
              disabled={isCreatingComment || !commentText.trim()}
              className="bg-brand-600 hover:bg-brand-700 text-white p-2.5 rounded-xl transition-colors shadow-sm shrink-0 disabled:opacity-50"
            >
              {isCreatingComment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </form>
        </div>
      )}
      {/* Modal danh sách người bày tỏ cảm xúc */}
      <ReactionsListModal
        isOpen={isReactionsModalOpen}
        onClose={() => setIsReactionsModalOpen(false)}
        postId={post._id}
      />
    </div>
  );
}
