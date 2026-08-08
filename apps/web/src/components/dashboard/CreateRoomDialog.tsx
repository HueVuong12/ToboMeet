"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateRoomMutation } from "@/lib/redux/api/roomsApi";
import {
  X,
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

type Step = "enter-name" | "success";

export default function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();

  // Bỏ step chọn type, mặc định vào luôn bước nhập tên
  const [step, setStep] = useState<Step>("enter-name");
  const [roomName, setRoomName] = useState("");
  const [createRoom, { isLoading }] = useCreateRoomMutation();
  const [error, setError] = useState<string | null>(null);

  // Lưu kết quả sau khi tạo phòng thành công
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setError(null);

    try {
      // Đã loại bỏ hoàn toàn thuộc tính type
      const room = await createRoom({
        name: roomName.trim(),
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
            <h2 className="text-lg font-bold text-slate-900">
              {step === "enter-name"
                ? t("create_team", { defaultValue: "Tạo phòng mới" })
                : t("room_created_title", {
                    defaultValue: "Tạo phòng thành công!",
                  })}
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
          {/* Step 1: Nhập tên phòng */}
          {step === "enter-name" && (
            <div>
              <input
                id="create-room-name-input"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("room_name_placeholder", {
                  defaultValue: "Nhập tên phòng...",
                })}
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-slate-50/50
                           text-sm text-slate-900 placeholder:text-slate-400 font-medium
                           focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white
                           transition-all"
              />

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Success — Hiển thị mã phòng UI Mới */}
          {/* Step 2: Success — Hiển thị mã phòng UI Mới */}
          {step === "success" && createdRoomCode && (
            <div className="flex flex-col items-center text-center py-4 animate-fade-in">
              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5 ring-4 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>

              <p className="text-slate-600 text-sm font-medium mb-6 px-4">
                {t("room_created_desc", {
                  defaultValue:
                    "Chia sẻ mã này để mọi người tham gia phòng của bạn",
                })}
              </p>

              {/* Khối hiển thị Mã phòng */}
              <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-2xl p-5 mb-4 transition-colors group relative overflow-hidden">
                {/* Background gradient nhẹ */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-100/50 pointer-events-none" />

                <div className="relative z-10">
                  <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-3">
                    {t("room_code_label", { defaultValue: "MÃ PHÒNG" })}
                  </p>
                  <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-slate-800 tracking-[0.3em] ml-2">
                      {createdRoomCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      title={t("copy_code", { defaultValue: "Sao chép" })}
                      className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                        codeCopied
                          ? "bg-emerald-500 text-white scale-110 shadow-md shadow-emerald-500/20"
                          : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-600 group-hover:ring-4 group-hover:ring-brand-50"
                      }`}
                    >
                      {codeCopied ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-slate-500 bg-slate-50 px-4 py-2 rounded-full font-medium">
                {t("room_code_share_hint", {
                  defaultValue:
                    "Người khác có thể tham gia bằng mã này từ trang chủ",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "enter-name" && (
          <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t("cancel", { defaultValue: "Hủy" })}
            </button>
            <button
              id="create-room-submit-btn"
              onClick={handleCreate}
              disabled={!roomName.trim() || isLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/20
                         hover:bg-brand-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("create_room", { defaultValue: "Tạo phòng" })}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="flex justify-between items-center gap-3 px-6 pb-6 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              {t("close", { defaultValue: "Đóng" })}
            </button>
            <button
              id="go-to-room-btn"
              onClick={handleGoToRoom}
              className="inline-flex items-center justify-center flex-1 gap-2 py-3 rounded-xl bg-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/20
                         hover:bg-brand-600 hover:-translate-y-0.5 transition-all"
            >
              {t("go_to_room", { defaultValue: "Vào phòng ngay" })}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
