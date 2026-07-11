"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  AdminUserResponse,
  useLockUserMutation,
  useUnlockUserMutation,
  useExtendUserLockMutation,
} from "@/lib/redux/api/adminApi";
import { X, ShieldAlert, Clock, Mail, Info, Calendar, History, ShieldCheck, AlertTriangle } from "lucide-react";

interface ViolationDialogProps {
  user: AdminUserResponse;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const VIOLATION_TYPES = [
  { value: "Spam", labelKey: "violation_spam", labelDefault: "Spam / Quảng cáo" },
  { value: "Harassment", labelKey: "violation_harassment", labelDefault: "Quấy rối người khác" },
  { value: "Inappropriate_Content", labelKey: "violation_inappropriate_content", labelDefault: "Nội dung không phù hợp" },
  { value: "Impersonation", labelKey: "violation_impersonation", labelDefault: "Mạo danh" },
  { value: "Malware_Fraud", labelKey: "violation_malware_fraud", labelDefault: "Phát tán mã độc / Lừa đảo" },
  { value: "OTHER", labelKey: "violation_other", labelDefault: "Vi phạm khác" },
];

const PENALTY_POLICY: Record<string, { type: string; label: string }[]> = {
  spam: [
    { type: "WARNING", label: "Cảnh báo" },
    { type: "TEMPORARY", label: "12 giờ" },
    { type: "TEMPORARY", label: "24 giờ" },
  ],
  harassment: [
    { type: "TEMPORARY", label: "24 giờ" },
    { type: "TEMPORARY", label: "7 ngày" },
    { type: "INDEFINITE", label: "Vô thời hạn" },
  ],
  inappropriate_content: [
    { type: "TEMPORARY", label: "7 ngày" },
    { type: "TEMPORARY", label: "30 ngày" },
    { type: "INDEFINITE", label: "Vô thời hạn" },
  ],
  impersonation: [
    { type: "TEMPORARY", label: "30 ngày" },
    { type: "INDEFINITE", label: "Vô thời hạn" },
  ],
  malware_fraud: [
    { type: "INDEFINITE", label: "Vô thời hạn" },
  ],
};

const ADJUSTABLE_DURATIONS = [
  { value: "1 giờ", labelKey: "duration_1h", labelDefault: "1 giờ" },
  { value: "6 giờ", labelKey: "duration_6h", labelDefault: "6 giờ" },
  { value: "12 giờ", labelKey: "duration_12h", labelDefault: "12 giờ" },
  { value: "24 giờ", labelKey: "duration_24h", labelDefault: "24 giờ" },
  { value: "3 ngày", labelKey: "duration_3d", labelDefault: "3 ngày" },
  { value: "7 ngày", labelKey: "duration_7d", labelDefault: "7 ngày" },
  { value: "30 ngày", labelKey: "duration_30d", labelDefault: "30 ngày" },
  { value: "Vô thời hạn", labelKey: "lock_type_indefinite", labelDefault: "Khóa cho đến khi quản trị viên mở khóa (Vô thời hạn)" },
  { value: "custom", labelKey: "custom_unlock_datetime", labelDefault: "Tùy chỉnh Ngày & Giờ" },
];

export default function ViolationDialog({ user, onClose, onSuccess }: ViolationDialogProps) {
  const t = useTranslations("admin");
  const [activeTab, setActiveTab] = useState<"action" | "history">("action");

  const getDurationLabel = (val: string) => {
    switch (val) {
      case "Cảnh báo":
        return t("lock_type_warning_label", { defaultValue: "Cảnh báo" });
      case "1 giờ":
        return t("duration_1h", { defaultValue: "1 giờ" });
      case "6 giờ":
        return t("duration_6h", { defaultValue: "6 giờ" });
      case "12 giờ":
        return t("duration_12h", { defaultValue: "12 giờ" });
      case "24 giờ":
        return t("duration_24h", { defaultValue: "24 giờ" });
      case "3 ngày":
        return t("duration_3d", { defaultValue: "3 ngày" });
      case "7 ngày":
        return t("duration_7d", { defaultValue: "7 ngày" });
      case "30 ngày":
        return t("duration_30d", { defaultValue: "30 ngày" });
      case "Vô thời hạn":
        return t("lock_type_indefinite", { defaultValue: "Vô thời hạn" });
      case "Khóa cho đến khi quản trị viên mở khóa (Vô thời hạn)":
      case "Khóa cho đến khi quản trị viên mở khóa":
        return t("lock_type_indefinite", { defaultValue: "Khóa cho đến khi quản trị viên mở khóa" });
      default:
        return val;
    }
  };

  const getViolationTypeLabel = (val: string) => {
    const found = VIOLATION_TYPES.find(v => v.value === val);
    return found ? t(found.labelKey, { defaultValue: found.labelDefault }) : val;
  };
  
  // Lock mutations
  const [lockUser, { isLoading: isLocking }] = useLockUserMutation();
  const [unlockUser, { isLoading: isUnlocking }] = useUnlockUserMutation();
  const [extendUserLock, { isLoading: isExtending }] = useExtendUserLockMutation();

  // Form states
  const [violationType, setViolationType] = useState("Spam");
  const [recommendedDuration, setRecommendedDuration] = useState("Cảnh báo");
  const [applyProposal, setApplyProposal] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState("12 giờ");
  const [customDate, setCustomDate] = useState("");
  const [customDatePart, setCustomDatePart] = useState("");
  const [customHourPart, setCustomHourPart] = useState("08");
  const [customMinPart, setCustomMinPart] = useState("00");
  const [lockReason, setLockReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Extend lock states
  const [extendDuration, setExtendDuration] = useState("7 ngày");
  const [extendCustomDate, setExtendCustomDate] = useState("");
  const [extendDatePart, setExtendDatePart] = useState("");
  const [extendHourPart, setExtendHourPart] = useState("08");
  const [extendMinPart, setExtendMinPart] = useState("00");
  const [extendReason, setExtendReason] = useState("");

  const handleCustomDateChange = (date: string, hour: string, minute: string) => {
    setCustomDatePart(date);
    setCustomHourPart(hour);
    setCustomMinPart(minute);
    if (date) {
      setCustomDate(`${date}T${hour}:${minute}:00`);
    } else {
      setCustomDate("");
    }
  };

  const handleExtendCustomDateChange = (date: string, hour: string, minute: string) => {
    setExtendDatePart(date);
    setExtendHourPart(hour);
    setExtendMinPart(minute);
    if (date) {
      setExtendCustomDate(`${date}T${hour}:${minute}:00`);
    } else {
      setExtendCustomDate("");
    }
  };

  const formatCustomDisplay = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      const hour = d.getHours().toString().padStart(2, "0");
      const min = d.getMinutes().toString().padStart(2, "0");
      return `${day}/${month}/${year} ${hour}:${min}`;
    } catch {
      return "";
    }
  };

