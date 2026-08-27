"use client";

import { useTranslations } from "next-intl";
import { Users, Activity, Video, Award, FolderPlus, Clock } from "lucide-react";
import AdminStatsCard from "./AdminStatsCard";

interface AdminStatsGridProps {
  totalUsers: number;
  onlineUsers: number;
  activeMeetings: number;
  totalMeetings: number;
  roomsCreatedToday: number;
  averageMeetingDuration: number;
}

export default function AdminStatsGrid({
  totalUsers,
  onlineUsers,
  activeMeetings,
  totalMeetings,
  roomsCreatedToday,
  averageMeetingDuration,
}: AdminStatsGridProps) {
  const t = useTranslations("admin");

  const stats = [
    {
      title: t("total_users"),
      value: totalUsers,
      icon: <Users className="w-5 h-5" />,
      gradient: "from-blue-600 to-indigo-700",
    },
    {
      title: t("online_users"),
      value: onlineUsers,
      icon: <Activity className="w-5 h-5 animate-pulse" />,
      gradient: "from-emerald-500 to-teal-700",
    },
    {
      title: t("active_meetings"),
      value: activeMeetings,
      icon: <Video className="w-5 h-5" />,
      gradient: "from-rose-500 to-pink-600",
    },
    {
      title: t("total_meetings"),
      value: totalMeetings,
      icon: <Award className="w-5 h-5" />,
      gradient: "from-violet-600 to-purple-700",
    },
    {
      title: t("rooms_created_today"),
      value: roomsCreatedToday,
      icon: <FolderPlus className="w-5 h-5" />,
      gradient: "from-amber-500 to-orange-600",
    },
    {
      title: t("average_duration"),
      value: `${averageMeetingDuration} ${t("minutes")}`,
      icon: <Clock className="w-5 h-5" />,
      gradient: "from-cyan-500 to-blue-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {stats.map((s, idx) => (
        <AdminStatsCard
          key={idx}
          title={s.title}
          value={s.value}
          icon={s.icon}
          gradient={s.gradient}
        />
      ))}
    </div>
  );
}
