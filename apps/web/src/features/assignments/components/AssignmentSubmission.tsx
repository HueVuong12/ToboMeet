import React, { useState } from "react";
import { Submission, Assignment } from "../types";
import { Upload, Trash2, File, CheckCircle2, Clock, Calendar } from "lucide-react";
import { uploadReportEvidence } from "@/services/uploadService";
import { toast } from "sonner";

interface AssignmentSubmissionProps {
  assignment: Assignment;
  submission: Submission | null;
  onSubmit: (attachments: any[]) => Promise<void>;
  isSubmitting: boolean;
}

export default function AssignmentSubmission({
  assignment,
  submission,
  onSubmit,
  isSubmitting,
}: AssignmentSubmissionProps) {
  const [attachments, setAttachments] = useState<any[]>(submission?.attachments || []);
  const [isUploading, setIsUploading] = useState(false);

  const isPastDeadline = new Date() > new Date(assignment.deadline);
  const isLocked = isPastDeadline && assignment.submissionPolicy === "lock_after_deadline";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      toast.error("Đã hết hạn nộp bài. Bạn không thể tải file lên.");
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
      toast.success("Tải file bài làm lên thành công");
    } catch (err: any) {
      toast.error(err?.message || "Lỗi upload file. Chỉ nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    if (isLocked) return;
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (attachments.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một file bài làm trước khi nộp.");
      return;
    }
    await onSubmit(attachments);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 mb-4">
        Bài làm của bạn
      </h3>

      {submission && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            {submission.submissionStatus === "on_time" ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-emerald-600">Đã nộp đúng hạn</span>
              </>
            ) : (
              <>
                <Clock size={14} className="text-amber-500" />
                <span className="text-amber-600">Nộp trễ {submission.lateMinutes} phút</span>
              </>
            )}
          </div>
          <span className="text-slate-400">
            {new Date(submission.submittedAt).toLocaleString("vi-VN")}
          </span>
        </div>
      )}

      {/* Upload Zone */}
      {!isLocked ? (
        <div className="border border-dashed border-slate-200 hover:border-brand-500 rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/30 relative">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading || isSubmitting}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload size={20} className="text-slate-400" />
          <p className="text-xs text-slate-600 font-semibold">Tải bài làm của bạn lên đây</p>
          <p className="text-[10px] text-slate-400">Chỉ hỗ trợ ảnh: JPG, JPEG, PNG, WEBP</p>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col items-center text-center gap-1">
          <Clock size={20} className="text-red-500" />
          <span className="text-xs text-red-600 font-bold">Đã hết hạn nộp bài</span>
          <span className="text-[10px] text-red-400">Bài tập đã bị khóa và không chấp nhận bài nộp mới</span>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mt-4 space-y-2">
          {attachments.map((file, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs"
            >
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 truncate hover:underline hover:text-brand-600"
              >
                <File size={15} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-700 truncate">{file.name}</span>
              </a>
              {!isLocked && (
                <button
                  onClick={() => handleRemoveAttachment(idx)}
                  className="p-1 hover:bg-slate-200 rounded text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isLocked && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploading}
          className="w-full mt-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
        >
          <span>{submission ? "Nộp lại bài làm" : "Nộp bài"}</span>
        </button>
      )}
    </div>
  );
}