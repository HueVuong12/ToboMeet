"use client";

import { useGetRoomByIdQuery } from "@/lib/redux/api/roomsApi";
import Sidebar from "./Sidebar";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface RoomContentProps {
  roomId: string;
  userId: string;
}

export default function RoomContent({ roomId, userId }: RoomContentProps) {
  const t = useTranslations("room");
  const { data: room, isLoading, error } = useGetRoomByIdQuery(roomId);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e]">
        <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e]">
        <p className="text-white/60 text-sm">{t("room_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#1e1e1e] font-sans overflow-hidden">
      {/* Sidebar bên trái — Teams style */}
      <Sidebar room={room} userId={userId} />

      {/* Main Content Area — placeholder */}
      <div className="flex-1 flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-slate-400">
              {room.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-1">
            {room.name}
          </h2>
          <p className="text-sm text-slate-400">
            {t("select_channel_to_start")}
          </p>
        </div>
      </div>
    </div>
  );
}