  const isBlocked = user.status === "BLOCKED" || user.status === "locked";

  const handleViolationTypeChange = (typeVal: string) => {
    setViolationType(typeVal);
    if (typeVal !== "OTHER") {
      setLockReason("");
      setValidationError("");
    }
  };

  // Tính số lần vi phạm và hình phạt đề xuất khi thay đổi hành vi
  useEffect(() => {
    if (isBlocked) return; // Không cần tính đề xuất nếu tài khoản đã bị khóa (chỉ gia hạn)

    const key = violationType.toLowerCase().replace(/\s+/g, "_");
    const count = (user.violationCounts?.[violationType] || 0) + 1;
    const policies = PENALTY_POLICY[key];
    
    if (policies) {
      const idx = Math.max(0, count - 1);
      const proposal = idx >= policies.length ? policies[policies.length - 1] : policies[idx];
      setRecommendedDuration(proposal.label);
    } else {
      setRecommendedDuration("24 giờ"); // Mặc định cho hành vi khác
    }
  }, [violationType, user.violationCounts, isBlocked]);

  // Thực hiện khóa
  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalReason = "";
    if (violationType === "OTHER") {
      if (!lockReason.trim()) {
        setValidationError(t("validation_required_reason"));
        return;
      }
      finalReason = lockReason.trim();
    } else {
      const currentViolation = VIOLATION_TYPES.find(v => v.value === violationType);
      finalReason = currentViolation 
        ? t(currentViolation.labelKey, { defaultValue: currentViolation.labelDefault }) 
        : violationType;
    }

    let finalDuration = applyProposal ? recommendedDuration : selectedDuration;
    if (!applyProposal && selectedDuration === "custom") {
      if (!customDate) {
        alert(t("select_custom_time_error"));
        return;
      }
      finalDuration = new Date(customDate).toISOString();
    }

