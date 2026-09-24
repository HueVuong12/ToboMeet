import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Pencil,
  MoreVertical,
  FileSpreadsheet,
  Trash2,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  File,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Assignment } from "../types";
import { downloadAssignmentExcel } from "../utils/excelExport";
import { downloadFileDirectly } from "../utils/downloadHelper";
import { useTranslations } from "next-intl";

interface AssignmentDetailHeaderProps {
  assignment: Assignment;
  isTeacher: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export default function AssignmentDetailHeader({
  assignment,
  isTeacher,
  onBack,
  onEdit,
  onDelete,
}: AssignmentDetailHeaderProps) {
  const t = useTranslations("room.assignments_i18n.lms");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Hỗ trợ bấm phím Escape để đóng popup xác nhận xóa
  useEffect(() => {
    if (!showConfirmDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmDelete(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmDelete]);

  const handleDownloadAttachment = async (url: string, fileName: string) => {
    if (downloadingFile) return;
    setDownloadingFile(fileName);
    try {
      await downloadFileDirectly(url, fileName);
    } finally {
      setDownloadingFile(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const formatHeaderDate = (dateStr?: string | Date) => {
    if (!dateStr) return "Không có hạn nộp";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleExport = () => {
    setIsMenuOpen(false);
    downloadAssignmentExcel(assignment._id, assignment.title);
  };

  const hasAttachments = assignment.attachments && assignment.attachments.length > 0;
  const hasDescription = !!assignment.description?.trim();

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-xs">
      {/* Top row: Navigation & Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors mt-0.5 cursor-pointer"
            title="Quay lại danh sách"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                {assignment.title}
              </h1>
              {assignment.gradingType === "graded" && (
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md shrink-0">
                  {t("points", { points: assignment.maxScore ?? 10 })}
                </span>
              )}
            </div>

            {/* Subtitle date info */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                <span>{t("due_at", { time: formatHeaderDate(assignment.deadline) })}</span>
              </div>
              {assignment.submissionPolicy === "lock_after_deadline" && (
                <>
                  <span>•</span>
                  <span className="text-amber-600 font-medium">
                    {formatHeaderDate(assignment.deadline)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right action buttons (Only for Teachers) */}
        {isTeacher && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 active:bg-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Pencil size={14} />
              <span>{t("edit_btn")}</span>
            </button>

            {/* 3-dot More Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                title="Tùy chọn khác"
              >
                <MoreVertical size={18} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl ring-1 ring-black/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>{t("export_excel")}</span>
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowConfirmDelete(true);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                      <span>{t("delete_assignment")}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toggle Instructions and Attachments bar */}
      {(hasDescription || hasAttachments) && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsInstructionsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors cursor-pointer"
          >
            <FileText size={14} />
            <span>
              {isInstructionsOpen ? t("toggle_collapse") : t("toggle_expand")}
            </span>
            {isInstructionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isInstructionsOpen && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              {hasDescription && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t("description_title")}
                  </h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {assignment.description}
                  </p>
                </div>
              )}

              {hasAttachments && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {t("attachments_title")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {assignment.attachments.map((file, idx) => {
                      const isDownloading = downloadingFile === file.name;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleDownloadAttachment(file.url, file.name)}
                          disabled={isDownloading}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-500 rounded-lg text-xs font-medium text-slate-700 hover:text-brand-600 transition-colors shadow-2xs cursor-pointer active:bg-slate-50 disabled:opacity-75"
                          title={`Tải xuống ${file.name}`}
                        >
                          {isDownloading ? (
                            <Loader2 size={13} className="text-brand-600 animate-spin" />
                          ) : (
                            <File size={13} className="text-slate-400" />
                          )}
                          <span className="truncate max-w-[220px]">{file.name}</span>
                          <Download size={12} className="text-slate-400 ml-0.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal xác nhận xóa nhiệm vụ */}
      {showConfirmDelete && (
        <div
          onClick={() => setShowConfirmDelete(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[390px] p-5 sm:p-5.5 mx-4 flex flex-col transform transition-all duration-200 cursor-default"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {t("confirm_delete_title")}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer -mr-1"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              {t("confirm_delete_msg")}
            </p>
            <div className="flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                {t("cancel_btn")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmDelete(false);
                  if (onDelete) {
                    await onDelete();
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                {t("delete_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
