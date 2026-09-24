import React from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface SubmissionTabsProps {
  activeTab: "need_return" | "returned";
  onTabChange: (tab: "need_return" | "returned") => void;
  needReturnCount: number;
  returnedCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function SubmissionTabs({
  activeTab,
  onTabChange,
  needReturnCount,
  returnedCount,
  searchQuery,
  onSearchChange,
}: SubmissionTabsProps) {
  const t = useTranslations("room.assignments_i18n.lms");

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 px-6 bg-white gap-3 shrink-0">
      {/* Tab buttons */}
      <div className="flex items-center gap-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => onTabChange("need_return")}
          className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "need_return"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t("tab_need_return")}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("returned")}
          className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "returned"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t("tab_returned")}
        </button>
      </div>

      {/* Search Bar */}
      <div className="py-2 sm:py-0 w-full sm:w-72">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full pl-3.5 pr-9 py-1.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
          <Search
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
