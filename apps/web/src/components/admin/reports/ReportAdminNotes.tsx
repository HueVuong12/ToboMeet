"use client";

import { useState } from "react";
import { StickyNote, Send, Loader2, Lock } from "lucide-react";
import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import { useAddReportNoteMutation } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportAdminNotes({ report, onSuccess, onError }: Props) {
  const t = useTranslations("admin.reports");
  const [addNote, { isLoading }] = useAddReportNoteMutation();
  const [content, setContent] = useState("");

  const notes = report.adminNotes || [];

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await addNote({ id: report._id, content: content.trim() }).unwrap();
      setContent("");
      onSuccess?.(t("notes_add_success", { fallback: "Đã thêm ghi chú thành công" }));
    } catch {
      onError?.(t("notes_add_failed", { fallback: "Không thể thêm ghi chú. Vui lòng thử lại." }));
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-slate-400" />
        {t("detail_notes")}
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-semibold ml-auto">
          <Lock className="w-2.5 h-2.5" />
          {t("admin_only_note")}
        </span>
      </h3>

      {/* Existing notes */}
      {notes.length > 0 ? (
        <div className="space-y-2">
          {notes.map((note, i) => (
            <div
              key={i}
              className="bg-amber-50 border border-amber-100 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-amber-700">
                  {note.adminEmail}
                </span>
                <span className="text-[11px] text-amber-500">
                  {formatDate(note.createdAt)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{note.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
          <p className="text-xs text-slate-400">{t("notes_empty", { fallback: "Chưa có ghi chú nào" })}</p>
        </div>
      )}

      {/* Add note */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder={t("notes_placeholder", { fallback: "Thêm ghi chú nội bộ... (ví dụ: Đã kiểm tra bằng chứng, Người dùng thừa nhận vi phạm...)" })}
          className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex justify-end border-t border-slate-100 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {t("btn_add_note")}
          </button>
        </div>
      </div>
    </div>
  );
}
