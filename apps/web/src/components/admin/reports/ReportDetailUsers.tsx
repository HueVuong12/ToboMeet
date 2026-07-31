"use client";

import { useState } from "react";
import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import { Users, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
  onViewReportedUser?: () => void;
}

function UserCard({
  label,
  user,
  userId,
  isReported,
  onView,
}: {
  label: string;
  user: AdminReportDetail["reporter"];
  userId: string;
  isReported?: boolean;
  onView?: () => void;
}) {
  const t = useTranslations("admin.reports");
  const name = user?.displayName || "Không rõ";
  const email = user?.email || userId;
  const initials = name[0]?.toUpperCase() || "?";
  const status = user?.status;
  const isLocked = status === "BLOCKED" || status === "locked";

  return (
    <div
      className={`flex-1 rounded-2xl p-4 border ${
        isReported ? "border-red-100 bg-red-50/50" : "border-slate-100 bg-slate-50"
      }`}
    >
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
        {label}
      </p>
      <div className="flex items-center gap-3">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={name}
            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm ${
              isReported ? "bg-red-100 text-red-600" : "bg-brand-100 text-brand-600"
            }`}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
          <p className="text-xs text-slate-400 truncate">{email}</p>
          {isReported && (
            <div className="mt-1">
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3 h-3" />
                  {t("status_locked", { fallback: "Đã khóa" })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  {t("status_active", { fallback: "Hoạt động" })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isReported && onView && (
        <button
          onClick={onView}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-brand-600 bg-white border border-brand-200 hover:bg-brand-50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("btn_view_user")}
        </button>
      )}
    </div>
  );
}

export default function ReportDetailUsers({ report, onViewReportedUser }: Props) {
  const t = useTranslations("admin.reports");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        {t("detail_users")}
      </h3>
      <div className="flex gap-3 flex-col sm:flex-row">
        <UserCard
          label={t("user_card_reporter", { fallback: "Người báo cáo" })}
          user={report.reporter}
          userId={report.reporterId}
        />
        <UserCard
          label={t("user_card_reported", { fallback: "Người bị báo cáo" })}
          user={report.reported}
          userId={report.reportedUserId}
          isReported
          onView={onViewReportedUser}
        />
      </div>
    </div>
  );
}
