import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  Award,
  Calendar,
  Settings,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  Copy,
  Check,
  AlignLeft,
  CheckSquare,
  Save,
  Send,
  X,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
} from "@/lib/redux/api/assignmentsApi";
import { Assignment, QuizQuestion, QuizSettings, QuizOption } from "../types";
import QuizSettingsModal from "./QuizSettingsModal";
import { toLocalDatetimeInputString, fromLocalDatetimeInputString } from "../utils/datetimeHelper";

interface QuizCreateProps {
  roomId: string;
  channels?: { _id: string; name?: string }[];
  roomMembers?: { userId?: string; name?: string; displayName?: string; role?: string }[];
  userId: string;
  assignmentToEdit?: Assignment;
  onBack: () => void;
  onSubmit?: (quizData: any) => Promise<void> | void;
  isSubmitting?: boolean;
}

const DEFAULT_SETTINGS: QuizSettings = {
  timeLimitMinutes: 15,
  passScore: 50,
  shuffleQuestions: false,
  showResultsAfterSubmit: true,
  acceptingResponses: true,
  allowMultipleAttempts: false,
  startDate: null,
  endDate: null,
  closeDate: null,
  accessControl: "anyone",
};

export default function QuizCreate({
  roomId,
  channels = [],
  roomMembers = [],
  userId,
  assignmentToEdit,
  onBack,
  onSubmit,
  isSubmitting = false,
}: QuizCreateProps) {
  const t = useTranslations("room.assignments_i18n");
  const isEditing = !!assignmentToEdit;

  const [createAssignment, { isLoading: isCreating }] = useCreateAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] = useUpdateAssignmentMutation();

  const [title, setTitle] = useState(assignmentToEdit?.title || "");
  const [description, setDescription] = useState(assignmentToEdit?.description || "");
  
  // State chọn nhiều kênh
  const [channelIds, setChannelIds] = useState<string[]>(() => {
    if (assignmentToEdit?.channelIds && assignmentToEdit.channelIds.length > 0) {
      return assignmentToEdit.channelIds;
    }
    if (assignmentToEdit?.channelId) {
      return [assignmentToEdit.channelId];
    }
    return channels[0]?._id ? [channels[0]._id] : [];
  });
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const channelDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown kênh khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(event.target as Node)) {
        setIsChannelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Bật/tắt chọn kênh
  const toggleChannel = (id: string) => {
    setChannelIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          toast.warning(t("quiz_toast_channel_min"));
          return prev;
        }
        return prev.filter((cId) => cId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Label chuỗi các kênh đã chọn
  const getSelectedChannelsLabel = () => {
    if (channelIds.length === 0) return t("quiz_select_channel");
    const selectedNames = channelIds
      .map((id) => channels.find((c) => c._id === id)?.name)
      .filter(Boolean);

    if (selectedNames.length <= 2) {
      return selectedNames.join(", ");
    }
    return `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;
  };
  const [deadline, setDeadline] = useState(() =>
    toLocalDatetimeInputString(
      assignmentToEdit?.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    )
  );

  const [settings, setSettings] = useState<QuizSettings>(() => {
    const base = assignmentToEdit?.quizSettings || DEFAULT_SETTINGS;
    const rType = (assignmentToEdit?.recipientType as any) || base.recipientType || "current_and_future_members";
    const memberIds = assignmentToEdit?.recipientMemberIds || base.specificMemberIds || [];
    return {
      ...DEFAULT_SETTINGS,
      ...base,
      recipientType: rType,
      specificMemberIds: memberIds,
    };
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Adding question flow states
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState<"choice" | "text" | null>(null);
  const [draftQuestion, setDraftQuestion] = useState<QuizQuestion | null>(null);

  // Initialize questions
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    if (assignmentToEdit?.questions && assignmentToEdit.questions.length > 0) {
      return assignmentToEdit.questions;
    }
    return [];
  });

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // Question manipulation
  const handleSelectQuestionType = (type: "choice" | "text") => {
    setSelectedQuestionType(type);
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (type === "choice") {
      setDraftQuestion({
        _id: newId,
        questionType: "choice",
        title: "",
        points: 10,
        isRequired: true,
        shuffleOptions: false,
        allowMultiple: false,
        options: [
          { _id: `opt_${Date.now()}_1`, text: "", isCorrect: true },
          { _id: `opt_${Date.now()}_2`, text: "", isCorrect: false },
          { _id: `opt_${Date.now()}_3`, text: "", isCorrect: false },
          { _id: `opt_${Date.now()}_4`, text: "", isCorrect: false },
        ],
      });
    } else {
      setDraftQuestion({
        _id: newId,
        questionType: "text",
        title: "",
        points: 10,
        isRequired: true,
        shuffleOptions: false,
        allowMultiple: false,
        options: [],
      });
    }
  };

  const handleCancelDraftQuestion = () => {
    setIsAddingQuestion(false);
    setSelectedQuestionType(null);
    setDraftQuestion(null);
  };

  const handleUpdateDraftOption = (optIdx: number, text: string) => {
    if (!draftQuestion) return;
    setDraftQuestion({
      ...draftQuestion,
      options: draftQuestion.options.map((opt, idx) =>
        idx === optIdx ? { ...opt, text } : opt
      ),
    });
  };

  const handleToggleDraftCorrectOption = (optIdx: number) => {
    if (!draftQuestion) return;
    if (draftQuestion.allowMultiple) {
      setDraftQuestion({
        ...draftQuestion,
        options: draftQuestion.options.map((opt, idx) =>
          idx === optIdx ? { ...opt, isCorrect: !opt.isCorrect } : opt
        ),
      });
    } else {
      setDraftQuestion({
        ...draftQuestion,
        options: draftQuestion.options.map((opt, idx) => ({
          ...opt,
          isCorrect: idx === optIdx,
        })),
      });
    }
  };

  const handleToggleDraftAllowMultiple = () => {
    if (!draftQuestion) return;
    const nextAllow = !draftQuestion.allowMultiple;
    let nextOpts = [...draftQuestion.options];
    if (!nextAllow) {
      let found = false;
      nextOpts = nextOpts.map((opt) => {
        if (opt.isCorrect) {
          if (!found) {
            found = true;
            return opt;
          }
          return { ...opt, isCorrect: false };
        }
        return opt;
      });
      if (!found && nextOpts.length > 0) {
        nextOpts[0].isCorrect = true;
      }
    }
    setDraftQuestion({
      ...draftQuestion,
      allowMultiple: nextAllow,
      options: nextOpts,
    });
  };

  const handleAddDraftOption = () => {
    if (!draftQuestion) return;
    const newOpt: QuizOption = {
      _id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: "",
      isCorrect: false,
    };
    setDraftQuestion({
      ...draftQuestion,
      options: [...draftQuestion.options, newOpt],
    });
  };

  const handleDeleteDraftOption = (optIdx: number) => {
    if (!draftQuestion || draftQuestion.options.length <= 2) return;
    const nextOpts = draftQuestion.options.filter((_, idx) => idx !== optIdx);
    const hasCorrect = nextOpts.some((o) => o.isCorrect);
    if (!hasCorrect && nextOpts.length > 0) {
      nextOpts[0].isCorrect = true;
    }
    setDraftQuestion({
      ...draftQuestion,
      options: nextOpts,
    });
  };

  const handleConfirmCreateQuestion = () => {
    if (!draftQuestion) return;

    if (!draftQuestion.title.trim()) {
      toast.error(t("quiz_toast_enter_title"));
      return;
    }

    if (draftQuestion.questionType === "choice") {
      if (draftQuestion.options.length < 2) {
        toast.error(t("quiz_toast_choice_min2"));
        return;
      }
      const hasEmpty = draftQuestion.options.some((o) => !o.text.trim());
      if (hasEmpty) {
        toast.error(t("quiz_toast_fill_all_options"));
        return;
      }
      const hasCorrect = draftQuestion.options.some((o) => o.isCorrect);
      if (!hasCorrect) {
        toast.error(t("quiz_toast_select_correct"));
        return;
      }
    }

    setQuestions((prev) => [...prev, draftQuestion]);
    toast.success(t("quiz_toast_question_created"));
    setIsAddingQuestion(false);
    setSelectedQuestionType(null);
    setDraftQuestion(null);
  };

  const handleUpdateQuestion = (index: number, updated: Partial<QuizQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, ...updated } : q))
    );
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
    toast.success(t("quiz_toast_question_deleted"));
  };

  const handleDuplicateQuestion = (index: number) => {
    const source = questions[index];
    const cloned: QuizQuestion = {
      ...source,
      _id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      options: source.options.map((opt) => ({
        ...opt,
        _id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      })),
    };
    const nextList = [...questions];
    nextList.splice(index + 1, 0, cloned);
    setQuestions(nextList);
    toast.success(t("quiz_toast_question_duplicated"));
  };

  // Option manipulation
  const handleAddOption = (qIdx: number) => {
    const q = questions[qIdx];
    const newOpt: QuizOption = {
      _id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: "",
      isCorrect: false,
    };
    handleUpdateQuestion(qIdx, { options: [...q.options, newOpt] });
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, text: string) => {
    const q = questions[qIdx];
    const newOpts = q.options.map((opt, i) => (i === optIdx ? { ...opt, text } : opt));
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleDeleteOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    if (q.options.length <= 2) {
      toast.error(t("quiz_toast_min_two_options"));
      return;
    }
    const newOpts = q.options.filter((_, i) => i !== optIdx);
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleToggleCorrectOption = (qIdx: number, optIdx: number) => {
    const q = questions[qIdx];
    let newOpts: QuizOption[];
    if (q.allowMultiple) {
      newOpts = q.options.map((opt, i) =>
        i === optIdx ? { ...opt, isCorrect: !opt.isCorrect } : opt
      );
    } else {
      newOpts = q.options.map((opt, i) => ({
        ...opt,
        isCorrect: i === optIdx,
      }));
    }
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleToggleAllowMultiple = (qIdx: number) => {
    const q = questions[qIdx];
    const newMultiple = !q.allowMultiple;
    let newOpts = q.options;

    // Nếu tắt Nhiều câu trả lời mà đang có nhiều hơn 1 đáp án đúng, chỉ giữ lại đáp án đầu tiên
    if (!newMultiple) {
      let kept = false;
      newOpts = q.options.map((opt) => {
        if (opt.isCorrect) {
          if (!kept) {
            kept = true;
            return opt;
          }
          return { ...opt, isCorrect: false };
        }
        return opt;
      });
    }

    handleUpdateQuestion(qIdx, {
      allowMultiple: newMultiple,
      options: newOpts,
    });
  };

  // Submit
  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim()) {
      toast.error(t("quiz_toast_enter_quiz_title"));
      return;
    }

    if (questions.length === 0) {
      toast.error(t("quiz_toast_add_at_least_one_question"));
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title.trim()) {
        toast.error(t("quiz_toast_question_empty_title", { number: i + 1 }));
        return;
      }
      if (q.questionType === "choice") {
        if (q.options.length < 2) {
          toast.error(t("quiz_toast_question_min_options", { number: i + 1 }));
          return;
        }
        const hasEmptyOpt = q.options.some((o) => !o.text.trim());
        if (hasEmptyOpt) {
          toast.error(t("quiz_toast_question_empty_option", { number: i + 1 }));
          return;
        }
        const hasCorrect = q.options.some((o) => o.isCorrect);
        if (!hasCorrect) {
          toast.error(t("quiz_toast_question_no_correct", { number: i + 1 }));
          return;
        }
      }
    }

    const activeRecipientType = settings.recipientType || (
      settings.accessControl === "specific_members"
        ? "specific_members"
        : settings.accessControl === "anyone"
        ? "current_and_future_members"
        : "current_members"
    );
    const activeMemberIds = activeRecipientType === "specific_members"
      ? (settings.specificMemberIds || [])
      : [];

    const payload: Partial<Assignment> = {
      title: title.trim(),
      description: description.trim(),
      roomId,
      channelId: channelIds[0] || channels[0]?._id,
      channelIds,
      deadline: fromLocalDatetimeInputString(deadline) || new Date().toISOString(),
      type: "quiz",
      questions,
      quizSettings: {
        ...settings,
        recipientType: activeRecipientType,
        specificMemberIds: activeMemberIds,
      },
      recipientType: activeRecipientType,
      recipientMemberIds: activeMemberIds,
      maxScore: totalPoints,
      status,
    };

    try {
      if (isEditing && assignmentToEdit) {
        await updateAssignment({ id: assignmentToEdit._id, body: payload }).unwrap();
        toast.success(t("quiz_toast_update_success"));
      } else {
        await createAssignment(payload).unwrap();
        toast.success(status === "published" ? t("quiz_toast_create_success") : t("quiz_btn_save_draft"));
      }
      if (onSubmit) {
        await onSubmit(payload);
      }
      onBack();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("quiz_toast_save_error"));
    }
  };

  const busy = isCreating || isUpdating || isSubmitting;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {isEditing ? t("quiz_edit_title") : t("quiz_create_title")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("quiz_total_questions", { count: questions.length })} • {t("quiz_total_points", { points: totalPoints })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>{t("quiz_settings_btn")}</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t("quiz_field_title_required")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("quiz_field_title_ph")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t("quiz_field_desc")}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("quiz_field_desc_ph")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div ref={channelDropdownRef} className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t("quiz_field_channel")}
              </label>
              <div
                onClick={() => setIsChannelDropdownOpen((prev) => !prev)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium flex items-center justify-between cursor-pointer hover:border-blue-500 hover:bg-white transition-all select-none text-slate-700"
              >
                <span className="truncate pr-2 font-semibold text-slate-800">
                  {getSelectedChannelsLabel()}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                    isChannelDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Dropdown Options List */}
              {isChannelDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto flex flex-col gap-0.5">
                  {channels.map((ch) => {
                    const isChecked = channelIds.includes(ch._id);
                    return (
                      <div
                        key={ch._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChannel(ch._id);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isChecked
                            ? "bg-blue-50 text-[#0052FF] font-semibold"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">{ch.name || ch._id}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="pointer-events-none accent-[#0052FF] shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {t("quiz_field_deadline")}
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Questions Header */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#0052FF]" />
            {t("quiz_questions_title", { count: questions.length })}
          </h2>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div
              key={q._id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-50 text-[#0052FF] text-[11px] font-bold flex items-center justify-center">
                    {qIdx + 1}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {q.questionType === "text"
                      ? t("quiz_essay_label")
                      : q.allowMultiple
                      ? t("quiz_choice_multi")
                      : t("quiz_choice_single")}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">{t("quiz_points_label")}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) =>
                        handleUpdateQuestion(qIdx, {
                          points: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-10 bg-transparent text-[11px] font-bold text-slate-800 text-center focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDuplicateQuestion(qIdx)}
                    title={t("quiz_toast_question_duplicated")}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIdx)}
                    title={t("quiz_toast_question_deleted")}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Title */}
              <div>
                <input
                  type="text"
                  value={q.title}
                  onChange={(e) => handleUpdateQuestion(qIdx, { title: e.target.value })}
                  placeholder={t("quiz_question_ph", { number: qIdx + 1 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400"
                />
              </div>

              {/* Question Body: Choice or Essay */}
              {q.questionType === "text" ? (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-dashed border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>
                    {t("quiz_essay_notice")}
                  </span>
                </div>
              ) : (
                <div className="space-y-2 pt-0.5">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={opt._id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                        opt.isCorrect
                          ? "bg-emerald-50/60 border-emerald-300"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      {/* Correct indicator toggle: Radio for single/boolean, Checkbox for multi */}
                      <button
                        type="button"
                        onClick={() => handleToggleCorrectOption(qIdx, optIdx)}
                        className={`w-5 h-5 ${
                          q.allowMultiple ? "rounded-md" : "rounded-full"
                        } flex items-center justify-center transition-all ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-white border border-slate-300 text-transparent hover:border-emerald-400"
                        }`}
                      >
                        {q.allowMultiple ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          opt.isCorrect ? <span className="w-2 h-2 rounded-full bg-white" /> : null
                        )}
                      </button>

                      {/* Option text */}
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                        placeholder={t("quiz_option_ph", { letter: String.fromCharCode(65 + optIdx) })}
                        className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-normal"
                      />

                      {/* Delete option */}
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(qIdx, optIdx)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIdx)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#0052FF] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("quiz_add_option")}
                    </button>

                    {/* Công tắc Nhiều câu trả lời */}
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-xs font-semibold text-slate-600">{t("quiz_allow_multiple")}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={q.allowMultiple}
                        onClick={() => handleToggleAllowMultiple(qIdx)}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                          q.allowMultiple ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            q.allowMultiple ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {questions.length === 0 && !isAddingQuestion && (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">{t("quiz_no_questions_title")}</p>
              <p className="text-[11px] text-slate-400">{t("quiz_no_questions_desc")}</p>
            </div>
          )}
        </div>

        {/* Add Question Area */}
        <div className="space-y-4 pt-1">
          {/* Draft Form Card */}
          {isAddingQuestion && selectedQuestionType && draftQuestion && (
            <div className="bg-white rounded-2xl border-2 border-blue-400/80 p-4 shadow-sm space-y-3 animate-in fade-in duration-150">
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-50 text-[#0052FF] text-[11px] font-bold flex items-center justify-center">
                    {questions.length + 1}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {draftQuestion.questionType === "text"
                      ? t("quiz_essay_new_label")
                      : draftQuestion.allowMultiple
                      ? t("quiz_choice_multi_label")
                      : t("quiz_choice_single_label")}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">{t("quiz_points_label")}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={draftQuestion.points}
                      onChange={(e) =>
                        setDraftQuestion({
                          ...draftQuestion,
                          points: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-10 bg-transparent text-[11px] font-bold text-slate-800 text-center focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelDraftQuestion}
                    title={t("quiz_btn_cancel")}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Title */}
              <div>
                <input
                  type="text"
                  value={draftQuestion.title}
                  onChange={(e) =>
                    setDraftQuestion({ ...draftQuestion, title: e.target.value })
                  }
                  placeholder={t("quiz_question_ph", { number: questions.length + 1 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Question Body: Choice or Essay */}
              {draftQuestion.questionType === "text" ? (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-dashed border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>
                    {t("quiz_essay_notice")}
                  </span>
                </div>
              ) : (
                <div className="space-y-2 pt-0.5">
                  {draftQuestion.options.map((opt, optIdx) => (
                    <div
                      key={opt._id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                        opt.isCorrect
                          ? "bg-emerald-50/60 border-emerald-300"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleDraftCorrectOption(optIdx)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          opt.isCorrect
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-400 border border-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                        }`}
                        title={opt.isCorrect ? t("quiz_correct_answer") : t("quiz_correct_answer")}
                      >
                        {opt.isCorrect ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          String.fromCharCode(65 + optIdx)
                        )}
                      </button>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateDraftOption(optIdx, e.target.value)}
                        placeholder={t("quiz_option_ph", { letter: String.fromCharCode(65 + optIdx) })}
                        className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-normal"
                      />

                      {draftQuestion.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDraftOption(optIdx)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                    <button
                      type="button"
                      onClick={handleAddDraftOption}
                      className="flex items-center gap-1 text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("quiz_add_option")}
                    </button>

                    <div className="flex items-center gap-2 select-none">
                      <span className="text-xs font-semibold text-slate-600">{t("quiz_allow_multiple")}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draftQuestion.allowMultiple}
                        onClick={handleToggleDraftAllowMultiple}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                          draftQuestion.allowMultiple ? "bg-[#0052FF]" : "bg-slate-300 hover:bg-slate-400"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            draftQuestion.allowMultiple ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Action Buttons: Hủy & Tạo câu hỏi */}
              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelDraftQuestion}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t("quiz_btn_cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCreateQuestion}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0052FF] hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t("quiz_btn_create_question")}</span>
                </button>
              </div>
            </div>
          )}

          {/* Trigger button & Type selector */}
          {!isAddingQuestion ? (
            <div className="flex justify-center pt-2 pb-2">
              <button
                type="button"
                onClick={() => setIsAddingQuestion(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-[#0052FF] hover:text-[#0052FF] font-bold text-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("quiz_add_new_question")}
              </button>
            </div>
          ) : !selectedQuestionType ? (
            <div className="flex flex-col items-center gap-2.5 pt-2 pb-2">
              <button
                type="button"
                onClick={() => setIsAddingQuestion(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-[#0052FF] text-[#0052FF] font-bold text-xs transition-all cursor-pointer bg-blue-50/40"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("quiz_add_new_question")}
              </button>

              {/* Hai button lựa chọn loại câu hỏi */}
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-xs animate-in fade-in zoom-in-95 duration-150">
                <span className="text-xs text-slate-500 font-medium px-1">{t("quiz_select_type")}</span>
                <button
                  type="button"
                  onClick={() => handleSelectQuestionType("choice")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-[#0052FF] text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  {t("quiz_type_choice")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectQuestionType("text")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <AlignLeft className="w-3 h-3" />
                  {t("quiz_type_essay")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors ml-1 cursor-pointer"
                  title={t("quiz_btn_cancel")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Bottom Actions Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex items-center justify-end gap-3 shadow-2xs mb-8">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-bold rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{t("quiz_btn_discard")}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave("draft")}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{t("quiz_btn_save_draft")}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSave("published")}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0052FF] hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{busy ? t("quiz_btn_saving") : isEditing ? t("quiz_btn_update") : t("quiz_btn_publish")}</span>
          </button>
        </div>
      </div>
    </div>

      {/* Settings Modal */}
      <QuizSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSave={(updated) => setSettings(updated)}
        roomMembers={roomMembers}
      />
    </div>
  );
}
