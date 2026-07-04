"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RoomResponse } from "@tobomeet/shared/types";
import { Video, GraduationCap, Users } from "lucide-react";

// Gradient presets tương tự Microsoft Teams
const CARD_GRADIENTS = [
  "from-violet-600 to-purple-700",
  "from-blue-600 to-indigo-700",
  "from-teal-500 to-emerald-700",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-700",
  "from-cyan-500 to-blue-700",
  "from-fuchsia-500 to-purple-700",
  "from-emerald-500 to-teal-700",
];

function getGradient(id: string): string {
  // Dùng hash đơn giản từ _id để assign gradient ổn định
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
}

interface RoomCardProps {
  room: RoomResponse;
}

export default function RoomCard({ room }: RoomCardProps) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const gradient = getGradient(room._id);
  const isMeeting = room.type === "meeting";

  return (
    <button
      id={`room-card-${room._id}`}
      onClick={() => router.push(`room/${room._id}`)}
      className="group text-left w-full bg-white rounded-xl overflow-hidden border border-gray-200
                 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)]
                 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {/* Gradient Header — Teams style */}
      <div
        className={`h-24 bg-gradient-to-br ${gradient} relative overflow-hidden`}
      >
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

        {/* Room initials */}
        <div className="absolute bottom-3 left-4">
          <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg">
            {room.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Room Name */}
        <h3 className="text-[15px] font-bold text-slate-900 truncate mb-1.5 group-hover:text-brand-600 transition-colors">
          {room.name}
        </h3>

        {/* Room Type Badge + Member Count */}
        <div className="flex items-center gap-2">
          {/* Type Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isMeeting
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : "bg-violet-50 text-violet-700 border border-violet-100"
            }`}
          >
            {isMeeting ? (
              <Video className="w-3 h-3" />
            ) : (
              <GraduationCap className="w-3 h-3" />
            )}
            {isMeeting ? t("meeting") : t("classroom")}
          </span>

          {/* Member Count */}
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Users className="w-3 h-3" />
            {room.members?.length || 0}
          </span>
        </div>
      </div>
    </button>
  );
}
