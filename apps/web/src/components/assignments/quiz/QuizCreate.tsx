import React, { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  Award,
  Calendar,
  Hash,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  title: string;
  options: QuizOption[];
  correctOptionIndex: number;
  points: number;
}

interface QuizCreateProps {
  roomId: string;
  channels?: any[];
  roomMembers?: any[];
  userId: string;
  onBack: () => void;
  onSubmit?: (quizData: any) => Promise<void> | void;
  isSubmitting?: boolean;
}

export default function QuizCreate({
  roomId,
  channels = [],
  roomMembers = [],
  userId,
  onBack,
  onSubmit,
  isSubmitting = false,
}: QuizCreateProps) {
  const t = useTranslations("room.assignments_i18n");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(channels[0]?._id || "");
  const [timeLimit, setTimeLimit] = useState<number>(15);
  const [deadline, setDeadline] = useState("");
  const [passScore, setPassScore] = useState<number>(70);

  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: "q_1",
      title: "",
      options: [
        { id: "opt_1", text: "" },
        { id: "opt_2", text: "" },
        { id: "opt_3", text: "" },
        { id: "opt_4", text: "" },
      ],
      correctOptionIndex: 0,
      points: 10,
    },
  ]);

  const handleAddQuestion = () => {
    const newId = `q_${Date.now()}`;
    setQuestions((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        options: [
          { id: `opt_${Date.now()}_1`, text: "" },
          { id: `opt_${Date.now()}_2`, text: "" },
          { id: `opt_${Date.now()}_3`, text: "" },
          { id: `opt_${Date.now()}_4`, text: "" },
        ],
        correctOptionIndex: 0,
        points: 10,
      },
    ]);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    if (questions.length <= 1) {
      toast.error("Bài trắc nghiệm phải có ít nhất 1 câu hỏi");
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));
  };

  const handleQuestionTitleChange = (qIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIndex ? { ...q, title: text } : q))
    );
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = { ...newOptions[optIndex], text };
        return { ...q, options: newOptions };
      })
    );
  };

  const handleSetCorrectOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qIndex ? { ...q, correctOptionIndex: optIndex } : q
      )
    );
  };

  const handlePointsChange = (qIndex: number, points: number) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIndex ? { ...q, points } : q))
    );
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề bài trắc nghiệm");
      return;
    }

    if (status === "published") {
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].title.trim()) {
          toast.error(`Câu hỏi ${i + 1} chưa có nội dung`);
          return;
        }
        const hasEmptyOption = questions[i].options.some((opt) => !opt.text.trim());
        if (hasEmptyOption) {
          toast.error(`Câu hỏi ${i + 1} có lựa chọn chưa điền nội dung`);
          return;
        }
      }
    }

    const payload = {
      type: "quiz",
      title: title.trim(),
      description: description.trim(),
      channelId: selectedChannel,
      roomId,
      createdBy: userId,
      timeLimitMinutes: Number(timeLimit) || 0,
      passScore: Number(passScore) || 0,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      status,
      questions,
    };

    if (onSubmit) {
      await onSubmit(payload);
    } else {
      toast.success(
        status === "published"
          ? "Đã tạo và xuất bản bài trắc nghiệm thành công!"
          : "Đã lưu bản nháp bài trắc nghiệm!"
      );
      onBack();
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase bg-purple-100 text-purple-700">
                {t("type_quiz")}
              </span>
              <h2 className="text-lg font-bold text-slate-800">
                {t("quiz_create_title")}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {questions.length} câu hỏi • Tổng điểm: {totalPoints}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            {t("quiz_save_draft")}
          </button>
          <button
            type="button"
            onClick={() => handleSave("published")}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
          >
            <Sparkles size={14} />
            <span>{t("quiz_publish")}</span>
          </button>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* General Information Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-[11px] text-slate-400">
              Thông tin chung
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t("quiz_field_title")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Kiểm tra 15 phút - Chương 1..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t("field_desc")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Hướng dẫn làm bài, phạm vi kiến thức..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  <Clock size={14} className="text-slate-400" />
                  <span>{t("quiz_field_time_limit")}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  <Award size={14} className="text-slate-400" />
                  <span>{t("quiz_field_pass_score")} (%)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passScore}
                  onChange={(e) => setPassScore(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span>{t("field_deadline_date")}</span>
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Danh sách câu hỏi ({questions.length})
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>{t("quiz_add_question")}</span>
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-all space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                      {qIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      Câu hỏi {qIdx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium">Điểm:</span>
                      <input
                        type="number"
                        min={1}
                        value={q.points}
                        onChange={(e) => handlePointsChange(qIdx, Number(e.target.value))}
                        className="w-12 bg-transparent text-xs font-bold text-slate-800 text-center focus:outline-none"
                      />
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Title */}
                <div>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => handleQuestionTitleChange(qIdx, e.target.value)}
                    placeholder={t("quiz_question_placeholder")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Question Options */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Các phương án (Chọn tích xanh cho đáp án đúng)
                  </span>
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctOptionIndex === optIdx;
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                          isCorrect
                            ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetCorrectOption(qIdx, optIdx)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-500 border border-slate-300 hover:border-emerald-500"
                          }`}
                          title="Chọn làm đáp án đúng"
                        >
                          {isCorrect ? <CheckCircle2 size={16} /> : letter}
                        </button>

                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) =>
                            handleOptionTextChange(qIdx, optIdx, e.target.value)
                          }
                          placeholder={`Lựa chọn ${letter}...`}
                          className="flex-1 bg-transparent text-sm text-slate-800 focus:outline-none font-medium"
                        />

                        {isCorrect && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            {t("quiz_correct_answer")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3.5 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl bg-purple-50/50 hover:bg-purple-50 text-purple-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>{t("quiz_add_question")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
