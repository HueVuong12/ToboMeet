import React, { useState } from "react";
import { X, Calendar, Clock, Check, Shield, Shuffle, Eye, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { QuizSettings } from "../types";
import { toLocalDatetimeInputString, fromLocalDatetimeInputString } from "../utils/datetimeHelper";

interface QuizSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: QuizSettings;
  onSave: (updated: QuizSettings) => void;
  roomMembers?: { userId?: string; name?: string; displayName?: string; role?: string }[];
}

export default function QuizSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  roomMembers = [],
}: QuizSettingsModalProps) {
  const t = useTranslations("room.assignments_i18n");
  const [draft, setDraft] = useState<QuizSettings>(settings);
  const [searchMember, setSearchMember] = useState("");

  if (!isOpen) return null;

  const updateField = <K extends keyof QuizSettings>(key: K, value: QuizSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMember = (memberId: string) => {
    const current = draft.specificMemberIds || [];
    if (current.includes(memberId)) {
      updateField("specificMemberIds", current.filter((id) => id !== memberId));
    } else {
      updateField("specificMemberIds", [...current, memberId]);
    }
  };

  const filteredMembers = (roomMembers || []).filter((m) => {
    const name = m.displayName || m.name || m.userId || "";
    return name.toLowerCase().includes(searchMember.toLowerCase().trim());
  });

  const handleSave = () => {
    const isSpecific = draft.recipientType === "specific_members" || draft.accessControl === "specific_members";
    if (isSpecific && (!draft.specificMemberIds || draft.specificMemberIds.length === 0)) {
      toast.error(t("quiz_select_members_min_one"));
      return;
    }
    onSave(draft);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t("quiz_settings_title")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("quiz_settings_desc")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Section 1: Thời gian & Điểm */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-blue-500" />
              {t("quiz_section_time_score")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t("quiz_time_limit_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={draft.timeLimitMinutes}
                  onChange={(e) => updateField("timeLimitMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder={t("quiz_time_limit_placeholder")}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">{t("quiz_time_limit_hint")}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t("quiz_pass_score_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.passScore}
                  onChange={(e) => updateField("passScore", Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">{t("quiz_pass_score_hint")}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Tùy chọn hiển thị & xáo trộn */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              {t("quiz_section_rules")}
            </h3>
            <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {/* Hiển thị kết quả tự động */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <p className="font-semibold text-slate-800 text-xs">{t("quiz_show_results_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("quiz_show_results_desc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.showResultsAfterSubmit}
                  onClick={() => updateField("showResultsAfterSubmit", !draft.showResultsAfterSubmit)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    draft.showResultsAfterSubmit ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      draft.showResultsAfterSubmit ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Xáo trộn câu hỏi */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <p className="font-semibold text-slate-800 text-xs">{t("quiz_shuffle_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("quiz_shuffle_desc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.shuffleQuestions}
                  onClick={() => updateField("shuffleQuestions", !draft.shuffleQuestions)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    draft.shuffleQuestions ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      draft.shuffleQuestions ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Nhận phản hồi */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <p className="font-semibold text-slate-800 text-xs">{t("quiz_accept_responses_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("quiz_accept_responses_desc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.acceptingResponses}
                  onClick={() => updateField("acceptingResponses", !draft.acceptingResponses)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    draft.acceptingResponses ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      draft.acceptingResponses ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Cho phép làm bài nhiều lần */}
              <div className="flex items-center justify-between p-3.5">
                <div className="pr-4">
                  <p className="font-semibold text-slate-800 text-xs">{t("quiz_allow_multiple_attempts_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t("quiz_allow_multiple_attempts_desc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.allowMultipleAttempts ?? false}
                  onClick={() => updateField("allowMultipleAttempts", !(draft.allowMultipleAttempts ?? false))}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                    draft.allowMultipleAttempts ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      draft.allowMultipleAttempts ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>


          {/* Section 3: Lịch thi */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              {t("quiz_section_schedule")}
            </h3>
            <div className="flex flex-col gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("quiz_start_date")}
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInputString(draft.startDate)}
                  onChange={(e) => updateField("startDate", fromLocalDatetimeInputString(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("quiz_end_date")}
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInputString(draft.endDate)}
                  onChange={(e) => updateField("endDate", fromLocalDatetimeInputString(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t("quiz_close_date")}
                </label>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInputString(draft.closeDate)}
                  onChange={(e) => updateField("closeDate", fromLocalDatetimeInputString(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Giao cho */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              {t("field_recipient")}
            </h3>
            <select
              value={
                draft.recipientType ||
                (draft.accessControl === "specific_members"
                  ? "specific_members"
                  : draft.accessControl === "anyone"
                  ? "current_and_future_members"
                  : "current_members")
              }
              onChange={(e) => {
                const val = e.target.value as any;
                setDraft((prev) => ({
                  ...prev,
                  recipientType: val,
                  accessControl: val === "specific_members" ? "specific_members" : "anyone",
                }));
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="current_members">{t("recipient_current")}</option>
              <option value="current_and_future_members">{t("recipient_current_and_future")}</option>
              <option value="specific_members">{t("recipient_specific")}</option>
            </select>

            {/* Khi chọn Chỉ định -> Hiển thị input tìm kiếm & danh sách thành viên */}
            {(draft.recipientType === "specific_members" || draft.accessControl === "specific_members") && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{t("quiz_select_members_label")}</span>
                  <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {t("quiz_selected_members_count", { count: (draft.specificMemberIds || []).length })}
                  </span>
                </div>

                {/* Input tìm kiếm */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder={t("quiz_search_member_placeholder")}
                    className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium text-slate-800 transition-all placeholder:text-slate-400"
                  />
                  {searchMember && (
                    <button
                      type="button"
                      onClick={() => setSearchMember("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* List thành viên */}
                <div className="bg-white border border-slate-200 rounded-xl p-1.5 max-h-48 overflow-y-auto space-y-0.5">
                  {roomMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">{t("quiz_no_members_in_room")}</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">{t("quiz_no_members_found")}</p>
                  ) : (
                    filteredMembers.map((m) => {
                      const mId = m.userId || "";
                      const isSelected = (draft.specificMemberIds || []).includes(mId);
                      return (
                        <div
                          key={mId}
                          onClick={() => toggleMember(mId)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? "bg-blue-50 text-[#0052FF] font-semibold"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">
                              {(m.displayName || m.name || "?").slice(0, 1).toUpperCase()}
                            </div>
                            <span className="truncate">{m.displayName || m.name || mId}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="pointer-events-none accent-[#0052FF] shrink-0"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            {t("quiz_btn_cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0052FF] hover:bg-blue-700 transition-colors shadow-sm"
          >
            {t("quiz_settings_save_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
