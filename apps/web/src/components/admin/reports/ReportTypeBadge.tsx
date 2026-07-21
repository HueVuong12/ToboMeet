"use client";

import { useTranslations } from "next-intl";

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  Spam: { bg: "bg-orange-50", text: "text-orange-700" },
  "Quấy rối": { bg: "bg-red-50", text: "text-red-700" },
  "Ngôn từ xúc phạm": { bg: "bg-pink-50", text: "text-pink-700" },
  "Chia sẻ nội dung không phù hợp": {
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  "Mạo danh": { bg: "bg-indigo-50", text: "text-indigo-700" },
  Khác: { bg: "bg-slate-100", text: "text-slate-600" },
};

interface Props {
  reason: string;
  size?: "sm" | "md";
}

export default function ReportTypeBadge({ reason, size = "md" }: Props) {
  const t = useTranslations("admin.reports");
  const config = TYPE_CONFIG[reason] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
  };
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  const reasonKeys: Record<string, string> = {
    "Spam": "reason_spam",
    "Quấy rối": "reason_harassment",
    "Lừa đảo": "reason_fraud",
    "Ngôn từ xúc phạm": "reason_offensive_speech",
    "Chia sẻ nội dung không phù hợp": "reason_inappropriate_content",
    "Nội dung không phù hợp": "reason_inappropriate_content",
    "Mạo danh": "reason_impersonation",
    "Khác": "reason_other",
  };

  const translationKey = reasonKeys[reason];
  const displayLabel = translationKey ? t(translationKey, { fallback: reason }) : reason;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${px}`}
    >
      {displayLabel}
    </span>
  );
}
