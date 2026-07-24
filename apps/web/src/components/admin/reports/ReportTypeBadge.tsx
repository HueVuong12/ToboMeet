"use client";

import { useTranslations } from "next-intl";

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  Spam: { bg: "bg-orange-50", text: "text-orange-700" },
  "Quấy rối": { bg: "bg-red-50", text: "text-red-700" },
  "Ngôn từ xúc phạm": { bg: "bg-pink-50", text: "text-pink-700" },
  "Chia sẻ nội dung không phù hợp": { bg: "bg-purple-50", text: "text-purple-700" },
  "Nội dung không phù hợp": { bg: "bg-purple-50", text: "text-purple-700" },
  "Nội dung phản cảm": { bg: "bg-purple-50", text: "text-purple-700" },
  "Lừa đảo": { bg: "bg-amber-50", text: "text-amber-700" },
  "Chia sẻ thông tin sai sự thật": { bg: "bg-rose-50", text: "text-rose-700" },
  "Thông tin sai sự thật": { bg: "bg-rose-50", text: "text-rose-700" },
  "Vi phạm bản quyền": { bg: "bg-blue-50", text: "text-blue-700" },
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
    "Lừa đảo": "reason_scam",
    "Ngôn từ xúc phạm": "reason_offensive_speech",
    "Chia sẻ nội dung không phù hợp": "reason_inappropriate_content",
    "Nội dung không phù hợp": "reason_inappropriate_content",
    "Nội dung phản cảm": "reason_inappropriate_content_room",
    "Chia sẻ thông tin sai sự thật": "reason_fake_info",
    "Thông tin sai sự thật": "reason_fake_info",
    "Vi phạm bản quyền": "reason_copyright",
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
