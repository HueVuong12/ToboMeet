"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useGetAdminReportByIdQuery } from "@/lib/redux/api/adminApi";
import ReportDetailInfo from "./ReportDetailInfo";
import ReportDetailUsers from "./ReportDetailUsers";
import ReportDetailRoom from "./ReportDetailRoom";
import ReportDetailEvidence from "./ReportDetailEvidence";
import ReportStatusUpdate from "./ReportStatusUpdate";
import ReportAdminNotes from "./ReportAdminNotes";
import ReportConclusion from "./ReportConclusion";
import ReportTimeline from "./ReportTimeline";
import { useTranslations } from "next-intl";

interface Props {
  reportId: string;
  onClose: () => void;
  onViewUser?: (userId: string) => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export default function ReportDetailModal({
  reportId,
  onClose,
  onViewUser,
  onSuccess,
  onError,
}: Props) {
  const t = useTranslations("admin.reports");
  const { data: report, isLoading } = useGetAdminReportByIdQuery(reportId);
  const [mounted, setMounted] = useState(false);

  // Mounted state check for safe Next.js Client Portal rendering
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Esc key handler to close modal
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

  const modalLayout = (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 overflow-hidden">
      {/* CSS Animation injection to guarantee smooth fade-in and scale-up transitions */}
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

      {/* Backdrop with 50% opacity slate-900 color */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
      />

      {/* Centered Modal Container */}
      <div className="relative w-full max-w-5xl bg-white rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-content z-10 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("detail_title")}</h2>
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
              Không tìm thấy báo cáo
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Info */}
              <ReportDetailInfo report={report} />

              {/* Users */}
              <ReportDetailUsers
                report={report}
                onViewReportedUser={() => {
                  onClose();
                  onViewUser?.(report.reportedUserId);
                }}
              />

              {/* Room */}
              <ReportDetailRoom report={report} />

              {/* Evidence */}
              <ReportDetailEvidence report={report} />

              <div className="border-t border-slate-100 pt-6 space-y-6">
                {/* Status Update */}
                <ReportStatusUpdate
                  report={report}
                  onSuccess={onSuccess}
                  onError={onError}
                />

                {/* Admin Notes */}
                <ReportAdminNotes
                  report={report}
                  onSuccess={onSuccess}
                  onError={onError}
                />

                {/* Conclusion */}
                <ReportConclusion
                  report={report}
                  onSuccess={onSuccess}
                  onError={onError}
                  onViewUser={() => {
                    onClose();
                    onViewUser?.(report.reportedUserId);
                  }}
                />
              </div>

              {/* Timeline */}
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
    </div>
  );

  return createPortal(modalLayout, document.body);
}
