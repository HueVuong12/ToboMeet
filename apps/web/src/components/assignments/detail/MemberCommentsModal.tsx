import React, { useState, useRef, useEffect } from "react";
import { X, MessageSquare, Send, Trash2, Loader2, User } from "lucide-react";
import { Assignment, AssignmentComment } from "../types";
import { MemberWithSubmission } from "./SubmissionMembersTable";

interface MemberCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  member: MemberWithSubmission | null;
  comments: AssignmentComment[];
  currentUserId?: string;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export default function MemberCommentsModal({
  isOpen,
  onClose,
  assignment,
  member,
  comments,
  currentUserId,
  onAddComment,
  onDeleteComment,
}: MemberCommentsModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cuộn xuống cuối khi có tin nhắn mới hoặc khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, comments.length]);

  if (!isOpen || !member) return null;

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(trimmed);
      setContent("");
    } catch (err) {
      console.error("Error sending comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!onDeleteComment || deletingId) return;
    try {
      setDeletingId(commentId);
      await onDeleteComment(commentId);
    } catch (err) {
      console.error("Error deleting comment:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatCommentTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0052FF]">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Bình luận với {member.displayName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#0052FF]">
                  {comments.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
                Nhiệm vụ: {assignment.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: Danh sách bình luận */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/30 min-h-[260px] max-h-[460px]">
          {comments.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <MessageSquare size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Chưa có bình luận nào</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Hãy bắt đầu cuộc trao đổi về bài làm này với {member.displayName}.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const isMine = comment.userId === currentUserId;
              const isTeacher =
                comment.role === "teacher" ||
                comment.role === "owner" ||
                comment.role === "admin" ||
                comment.role === "leader";

              return (
                <div
                  key={comment._id}
                  className={`flex flex-col p-3 rounded-xl border transition-all ${
                    isTeacher
                      ? "bg-blue-50/60 border-blue-100"
                      : "bg-white border-slate-200"
                  }`}
                >
                  {/* Top line: Người gửi + Vai trò + Nút xóa */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs">
                        {comment.userName || (isTeacher ? "Trưởng nhóm" : member.displayName)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                          isTeacher
                            ? "bg-blue-100 text-[#0052FF] border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {isTeacher ? "Trưởng nhóm" : "Thành viên"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {formatCommentTime(comment.createdAt)}
                      </span>
                      {isMine && onDeleteComment && (
                        <button
                          type="button"
                          onClick={() => handleDelete(comment._id)}
                          disabled={deletingId === comment._id}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors disabled:opacity-50"
                          title="Xóa bình luận"
                        >
                          {deletingId === comment._id ? (
                            <Loader2 size={12} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nội dung tin nhắn */}
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mt-0.5">
                    {comment.content}
                  </p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer: Khung nhập bình luận */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Viết bình luận gửi đến ${member.displayName}... (Nhấn Enter để gửi)`}
              disabled={isSubmitting}
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none resize-none p-1 font-medium leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() || isSubmitting}
              className="px-3.5 py-2 bg-[#0052FF] hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Gửi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
