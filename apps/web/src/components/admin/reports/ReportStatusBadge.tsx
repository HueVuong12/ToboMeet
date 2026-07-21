"use client";

import { useTranslations } from "next-intl";

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    labelKey: "status_pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
  },
  INVESTIGATING: {
    labelKey: "status_investigating",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  REVIEWING: {
    labelKey: "status_investigating",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  RESOLVED: {
    labelKey: "status_resolved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    labelKey: "status_rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  CLOSED: {
    labelKey: "status_closed",
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export default function ReportStatusBadge({ status, size = "md" }: Props) {
  const t = useTranslations("admin.reports");

  const config = STATUS_CONFIG[status] || {
    labelKey: "",
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  };

  const labelMap: Record<string, string> = {
    PENDING: "Chờ xử lý",
    INVESTIGATING: "Đang xem xét",
    REVIEWING: "Đang xem xét",
    RESOLVED: "Đã xử lý",
    REJECTED: "Đã từ chối",
    CLOSED: "Đã đóng",
  };

  const label = config.labelKey ? t(config.labelKey, { fallback: labelMap[status] || status }) : (labelMap[status] || status);
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${config.bg} ${config.text} ${px}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

export { STATUS_CONFIG };
