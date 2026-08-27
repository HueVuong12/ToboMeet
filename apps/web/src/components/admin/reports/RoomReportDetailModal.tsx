"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  Calendar,
  ShieldAlert,
  Ban,
  AlertTriangle,
  FileText,
  Hash,
  Users,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  useGetAdminRoomReportByIdQuery,
  useUpdateRoomReportStatusMutation,
} from "@/lib/redux/api/adminApi";
import ReportStatusBadge from "./ReportStatusBadge";
import ReportTypeBadge from "./ReportTypeBadge";
import ReportConfirmModal from "./ReportConfirmModal";
import ReportImageLightbox from "./ReportImageLightbox";
import ReportTimeline from "./ReportTimeline";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Props {
  reportId: string;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoomReportDetailModal({
  reportId,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const t = useTranslations("admin.reports");
  const tRoom = useTranslations("room");
  const { data: report, isLoading, refetch } = useGetAdminRoomReportByIdQuery(reportId);
  const [updateStatus, { isLoading: isUpdating }] = useUpdateRoomReportStatusMutation();
  const [mounted, setMounted] = useState(false);

  const [adminNote, setAdminNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<{
    status: string;
    actionResult?: "none" | "blocked" | "disbanded" | "warning";
    label: string;
    variant: "danger" | "warning" | "info";
  } | null>(null);

  // Mounted check cho Next.js Client Portal rendering
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  const handleTriggerAction = (
    status: string,
    actionResult: "none" | "blocked" | "disbanded" | "warning" = "none",
    label: string,
    variant: "danger" | "warning" | "info" = "info",
  ) => {
    setPendingAction({ status, actionResult, label, variant });
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    try {
      await updateStatus({
        id: reportId,
        status: pendingAction.status,
        actionResult: pendingAction.actionResult,
        note: adminNote.trim() || undefined,
      }).unwrap();

      onSuccess?.(t("status_update_success", { status: pendingAction.label, fallback: "Cập nhật trạng thái báo cáo phòng thành công!" }));
      refetch();
      setConfirmOpen(false);
      setPendingAction(null);
      setAdminNote("");
      onClose();
    } catch (err: any) {
      setConfirmOpen(false);
      const errMsg = err?.data?.message || err?.message || t("status_update_failed", { fallback: "Cập nhật thất bại. Vui lòng thử lại." });
      toast.error(errMsg);
      onError?.(errMsg);
    }
  };

  const modalLayout = (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 overflow-hidden">
      {/* CSS Animation injection */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes modalScaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-modal-backdrop {
          animation: modalFadeIn 200ms ease-out forwards;
        }
        .animate-modal-content {
          animation: modalScaleUp 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
      />

      {/* Centered Modal Container */}
      <div className="relative w-full max-w-5xl bg-white rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-content z-10 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {t("tab_room_reports", { fallback: "BÁO CÁO PHÒNG HỌP" })}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              {t("detail_title", { fallback: "Chi tiết báo cáo vi phạm phòng họp" })}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{reportId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Inner scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : !report ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t("detail_room_empty", { fallback: "Không tìm thấy báo cáo phòng họp" })}
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* 1. Tổng quan báo cáo phòng */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {t("detail_info", { fallback: "Thông tin tổng quan báo cáo" })}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* ID */}
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{t("detail_info_id", { fallback: "ID Báo cáo" })}</p>
                      <p className="text-xs font-mono text-slate-700 mt-0.5 break-all">
                        {report._id}
                      </p>
                    </div>
                  </div>

                  {/* Created at */}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{t("detail_info_time", { fallback: "Thời gian gửi" })}</p>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">{t("table_col_status", { fallback: "Trạng thái" })}</p>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1.5">{t("table_col_reason", { fallback: "Lý do vi phạm" })}</p>
                    <ReportTypeBadge reason={report.reason} />
                  </div>
                </div>


                {/* Description */}
                {report.description && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Mô tả chi tiết</p>
                    <p className="text-sm text-slate-700 leading-relaxed bg-white rounded-xl p-3 border border-slate-100">
                      {report.description}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Thông tin Phòng họp & Đối tượng liên quan */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  {t("detail_users", { fallback: "Đối tượng & Phòng họp liên quan" })}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card Phòng họp */}
                  <div className="rounded-2xl p-4 border border-brand-100 bg-brand-50/40">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-brand-600" />
                      {t("detail_room", { fallback: "Phòng họp bị báo cáo" })}
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {report.roomInfo?.name || report.roomName}
                      </p>
                      <p className="text-slate-500">
                        {t("detail_room_code", { fallback: "Mã phòng" })}: <span className="font-semibold text-brand-600">{report.roomInfo?.code || "—"}</span>
                      </p>
                      <p className="text-slate-500">
                        {t("detail_room_type", { fallback: "Loại phòng" })}: <span className="capitalize">{report.roomInfo?.type || "meeting"}</span>
                      </p>
                      <p className="text-slate-500">
                        {t("detail_room_members", { fallback: "Thành viên" })}: {report.roomInfo?.memberCount || "—"}
                      </p>

                    </div>
                  </div>

                  {/* Card Người báo cáo */}
                  <div className="rounded-2xl p-4 border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                      {t("user_card_reporter", { fallback: "Người báo cáo" })}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm bg-brand-100 text-brand-600 shrink-0">
                        {report.reporter?.displayName?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {report.reporter?.displayName || "—"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {report.reporter?.email || report.reporterId}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Chủ phòng */}
                  <div className="rounded-2xl p-4 border border-red-100 bg-red-50/40">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                      {t("detail_room_host", { fallback: "Chủ phòng họp (Owner)" })}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm bg-red-100 text-red-600 shrink-0">
                        {report.owner?.displayName?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {report.owner?.displayName || "—"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {report.owner?.email || report.roomOwner}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Minh chứng đính kèm */}
              {report.attachments && report.attachments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">{t("detail_evidence", { fallback: "Minh chứng đính kèm" })}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {report.attachments.map((file: any, i: number) => (
                      <div
                        key={i}
                        onClick={() => {
                          const allUrls = report.attachments.map((a: any) => a.url);
                          setLightboxImages(allUrls);
                          setLightboxIndex(i);
                        }}
                        className="relative block rounded-2xl overflow-hidden border border-slate-200 aspect-square group bg-slate-50 shadow-sm cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={file.url}
                          alt={file.fileName}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold text-center p-2">
                          {t("btn_view", { fallback: "Xem ảnh gốc" })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Cập nhật trạng thái & Khung hành động Admin */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800">{t("detail_status_update", { fallback: "Cập nhật trạng thái xử lý" })}</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">{t("status_current", { fallback: "Hiện tại:" })}</span>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      {t("status_update_note_label", { fallback: "Ghi chú / Thông báo xử lý của Admin (sẽ gửi kèm mail cho các bên)" })}
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={2}
                      placeholder={t("status_update_note_placeholder", { fallback: "Nhập ghi chú xử lý, lý do từ chối hoặc cảnh cáo..." })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 resize-none transition-all"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        handleTriggerAction("REVIEWING", "none", t("status_investigating", { fallback: "Đánh dấu đang xem xét" }), "info")
                      }
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {t("status_investigating", { fallback: "Đánh dấu đang xem xét" })}
                    </button>
                    <button
                      onClick={() =>
                        handleTriggerAction("REJECTED", "none", t("stats_rejected", { fallback: "Từ chối báo cáo" }), "danger")
                      }
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {t("stats_rejected", { fallback: "Từ chối báo cáo" })}
                    </button>
                    <button
                      onClick={() =>
                        handleTriggerAction("RESOLVED", "none", t("btn_warning", { fallback: "Cảnh cáo" }), "warning")
                      }
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {t("btn_warning", { fallback: "Cảnh cáo" })}
                    </button>
                    <button
                      onClick={() =>
                        handleTriggerAction(
                          "RESOLVED",
                          "blocked",
                          t("btn_lock_room", { fallback: "Khóa phòng vi phạm" }),
                          "danger",
                        )
                      }
                      disabled={isUpdating || !report.roomInfo}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {t("btn_lock_room", { fallback: "Khóa phòng vi phạm" })}
                    </button>
                  </div>
                </div>
              </div>


              {/* 5. Dòng thời gian nhật ký xử lý (Timeline) */}
              {report.processingLog && (
                <div className="border-t border-slate-100 pt-6">
                  <ReportTimeline
                    log={report.processingLog}
                    createdAt={report.createdAt}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      <ReportConfirmModal
        open={confirmOpen}
        title="Xác nhận hành động xử lý báo cáo"
        description={`Bạn có chắc chắn muốn thực hiện hành động "${pendingAction?.label}"? Hệ thống sẽ cập nhật trạng thái và gửi thông báo cho các bên liên quan.`}
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        variant={pendingAction?.variant || "info"}
        isLoading={isUpdating}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Image Lightbox */}
      {lightboxImages.length > 0 && (
        <ReportImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxImages([])}
        />
      )}
    </div>
  );

  return createPortal(modalLayout, document.body);
}
