import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  MessageSquare,
  ArrowUpDown,
  CornerUpLeft,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { Assignment, Submission } from "../types";
import { calculateSubmissionTiming } from "../utils/submissionTimeHelper";
import { useTranslations } from "next-intl";

export interface MemberWithSubmission {
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
  submission?: Submission;
  isSubmitted: boolean;
  isGraded: boolean;
  timing: ReturnType<typeof calculateSubmissionTiming>;
}

interface SubmissionMembersTableProps {
  assignment: Assignment;
  members: MemberWithSubmission[];
  activeTab: "need_return" | "returned";
  onSelectMember: (member: MemberWithSubmission) => void;
}

export default function SubmissionMembersTable({
  assignment,
  members,
  activeTab,
  onSelectMember,
}: SubmissionMembersTableProps) {
  const t = useTranslations("room.assignments_i18n.lms");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"name" | "status" | "score">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const handleToggleSelectAll = () => {
    if (selectedUserIds.size === members.length && members.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(members.map((m) => m.userId)));
    }
  };

  const handleToggleSelectRow = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const sortedMembers = useMemo(() => {
    const list = [...members];
    list.sort((a, b) => {
      if (sortField === "name") {
        const nameA = a.displayName.toLowerCase();
        const nameB = b.displayName.toLowerCase();
        return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === "score") {
        const scoreA = a.submission?.score ?? -1;
        const scoreB = b.submission?.score ?? -1;
        return sortAsc ? scoreA - scoreB : scoreB - scoreA;
      }
      if (sortField === "status") {
        return sortAsc
          ? Number(a.isSubmitted) - Number(b.isSubmitted)
          : Number(b.isSubmitted) - Number(a.isSubmitted);
      }
      return 0;
    });
    return list;
  }, [members, sortField, sortAsc]);

  const handleSort = (field: "name" | "status" | "score") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const maxScore = assignment.gradingType === "graded" ? (assignment.maxScore ?? 10) : 10;

  // Phân chia nhóm trong tab "need_return": Đã nộp (chờ chấm) & Chưa nộp
  const submittedWaiting = useMemo(
    () => sortedMembers.filter((m) => m.isSubmitted && !m.isGraded),
    [sortedMembers]
  );
  const notSubmittedList = useMemo(
    () => sortedMembers.filter((m) => !m.isSubmitted),
    [sortedMembers]
  );

  const renderRow = (item: MemberWithSubmission) => {
    const isChecked = selectedUserIds.has(item.userId);
    const sub = item.submission;
    const timing = calculateSubmissionTiming(sub?.submittedAt, assignment.deadline, t);

    // Avatar initials
    const initials = (item.displayName || "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <tr
        key={item.userId}
        onClick={() => onSelectMember(item)}
        className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors group text-xs text-slate-700"
      >
        {/* Checkbox */}
        <td className="w-10 px-4 py-3 text-center" onClick={(e) => handleToggleSelectRow(item.userId, e)}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => {}}
            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
        </td>

        {/* Member: Avatar + Name + Email */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt={item.displayName}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                {item.displayName}
              </div>
              {item.email && (
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {item.email}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          {item.isSubmitted ? (
            item.isGraded ? (
              <div className="inline-flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-medium border border-purple-100">
                <CornerUpLeft size={13} />
                <span>{t("status_returned")}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium border border-blue-100">
                <UserCheck size={13} />
                <span>{t("status_submitted")}</span>
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium border border-slate-200">
              <UserX size={13} />
              <span>{t("status_not_submitted")}</span>
            </div>
          )}
        </td>

        {/* Submission timing */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${timing.badgeClass}`}
          >
            {timing.status !== "not_submitted" && <Clock size={11} />}
            <span>{timing.text}</span>
          </span>
        </td>

        {/* Feedback icon & preview */}
        <td className="px-4 py-3">
          {sub?.feedback ? (
            <div className="flex items-center gap-1.5 text-purple-600 font-medium" title={sub.feedback}>
              <MessageSquare size={16} className="fill-purple-100 shrink-0" />
              <span className="truncate max-w-[120px] text-slate-600 text-[11px]">{sub.feedback}</span>
            </div>
          ) : (
            <div className="text-slate-300">
              <MessageSquare size={16} />
            </div>
          )}
        </td>

        {/* Score / maxScore */}
        <td className="px-4 py-3">
          {item.isGraded && sub?.score !== undefined ? (
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 bg-slate-100 rounded-md font-bold text-slate-800 text-xs min-w-[32px] text-center">
                {sub.score}
              </span>
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            </div>
          ) : (
            <span className="text-slate-400 font-medium pl-2">—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <table className="w-full text-left border-collapse">
        {/* Table Header */}
        <thead className="bg-white border-b border-slate-200 sticky top-0 z-10 text-[11px] font-bold text-slate-600">
          <tr>
            <th className="w-10 px-4 py-3 text-center">
              <input
                type="checkbox"
                checked={selectedUserIds.size === members.length && members.length > 0}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
            </th>

            <th
              className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center gap-1">
                <span>{t("col_name")}</span>
                <ArrowUpDown size={12} className="text-slate-400" />
              </div>
            </th>

            <th
              className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center gap-1">
                <span>{t("col_status")}</span>
                <ArrowUpDown size={12} className="text-slate-400" />
              </div>
            </th>

            <th className="px-4 py-3">
              <span>{t("col_submitted_at")}</span>
            </th>

            <th className="px-4 py-3">
              <span>{t("col_feedback")}</span>
            </th>

            <th
              className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort("score")}
            >
              <div className="flex items-center gap-1">
                <span>/ {maxScore}</span>
                <ArrowUpDown size={12} className="text-slate-400" />
              </div>
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-slate-400">
                {t("empty_search")}
              </td>
            </tr>
          ) : activeTab === "returned" ? (
            // Tab Đã trả về: hiển thị thẳng danh sách đã trả bài
            sortedMembers.map((m) => renderRow(m))
          ) : (
            // Tab Cần trả về: Hiển thị các thành viên liền mạch (đã nộp chờ chấm & chưa nộp)
            <>
              {submittedWaiting.map((m) => renderRow(m))}
              {notSubmittedList.map((m) => renderRow(m))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
