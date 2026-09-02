import React, { useState } from "react";
import { Assignment, Submission } from "./types";
import { File, CheckCircle2, AlertCircle, Save, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface AssignmentGradingProps {
  assignment: Assignment;
  submissions: Submission[];
  roomMembers: any[];
  onBack: () => void;
  onGrade: (
    studentId: string,
    submissionId: string | undefined,
    score: number | undefined,
    feedback: string
  ) => Promise<void>;
  isGrading: boolean;
}

export default function AssignmentGrading({
  assignment,
  submissions,
  roomMembers,
  onBack,
  onGrade,
  isGrading,
}: AssignmentGradingProps) {
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  const activeSubmission = submissions.find((s) => s._id === selectedSubId);
  const studentInfo = activeSubmission
    ? roomMembers.find((m) => m.userId === activeSubmission.studentId)
    : null;

  const handleSelectSubmission = (sub: Submission) => {
    setSelectedSubId(sub._id);
    setScoreInput(sub.score !== undefined ? String(sub.score) : "");
    setFeedbackInput(sub.feedback || "");
  };

  const handleSaveGrade = async () => {
    if (!selectedSubId || !activeSubmission) return;

    let score: number | undefined = undefined;
    if (assignment.gradingType === "graded") {
      if (scoreInput.trim() === "") {
        toast.error("Vui lòng nhập điểm");
        return;
      }
      score = Number(scoreInput);
      if (isNaN(score) || score < 0 || (assignment.maxScore !== undefined && score > assignment.maxScore)) {
        toast.error(`Điểm phải nằm trong khoảng từ 0 đến ${assignment.maxScore}`);
        return;
      }
    }

    await onGrade(activeSubmission.studentId, selectedSubId, score, feedbackInput);
    toast.success("Đã lưu điểm và feedback thành công");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-bold text-slate-800 text-sm">
            Đánh giá: {assignment.title}
          </h2>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Submissions list */}
        <div className="w-80 border-r border-slate-200 bg-white overflow-y-auto flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Bài nộp nhiệm vụ ({submissions.length})
            </span>
          </div>

          {submissions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <AlertCircle size={32} className="mb-2 opacity-50" />
              <p className="text-xs font-semibold">Chưa có bài nộp nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map((sub) => {
                const member = roomMembers.find((m) => m.userId === sub.studentId);
                const isSelected = sub._id === selectedSubId;
                const isGraded = sub.score !== undefined || sub.feedback;

                return (
                  <div
                    key={sub._id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-3.5 cursor-pointer transition-colors flex flex-col gap-1.5 text-xs ${
                      isSelected ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">
                        {member?.displayName || sub.studentId}
                      </span>
                      {isGraded ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 border border-emerald-100 rounded-md">
                          Đã đánh giá
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 border border-slate-200 rounded-md">
                          Chờ đánh giá
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Nộp: {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}</span>
                      {sub.submissionStatus === "late" && (
                        <span className="text-amber-600 font-medium">Trễ {sub.lateMinutes} phút</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Grading area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-6">
          {activeSubmission ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Submission files */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 text-sm">
                    Bài nộp của {studentInfo?.displayName || activeSubmission.studentId}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nộp lúc {new Date(activeSubmission.submittedAt).toLocaleString("vi-VN")}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700">Tệp nhiệm vụ</span>
                  <div className="grid gap-2">
                    {activeSubmission.attachments.map((file, index) => (
                      <a
                        key={index}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs hover:underline hover:text-brand-600 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <File size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700 truncate">{file.name}</span>
                          {file.uploadedAt && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({new Date(file.uploadedAt).toLocaleString("vi-VN")})
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grading input */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                  Đánh giá & Cho điểm
                </h3>

                {assignment.gradingType === "graded" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>Điểm số</span>
                      <span className="text-slate-400">Trên {assignment.maxScore}đ</span>
                    </div>
                    <input
                      type="number"
                      max={assignment.maxScore}
                      min={0}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="Nhập điểm..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Nhận xét / Feedback</label>
                  <textarea
                    rows={4}
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    placeholder="Viết nhận xét của bạn..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                  />
                </div>

                <button
                  onClick={handleSaveGrade}
                  disabled={isGrading}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isGrading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Lưu đánh giá</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-[50vh] flex flex-col items-center justify-center text-slate-400">
              <CheckCircle2 size={40} className="mb-2 opacity-30" />
              <p className="text-sm font-semibold">Chọn học viên để xem bài nộp và đánh giá</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
