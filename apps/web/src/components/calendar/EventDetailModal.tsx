"use client";

import { X, Video, MessageSquare, Clock, Paperclip, Pencil, Trash2, ClipboardList, ArrowRight } from "lucide-react";
import { CalendarEvent, RsvpMember } from "./types";

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  event: CalendarEvent | null;
  rsvpList: RsvpMember[];
  currentUserId?: string;
  currentSupabaseId?: string;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onJoinMeeting: (meetingCode: string) => void;
}

export default function EventDetailModal({
  isOpen,
  onClose,
  locale,
  event,
  rsvpList,
  currentUserId,
  currentSupabaseId,
  onEdit,
  onDelete,
  onJoinMeeting,
}: EventDetailModalProps) {
  if (!isOpen || !event) return null;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  // Trường hợp là Nhiệm vụ (Assignment)
  if (event.eventType === "assignment") {
    const statusMap: Record<string, { label: string; color: string }> = {
      submitted: { label: "Đã nộp", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      graded: { label: "Đã chấm điểm", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      overdue: { label: "Đã quá hạn", color: "bg-rose-100 text-rose-700 border-rose-200" },
      closed: { label: "Đã khóa/đóng", color: "bg-slate-100 text-slate-700 border-slate-200" },
      in_progress: { label: "Đang thực hiện", color: "bg-blue-100 text-blue-700 border-blue-200" },
    };
    const currentStatus = statusMap[event.assignmentStatus || "in_progress"] || statusMap.in_progress;

    const handleOpenAssignment = () => {
      onClose();
      window.location.href = `/${locale}/room/${event.roomId}?channel=__assignments__&assignmentId=${event.assignmentId}`;
    };

    return (
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-[17px]">
                {locale === "vi" ? "Chi tiết nhiệm vụ" : "Assignment Details"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-left">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStatus.color}`}>
                  {currentStatus.label}
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                {event.title}
              </h4>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">
                  {locale === "vi" ? "Thời gian bắt đầu:" : "Start time:"}
                </span>
                <span className="font-semibold text-slate-700">
                  {formatDateTime(event.assignmentStartDate || event.startDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">
                  {locale === "vi" ? "Thời gian kết thúc:" : "End time:"}
                </span>
                <span
                  className={
                    event.assignmentStatus === "overdue"
                      ? "font-bold text-rose-600"
                      : "font-semibold text-slate-700"
                  }
                >
                  {formatDateTime(event.assignmentDueDate || event.startDate)}
                </span>
              </div>
              {event.hostDisplayName && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-medium">
                    {locale === "vi" ? "Người giao:" : "Assigned by:"}
                  </span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    {event.hostAvatarUrl ? (
                      <img src={event.hostAvatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : null}
                    <span>{event.hostDisplayName}</span>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {locale === "vi" ? "Mô tả nhiệm vụ" : "Description"}
                </p>
                <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {event.description}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {locale === "vi" ? "Đóng" : "Close"}
              </button>
              <button
                type="button"
                onClick={handleOpenAssignment}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>{locale === "vi" ? "Xem chi tiết nhiệm vụ" : "View Assignment"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isChannelMeeting =
    event.roomType === "channel_meeting" &&
    event.roomId &&
    event.channelId;
  const hasRsvp = rsvpList && rsvpList.length > 0;

  const isHost =
    (currentUserId && currentUserId === event.hostId) ||
    (currentSupabaseId && currentSupabaseId === event.hostId);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-[17px]">
            {locale === "vi" ? "Chi tiết lịch họp" : "Meeting Details"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight">
              {event.title}
            </h4>

            {/* Microsoft Teams style Action Buttons */}
            {(isChannelMeeting || hasRsvp) && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    if (!isChannelMeeting) {
                      onJoinMeeting(event.meetingCode || "");
                    } else {
                      window.location.href = `/${locale}/room/${event.roomId}?channel=${event.channelId}`;
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Video className="w-4 h-4" />
                  <span>{locale === "vi" ? "Tham gia" : "Join"}</span>
                </button>

                <button
                  onClick={() => {}}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span>{locale === "vi" ? "Trò chuyện" : "Chat"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
              </span>
            </div>

            {event.description &&
              (() => {
                const match = event.description.match(
                  /<div[^>]*data-attachments="([^"]*)"[^>]*><\/div>/,
                );
                let cleanHtml = event.description;
                let files: any[] = [];
                if (match) {
                  cleanHtml = event.description.replace(match[0], "");
                  try {
                    files = JSON.parse(decodeURIComponent(match[1]));
                  } catch (e) {}
                }
                const isHtmlEmpty = (htmlStr: string) => {
                  if (!htmlStr) return true;
                  const text = htmlStr
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, "")
                    .trim();
                  return text === "";
                };

                return (
                  <div className="mt-2 space-y-3">
                    {!isHtmlEmpty(cleanHtml) && (
                      <div
                        className="text-sm bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-500 rich-text-display prose prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: cleanHtml }}
                      />
                    )}
                    {files.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {locale === "vi" ? "Tệp đính kèm" : "Attachments"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {files.map((f: any, idx: number) => (
                            <a
                              key={idx}
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-[11px] font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                            >
                              <Paperclip className="w-3 h-3 text-slate-400" />
                              <span>{f.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Danh sách người tham gia (chỉ hiển thị khi cuộc họp có khách mời) */}
          {rsvpList && rsvpList.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                {locale === "vi" ? "Người tham gia" : "Participants"}
              </h5>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {/* Người tổ chức (Host) */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {event.hostAvatarUrl ? (
                      <img
                        src={event.hostAvatarUrl}
                        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                        alt=""
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 uppercase shrink-0">
                        {(
                          event.hostDisplayName ||
                          event.hostEmail ||
                          "?"
                        ).substring(0, 1)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 truncate">
                        {event.hostDisplayName ||
                          event.hostEmail?.split("@")[0]}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {event.hostEmail}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase shrink-0">
                    {locale === "vi" ? "Người tổ chức" : "Organizer"}
                  </span>
                </div>

                {/* Khách mời */}
                {rsvpList.map((inv, idx) => {
                  const isResponded = inv.status !== "PENDING";
                  const statusText = isResponded
                    ? locale === "vi"
                      ? "Đã phản hồi"
                      : "Responded"
                    : locale === "vi"
                      ? "Chưa phản hồi"
                      : "No response";

                  let dotColor = "bg-slate-400";
                  if (inv.status === "ACCEPTED") dotColor = "bg-emerald-500";
                  else if (inv.status === "DECLINED") dotColor = "bg-rose-500";
                  else if (inv.status === "TENTATIVE") dotColor = "bg-amber-500";

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {inv.avatarUrl ? (
                          <img
                            src={inv.avatarUrl}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            alt=""
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 uppercase shrink-0">
                            {inv.displayName
                              ? inv.displayName.substring(0, 1)
                              : "?"}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-800 truncate">
                            {inv.displayName || inv.email.split("@")[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {inv.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isResponded ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          {statusText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons ở Footer */}
          <div className="flex gap-2 pt-4 w-full border-t border-slate-50">
            {isHost && (
              <button
                onClick={() => onEdit(event)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                title={locale === "vi" ? "Chỉnh sửa" : "Edit"}
              >
                <Pencil className="w-3.5 h-3.5 text-slate-600" />
                <span>{locale === "vi" ? "Chỉnh sửa" : "Edit"}</span>
              </button>
            )}
            <button
              onClick={() => onDelete(event)}
              className="px-4 py-2 border border-red-100 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>{locale === "vi" ? "Xóa" : "Delete"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
