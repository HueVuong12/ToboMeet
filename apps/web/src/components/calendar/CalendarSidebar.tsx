"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEvent } from "./types";

interface CalendarSidebarProps {
  locale: string;
  currentDate: Date;
  onSetCurrentDate: (date: Date) => void;
  events: CalendarEvent[];
  typeFilter: string;
  onSetTypeFilter: (type: string) => void;
}

export default function CalendarSidebar({
  locale,
  currentDate,
  onSetCurrentDate,
  events,
  typeFilter,
  onSetTypeFilter,
}: CalendarSidebarProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // CN = 0, T2 = 1...

  // Tính toán lấp đầy 42 ô (6 hàng x 7 ngày)
  const cells: Date[] = [];
  const startDate = new Date(
    firstDay.getTime() - startDayOfWeek * 24 * 60 * 60 * 1000,
  );

  for (let i = 0; i < 42; i++) {
    cells.push(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000));
  }

  const filterOptions = [
    {
      value: "all",
      label: locale === "vi" ? "Tất cả cuộc họp" : "All meetings",
      color: "bg-slate-200",
    },
    {
      value: "meeting",
      label:
        locale === "vi"
          ? "Meeting (Họp nhóm)"
          : "Meeting (Group)",
      color: "bg-indigo-500",
    },
    {
      value: "classroom",
      label:
        locale === "vi"
          ? "Classroom (Lớp học)"
          : "Classroom (Class)",
      color: "bg-emerald-500",
    },
    {
      value: "livestream",
      label: "Livestream",
      color: "bg-amber-500",
    },
    {
      value: "private",
      label:
        locale === "vi"
          ? "Private (Cá nhân)"
          : "Private (Personal)",
      color: "bg-purple-500",
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-5 flex flex-col gap-6 flex-shrink-0 animate-in slide-in-from-left duration-200">
      {/* Mini Calendar */}
      <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-bold text-slate-800">
            {currentDate
              .toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                month: "long",
                year: "numeric",
              })
              .replace(/\u200E/g, "")
              .replace(/^./, (c) => c.toUpperCase())}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const prevMonth = new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth() - 1,
                  1,
                );
                onSetCurrentDate(prevMonth);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-md text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const nextMonth = new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth() + 1,
                  1,
                );
                onSetCurrentDate(nextMonth);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-md text-slate-600 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Grid 7 columns */}
        <div className="grid grid-cols-7 gap-y-1.5 text-center text-[10px] font-bold text-slate-400 mb-2">
          {locale === "vi"
            ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                <div key={d}>{d}</div>
              ))
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cellDate, idx) => {
            const isToday =
              cellDate.toDateString() === new Date().toDateString();
            const isSelected =
              cellDate.toDateString() === currentDate.toDateString();
            const isCurrentMonth = cellDate.getMonth() === currentDate.getMonth();

            // Check if date has events for showing event dot indicator
            const hasEvents = events.some(
              (ev) =>
                new Date(ev.startDate).toDateString() === cellDate.toDateString(),
            );

            return (
              <button
                key={idx}
                onClick={() => onSetCurrentDate(cellDate)}
                className={`aspect-square flex flex-col items-center justify-center rounded-full text-[11px] font-semibold transition-all relative ${
                  isSelected
                    ? "bg-indigo-600 text-white font-bold"
                    : isToday
                      ? "border border-indigo-600 text-indigo-600 font-bold"
                      : isCurrentMonth
                        ? "text-slate-800 hover:bg-slate-200/50"
                        : "text-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>{cellDate.getDate()}</span>
                {hasEvents && (
                  <span
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-indigo-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter types */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {locale === "vi" ? "Bộ lọc cuộc họp" : "Meeting Filters"}
        </h3>
        <div className="space-y-1.5">
          {filterOptions.map((item) => (
            <button
              key={item.value}
              onClick={() => onSetTypeFilter(item.value)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                typeFilter === item.value
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
