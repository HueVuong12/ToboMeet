import React from "react";
import { X, Check, CheckCircle2, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { QuizQuestion, QuizAnswer } from "../types";

type NavigatorMode = "taking" | "results";

interface QuizNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  answers: Map<string, QuizAnswer>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  mode: NavigatorMode;
  /** Map chứa kết quả đúng/sai (chỉ có khi mode = "results") */
  correctMap?: Map<string, boolean | null>;
}

export default function QuizNavigator({
  isOpen,
  onClose,
  questions,
  answers,
  currentIndex,
  onSelectQuestion,
  mode,
  correctMap,
}: QuizNavigatorProps) {
  const t = useTranslations("room.assignments_i18n");

  if (!isOpen) return null;

  const answeredCount = questions.filter((q) => {
    const ans = answers.get(q._id);
    return (
      (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
      (ans?.textAnswer && ans.textAnswer.trim().length > 0)
    );
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-80 h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {mode === "taking" ? t("quiz_nav_title_taking") : t("quiz_nav_title_results")}
            </h2>
            {mode === "taking" ? (
              <p className="text-xs text-slate-500 mt-0.5">
                {t("quiz_nav_answered_count", { answered: answeredCount, total: questions.length })}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                {t("quiz_nav_total_count", { total: questions.length })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-white text-xs">
          {mode === "taking" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" />
                <span className="text-slate-600 font-medium">{t("quiz_nav_legend_selected")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-100 border border-rose-400 inline-block" />
                <span className="text-slate-600 font-medium">{t("quiz_nav_legend_unselected")}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" />
                <span className="text-slate-600 font-medium">{t("quiz_nav_legend_correct")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-100 border border-rose-400 inline-block" />
                <span className="text-slate-600 font-medium">{t("quiz_nav_legend_incorrect")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block" />
                <span className="text-slate-600 font-medium">{t("quiz_nav_legend_essay")}</span>
              </div>
            </>
          )}
        </div>

        {/* Questions Grid */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="grid grid-cols-5 gap-2.5">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;

              let btnClass = "";
              if (mode === "results") {
                const correct = correctMap?.get(q._id);
                if (correct === null || correct === undefined) {
                  // Tự luận
                  btnClass = isCurrent
                    ? "bg-slate-300 text-slate-800 ring-2 ring-slate-400"
                    : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200";
                } else if (correct) {
                  // Đúng -> Xanh
                  btnClass = isCurrent
                    ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200";
                } else {
                  // Sai -> Đỏ
                  btnClass = isCurrent
                    ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-400"
                    : "bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200";
                }
              } else {
                // Taking mode: Đã chọn -> Xanh, Chưa chọn -> Đỏ
                const ans = answers.get(q._id);
                const isAnswered =
                  (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                  (ans?.textAnswer && ans.textAnswer.trim().length > 0);

                if (isAnswered) {
                  btnClass = isCurrent
                    ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 font-bold"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 font-semibold";
                } else {
                  btnClass = isCurrent
                    ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-400 font-bold"
                    : "bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200 font-semibold";
                }
              }

              return (
                <button
                  key={q._id}
                  type="button"
                  onClick={() => {
                    onSelectQuestion(idx);
                    onClose();
                  }}
                  className={`h-11 rounded-xl flex items-center justify-center text-xs transition-all ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
