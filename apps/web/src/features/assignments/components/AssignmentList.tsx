import React from "react";
import { Assignment } from "../types";
import { Plus, Calendar, Lock, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface AssignmentListProps {
  assignments: Assignment[];
  isTeacher: boolean;
  onSelect: (assignment: Assignment) => void;
  onCreateClick: () => void;
}

export default function AssignmentList({
  assignments,
  isTeacher,
  onSelect,
  onCreateClick,
}: AssignmentListProps) {
  const t = useTranslations("room.assignments_i18n");

  const drafts = assignments.filter((a) => a.status === "draft");
  const active = assignments.filter(
    (a) => a.status === "published" && new Date(a.deadline) > new Date()
  );
  const expired = assignments.filter(
    (a) => a.status === "published" && new Date(a.deadline) <= new Date()
  );

  const renderSection = (title: string, list: Assignment[], type: string) => {
    if (list.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {title} ({list.length})
        </h3>
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
          {list.map((assignment) => (
            <div
              key={assignment._id}
              onClick={() => onSelect(assignment)}
              className="bg-white border border-slate-200 hover:border-brand-500 hover:shadow-md p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-800 text-sm truncate max-w-[80%]">
                    {assignment.title}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      assignment.gradingType === "graded"
                        ? "bg-purple-50 text-purple-600 border border-purple-100"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {assignment.gradingType === "graded" ? `${assignment.maxScore}đ` : "KĐ"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  {assignment.description || t("no_description")}
                </p>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  <span>
                    {t("deadline", { date: new Date(assignment.deadline).toLocaleString() })}
                  </span>
                </div>
                {assignment.submissionPolicy === "lock_after_deadline" ? (
                  <div className="flex items-center gap-1 text-red-500 font-medium">
                    <Lock size={11} />
                    <span>{t("lock_late")}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 size={11} />
                    <span>{t("allow_late")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t("title")}</h2>
          <p className="text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        {isTeacher && (
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            <Plus size={16} />
            <span>{t("create_btn")}</span>
          </button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <FileText size={48} className="mb-3 opacity-40 text-slate-500" />
          <p className="text-sm font-semibold">{t("no_data")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("no_data_desc")}</p>
        </div>
      ) : (
        <>
          {renderSection(t("draft_section"), drafts, "draft")}
          {renderSection(t("active_section"), active, "active")}
          {renderSection(t("expired_section"), expired, "expired")}
        </>
      )}
    </div>
  );
}