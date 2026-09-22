"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  SlidersHorizontal,
  ShieldCheck,
  Users,
  UserCheck,
  Loader2,
  Check,
  Eye,
  Edit3,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { WhiteboardSettings, WhiteboardAccessRole, WhiteboardPermissionLevel } from "@tobomeet/shared/types";

interface WhiteboardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: WhiteboardSettings;
  onSave: (settings: WhiteboardSettings) => Promise<void>;
}

export default function WhiteboardSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSave,
}: WhiteboardSettingsModalProps) {
  const t = useTranslations("meeting.whiteboard_settings_modal");
  const [isSaving, setIsSaving] = useState(false);

  // Local state for editing
  const [isMemberAllowed, setIsMemberAllowed] = useState(true);
  const [memberPerm, setMemberPerm] = useState<WhiteboardPermissionLevel>("edit");

  const [isGuestAllowed, setIsGuestAllowed] = useState(true);
  const [guestPerm, setGuestPerm] = useState<WhiteboardPermissionLevel>("edit");

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && currentSettings) {
      const allowed = currentSettings.allowedRoles || ["admin", "member", "guest"];
      setIsMemberAllowed(allowed.includes("member"));
      setMemberPerm(currentSettings.memberPermission || "edit");

      setIsGuestAllowed(allowed.includes("guest"));
      setGuestPerm(currentSettings.guestPermission || "edit");
    }
  }, [isOpen, currentSettings]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const allowedRoles: WhiteboardAccessRole[] = ["admin"];
      if (isMemberAllowed) allowedRoles.push("member");
      if (isGuestAllowed) allowedRoles.push("guest");

      const newSettings: WhiteboardSettings = {
        allowedRoles,
        memberPermission: memberPerm,
        guestPermission: guestPerm,
      };

      await onSave(newSettings);
      toast.success(t("save_success"));
      onClose();
    } catch (error) {
      console.error("Failed to save whiteboard settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 px-4 animate-fade-in backdrop-blur-md">
      <div className="bg-[#161619] border border-[#232328] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scale-in relative z-10">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232328] bg-[#111113]">
          <h3 className="text-[15px] font-bold text-white tracking-wide flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <SlidersHorizontal size={18} />
            </div>
            <span>{t("title")}</span>
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 hover:bg-[#232328] rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-[#141417]">
          <p className="text-xs text-slate-400 leading-relaxed">
            {t("subtitle")}
          </p>

          {/* Group 1: Chỉ quản trị viên (Owner + Admin) */}
          <div className="bg-[#1a1a1e] border border-[#26262c] rounded-xl p-4 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {t("role_admin_title")}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {t("role_admin_badge")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("role_admin_desc")}
                  </p>
                </div>
              </div>

              {/* Checkbox locked / checked */}
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="w-4 h-4 rounded bg-blue-600 border-transparent text-blue-600 cursor-not-allowed opacity-80"
                />
              </div>
            </div>
          </div>

          {/* Group 2: Thành viên trong phòng */}
          <div
            className={`bg-[#1a1a1e] border rounded-xl p-4 transition-all ${
              isMemberAllowed ? "border-[#2c2c34]" : "border-[#26262c] opacity-80"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <UserCheck size={18} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">
                    {t("role_member_title")}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("role_member_desc")}
                  </p>
                </div>
              </div>

              {/* Checkbox toggle */}
              <label className="relative flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={isMemberAllowed}
                  onChange={(e) => setIsMemberAllowed(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#111113] border-[#3a3a42] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                />
              </label>
            </div>

            {/* Submenu permission level for Member */}
            {isMemberAllowed && (
              <div className="mt-3.5 pt-3 border-t border-[#26262c] pl-9 space-y-2">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("permission_level_title")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    onClick={() => setMemberPerm("view")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      memberPerm === "view"
                        ? "bg-blue-600/10 border-blue-500/50 text-white"
                        : "bg-[#141417] border-[#26262c] text-slate-300 hover:bg-[#1f1f24]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="member_perm"
                      value="view"
                      checked={memberPerm === "view"}
                      onChange={() => setMemberPerm("view")}
                      className="accent-blue-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Eye size={14} className={memberPerm === "view" ? "text-blue-400" : "text-slate-400"} />
                      <span>{t("perm_can_view")}</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setMemberPerm("edit")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      memberPerm === "edit"
                        ? "bg-blue-600/10 border-blue-500/50 text-white"
                        : "bg-[#141417] border-[#26262c] text-slate-300 hover:bg-[#1f1f24]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="member_perm"
                      value="edit"
                      checked={memberPerm === "edit"}
                      onChange={() => setMemberPerm("edit")}
                      className="accent-blue-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Edit3 size={14} className={memberPerm === "edit" ? "text-blue-400" : "text-slate-400"} />
                      <span>{t("perm_can_edit")}</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Group 3: Người khác (Khách/Ngoài phòng) */}
          <div
            className={`bg-[#1a1a1e] border rounded-xl p-4 transition-all ${
              isGuestAllowed ? "border-[#2c2c34]" : "border-[#26262c] opacity-80"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Users size={18} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">
                    {t("role_guest_title")}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("role_guest_desc")}
                  </p>
                </div>
              </div>

              {/* Checkbox toggle */}
              <label className="relative flex items-center cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={isGuestAllowed}
                  onChange={(e) => setIsGuestAllowed(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#111113] border-[#3a3a42] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
                />
              </label>
            </div>

            {/* Submenu permission level for Guest */}
            {isGuestAllowed && (
              <div className="mt-3.5 pt-3 border-t border-[#26262c] pl-9 space-y-2">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("permission_level_title")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    onClick={() => setGuestPerm("view")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      guestPerm === "view"
                        ? "bg-blue-600/10 border-blue-500/50 text-white"
                        : "bg-[#141417] border-[#26262c] text-slate-300 hover:bg-[#1f1f24]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="guest_perm"
                      value="view"
                      checked={guestPerm === "view"}
                      onChange={() => setGuestPerm("view")}
                      className="accent-blue-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Eye size={14} className={guestPerm === "view" ? "text-blue-400" : "text-slate-400"} />
                      <span>{t("perm_can_view")}</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setGuestPerm("edit")}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      guestPerm === "edit"
                        ? "bg-blue-600/10 border-blue-500/50 text-white"
                        : "bg-[#141417] border-[#26262c] text-slate-300 hover:bg-[#1f1f24]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="guest_perm"
                      value="edit"
                      checked={guestPerm === "edit"}
                      onChange={() => setGuestPerm("edit")}
                      className="accent-blue-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Edit3 size={14} className={guestPerm === "edit" ? "text-blue-400" : "text-slate-400"} />
                      <span>{t("perm_can_edit")}</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#232328] bg-[#111113]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-[#232328] transition-colors cursor-pointer disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t("saving")}</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>{t("save")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
