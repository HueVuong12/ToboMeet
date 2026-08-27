"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useGetMyRoomsQuery } from "@/lib/redux/api/roomsApi";
import { RoomResponse } from "@tobomeet/shared/types";
import { Plus, Loader2, FolderOpen, Search, X, Users } from "lucide-react";
import RoomCard from "./RoomCard";
import JoinCreateMenu from "@/components/dashboard/JoinCreateMenu";
import { useHomeContext } from "@/app/[locale]/(home)/layout";

interface DashboardContentProps {
  initialRooms?: RoomResponse[];
}

export default function DashboardContent({
  initialRooms = [],
}: DashboardContentProps) {
  const t = useTranslations("dashboard");
  const { data: rooms = initialRooms, isLoading } = useGetMyRoomsQuery();

  const { setShowJoinDialog, setShowCreateDialog } = useHomeContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const filteredRooms = rooms?.filter(
    (room) =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.code &&
        room.code.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#fcfcfc]">
      {/* ── Local Header Bar (Thiết kế thanh lịch, Responsive mượt mà) ── */}
      <header className="shrink-0 bg-white border-b border-slate-200/60 z-30">
        <div className="w-full px-4 lg:px-8 h-18 flex items-center justify-between gap-3 md:gap-4">
          {/* Left: Title (Ẩn trên Mobile, chỉ hiện trên Tablet/Desktop trở lên) */}
          <div className="hidden md:flex items-center gap-3 w-1/3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight truncate">
              {t("title")}
            </h1>
          </div>

          {/* Middle: Search Bar (Trải dài full trên Mobile, chiếm 1/3 ở giữa trên Desktop) */}
          <div className="flex-1 md:w-1/3 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full pl-11 pr-10 py-2.5 bg-slate-100/70 hover:bg-slate-100 focus:bg-white rounded-full text-[13px] font-medium text-slate-700 placeholder:text-slate-400 border border-transparent focus:border-brand-500/30 focus:ring-4 focus:ring-brand-500/10 transition-all duration-200 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions (Nút bấm tròn chỉ hiện Icon trên Mobile, hiện đủ Text trên Desktop) */}
          <div className="flex items-center justify-end md:w-1/3 shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center justify-center gap-2 w-10 h-10 md:w-auto md:h-auto md:px-5 md:py-2.5 rounded-full bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-600 active:scale-[0.97] transition-all duration-150 shadow-sm shrink-0"
              >
                {/* Icon to hơn một chút trên Mobile */}
                <Plus className="w-5 h-5 md:w-4 md:h-4" />
                {/* Ẩn Text trên màn hình nhỏ */}
                <span className="hidden md:inline">{t("join_or_create")}</span>
              </button>

              {showMenu && (
                <JoinCreateMenu
                  onJoinTeam={() => {
                    setShowMenu(false);
                    setShowJoinDialog(true);
                  }}
                  onCreateTeam={() => {
                    setShowMenu(false);
                    setShowCreateDialog(true);
                  }}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Scrollable Content ── */}
      <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="w-full">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-slate-500 text-sm font-medium">
                {t("loading_rooms")}
              </p>
            </div>
          )}

          {!isLoading && (!rooms || rooms.length === 0) && (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="w-20 h-20 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
                <FolderOpen className="w-10 h-10 text-slate-300" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {t("empty_title")}
                </h2>
                <p className="text-slate-500 max-w-md">
                  {t("empty_description")}
                </p>
              </div>
              <button
                onClick={() => setShowMenu(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 text-white text-[13px] font-semibold
                       hover:bg-brand-600 transition-all shadow-md shadow-brand-500/20"
              >
                <Plus className="w-4 h-4" />
                {t("join_or_create")}
              </button>
            </div>
          )}

          {!isLoading && filteredRooms && filteredRooms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {filteredRooms.map((room) => (
                <RoomCard key={room._id} room={room} />
              ))}
            </div>
          )}

          {!isLoading &&
            rooms &&
            rooms.length > 0 &&
            filteredRooms &&
            filteredRooms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-800">
                    {t("no_results_title")}
                  </h3>
                  <p className="text-[13px] text-slate-400 mt-1">
                    {t("no_results_desc")}
                  </p>
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
