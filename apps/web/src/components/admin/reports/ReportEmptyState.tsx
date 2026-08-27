"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  message?: string;
  description?: string;
}

export default function ReportEmptyState({
  message,
  description,
}: Props) {
  const t = useTranslations("admin.reports");

  const msg = message || t("empty_title");
  const desc = description || t("empty_desc");

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Flag className="w-8 h-8 text-slate-300" />
      </div>
      <h3 className="text-base font-bold text-slate-700 mb-1">{msg}</h3>
      <p className="text-sm text-slate-400 max-w-xs">{desc}</p>
    </div>
  );
}
