"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useGetMyRoomsQuery } from "@/lib/redux/api/roomsApi";
import { logout } from "@/app/[locale]/auth/actions";
import RoomCard from "./RoomCard";
import JoinCreateMenu from "./JoinCreateMenu";
import JoinDialog from "./JoinDialog";
import CreateRoomDialog from "./CreateRoomDialog";
import SettingsDialog from "./SettingsDialog";
import { RoomResponse } from "@tobomeet/shared/types";
import {
  Users,
  Plus,
  Loader2,
  FolderOpen,
  Video,
  Settings,
  Search,
  X,
} from "lucide-react";

interface DashboardContentProps {
  initialRooms?: RoomResponse[];
}

export default function DashboardContent({
  initialRooms = [],
}: DashboardContentProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  // initialRooms từ server-side prefetch dùng làm dữ liệu tức thì
  // RTK Query vẫn fetch để refresh nhưng không block render
  const { data: rooms = initialRooms, isLoading } = useGetMyRoomsQuery();

  const [showMenu, setShowMenu] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = rooms?.filter(
    (room) =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleLogout = async () => {
    await logout();
  };

  const handleJoinTeam = () => {
    setShowMenu(false);
    setShowJoinDialog(true);
  };

  const handleCreateTeam = () => {
    setShowMenu(false);
    setShowCreateDialog(true);
  };

  return (
    <div className="h-screen bg-[#f5f5f5] font-sans flex flex-col overflow-hidden">
      {/* ── Header Bar ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {t("title")}
            </h1>
          </div>

          {/* Middle: Search Bar */}
          <div className="flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full pl-10 pr-10 py-2 bg-slate-100 hover:bg-slate-200/60 focus:bg-white rounded-xl text-sm text-slate-900 placeholder:text-slate-400 border border-transparent focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/5 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Join or Create Team button */}
            <div className="relative">
              <button
                id="join-create-team-btn"
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold
                           hover:bg-brand-600 active:scale-[0.97] transition-all duration-150
                           shadow-[0_2px_8px_rgba(0,85,255,0.25)]"
              >
                <Plus className="w-4 h-4" />
                {t("join_or_create")}
              </button>

              {/* Popup menu */}
              {showMenu && (
                <JoinCreateMenu
                  onJoinTeam={handleJoinTeam}
                  onCreateTeam={handleCreateTeam}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Dashboard Layout Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Left Sidebar ── */}
        <aside className="w-[68px] bg-[#f8f9fa] border-r border-slate-200 flex flex-col justify-between items-center pt-0 pb-4 flex-shrink-0 z-20 shadow-[2px_0_8px_rgba(0,0,0,0.02)] relative">
          {/* Top Section */}
          <div className="w-full flex flex-col items-center">
            {/* Teams Button (Active State) */}
            <button className="flex flex-col items-center justify-center gap-1.5 w-full py-3 px-1 text-brand-600 bg-white border-l-2 border-brand-600 shadow-sm transition-all group">
              <Video className="w-[22px] h-[22px] group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold tracking-wide">
                Teams
              </span>
            </button>
          </div>

          {/* Bottom Section */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${showSettings ? "bg-slate-200/80 text-slate-800" : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"}`}
            >
              <Settings className="w-[22px] h-[22px]" />
            </button>

            {/* Settings Popup Menu */}
            {showSettings && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSettings(false)}
                />

                {/* Menu */}
                <div className="absolute left-full bottom-0 mb-2 ml-4 w-56 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-slate-100 py-2 z-50 flex flex-col text-[14px]">
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setShowSettingsDialog(true);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors w-full text-left font-medium"
                  >
                    <Settings className="w-[18px] h-[18px] text-slate-500" />
                    <span>{t("settings")}</span>
                  </button>

                  <div className="h-[1px] bg-slate-100 my-1.5 w-full"></div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <span>{t("logout")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                <p className="text-slate-500 text-sm font-medium">
                  {t("loading_rooms")}
                </p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && (!rooms || rooms.length === 0) && (
              <div className="flex flex-col items-center justify-center py-32 gap-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FolderOpen className="w-10 h-10 text-slate-400" />
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-500 text-white font-semibold
                         hover:bg-brand-600 transition-all shadow-[0_2px_8px_rgba(0,85,255,0.25)]"
                >
                  <Plus className="w-4 h-4" />
                  {t("join_or_create")}
                </button>
              </div>
            )}

            {/* Room Cards Grid */}
            {!isLoading && filteredRooms && filteredRooms.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredRooms.map((room) => (
                  <RoomCard key={room._id} room={room} />
                ))}
              </div>
            )}

            {/* No Search Results State */}
            {!isLoading &&
              rooms &&
              rooms.length > 0 &&
              filteredRooms &&
              filteredRooms.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-bold text-slate-800">
                      {t("no_results_title")}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {t("no_results_desc")}
                    </p>
                  </div>
                </div>
              )}
          </div>
        </main>
      </div>

      {/* ── Dialogs ── */}
      {showJoinDialog && (
        <JoinDialog onClose={() => setShowJoinDialog(false)} />
      )}

      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
      )}

      {showSettingsDialog && (
        <SettingsDialog onClose={() => setShowSettingsDialog(false)} />
      )}
    </div>
  );
}
