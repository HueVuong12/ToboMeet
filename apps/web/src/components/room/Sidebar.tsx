"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Room } from "@tobomeet/shared/types";
import { useAddChannelMutation } from "@/lib/redux/api/roomsApi";
import {
  Hash,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Video,
  GraduationCap,
  Plus,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface SidebarProps {
  room: Room;
  userId: string;
}

export default function Sidebar({ room, userId }: SidebarProps) {
  const t = useTranslations("room");
  const router = useRouter();
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [activeChannel, setActiveChannel] = useState<string>(
    room.channels[0]?.name || "General",
  );
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [addChannel, { isLoading }] = useAddChannelMutation();
  const [error, setError] = useState<string | null>(null);

  const isMeeting = room.type === "meeting";
  const isOwner = room.ownerId === userId;

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setError(null);

    try {
      await addChannel({
        roomId: room._id,
        name: newChannelName.trim(),
      }).unwrap();
      setNewChannelName("");
      setShowAddChannelModal(false);
    } catch (err: any) {
      setError(err?.message || "Không thể tạo kênh. Vui lòng thử lại.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleCreateChannel();
    }
  };

  return (
    <aside className="w-64 h-full bg-[#f5f5f5] flex flex-col border-r border-slate-200 select-none relative">
      {/* Room Header */}
      <div className="px-4 h-14 flex items-center gap-3 border-b border-slate-200 flex-shrink-0">
        {/* Back button */}
        <button
          id="back-to-dashboard-btn"
          onClick={() => router.push("../dashboard")}
          className="w-7 h-7 rounded-md hover:bg-slate-200 flex items-center justify-center transition-colors"
          title={t("back_to_dashboard")}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>

        {/* Room name */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 truncate">
            {room.name}
          </h2>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              isMeeting ? "text-blue-400" : "text-violet-400"
            }`}
          >
            {isMeeting ? (
              <Video className="w-3 h-3" />
            ) : (
              <GraduationCap className="w-3 h-3" />
            )}
            {isMeeting ? "Meeting" : "Classroom"}
          </span>
        </div>
      </div>

      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto py-3">
        {/* Section Header */}
        <div className="w-full flex items-center justify-between px-4 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="flex items-center gap-1 hover:text-slate-700 transition-colors"
          >
            {channelsExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {t("channels")}
          </button>

          {isOwner && (
            <button
              onClick={() => setShowAddChannelModal(true)}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              title="Thêm kênh"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Channel List */}
        {channelsExpanded && (
          <div className="mt-1 px-2 space-y-0.5">
            {room.channels.map((channel) => {
              const isActive = channel.name === activeChannel;

              return (
                <button
                  key={channel._id || channel.name}
                  onClick={() => setActiveChannel(channel.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors relative
                    ${
                      isActive
                        ? "bg-white text-slate-900 font-semibold shadow-sm"
                        : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                    }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 w-[3px] h-5 bg-brand-500 rounded-r-full" />
                  )}
                  <Hash className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>


      {/* Add Channel Modal */}
      {showAddChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddChannelModal(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-slate-900">{t("create_channel")}</h2>
              <button
                onClick={() => setShowAddChannelModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">{t("channel_name")}</label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-slate-400 text-base">#</span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("channel_name_placeholder")}
                    autoFocus
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-slate-50
                               text-sm text-slate-900 placeholder:text-slate-400
                               focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                               transition-all"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
              <button
                onClick={() => setShowAddChannelModal(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold
                           hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("create_channel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
