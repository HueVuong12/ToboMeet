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
          {/* Step 1: Nhập tên phòng (Đã bỏ chọn Type) */}
          {step === "enter-name" && (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Hãy đặt một cái tên thật hay cho phòng của bạn để mọi người dễ
                dàng nhận ra nhé.
              </p>

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
          {step === "success" && createdRoomCode && (
            <div className="flex flex-col items-center text-center py-2">
              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>

              <p className="text-slate-500 text-sm mb-6 px-4">
                {t("room_created_desc", {
                  defaultValue:
                    "Phòng của bạn đã sẵn sàng. Hãy gửi mã này cho những người bạn muốn mời tham gia.",
                })}
              </p>

              {/* Mã phòng - Kiểu dáng nổi bật (Ticket style) */}
              <div className="w-full relative overflow-hidden bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl p-6 mb-5 group hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.2em] font-bold mb-3 relative z-10">
                  {t("room_code_label", { defaultValue: "MÃ PHÒNG CỦA BẠN" })}
                </p>

                <div className="flex flex-col items-center gap-5 relative z-10">
                  <span className="font-mono text-4xl sm:text-5xl font-extrabold text-slate-800 tracking-[0.15em] bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-100">
                    {createdRoomCode}
                  </span>

                  <button
                    onClick={handleCopyCode}
                    className={`flex items-center justify-center gap-2 w-48 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      codeCopied
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 hover:-translate-y-0.5"
                    }`}
                  >
                    {codeCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t("copied", { defaultValue: "Đã sao chép!" })}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t("copy_code", { defaultValue: "Sao chép mã" })}
                      </>
                    )}
                  </button>
                </div>
              </div>
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
