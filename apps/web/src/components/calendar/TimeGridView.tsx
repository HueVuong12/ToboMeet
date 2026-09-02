"use client";

import React from "react";
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

  const hoursRange = Array.from({ length: 23 }, (_, i) => i + 1); // 1 AM đến 11 PM

  // Tính toán vị trí tuyệt đối của Event Card trong lưới Grid
  const getEventPositionStyles = (event: CalendarEvent) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    let startHour = start.getHours() + start.getMinutes() / 60;
    let endHour = end.getHours() + end.getMinutes() / 60;

    // Đối với Assignment: Hiển thị marker nhỏ gọn cắm tại đúng mốc giờ deadline, không kéo dài
    if (event.eventType === "assignment") {
      const displayStart = Math.max(1, Math.min(23, startHour));
      const top = (displayStart - 1) * 64;
      const finalHeight = 36;
      return {
        top: `${top}px`,
        height: `${finalHeight}px`,
      };
    }

    if (end.toDateString() !== start.toDateString()) {
      endHour = 23;
    }

    const displayStart = Math.max(1, Math.min(23, startHour));
    const displayEnd = Math.max(1, Math.min(23, endHour));
    const durationHours = Math.max(0.5, displayEnd - displayStart);

    const top = (displayStart - 1) * 64;
    const height = durationHours * 64;

    const finalHeight = Math.max(38, height - 4);
    const offsetTop = (height - finalHeight) / 2;

    return {
      top: `${top + offsetTop}px`,
      height: `${finalHeight}px`,
    };
  };

  // Tính toán layout chiều ngang (left, width) cho các sự kiện bị trùng giờ song song
  const getEventsLayout = (dayEvents: CalendarEvent[]) => {
    interface EventLayout {
      left: string;
      width: string;
    }
    const layouts: Record<string, EventLayout> = {};
    if (dayEvents.length === 0) return layouts;

    const sorted = [...dayEvents].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const groups: CalendarEvent[][] = [];
    let currentGroup: CalendarEvent[] = [];
    let groupEnd = 0;

    for (const event of sorted) {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate).getTime();

      if (currentGroup.length === 0 || start < groupEnd) {
        currentGroup.push(event);
        groupEnd = Math.max(groupEnd, end);
      } else {
        groups.push(currentGroup);
        currentGroup = [event];
        groupEnd = end;
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    for (const group of groups) {
      const columns: CalendarEvent[][] = [];

      for (const event of group) {
        let placed = false;
        const start = new Date(event.startDate).getTime();

        for (let i = 0; i < columns.length; i++) {
          const lastInCol = columns[i][columns[i].length - 1];
          const lastEnd = new Date(lastInCol.endDate).getTime();

          if (start >= lastEnd) {
            columns[i].push(event);
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([event]);
        }
      }

      const totalCols = columns.length;
      for (let colIdx = 0; colIdx < totalCols; colIdx++) {
        for (const event of columns[colIdx]) {
          const widthPercent = 100 / totalCols;
          const leftPercent = colIdx * widthPercent;

          layouts[event._id] = {
            left: `calc(${leftPercent}% + 1.5px)`,
            width: `calc(${widthPercent}% - 3px)`,
          };
        }
      }
    }

    return layouts;
  };

  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", eventId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="min-w-[800px] bg-white border border-slate-200 rounded-2xl shadow-sm relative"
      style={{ height: `${23 * 64 + 48}px` }}
    >
      {/* Grid Header */}
      <div className="flex border-b border-slate-100 h-12 items-center bg-white sticky top-0 z-30 rounded-t-2xl">
        <div className="w-20 text-center text-xs font-bold text-slate-400 border-r border-slate-100 bg-white sticky left-0 z-30 h-full flex items-center justify-center">
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

      {/* Grid Body */}
      <div className="flex relative" style={{ height: `${23 * 64}px` }}>
        {/* Time labels column */}
        <div className="w-20 border-r border-slate-100 flex flex-col bg-white sticky left-0 z-20">
          {hoursRange.map((hour) => (
            <div
              key={hour}
              className="h-16 flex justify-center items-start pt-2 border-b border-slate-50 text-[11px] font-bold text-slate-400 bg-white"
            >
              {hour > 12
                ? `${hour - 12} PM`
                : hour === 12
                  ? "12 PM"
                  : `${hour} AM`}
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {displayedDays.map((dayDate, colIdx) => (
          <div
            key={colIdx}
            className="flex-1 border-r border-slate-100 last:border-0 relative h-full flex flex-col overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const hourOffset = Math.floor(y / 64) + 1; // Bắt đầu từ 1 AM
              const eventId = e.dataTransfer.getData("text/plain");
              if (eventId) {
                onDropEvent(eventId, dayDate, hourOffset);
              }
            }}
          >
            {/* Time cell slots */}
            {hoursRange.map((hour) => (
              <div
                key={hour}
                onClick={() => onCellClick(dayDate, hour)}
                className="h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
              />
            ))}

            {/* Absolutely positioned events */}
            {(() => {
              const dayEvents = filteredEvents.filter(
                (ev) =>
                  new Date(ev.startDate).toDateString() === dayDate.toDateString()
              );
              const layouts = getEventsLayout(dayEvents);

              return dayEvents.map((event) => {
                const { top, height } = getEventPositionStyles(event);
                const layout = layouts[event._id] || {
                  left: "1.5px",
                  width: "calc(100% - 3px)",
                };

                return (
                  <div
                    key={event._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, event._id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    style={{
                      top,
                      minHeight: height,
                      left: layout.left,
                      width: layout.width,
                    }}
                    className={`absolute h-auto px-3 py-1.5 rounded-xl border border-l-4 ${getEventBgColor(
                      event.roomType,
                      event.status,
                      event.eventType,
                      event.assignmentStatus
                    )} transition-all cursor-pointer overflow-hidden flex flex-col ${
                      parseFloat(height) > 48
                        ? "justify-between"
                        : "justify-center"
                    } z-10 hover:z-30 hover:shadow-md ${
                      highlightedEventId === event._id
                        ? "ring-4 ring-indigo-500 ring-offset-2 scale-105 z-50 shadow-xl animate-pulse"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="shrink-0">
                          {getEventIcon(event.roomType, event.eventType)}
                        </div>
                        <h4 className="font-bold text-xs leading-tight truncate text-left flex-1 min-w-0">
                          {event.eventType === "assignment" ? `[Nhiệm vụ] ${event.title}` : event.title}
                        </h4>
                        {event.eventType === "assignment" && event.assignmentStatus && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80 shrink-0">
                            {event.assignmentStatus === "submitted"
                              ? "Đã nộp"
                              : event.assignmentStatus === "graded"
                              ? "Đã chấm"
                              : event.assignmentStatus === "overdue"
                              ? "Quá hạn"
                              : event.assignmentStatus === "closed"
                              ? "Đã đóng"
                              : "Đang làm"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
