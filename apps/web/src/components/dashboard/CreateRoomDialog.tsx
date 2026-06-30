"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateRoomMutation } from "@/lib/redux/api/roomsApi";
import {
  X,
  Video,
  GraduationCap,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";

interface CreateRoomDialogProps {
  onClose: () => void;
}

type Step = "select-type" | "enter-name" | "success";

export default function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();

  const [step, setStep] = useState<Step>("select-type");
  const [selectedType, setSelectedType] = useState<
    "meeting" | "classroom" | null
  >(null);
  const [roomName, setRoomName] = useState("");
  const [createRoom, { isLoading }] = useCreateRoomMutation();
  const [error, setError] = useState<string | null>(null);

  // Lưu kết quả sau khi tạo phòng thành công
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleSelectType = (type: "meeting" | "classroom") => {
    setSelectedType(type);
    setStep("enter-name");
  };

  const handleBack = () => {
    setStep("select-type");
    setSelectedType(null);
    setRoomName("");
    setError(null);
  };

  const handleCreate = async () => {
    if (!roomName.trim() || !selectedType) return;
    setError(null);

    try {
      const room = await createRoom({
        name: roomName.trim(),
        type: selectedType,
      }).unwrap();

      // Lưu thông tin phòng vừa tạo, chuyển sang bước hiển thị mã
      setCreatedRoomId(room._id);
      setCreatedRoomCode(room.code);
      setStep("success");
    } catch (err: any) {
      setError(err?.message || t("create_room_failed"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleCreate();
    }
  };

  const handleCopyCode = () => {
    if (!createdRoomCode) return;
    navigator.clipboard.writeText(createdRoomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleGoToRoom = () => {
    if (createdRoomId) {
      router.push(`room/${createdRoomId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={step === "success" ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] w-full max-w-lg mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            {step === "enter-name" && (
              <button
                onClick={handleBack}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900">
              {step === "select-type"
                ? t("select_room_type")
                : step === "enter-name"
                ? t("create_team")
                : t("room_created_title")}
            </h2>
          </div>
          {step !== "success" && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Step 1: Select Room Type */}
          {step === "select-type" && (
            <div className="grid grid-cols-2 gap-4">
              {/* Meeting Card */}
              <button
                id="select-meeting-type"
                onClick={() => handleSelectType("meeting")}
                className="group flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-200
                           hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center
                                group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-blue-500/25">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {t("meeting")}
                </span>
              </button>

              {/* Classroom Card */}
              <button
                id="select-classroom-type"
                onClick={() => handleSelectType("classroom")}
                className="group flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-gray-200
                           hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-200 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center
                                group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-violet-500/25">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {t("classroom")}
                </span>
              </button>
            </div>
          )}

          {/* Step 2: Enter Room Name */}
          {step === "enter-name" && (
            <div>
              {/* Type indicator */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    selectedType === "meeting"
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-violet-50 text-violet-700 border border-violet-100"
                  }`}
                >
                  {selectedType === "meeting" ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <GraduationCap className="w-3 h-3" />
                  )}
                  {selectedType === "meeting" ? t("meeting") : t("classroom")}
                </span>
              </div>

              <input
                id="create-room-name-input"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("room_name_placeholder")}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50
                           text-sm text-slate-900 placeholder:text-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                           transition-all"
              />

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Success — Hiển thị mã phòng */}
          {step === "success" && createdRoomCode && (
            <div className="flex flex-col items-center text-center py-2">
              {/* Success Icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>

              <p className="text-slate-500 text-sm mb-6">
                {t("room_created_desc")}
              </p>

              {/* Mã phòng */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">
                  {t("room_code_label")}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-bold text-slate-800 tracking-[0.25em]">
                    {createdRoomCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      codeCopied
                        ? "bg-emerald-500 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {codeCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t("copy_code")}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                {t("room_code_share_hint")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "enter-name" && (
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button
              onClick={handleBack}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t("step_back")}
            </button>
            <button
              id="create-room-submit-btn"
              onClick={handleCreate}
              disabled={!roomName.trim() || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold
                         hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("create_room")}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t("close")}
            </button>
            <button
              id="go-to-room-btn"
              onClick={handleGoToRoom}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold
                         hover:bg-brand-600 transition-all"
            >
              {t("go_to_room")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
