"use client";

import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import { Video, Hash, User, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportDetailRoom({ report }: Props) {
  const t = useTranslations("admin.reports");
  const room = report.roomInfo;

  if (!room || (!room.roomName && !room.roomId)) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Video className="w-4 h-4 text-slate-400" />
          {t("detail_room")}
        </h3>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
          <p className="text-xs text-slate-400">{t("detail_room_empty", { fallback: "Không có thông tin phòng họp" })}</p>
        </div>
      </div>
    );
  }

  const rows = [
    { icon: Hash, label: t("detail_room_id", { fallback: "Room ID" }), value: room.roomId },
    { icon: Video, label: t("detail_room_name", { fallback: "Tên phòng" }), value: room.roomName },
    { icon: Hash, label: t("detail_room_code", { fallback: "Mã phòng" }), value: room.roomCode },
    { icon: User, label: t("detail_room_host", { fallback: "Chủ phòng" }), value: room.hostName },
    {
      icon: Calendar,
      label: t("detail_room_time", { fallback: "Thời gian diễn ra" }),
      value: room.occurredAt ? formatDate(String(room.occurredAt)) : undefined,
    },
  ].filter((r) => r.value);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Video className="w-4 h-4 text-slate-400" />
        {t("detail_room")}
      </h3>
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                <p className="text-xs text-slate-700 font-medium mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
