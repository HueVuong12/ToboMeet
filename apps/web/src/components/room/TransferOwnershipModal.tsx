"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTransferRoomOwnershipMutation } from "@/lib/redux/api/roomsApi";

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  targetUserId: string;
  targetUserName: string;
  roomType: "classroom" | "meeting" | string;
}

export default function TransferOwnershipModal({
  isOpen,
  onClose,
  roomId,
  targetUserId,
  targetUserName,
  roomType,
}: TransferOwnershipModalProps) {
  const t = useTranslations("room");
  const [transferOwnership, { isLoading }] = useTransferRoomOwnershipMutation();

  if (!isOpen) return null;

  const title = t("transfer_leader_title", {
    defaultValue: "Chuyển quyền Trưởng nhóm",
  });
  const roleName = t("role_leader", { defaultValue: "Trưởng nhóm" });
  const downgradedRoleName = t("role_member", { defaultValue: "Thành viên" });

  const handleConfirm = async () => {
    try {
      await transferOwnership({
        roomId,
        newOwnerId: targetUserId,
      }).unwrap();

      toast.success(
        t("toast_transfer_success", {
          actor: "",
          role: roleName,
          target: targetUserName,
          defaultValue: "Chuyển quyền thành công!",
        }),
      );
      onClose();
    } catch (err: any) {
      console.error("[TransferOwnershipModal] Transfer error:", err);
      const msg =
        err?.data?.message ||
        err?.message ||
        "Không thể chuyển quyền. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 font-medium">
              {t("transfer_modal_subtitle", {
                defaultValue: "Xác nhận thay đổi quyền hạn quản lý",
              })}
            </p>
          </div>
        </div>

        {/* Message body */}
        <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/80 text-sm text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1">
            {t("transfer_modal_body", {
              role: roleName,
              name: targetUserName,
              defaultValue: `Bạn có chắc chắn muốn chuyển quyền ${roleName} cho ${targetUserName}?`,
            })}
          </p>
          <p className="text-xs text-amber-800 mt-2 font-medium">
            {t("transfer_modal_warning", {
              role: downgradedRoleName.toUpperCase(),
              defaultValue: `Sau khi xác nhận, bạn sẽ trở thành ${downgradedRoleName.toUpperCase()}.`,
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {t("cancel", { defaultValue: "Hủy" })}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("confirm", { defaultValue: "Xác nhận" })}
          </button>
        </div>
      </div>
    </div>
  );
}
