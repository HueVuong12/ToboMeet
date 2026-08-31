"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useEnsureChannelMeetingMutation,
  useGetSessionAttendanceQuery,
} from "@/lib/redux/api/meetingsApi";
import { useFetchMeetingSession } from "@/hooks/useFetchMeetingSession";
import { MeetingSessionResponse, SessionAttendanceItem } from "@tobomeet/shared/types";
import {
  Video,
  Clock,
  Calendar,
  Users,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Radio,
  Timer,
  UserCheck,
  UserX,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface ChannelSessionsTabProps {
  roomId: string;
  channelId: string;
  channelName?: string;
  userId: string;
}

export default function ChannelSessionsTab({
  roomId,
  channelId,
  channelName,
  userId,
}: ChannelSessionsTabProps) {
  const t = useTranslations("room");
  const locale = useLocale();
  const router = useRouter();

  const [meetingCode, setMeetingCode] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<MeetingSessionResponse | null>(null);

  const [ensureChannelMeeting, { isLoading: isEnsuringMeeting }] =
    useEnsureChannelMeetingMutation();

  // Gọi ensureChannelMeeting để lấy mã phòng (meetingCode) khi mount hoặc chuyển kênh
  useEffect(() => {
    let isMounted = true;
    if (!roomId || !channelId) return;

    const fetchMeetingCode = async () => {
      try {
        const res = await ensureChannelMeeting({ roomId, channelId }).unwrap();
        if (isMounted && res?.meetingCode) {
          setMeetingCode(res.meetingCode);
        }
      } catch (err: any) {
        console.error("Lỗi khi lấy meetingCode:", err);
        if (isMounted) {
          toast.error(
            err?.data?.message || err?.message || "Không thể tải thông tin cuộc họp của kênh",
          );
        }
      }
    };

    fetchMeetingCode();
    // Reset selectedSession khi đổi kênh
    setSelectedSession(null);

    return () => {
      isMounted = false;
    };
  }, [roomId, channelId, ensureChannelMeeting]);

  // Hook fetch meeting sessions có phân trang (50 sessions / page)
  const {
    sessions,
    total,
    hasNext,
    isInitialLoading,
    isLoadingMore,
    isFetching,
    loadMore,
    refresh,
  } = useFetchMeetingSession({
    meetingCode,
    limit: 50,
    skip: !meetingCode,
  });

  // Format ngày giờ theo locale
  const formatDateTime = (dateVal?: string | Date) => {
    if (!dateVal) return "--:--";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTimeOnly = (dateVal?: string | Date) => {
    if (!dateVal) return "--:--";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format thời lượng từ giây sang giờ phút giây
  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return "--";
    const sec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) {
      return locale === "vi"
        ? `${h} giờ ${m > 0 ? `${m} phút` : ""}`
        : `${h}h ${m > 0 ? `${m}m` : ""}`;
    }
    if (m > 0) {
      return locale === "vi" ? `${m} phút ${s > 0 ? `${s}s` : ""}` : `${m}m ${s > 0 ? `${s}s` : ""}`;
    }
    return locale === "vi" ? `${s} giây` : `${s}s`;
  };

  const handleJoinMeeting = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    router.push(`/meeting/${code}`);
  };

  // Render Skeleton khi đang tải mã phòng hoặc danh sách lần đầu
  if (isEnsuringMeeting || (isInitialLoading && sessions.length === 0)) {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-50/50">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse" />
        </div>

        <div className="space-y-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
                <div className="space-y-2.5 flex-1">
                  <div className="h-4 w-1/4 bg-slate-200 rounded" />
                  <div className="h-3.5 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-9 w-28 bg-slate-100 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===================== MÀN HÌNH CHI TIẾT PHIÊN HỌP =====================
  if (selectedSession) {
    return (
      <SessionDetailView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        formatDateTime={formatDateTime}
        formatTimeOnly={formatTimeOnly}
        formatDuration={formatDuration}
        onJoinMeeting={(code) => router.push(`/meeting/${code}`)}
        locale={locale}
      />
    );
  }

  // ===================== MÀN HÌNH DANH SÁCH PHIÊN HỌP (LONG CARDS) =====================
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Header bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">
              {locale === "vi" ? "Lịch sử phiên họp" : "Meeting Sessions"}
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200/60 rounded-full">
              {total} {locale === "vi" ? "phiên" : "sessions"}
            </span>
            {channelName && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                #{channelName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {locale === "vi"
              ? "Danh sách các phiên họp đã và đang diễn ra trong kênh này"
              : "List of past and ongoing meeting sessions in this channel"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 hover:border-brand-200 border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin text-brand-600" : ""} />
            <span>{locale === "vi" ? "Làm mới" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Danh sách các session dạng card dài */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3.5 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3.5">
              <Video size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {locale === "vi" ? "Chưa có phiên họp nào" : "No meeting sessions recorded"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {locale === "vi"
                ? "Khi bắt đầu một cuộc họp trong kênh này, thông tin phiên họp và danh sách điểm danh sẽ tự động xuất hiện tại đây."
                : "When a meeting begins in this channel, session logs and attendance data will appear here automatically."}
            </p>
          </div>
        ) : (
          <>
            {sessions.map((session, index) => {
              const isOngoing = session.status === "ongoing";
              const sessionIndex = total > 0 ? total - index : index + 1;

              return (
                <div
                  key={session._id}
                  onClick={() => setSelectedSession(session)}
                  className={`
                    group relative w-full bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5
                    flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer
                    ${isOngoing
                      ? "border-emerald-300 shadow-sm hover:shadow-md hover:border-emerald-400 bg-gradient-to-r from-emerald-50/20 via-white to-white"
                      : "border-slate-200 hover:border-brand-300 hover:shadow-md"
                    }
                  `}
                >
                  {/* Left Side: Status Icon & Details */}
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    {/* Status Badge Icon */}
                    <div
                      className={`
                        w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold transition-transform group-hover:scale-105
                        ${isOngoing
                          ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                        }
                      `}
                    >
                      {isOngoing ? (
                        <Radio size={22} className="animate-pulse" />
                      ) : (
                        <Video size={20} className="text-slate-500" />
                      )}
                    </div>

                    {/* Metadata Breakdown */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition-colors">
                          {locale === "vi" ? `Phiên họp #${sessionIndex}` : `Meeting Session #${sessionIndex}`}
                        </span>

                        {isOngoing ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            {locale === "vi" ? "Đang diễn ra" : "Live Now"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                            <CheckCircle2 size={12} className="text-slate-500" />
                            {locale === "vi" ? "Đã kết thúc" : "Ended"}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: {session._id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      {/* Timestamps & Info Row */}
                      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-600">
                        {/* Start time */}
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>
                            <strong className="font-medium text-slate-700">
                              {locale === "vi" ? "Bắt đầu:" : "Started:"}
                            </strong>{" "}
                            {formatDateTime(session.startedAt || session.createdAt)}
                          </span>
                        </div>

                        {/* End time */}
                        {session.endedAt && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-400 shrink-0" />
                            <span>
                              <strong className="font-medium text-slate-700">
                                {locale === "vi" ? "Kết thúc:" : "Ended:"}
                              </strong>{" "}
                              {formatDateTime(session.endedAt)}
                            </span>
                          </div>
                        )}

                        {/* Duration */}
                        <div className="flex items-center gap-1.5">
                          <Timer size={13} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">
                            {locale === "vi" ? "Thời lượng:" : "Duration:"}{" "}
                            <span className="font-bold text-slate-900">
                              {formatDuration(session.durationSeconds)}
                            </span>
                          </span>
                        </div>

                        {/* Participants Count */}
                        {session.totalParticipants !== undefined && session.totalParticipants > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">
                              <span className="font-bold text-slate-900">
                                {session.totalParticipants}
                              </span>{" "}
                              {locale === "vi" ? "người tham gia" : "participants"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Actions & Navigate Arrow */}
                  <div className="flex items-center justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {isOngoing && (
                      <button
                        onClick={(e) => handleJoinMeeting(e, session.meetingCode)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
                      >
                        <PlayCircle size={15} />
                        <span>{locale === "vi" ? "Tham gia" : "Join Now"}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-brand-600 transition-colors">
                      <span className="hidden sm:inline">
                        {locale === "vi" ? "Chi tiết" : "Details"}
                      </span>
                      <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more button */}
            {hasNext && (
              <div className="pt-3 pb-6 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-brand-300 text-slate-700 hover:text-brand-600 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-brand-600" />
                      <span>{locale === "vi" ? "Đang tải thêm phiên..." : "Loading more sessions..."}</span>
                    </>
                  ) : (
                    <span>{locale === "vi" ? "Tải thêm các phiên trước đó" : "Load more past sessions"}</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===================== SUB-COMPONENT: SESSION DETAIL VIEW =====================

interface SessionDetailViewProps {
  session: MeetingSessionResponse;
  onBack: () => void;
  formatDateTime: (d?: string | Date) => string;
  formatTimeOnly: (d?: string | Date) => string;
  formatDuration: (s?: number) => string;
  onJoinMeeting: (code: string) => void;
  locale: string;
}

function SessionDetailView({
  session,
  onBack,
  formatDateTime,
  formatTimeOnly,
  formatDuration,
  onJoinMeeting,
  locale,
}: SessionDetailViewProps) {
  const isOngoing = session.status === "ongoing";

  // Lấy dữ liệu điểm danh của session
  const { data: attendanceList = [], isLoading: isAttendanceLoading } =
    useGetSessionAttendanceQuery({
      meetingCode: session.meetingCode,
      sessionId: session._id,
    });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Top Bar with Back Button */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title={locale === "vi" ? "Quay lại" : "Back"}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {locale === "vi" ? "Chi tiết phiên họp" : "Session Details"}
              </h2>
              {isOngoing ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {locale === "vi" ? "Đang diễn ra" : "Live Now"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  <CheckCircle2 size={12} className="text-slate-500" />
                  {locale === "vi" ? "Đã kết thúc" : "Ended"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Session ID: {session._id} • Meeting Code: {session.meetingCode}
            </p>
          </div>
        </div>

        {isOngoing && (
          <button
            onClick={() => onJoinMeeting(session.meetingCode)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
          >
            <PlayCircle size={16} />
            <span>{locale === "vi" ? "Tham gia ngay" : "Join Now"}</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-500 text-xs font-medium mb-1.5">
              <Calendar size={15} className="text-brand-500" />
              <span>{locale === "vi" ? "Thời gian bắt đầu" : "Start Time"}</span>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {formatDateTime(session.startedAt || session.createdAt)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-500 text-xs font-medium mb-1.5">
              <Clock size={15} className="text-amber-500" />
              <span>{locale === "vi" ? "Thời gian kết thúc" : "End Time"}</span>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {session.endedAt
                ? formatDateTime(session.endedAt)
                : locale === "vi"
                  ? "Chưa kết thúc"
                  : "In progress"}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-500 text-xs font-medium mb-1.5">
              <Timer size={15} className="text-purple-500" />
              <span>{locale === "vi" ? "Tổng thời lượng" : "Total Duration"}</span>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {formatDuration(session.durationSeconds)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-500 text-xs font-medium mb-1.5">
              <Users size={15} className="text-emerald-500" />
              <span>{locale === "vi" ? "Người tham gia" : "Participants"}</span>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {attendanceList.length > 0
                ? `${attendanceList.length} ${locale === "vi" ? "người" : "users"}`
                : session.totalParticipants !== undefined
                  ? `${session.totalParticipants} ${locale === "vi" ? "người" : "users"}`
                  : "0"}
            </div>
          </div>
        </div>

        {/* Danh sách người tham gia / Điểm danh */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {locale === "vi" ? "Danh sách điểm danh & người tham gia" : "Attendance & Participant Log"}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {attendanceList.length} {locale === "vi" ? "thành viên" : "records"}
            </span>
          </div>

          {isAttendanceLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-brand-500" />
              <p className="text-xs">{locale === "vi" ? "Đang tải dữ liệu điểm danh..." : "Loading attendance..."}</p>
            </div>
          ) : attendanceList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <UserX size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">
                {locale === "vi"
                  ? "Chưa có bản ghi điểm danh nào cho phiên họp này."
                  : "No attendance records recorded for this session."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">{locale === "vi" ? "Thành viên" : "Participant"}</th>
                    <th className="py-3 px-4">{locale === "vi" ? "Trạng thái" : "Status"}</th>
                    <th className="py-3 px-4">{locale === "vi" ? "Vào lần đầu" : "First Joined"}</th>
                    <th className="py-3 px-4">{locale === "vi" ? "Rời lần cuối" : "Last Left"}</th>
                    <th className="py-3 px-4">{locale === "vi" ? "Thời gian có mặt" : "Time in Session"}</th>
                    <th className="py-3 px-4 text-center">{locale === "vi" ? "Số lần vào" : "Visits"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceList.map((att: SessionAttendanceItem, idx: number) => {
                    const statusText =
                      att.status === "present"
                        ? locale === "vi" ? "Có mặt" : "Present"
                        : att.status === "late"
                          ? locale === "vi" ? "Đi muộn" : "Late"
                          : locale === "vi" ? "Rời sớm" : "Left early";

                    const statusBadgeClass =
                      att.status === "present"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : att.status === "late"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-orange-50 text-orange-700 border-orange-200";

                    return (
                      <tr key={att.userId || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {(att.displayName || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">
                                {att.displayName || (locale === "vi" ? "Người dùng" : "Participant")}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {att.userId}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeClass}`}
                          >
                            {statusText}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {formatTimeOnly(att.firstJoinedAt)}
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {att.lastLeftAt ? formatTimeOnly(att.lastLeftAt) : (isOngoing ? "-- (Đang họp)" : "--")}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {formatDuration(att.totalDurationSeconds)}
                        </td>

                        <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                          {att.visitCount || 1}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
