"use client";

import { CalendarEvent } from "./types";

interface YearViewProps {
  locale: string;
  currentDate: Date;
  events: CalendarEvent[];
  onSelectDate: (date: Date) => void;
}

export default function YearView({
  locale,
  currentDate,
  events,
  onSelectDate,
}: YearViewProps) {
  const year = currentDate.getFullYear();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
      {Array.from({ length: 12 }).map((_, monthIdx) => {
        const firstDayOfMonth = new Date(year, monthIdx, 1);
        const monthName = firstDayOfMonth
          .toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
            month: "long",
          })
          .replace(/\u200E/g, "")
          .replace(/^./, (c) => c.toUpperCase());
        const startDayOfWeek = firstDayOfMonth.getDay();

        const monthDays: Date[] = [];
        const startOfGrid = new Date(
          firstDayOfMonth.getTime() - startDayOfWeek * 24 * 60 * 60 * 1000,
        );
        for (let i = 0; i < 42; i++) {
          monthDays.push(
            new Date(startOfGrid.getTime() + i * 24 * 60 * 60 * 1000),
          );
        }

        return (
          <div
            key={monthIdx}
            className="border border-slate-100 rounded-xl p-3 bg-slate-50/30"
          >
            <h4 className="text-xs font-bold text-slate-800 capitalize mb-3">
              {monthName}
            </h4>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[9px] font-bold text-slate-400 mb-1.5">
              {locale === "vi"
                ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                    <div key={d}>{d}</div>
                  ))
                : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {monthDays.map((cellDate, idx) => {
                const isToday =
                  cellDate.toDateString() === new Date().toDateString();
                const isSelected =
                  cellDate.toDateString() === currentDate.toDateString();
                const isCurrentMonth = cellDate.getMonth() === monthIdx;

                const hasEvents = events.some(
                  (ev) =>
                    new Date(ev.startDate).toDateString() ===
                    cellDate.toDateString(),
                );

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectDate(cellDate)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-full text-[10px] font-semibold transition-all relative ${
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
                        className={`absolute bottom-0.5 w-0.5 h-0.5 rounded-full ${
                          isSelected ? "bg-white" : "bg-indigo-500"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
