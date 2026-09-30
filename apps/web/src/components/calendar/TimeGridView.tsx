"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { CalendarEvent, getDaysOfWeek, getEventBgColor, getEventIcon } from "./types";

interface TimeGridViewProps {
  locale: string;
  currentDate: Date;
  view: "day" | "week" | "workweek";
  filteredEvents: CalendarEvent[];
  highlightedEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
  onDropEvent: (eventId: string, date: Date, hour: number) => void;
}

export default function TimeGridView({
  locale,
  currentDate,
  view,
  filteredEvents,
  highlightedEventId,
  onSelectEvent,
  onCellClick,
  onDropEvent,
}: TimeGridViewProps) {
  const t = useTranslations("calendar");
  const daysOfWeek = getDaysOfWeek(currentDate);

  // Lọc theo chế độ làm việc (Work Week ẩn thứ 7 và CN)
  const displayedDays = daysOfWeek.filter((d) => {
    if (view === "workweek") {
      return d.getDay() !== 0 && d.getDay() !== 6;
    }
    if (view === "day") {
      return d.toDateString() === currentDate.toDateString();
    }
    return true;
  });

  // Hỗ trợ đầy đủ 24 khung giờ từ 0 đến 23
  const hoursRange = Array.from({ length: 24 }, (_, i) => i);

  const formatHourLabel = (hour: number) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (locale === "vi") {
      return `${pad(hour)}:00`;
    }
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const formatEventTime = (startDate: string, endDate: string) => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  };

  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", eventId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnCell = (
    e: React.DragEvent,
    dayDate: Date,
    hour: number,
  ) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    if (eventId) {
      onDropEvent(eventId, dayDate, hour);
    }
  };

  return (
    <div className="min-w-[800px] bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
      {/* Grid Header — Hàng tiêu đề ngày cố định khi lướt xuống */}
      <div className="flex border-b border-slate-200 h-12 items-center bg-white sticky top-0 z-30 rounded-t-2xl shadow-xs">
        <div className="w-20 text-center text-xs font-bold text-slate-400 border-r border-slate-200 bg-white sticky left-0 top-0 z-40 h-full flex items-center justify-center shrink-0 rounded-tl-2xl">
          GMT+07
        </div>
        {displayedDays.map((date, idx) => (
          <div
            key={idx}
            className="flex-1 text-center flex flex-col justify-center items-center h-full border-r border-slate-100 last:border-0 bg-white"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {date.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                weekday: "short",
              })}
            </span>
            <span
              className={`text-sm font-extrabold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                date.toDateString() === new Date().toDateString()
                  ? "bg-indigo-600 text-white"
                  : "text-slate-800"
              }`}
            >
              {date.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* Grid Body — Từng hàng là 1 khung giờ, mỗi ô có thể chứa nhiều lịch xuống dòng */}
      <div className="flex flex-col divide-y divide-slate-100">
        {hoursRange.map((hour) => (
          <div
            key={hour}
            className="flex min-h-[68px] hover:bg-slate-50/20 transition-colors"
          >
            {/* Nhãn khung giờ bên trái */}
            <div className="w-20 shrink-0 border-r border-slate-100 flex justify-center items-start pt-2 text-[11px] font-bold text-slate-400 bg-white sticky left-0 z-20 select-none">
              {formatHourLabel(hour)}
            </div>

            {/* Các ô (khung giờ) theo từng ngày */}
            {displayedDays.map((dayDate, colIdx) => {
              // Lấy tất cả sự kiện bắt đầu trong khung giờ này (hoặc deadline nhiệm vụ trong giờ này)
              const cellEvents = filteredEvents
                .filter((ev) => {
                  const evDate = new Date(ev.startDate);
                  const isSameDay =
                    evDate.toDateString() === dayDate.toDateString();
                  if (!isSameDay) return false;

                  if (ev.eventType === "assignment") {
                    const d = new Date(ev.assignmentDueDate || ev.startDate);
                    return d.getHours() === hour;
                  }

                  return evDate.getHours() === hour;
                })
                .sort(
                  (a, b) =>
                    new Date(a.startDate).getTime() -
                    new Date(b.startDate).getTime(),
                );

              return (
                <div
                  key={colIdx}
                  onClick={() => onCellClick(dayDate, hour)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnCell(e, dayDate, hour)}
                  className="flex-1 border-r border-slate-100 last:border-0 p-1.5 flex flex-col gap-1.5 hover:bg-indigo-50/20 transition-colors cursor-pointer min-w-0"
                >
                  {/* Danh sách các lịch trong khung giờ này — Tự động xuống dòng theo từng lịch */}
                  {cellEvents.map((event) => {
                    const isAssignment = event.eventType === "assignment";
                    const isHighlighted = highlightedEventId === event._id;

                    return (
                      <div
                        key={`${event._id}_${event.occurrenceDate || event.startDate}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event._id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(event);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl border border-l-4 ${getEventBgColor(
                          event.roomType,
                          event.status,
                          event.eventType,
                          event.assignmentStatus,
                        )} transition-all cursor-pointer overflow-hidden flex flex-col justify-center shadow-xs hover:shadow-md hover:scale-[1.01] ${
                          isHighlighted
                            ? "ring-2 ring-indigo-500 ring-offset-1 scale-[1.02] z-20 shadow-lg animate-pulse"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="shrink-0 text-slate-600">
                            {getEventIcon(event.roomType, event.eventType)}
                          </div>
                          <h4 className="font-bold text-xs leading-tight truncate text-left flex-1 min-w-0 text-slate-800">
                            {isAssignment
                              ? `${t("event_item.assignment_tag")} ${event.title}`
                              : event.title}
                          </h4>
                          {isAssignment && event.assignmentStatus && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80 shrink-0">
                              {t(`event_item.assignment_status.${event.assignmentStatus}`)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mt-0.5">
                          <span>
                            {formatEventTime(event.startDate, event.endDate)}
                          </span>
                          {(event.recurrenceRule || event.isRecurring) && (
                            <span className="flex items-center gap-0.5 text-indigo-600 font-semibold text-[9px] shrink-0">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>{t("event_item.recur_badge")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
