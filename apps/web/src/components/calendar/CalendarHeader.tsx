"use client";

import { useState, useRef, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  X,
  Menu,
  CalendarDays,
  Users2,
  Clock,
} from "lucide-react";
import { CalendarEvent, CalendarViewType, getEventIcon } from "./types";

interface CalendarHeaderProps {
  locale: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentDate: Date;
  onSetCurrentDate: (date: Date) => void;
  view: CalendarViewType;
  onSetView: (view: CalendarViewType) => void;
  // Search
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchResults: CalendarEvent[];
  searchLoading: boolean;
  onSelectSearchEvent: (event: CalendarEvent) => void;
  // Create actions
  onOpenCreateEventModal: () => void;
  onOpenChannelMeetingModal: () => void;
}

export default function CalendarHeader({
  locale,
  sidebarOpen,
  onToggleSidebar,
  currentDate,
  onSetCurrentDate,
  view,
  onSetView,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  onSelectSearchEvent,
  onOpenCreateEventModal,
  onOpenChannelMeetingModal,
}: CalendarHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Auto focus search input
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearch(false);
      }
    };
    if (showSearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch]);

  return (
    <div className="h-[72px] bg-white border-b border-slate-200/60 flex items-center flex-shrink-0 z-35">
      {/* LEFT: Cố định = độ rộng sidebar (w-64 = 256px) — Menu + Lịch */}
      <div className="w-64 flex-shrink-0 flex items-center gap-3 px-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-[17px] sm:text-lg font-bold text-slate-800 tracking-tight">
            {locale === "vi" ? "Lịch" : "Calendar"}
          </span>
        </div>
      </div>

      {/* RIGHT: flex-1 — tháng/năm + view switcher + điều hướng + tạo lịch */}
      <div className="flex-1 flex items-center justify-between pl-[46px] lg:pl-[54px] pr-4 lg:pr-6 gap-4">
        {/* Tháng/năm — thẳng hàng với đường kẻ phân cách */}
        <h2 className="text-[20px] font-bold text-slate-800 tracking-tight truncate">
          {currentDate
            .toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
              month: "long",
              year: "numeric",
            })
            .replace(/\u200E/g, "")
            .replace(/^./, (c) => c.toUpperCase())}
        </h2>

        {/* Giữa: Bộ chuyển đổi View */}
        <div className="hidden lg:flex justify-center">
          <div className="flex bg-slate-100/70 p-1 rounded-full shadow-inner">
            {(["day", "week", "month", "agenda"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onSetView(v)}
                className={`px-5 py-1.5 rounded-full text-[13px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  view === v
                    ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {v === "day" && (locale === "vi" ? "Ngày" : "Day")}
                {v === "week" && (locale === "vi" ? "Tuần" : "Week")}
                {v === "month" && (locale === "vi" ? "Tháng" : "Month")}
                {v === "agenda" && (locale === "vi" ? "Năm" : "Year")}
              </button>
            ))}
          </div>
        </div>

        {/* Phải: Điều hướng + Nút Tạo */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Search Component */}
          <div
            ref={searchContainerRef}
            className="relative w-9 h-9 flex items-center justify-center shrink-0"
          >
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              title={locale === "vi" ? "Tìm kiếm" : "Search"}
            >
              <Search className="w-5 h-5" />
            </button>

            {showSearch && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col z-[61]">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm w-40 animate-in fade-in slide-in-from-right-4 duration-200">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder={locale === "vi" ? "Tìm kiếm" : "Search"}
                    className="w-full bg-transparent text-sm text-slate-800 focus:outline-none placeholder-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => onSearchQueryChange("")}
                      className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Kết quả Tìm kiếm */}
                {searchQuery.trim() !== "" && (
                  <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] w-60 max-h-64 overflow-y-auto divide-y divide-slate-100 py-1">
                    {searchLoading ? (
                      <div className="px-4 py-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {locale === "vi" ? "Đang tìm kiếm..." : "Searching..."}
                        </span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 text-center">
                        {locale === "vi"
                          ? "Không tìm thấy kết quả"
                          : "No results found"}
                      </div>
                    ) : (
                      searchResults.map((ev) => (
                        <div
                          key={ev._id}
                          onClick={() => {
                            onSelectSearchEvent(ev);
                            setShowSearch(false);
                          }}
                          className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3"
                        >
                          <div className="mt-0.5 text-indigo-500">
                            {getEventIcon(ev.roomType)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {ev.title}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(ev.startDate).toLocaleString(
                                  locale === "vi" ? "vi-VN" : "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cụm nút điều hướng */}
          <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
            <button
              onClick={() => onSetCurrentDate(new Date())}
              className="px-4 py-1.5 hover:bg-white rounded-full text-[13px] font-bold text-slate-700 transition-all shadow-sm"
            >
              {locale === "vi" ? "Hôm nay" : "Today"}
            </button>
            <div className="w-[1px] h-4 bg-slate-200 mx-1 hidden sm:block"></div>
            <button
              onClick={() => {
                const temp = new Date(currentDate);
                if (view === "month") temp.setMonth(temp.getMonth() - 1);
                else if (view === "agenda")
                  temp.setFullYear(temp.getFullYear() - 1);
                else temp.setDate(temp.getDate() - 7);
                onSetCurrentDate(temp);
              }}
              className="p-1.5 hover:bg-white rounded-full text-slate-600 transition-all hidden sm:block"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const temp = new Date(currentDate);
                if (view === "month") temp.setMonth(temp.getMonth() + 1);
                else if (view === "agenda")
                  temp.setFullYear(temp.getFullYear() + 1);
                else temp.setDate(temp.getDate() + 7);
                onSetCurrentDate(temp);
              }}
              className="p-1.5 hover:bg-white rounded-full text-slate-600 transition-all hidden sm:block"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nút Tạo Lịch — dropdown Sự kiện / Cuộc họp kênh */}
          <div className="relative">
            <button
              onClick={() => setShowCreateDropdown((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-5 sm:py-2.5 rounded-full bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-600 active:scale-[0.97] transition-all duration-150 shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">
                {locale === "vi" ? "Tạo lịch" : "Create"}
              </span>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Dropdown menu */}
            {showCreateDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={() => setShowCreateDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-slate-100 py-1.5 z-[70] animate-in fade-in zoom-in-95 duration-150">
                  {/* Option 1: Sự kiện */}
                  <button
                    onClick={() => {
                      setShowCreateDropdown(false);
                      onOpenCreateEventModal();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xl mx-auto text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {locale === "vi" ? "Sự kiện" : "Event"}
                      </p>
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1 mx-3" />

                  {/* Option 2: Cuộc họp kênh */}
                  <button
                    onClick={() => {
                      setShowCreateDropdown(false);
                      onOpenChannelMeetingModal();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xl mx-auto text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Users2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {locale === "vi" ? "Cuộc họp kênh" : "Channel meeting"}
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