    try {
      const res = await lockUser({
        id: user.id,
        violationType,
        recommendedDuration,
        actualDuration: finalDuration,
        lockReason: finalReason,
        sendEmail: true,
      }).unwrap();

      const successMsg = finalDuration === "Cảnh báo" 
        ? t("warning_success")
        : t("lock_success");

      if (res && res.emailWarning) {
        onSuccess(res.emailWarning);
      } else {
        onSuccess(successMsg);
      }
      onClose();
    } catch (err: any) {
      alert(t("error_prefix") + (err?.data?.message || err?.message));
    }
  };

  // Thực hiện gia hạn khóa
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendReason.trim()) return;

    let finalDuration = extendDuration;
    if (extendDuration === "custom") {
      if (!extendCustomDate) {
        alert(t("select_custom_time_error"));
        return;
      }
      finalDuration = new Date(extendCustomDate).toISOString();
    }

    try {
      const res = await extendUserLock({
        id: user.id,
        actualDuration: finalDuration,
        lockReason: extendReason.trim(),
      }).unwrap();

      if (res && res.emailWarning) {
        onSuccess(res.emailWarning);
      } else {
        onSuccess(t("extend_lock_success"));
      }
      onClose();
    } catch (err: any) {
      alert(t("error_prefix") + (err?.data?.message || err?.message));
    }
  };

  // Thực hiện mở khóa
  const handleUnlockClick = async () => {
    if (!confirm(t("unlock_confirm_desc", { name: user.displayName || user.email }))) {
      return;
    }
    try {
      await unlockUser(user.id).unwrap();
      onSuccess(t("unlock_success"));
      onClose();
    } catch (err: any) {
      alert(t("error_prefix") + (err?.data?.message || err?.message));
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return t("lock_type_indefinite");
    return new Date(dateStr).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isBlocked ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isBlocked ? t("lock_title_short") : t("lock_modal_title")}
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {user.displayName || user.email} ({user.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 border-b border-slate-100 flex gap-4 shrink-0 bg-white">
          <button
            onClick={() => setActiveTab("action")}
            className={`py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "action"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {isBlocked ? `${t("extend_lock")} / ${t("unlock")}` : t("lock_account")}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "history"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t("audit_history")} ({user.lockHistory?.length || 0})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-slate-50/30">
          {activeTab === "action" ? (
            isBlocked ? (
              /* MÀN HÌNH GIA HẠN / MỞ KHÓA */
              <div className="space-y-6">
                {/* Thông tin khóa hiện tại */}
                <div className="bg-red-50/50 border border-red-150 rounded-2xl p-4 text-sm text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-800">
                    <Clock className="w-4 h-4" />
                    <span>{t("status_blocked")}</span>
                  </div>
                  <p><strong>{t("lock_type")}:</strong> {user.lockType === "INDEFINITE" ? t("lock_type_indefinite") : t("lock_type_temporary")}</p>
                  {user.lockedUntil && (
                    <p><strong>{t("unlock_date")}:</strong> {formatDateTime(user.lockedUntil)}</p>
                  )}
                  <p><strong>{t("violation_behavior")}:</strong> {getViolationTypeLabel(user.violationType || "")}</p>
                  <p><strong>{t("lock_reason")}:</strong> {user.lockReason}</p>
                  <p><strong>{t("locked_by")}:</strong> {user.lockedBy}</p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleUnlockClick}
                    disabled={isUnlocking}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>{t("unlock")}</span>
                  </button>
                </div>

                <div className="relative flex py-2 items-center shrink-0">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t("extend_lock")}</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <form onSubmit={handleExtendSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      {t("select_new_lock_duration")}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ADJUSTABLE_DURATIONS.slice(0, 8).map((dur) => (
                        <button
                          key={dur.value}
                          type="button"
                          onClick={() => setExtendDuration(dur.value)}
                          className={`px-4 py-2.5 text-xs font-bold border rounded-xl text-left transition-all ${
                            extendDuration === dur.value
                              ? "bg-brand-50 border-brand-500 text-brand-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {t(dur.labelKey, { defaultValue: dur.labelDefault })}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setExtendDuration("custom")}
                        className={`col-span-2 px-4 py-2.5 text-xs font-bold border rounded-xl text-left transition-all ${
                          extendDuration === "custom"
                            ? "bg-brand-50 border-brand-500 text-brand-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t("custom_unlock_datetime")}
                      </button>
                    </div>
                  </div>

                  {extendDuration === "custom" && (
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-2 animate-in slide-in-from-top-1.5 duration-200">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {t("select_24h_datetime")}
                      </label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Chọn Ngày */}
                        <div className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <input
                            type="date"
                            value={extendDatePart}
                            onChange={(e) => handleExtendCustomDateChange(e.target.value, extendHourPart, extendMinPart)}
                            className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none"
                          />
                        </div>

                        {/* Chọn Giờ */}
                        <div className="w-[80px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <select
                            value={extendHourPart}
                            onChange={(e) => handleExtendCustomDateChange(extendDatePart, e.target.value, extendMinPart)}
                            className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer"
                          >
                            {Array.from({ length: 24 }).map((_, h) => {
                              const hStr = h.toString().padStart(2, "0");
                              return <option key={hStr} value={hStr}>{hStr}</option>;
                            })}
                          </select>
                        </div>

                        {/* Chọn Phút */}
                        <div className="w-[80px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <select
                            value={extendMinPart}
                            onChange={(e) => handleExtendCustomDateChange(extendDatePart, extendHourPart, e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer"
                          >
                            {Array.from({ length: 60 }).map((_, m) => {
                              const mStr = m.toString().padStart(2, "0");
                              return <option key={mStr} value={mStr}>{mStr}</option>;
                            })}
                          </select>
                        </div>
                      </div>
                      {extendCustomDate && (
                        <p className="text-[10px] text-slate-400 font-bold">
                          {t("selected_label")}: {formatCustomDisplay(extendCustomDate)}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      {t("extend_lock_reason")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={extendReason}
                      onChange={(e) => setExtendReason(e.target.value)}
                      placeholder={t("extend_lock_reason_placeholder")}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isExtending || !extendReason.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-md shadow-brand-600/10 cursor-pointer"
                  >
                    <span>{t("apply_extension")}</span>
                  </button>
                </form>
              </div>
            ) : (
              /* MÀN HÌNH KHÓA TÀI KHOẢN / CẢNH BÁO MỚI */
              <form onSubmit={handleLockSubmit} className="space-y-5">
                {/* Bước 1: Chọn hành vi */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    {t("step_1_select_violation")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIOLATION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleViolationTypeChange(type.value)}
                        className={`px-4 py-2.5 text-xs font-bold border rounded-xl text-left transition-all ${
                          violationType === type.value
                            ? "bg-brand-50 border-brand-500 text-brand-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t(type.labelKey, { defaultValue: type.labelDefault })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bước 2: Hiển thị Đề xuất hình phạt */}
                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("previous_violations")}
                      </span>
                      <p className="text-sm font-bold text-slate-700">
                        {t("times", { count: user.violationCounts?.[violationType] || 0 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {t("recommended_penalty")}
                      </span>
                      <p className="text-base font-black text-indigo-600">
                        {getDurationLabel(recommendedDuration)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyProposal}
                        onChange={(e) => setApplyProposal(e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {t("apply_recommended_duration")}
                      </span>
                    </label>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!applyProposal}
                        onChange={(e) => setApplyProposal(!e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {t("adjust_duration")}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Khi Admin chọn Điều chỉnh */}
                {!applyProposal && (
                  <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      {t("select_new_lock_duration")}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ADJUSTABLE_DURATIONS.slice(0, 8).map((dur) => (
                        <button
                          key={dur.value}
                          type="button"
                          onClick={() => setSelectedDuration(dur.value)}
                          className={`px-3 py-2 text-xs font-bold border rounded-lg text-left transition-all ${
                            selectedDuration === dur.value
                              ? "bg-brand-50 border-brand-500 text-brand-700"
                              : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {t(dur.labelKey, { defaultValue: dur.labelDefault })}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedDuration("custom")}
                        className={`col-span-2 px-3 py-2 text-xs font-bold border rounded-lg text-left transition-all ${
                          selectedDuration === "custom"
                            ? "bg-brand-50 border-brand-500 text-brand-700"
                            : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {t("custom_unlock_datetime")}
                      </button>
                    </div>

                    {selectedDuration === "custom" && (
                      <div className="bg-slate-50 border border-slate-100 p-3.5 mt-2 rounded-xl flex flex-col gap-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {t("select_24h_datetime")}
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                          {/* Chọn Ngày */}
                          <div className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              type="date"
                              value={customDatePart}
                              onChange={(e) => handleCustomDateChange(e.target.value, customHourPart, customMinPart)}
                              className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none"
                            />
                          </div>

                          {/* Chọn Giờ */}
                          <div className="w-[80px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <select
                              value={customHourPart}
                              onChange={(e) => handleCustomDateChange(customDatePart, e.target.value, customMinPart)}
                              className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer"
                            >
                              {Array.from({ length: 24 }).map((_, h) => {
                                const hStr = h.toString().padStart(2, "0");
                                return <option key={hStr} value={hStr}>{hStr}</option>;
                              })}
                            </select>
                          </div>

                          {/* Chọn Phút */}
                          <div className="w-[80px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <select
                              value={customMinPart}
                              onChange={(e) => handleCustomDateChange(customDatePart, customHourPart, e.target.value)}
                              className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer"
                            >
                              {Array.from({ length: 60 }).map((_, m) => {
                                const mStr = m.toString().padStart(2, "0");
                                return <option key={mStr} value={mStr}>{mStr}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                        {customDate && (
                          <p className="text-[10px] text-slate-400 font-bold">
                            {t("selected_label")}: {formatCustomDisplay(customDate)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Nhập lý do (Chỉ khi chọn Vi phạm khác) */}
                {violationType === "OTHER" && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      {t("lock_reason_other_label")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={lockReason}
                      onChange={(e) => {
                        setLockReason(e.target.value);
                        if (e.target.value.trim()) {
                          setValidationError("");
                        }
                      }}
                      placeholder={t("lock_reason_other_placeholder")}
                      className={`w-full px-4 py-3 bg-white border rounded-2xl text-sm focus:outline-none focus:border-brand-500 transition-colors ${
                        validationError ? "border-red-500 focus:border-red-500" : "border-slate-200"
                      }`}
                    />
                    {validationError && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {validationError}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLocking || (violationType === "OTHER" && !lockReason.trim())}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-md shadow-brand-600/10 cursor-pointer"
                >
                  <span>{t("apply_decision")}</span>
                </button>
              </form>
            )
          ) : (
            /* LỊCH SỬ AUDIT LOG */
            <div className="space-y-4">
              {!user.lockHistory || user.lockHistory.length === 0 ? (
                <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 font-medium">
                  {t("no_history_recorded")}
                </div>
              ) : (
                user.lockHistory.map((historyItem, index) => {
                  const isDurationDifferent = historyItem.recommendedDuration !== historyItem.actualDuration && historyItem.recommendedDuration !== "N/A";
                  return (
                    <div key={index} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
                      {isDurationDifferent && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-bl flex items-center gap-1 shadow-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t("adjust_duration")}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            historyItem.lockType === "WARNING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {historyItem.lockType === "WARNING" ? t("lock_type_warning_label") : t("lock_action")}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {formatDateTime(historyItem.lockedAt)}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          {t("source")}: <strong className="text-slate-600">{historyItem.lockSource || "MANUAL"}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                        <p className="text-slate-500">
                          {t("violation")}: <strong className="text-slate-700">{getViolationTypeLabel(historyItem.violationType)} ({t("times", { count: historyItem.violationCount })})</strong>
                        </p>
                        <p className="text-slate-500">
                          {t("handled_by")}: <strong className="text-slate-700">{historyItem.lockedBy}</strong>
                        </p>
                        <p className="text-slate-500">
                          {t("policy_proposal")}: <strong className="text-slate-700">{getDurationLabel(historyItem.recommendedDuration)}</strong>
                        </p>
                        <p className="text-slate-500">
                          {t("actual_applied")}: <strong className="text-slate-700">{historyItem.actualDuration.includes("-") ? t("custom_unlock_datetime") : getDurationLabel(historyItem.actualDuration)}</strong>
                        </p>
                        {historyItem.lockedUntil && (
                          <p className="text-slate-500 col-span-2">
                            {t("unlock_date")}: <strong className="text-slate-700">{formatDateTime(historyItem.lockedUntil)}</strong>
                          </p>
                        )}
                        <p className="text-slate-500 col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                          {t("reason")}: <span className="text-slate-700 font-semibold">{historyItem.lockReason}</span>
                        </p>
                        <div className="col-span-2 flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1 text-[11px] font-bold text-slate-400">
                          <span>{t("report_email")}: <strong className={historyItem.emailSent ? "text-emerald-600" : "text-slate-500"}>{historyItem.emailSent ? t("email_sent") : "No / Error"}</strong></span>
                          {historyItem.unlockedAt ? (
                            <span className="text-emerald-600">
                              {t("unlocked_on")}: {formatDateTime(historyItem.unlockedAt)} ({historyItem.unlockedBy})
                            </span>
                          ) : (
                            historyItem.lockType !== "WARNING" && (
                              <span className="text-red-500 flex items-center gap-1 animate-pulse">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{t("lock_active")}</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
