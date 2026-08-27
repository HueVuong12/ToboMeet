"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, Plus } from "lucide-react";

interface JoinCreateMenuProps {
  onJoinTeam: () => void;
  onCreateTeam: () => void;
  onClose: () => void;
}

export default function JoinCreateMenu({
  onJoinTeam,
  onCreateTeam,
  onClose,
}: JoinCreateMenuProps) {
  const t = useTranslations("dashboard");
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // Kiểm tra cả nút trigger
        const trigger = document.getElementById("join-create-team-btn");
        if (trigger && trigger.contains(event.target as Node)) return;
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)]
                 border border-gray-200 overflow-hidden animate-scale-in origin-top-right z-50"
    >
      <div className="p-1.5">
        <button
          id="join-team-option"
          onClick={onJoinTeam}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700
                     hover:bg-slate-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("join_team")}</p>
          </div>
        </button>

        <button
          id="create-team-option"
          onClick={onCreateTeam}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700
                     hover:bg-slate-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("create_team")}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
