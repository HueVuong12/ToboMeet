import React, { useState } from "react";
import { Assignment } from "../types";
import { ArrowLeft, Save, Send, Upload, X, Trash2, Calendar, File } from "lucide-react";
import { uploadReportEvidence } from "@/services/uploadService";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface AssignmentCreateProps {
  roomId: string;
  channels: any[];
  roomMembers: any[];
  assignmentToEdit?: Assignment;
  onBack: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}

export default function AssignmentCreate({
  roomId,
  channels,
  roomMembers,
  assignmentToEdit,
  onBack,
  onSubmit,
  isSubmitting,
}: AssignmentCreateProps) {
  const t = useTranslations("room.assignments_i18n");

  const [title, setTitle] = useState(assignmentToEdit?.title || "");
  const [description, setDescription] = useState(assignmentToEdit?.description || "");
  const [channelId, setChannelId] = useState(assignmentToEdit?.channelId || channels[0]?._id || "");
  
  // Format deadline date/time for local inputs
  const getInitialDateTime = () => {
    if (assignmentToEdit?.deadline) {
      const d = new Date(assignmentToEdit.deadline);
      const date = d.toISOString().split("T")[0];
      const time = d.toTimeString().split(" ")[0].substring(0, 5);
      return { date, time };
    }
    return { date: "", time: "23:59" };
  };

  const initialDateTime = getInitialDateTime();
  const [deadlineDate, setDeadlineDate] = useState(initialDateTime.date);
  const [deadlineTime, setDeadlineTime] = useState(initialDateTime.time);
  const [submissionPolicy, setSubmissionPolicy] = useState<"allow_late" | "lock_after_deadline">(
    assignmentToEdit?.submissionPolicy || "allow_late"
  );
  
  const [recipientType, setRecipientType] = useState<string>(
    assignmentToEdit?.recipientType || "current_and_future_members"
  );
  const [recipientMemberIds, setRecipientMemberIds] = useState<string[]>(
    assignmentToEdit?.recipientMemberIds || []
  );

  const [gradingType, setGradingType] = useState<"graded" | "ungraded">(
    assignmentToEdit?.gradingType || "graded"
  );
  const [maxScore, setMaxScore] = useState<number>(assignmentToEdit?.maxScore || 10);

  const [attachments, setAttachments] = useState<any[]>(assignmentToEdit?.attachments || []);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Sử dụng uploadReportEvidence có sẵn để upload minh chứng/file
        const uploaded = await uploadReportEvidence(file);
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: uploaded.url,
            size: file.size,
            type: file.type,
          },
        ]);
      }
      toast.success(t("upload_evidence_success"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t("upload_evidence_failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleRecipientMember = (memberId: string) => {
    setRecipientMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSave = async (status: "draft" | "published") => {
    // Chỉ validate đầy đủ khi Giao bài (published)
    if (status === "published") {
      if (!title.trim()) {
        toast.error(t("error_title_required"));
        return;
      }
      if (!channelId) {
        toast.error(t("error_channel_required"));
        return;
      }
      if (!deadlineDate) {
        toast.error(t("error_deadline_required"));
        return;
      }
    }

    // Nếu là bản nháp và chưa chọn ngày hết hạn, không gửi deadline ISO sai format
    const deadline = deadlineDate
      ? new Date(`${deadlineDate}T${deadlineTime || "00:00"}:00`).toISOString()
      : undefined;

    const payload = {
      title: title.trim(),
      description,
      roomId,
      channelId,
      deadline,
      submissionPolicy,
      recipientType,
      recipientMemberIds: recipientType === "specific_members" ? recipientMemberIds : [],
      gradingType,
      maxScore: gradingType === "graded" ? maxScore : undefined,
      attachments,
      status,
    };

    await onSubmit(payload);
  };

  const hasUnsavedChanges = () => {
    return (
      title !== (assignmentToEdit?.title || "") ||
      description !== (assignmentToEdit?.description || "") ||
      attachments.length !== (assignmentToEdit?.attachments?.length || 0)
    );
  };

  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const handleDiscardClick = () => {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true);
    } else {
      onBack();
    }
  };

  const handleBackClick = () => {
    handleDiscardClick();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackClick}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-bold text-slate-800 text-sm">
            {assignmentToEdit ? t("edit_title") : t("create_title")}
          </h2>
        </div>
      </div>

      {/* Main Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Form Body Fields (Colum/Row layout) */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Content Area */}
          <div className="flex-1 flex flex-col gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            {/* Tên bài tập */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{t("field_title")} *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("field_title_placeholder")}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>

            {/* Hướng dẫn */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{t("field_desc")}</label>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("field_desc_placeholder")}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
              />
            </div>

            {/* Đính kèm File */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{t("field_attachments")}</label>
              <div className="border border-dashed border-slate-200 hover:border-brand-500 rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={24} className="text-slate-400" />
                <p className="text-xs text-slate-600 font-medium">{t("upload_drag_drop")}</p>
                <p className="text-[10px] text-slate-400">{t("upload_hint")}</p>
              </div>

              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <File size={16} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 hover:bg-slate-200 rounded text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Settings Sidebar */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
            {/* Cấu hình thời gian & chính sách */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                {t("section_policy")}
              </h3>

              {/* Deadline */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">{t("field_deadline_date")} *</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">{t("field_deadline_time")}</label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Chính sách */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">{t("field_policy")}</label>
                <select
                  value={submissionPolicy}
                  onChange={(e: any) => setSubmissionPolicy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                >
                  <option value="allow_late">{t("policy_allow")}</option>
                  <option value="lock_after_deadline">{t("policy_lock")}</option>
                </select>
              </div>
            </div>

            {/* Kênh & Người nhận */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                {t("section_recipient")}
              </h3>

              {/* Kênh */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">{t("field_channel")} *</label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                >
                  {channels.map((ch) => (
                    <option key={ch._id} value={ch._id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Người nhận */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">{t("field_recipient")}</label>
                <select
                  value={recipientType}
                  onChange={(e: any) => setRecipientType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                >
                  <option value="current_members">{t("recipient_current")}</option>
                  <option value="current_and_future_members">{t("recipient_current_and_future")}</option>
                  <option value="specific_members">{t("recipient_specific")}</option>
                </select>
              </div>

              {/* Chọn thành viên cụ thể */}
              {recipientType === "specific_members" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">{t("select_members")}</label>
                  <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
                    {roomMembers
                      .filter((m) => m.userId !== roomMembers[0]?.userId) // Giao cho học viên
                      .map((m) => {
                        const isSelected = recipientMemberIds.includes(m.userId);
                        return (
                          <div
                            key={m.userId}
                            onClick={() => toggleRecipientMember(m.userId)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                              isSelected ? "bg-brand-50 text-brand-600 font-semibold" : "hover:bg-slate-50"
                            }`}
                          >
                            <span>{m.displayName || m.userId}</span>
                            <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none" />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Chấm điểm */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                {t("section_grading")}
              </h3>

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={gradingType === "graded"}
                    onChange={() => setGradingType("graded")}
                  />
                  <span>{t("grading_graded")}</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={gradingType === "ungraded"}
                    onChange={() => setGradingType("ungraded")}
                  />
                  <span>{t("grading_ungraded")}</span>
                </label>
              </div>

              {gradingType === "graded" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">{t("field_max_score")}</label>
                  <input
                    type="number"
                    min={1}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions (Bỏ + Lưu nháp + Giao bài) Căn phải */}
        <div className="mt-6 pt-5 border-t border-slate-200 bg-white p-5 rounded-2xl border border-slate-200 flex justify-end gap-3 shrink-0 shadow-sm">
          <button
            type="button"
            onClick={handleDiscardClick}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-lg transition-all"
          >
            <X size={13} />
            <span>{t("discard_btn")}</span>
          </button>
          <button
            onClick={() => handleSave("draft")}
            disabled={isSubmitting || isUploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
          >
            <Save size={13} />
            <span>{t("save_draft_btn")}</span>
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={isSubmitting || isUploading}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
          >
            <Send size={13} />
            <span>{t("publish_btn")}</span>
          </button>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 flex flex-col transform transition-all scale-100 duration-300">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t("confirm_discard_title")}
              </h3>
              <button
                onClick={() => setShowDiscardModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mb-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                {t("confirm_discard_message")}
              </p>
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                {t("keep_editing")}
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false);
                  onBack();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                {t("discard_changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}