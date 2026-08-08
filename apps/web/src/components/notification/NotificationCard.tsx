import { NotificationResponse } from "@tobomeet/shared/types";
import {
  Bell,
  UserMinus,
  Trash2,
  LogOut,
  Video,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationCardProps {
  notification: NotificationResponse;
  onCloseDrawer: () => void;
}

export default function NotificationCard({
  notification,
  onCloseDrawer,
}: NotificationCardProps) {
  const router = useRouter();

  // Hàm helper để map type sang UI tương ứng
  const getNotificationDetails = (
    type: string,
    metadata: Record<string, any>,
  ) => {
    switch (type) {
      case "KICKED":
        return {
          title: "Bị xóa khỏi nhóm",
          content: `Bạn đã bị xoá khỏi nhóm ${metadata?.roomName || ""}.`,
          icon: UserMinus,
          colorClass: "text-red-600 bg-red-100",
        };
      case "ROOM_DISBANDED":
        return {
          title: "Nhóm đã giải tán",
          content: `Trưởng nhóm đã giải tán ${metadata?.roomName || "nhóm"}.`,
          icon: Trash2,
          colorClass: "text-orange-600 bg-orange-100",
        };
      case "PARTICIPANT_REMOVED":
        return {
          title: "Đã rời cuộc họp",
          content: `Bạn đã bị xoá khỏi cuộc họp ${metadata?.meetingCode || ""}.`,
          icon: LogOut,
          colorClass: "text-red-600 bg-red-100",
        };
      case "MEETING_INVITE":
        return {
          title: "Lời mời tham gia họp",
          content: `${metadata?.inviterName || "Ai đó"} đã mời bạn tham gia cuộc họp.`,
          icon: Video,
          colorClass: "text-brand-600 bg-brand-100",
          actionUrl: `/room/join?code=${metadata?.meetingCode}`, // Link để chuyển hướng
        };
      case "ROOM_REPORTED":
        return {
          title: "Phòng bị báo cáo",
          content: `Phòng của bạn đã bị người dùng báo cáo vi phạm.`,
          icon: AlertTriangle,
          colorClass: "text-amber-600 bg-amber-100",
        };
      case "REPORT_RESOLVED":
        return {
          title: "Đã xử lý báo cáo",
          content: `Báo cáo vi phạm của bạn đã được quản trị viên xử lý.`,
          icon: CheckCircle2,
          colorClass: "text-emerald-600 bg-emerald-100",
        };
      default:
        return {
          title: "Thông báo hệ thống",
          content: `Có một sự kiện diễn ra (${type}).`,
          icon: Bell,
          colorClass: "text-slate-500 bg-slate-100",
        };
    }
  };

  const {
    title,
    content,
    icon: Icon,
    colorClass,
    actionUrl,
  } = getNotificationDetails(notification.type, notification.metadata || {});

  const handleClick = () => {
    // Nếu thông báo có link hành động (như lời mời họp), chuyển hướng và đóng drawer
    if (actionUrl) {
      router.push(actionUrl);
      onCloseDrawer();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative p-4 rounded-2xl border transition-all duration-200 ${actionUrl ? "cursor-pointer hover:shadow-md" : "cursor-default"} ${
        notification.isRead
          ? "bg-white border-slate-100 hover:border-slate-200"
          : "bg-brand-50/40 border-brand-100/60 hover:bg-brand-50/70"
      }`}
    >
      {/* Chấm tròn báo chưa đọc */}
      {!notification.isRead && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(0,85,255,0.4)]" />
      )}

      <div className="flex gap-3.5">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 pt-0.5">
          <h4 className="text-[13px] font-bold text-slate-800 leading-tight">
            {title}
          </h4>
          <p className="text-[12px] text-slate-600 mt-1 leading-snug">
            {content}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-2 flex items-center gap-1">
            {new Date(notification.createdAt).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
