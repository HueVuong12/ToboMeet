import React from "react";
import { Assignment } from "../types";
import { Plus, Calendar, Lock, FileText, CheckCircle2, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";

interface AssignmentListProps {
  assignments: Assignment[];
  isTeacher: boolean;
  onSelect: (assignment: Assignment) => void;
  onCreateClick: () => void;
  activeTab: "upcoming" | "grading" | "overdue" | "returned" | "draft";
  setActiveTab: (tab: "upcoming" | "grading" | "overdue" | "returned" | "draft") => void;
}

export default function AssignmentList({
  assignments,
  isTeacher,
  onSelect,
  onCreateClick,
  activeTab,
  setActiveTab,
}: AssignmentListProps) {
  const t = useTranslations("room.assignments_i18n");

  const tabs = [
    { id: "upcoming", label: t("tab_upcoming") },
    ...(isTeacher ? [{ id: "grading", label: t("tab_grading") }] : []),
    { id: "overdue", label: t("tab_overdue") },
    { id: "returned", label: t("tab_returned") },
    ...(isTeacher ? [{ id: "draft", label: t("tab_draft") }] : []),
  ];

  const filteredAssignments = assignments.filter((a) => {
    if (!isTeacher) {
      return a.status === "published";
    }

    const isPastDeadline = a.deadline ? new Date(a.deadline) <= new Date() : false;

    if (activeTab === "draft") {
      return a.status === "draft";
    }

    if (a.status !== "published") {
      return false;
    }

    if (activeTab === "upcoming") {
      if (isPastDeadline) return false;
      if (isTeacher) return true;
      return !a.mySubmission;
    }

    if (activeTab === "grading") {
      if (!isTeacher) return false;
      const submissions = (a as any).submissions || [];
      return submissions.some((s: any) => s.submittedAt && !s.gradedAt);
    }

    if (activeTab === "overdue") {
      if (!isPastDeadline) return false;
      if (isTeacher) return true;
      return !a.mySubmission;
    }

    if (activeTab === "returned") {
      if (isTeacher) {
        const submissions = (a as any).submissions || [];
        return submissions.length > 0 && submissions.some((s: any) => s.gradedAt);
      } else {
        return !!(a.mySubmission && a.mySubmission.gradedAt);
      }
    }

    return false;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      {/* Tabs */}
      {isTeacher && (
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all mr-4 -mb-px ${
                  isActive
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {filteredAssignments.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center text-slate-400">
          <FileText size={48} className="mb-3 opacity-40 text-slate-500" />
          <p className="text-sm font-semibold">{t("no_data")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("no_data_desc")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAssignments.map((assignment) => (
            <div
              key={assignment._id}
              onClick={() => onSelect(assignment)}
              className="bg-white border border-slate-200 hover:border-brand-500 hover:shadow-md p-4 rounded-xl cursor-pointer transition-all flex items-center gap-4"
            >
              {/* Pink Icon Wrapper */}
              <div className="w-10 h-10 bg-[#e66a9a] text-white rounded-lg flex items-center justify-center shrink-0">
                <FileUp size={20} />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  {t("badge_task")}
                </span>
                <h4 className="font-bold text-slate-800 text-sm truncate">
                  {assignment.title}
                </h4>
              </div>

              {/* Right side info (e.g. deadline or draft status) */}
              <div className="flex items-center gap-4 text-xs shrink-0 text-slate-500">
                {assignment.status === "draft" ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-50 text-amber-600 border border-amber-100">
                    {t("tab_draft")}
                  </span>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      <span>
                        {t("deadline", { date: new Date(assignment.deadline).toLocaleString() })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}