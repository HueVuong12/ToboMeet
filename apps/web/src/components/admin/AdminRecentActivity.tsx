"use client";

import { useTranslations } from "next-intl";
import { Folder, Video, Calendar } from "lucide-react";

interface RecentRoom {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

interface RecentMeeting {
  id: string;
  meetingCode: string;
  status: string;
  createdAt: string;
}

interface AdminRecentActivityProps {
  recentRooms: RecentRoom[];
  recentMeetings: RecentMeeting[];
}

export default function AdminRecentActivity({
  recentRooms = [],
  recentMeetings = [],
}: AdminRecentActivityProps) {
  const t = useTranslations("admin");

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${d.toLocaleDateString()}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Rooms */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Folder className="w-5 h-5 text-indigo-500" />
          <span>{t("recent_rooms")}</span>
        </h2>

        <div className="divide-y divide-slate-100">
          {recentRooms.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t("no_data")}</p>
          ) : (
            recentRooms.map((room) => (
              <div key={room.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{room.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{t("code")}: {room.code}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(room.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-indigo-500" />
          <span>{t("recent_meetings")}</span>
        </h2>

        <div className="divide-y divide-slate-100">
          {recentMeetings.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{t("no_data")}</p>
          ) : (
            recentMeetings.map((meet) => (
              <div key={meet.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 font-mono truncate">{meet.meetingCode}</p>
                  <span
                    className={`inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      meet.status === "ongoing"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-slate-50 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {meet.status === "ongoing" ? t("ongoing") : t("ended")}
                  </span>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(meet.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
