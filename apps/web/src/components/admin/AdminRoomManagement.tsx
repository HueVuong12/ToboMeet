import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  Eye,
  Video,
  VideoOff,
  AlertTriangle,
  History,
  FolderOpen,
  Calendar,
  X,
  ChevronDown,
} from "lucide-react";
import {
  useGetAdminRoomsQuery,
  useGetAdminRoomStatsQuery,
} from "@/lib/redux/api/adminApi";
import RoomDetailsDialog from "./RoomDetailsDialog";
import { toast } from "sonner";

export default function AdminRoomManagement() {
  const t = useTranslations("admin");
  
  // States
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
   const [isOpenStatusDropdown, setIsOpenStatusDropdown] = useState(false);
  const [isOpenTypeDropdown, setIsOpenTypeDropdown] = useState(false);
  const [isOpenTimeRangeDropdown, setIsOpenTimeRangeDropdown] = useState(false);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!isOpenStatusDropdown && !isOpenTypeDropdown && !isOpenTimeRangeDropdown) return;
    const handleClose = () => {
      setIsOpenStatusDropdown(false);
      setIsOpenTypeDropdown(false);
      setIsOpenTimeRangeDropdown(false);
    };
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isOpenStatusDropdown, isOpenTypeDropdown, isOpenTimeRangeDropdown]);

  const toggleStatusDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpenTypeDropdown(false);
    setIsOpenTimeRangeDropdown(false);
    setIsOpenStatusDropdown(!isOpenStatusDropdown);
  };

  const toggleTypeDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpenStatusDropdown(false);
    setIsOpenTimeRangeDropdown(false);
    setIsOpenTypeDropdown(!isOpenTypeDropdown);
  };

  const toggleTimeRangeDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpenStatusDropdown(false);
    setIsOpenTypeDropdown(false);
    setIsOpenTimeRangeDropdown(!isOpenTimeRangeDropdown);
  };

  // Queries
  const { data: stats } = useGetAdminRoomStatsQuery();
  const { data: listData, isLoading, refetch } = useGetAdminRoomsQuery({
    q,
    status,
    type,
    timeRange,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 10,
    sortBy,
    sortOrder,
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const getStatusBadge = (roomStatus: string) => {
    switch (roomStatus) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "disbanded":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          {t("rooms_management_title")}
        </h1>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("rooms_total"), value: stats.total, color: "text-slate-800", bg: "bg-slate-50 border-slate-200", icon: FolderOpen },
            { label: t("rooms_active"), value: stats.active, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100", icon: Video },
            { label: t("rooms_disbanded"), value: stats.disbanded, color: "text-red-700", bg: "bg-red-50 border-red-100", icon: Trash2 },
            { label: t("rooms_reported"), value: stats.reported, color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-100", icon: AlertTriangle },
          ].map((statItem, index) => {
            const Icon = statItem.icon;
            return (
              <div key={index} className={`border rounded-2xl p-4 flex flex-col justify-between shadow-xs ${statItem.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{statItem.label}</span>
                  <Icon className={`w-4 h-4 ${statItem.color}`} />
                </div>
                <p className={`text-xl font-black mt-2 ${statItem.color}`}>{statItem.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="flex-1 bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t("rooms_search_placeholder")}
              className="w-full bg-transparent border-0 p-0 text-sm font-bold text-slate-800 focus:ring-0 focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Filter Status Custom Dropdown */}
          <div className="relative flex flex-col">
            <div 
              onClick={toggleStatusDropdown}
              className="bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2 flex flex-col justify-center cursor-pointer hover:border-slate-200 transition-colors h-[48px] select-none"
            >
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 cursor-pointer">
                {t("filter_status")}
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {status === "all" && t("filter_all")}
                  {status === "active" && t("room_status_active")}
                  {status === "disbanded" && t("room_status_disbanded")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Dropdown Options Menu */}
            {isOpenStatusDropdown && (
              <div className="absolute top-[54px] left-0 right-0 bg-white border border-slate-150 rounded-xl shadow-lg shadow-slate-100/50 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150 transform origin-top overflow-hidden">
                {[
                  { value: "all", label: t("filter_all") },
                  { value: "active", label: t("room_status_active") },
                  { value: "disbanded", label: t("room_status_disbanded") },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setStatus(option.value);
                      setPage(1);
                      setIsOpenStatusDropdown(false);
                    }}
                    className={`w-full text-left px-4 h-[42px] flex items-center text-xs transition-all duration-150 ${
                      status === option.value
                        ? "bg-brand-50/60 text-brand-700 font-bold"
                        : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Type Custom Dropdown */}
          <div className="relative flex flex-col">
            <div 
              onClick={toggleTypeDropdown}
              className="bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2 flex flex-col justify-center cursor-pointer hover:border-slate-200 transition-colors h-[48px] select-none"
            >
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 cursor-pointer">
                {t("filter_type")}
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {type === "all" && t("filter_all")}
                  {type === "meeting" && t("room_type_meeting")}
                  {type === "classroom" && t("room_type_classroom")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Dropdown Options Menu */}
            {isOpenTypeDropdown && (
              <div className="absolute top-[54px] left-0 right-0 bg-white border border-slate-150 rounded-xl shadow-lg shadow-slate-100/50 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150 transform origin-top overflow-hidden">
                {[
                  { value: "all", label: t("filter_all") },
                  { value: "meeting", label: t("room_type_meeting") },
                  { value: "classroom", label: t("room_type_classroom") },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setType(option.value);
                      setPage(1);
                      setIsOpenTypeDropdown(false);
                    }}
                    className={`w-full text-left px-4 h-[42px] flex items-center text-xs transition-all duration-150 ${
                      type === option.value
                        ? "bg-brand-50/60 text-brand-700 font-bold"
                        : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Time Range Custom Dropdown */}
          <div className="relative flex flex-col">
            <div 
              onClick={toggleTimeRangeDropdown}
              className="bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2 flex flex-col justify-center cursor-pointer hover:border-slate-200 transition-colors h-[48px] select-none"
            >
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 cursor-pointer">
                {t("filter_created")}
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  {timeRange === "all" && t("filter_all")}
                  {timeRange === "today" && t("filter_today")}
                  {timeRange === "7days" && t("filter_7days")}
                  {timeRange === "30days" && t("filter_30days")}
                  {timeRange === "custom" && t("filter_custom")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Dropdown Options Menu */}
            {isOpenTimeRangeDropdown && (
              <div className="absolute top-[54px] left-0 right-0 bg-white border border-slate-150 rounded-xl shadow-lg shadow-slate-100/50 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150 transform origin-top overflow-hidden">
                {[
                  { value: "all", label: t("filter_all") },
                  { value: "today", label: t("filter_today") },
                  { value: "7days", label: t("filter_7days") },
                  { value: "30days", label: t("filter_30days") },
                  { value: "custom", label: t("filter_custom") },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTimeRange(option.value);
                      setPage(1);
                      setIsOpenTimeRangeDropdown(false);
                    }}
                    className={`w-full text-left px-4 h-[42px] flex items-center text-xs transition-all duration-150 ${
                      timeRange === option.value
                        ? "bg-brand-50/60 text-brand-700 font-bold"
                        : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {timeRange === "custom" && (
            <div className="col-span-2 md:col-span-1 bg-slate-50 border border-slate-150 rounded-2xl px-3 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-700 focus:ring-0 focus:outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent border-0 p-0 text-xs font-bold text-slate-700 focus:ring-0 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Room Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">
                    {t("col_room_name")}
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </th>
                <th className="px-6 py-4">{t("col_room_code")}</th>
                <th className="px-6 py-4">{t("col_room_host")}</th>
                <th className="px-6 py-4">{t("col_room_type")}</th>
                <th className="px-6 py-4 text-center">{t("col_room_members")}</th>
                <th className="px-6 py-4">{t("col_room_status")}</th>
                <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort("createdAt")}>
                  <span className="flex items-center gap-1">
                    {t("col_room_created")}
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </span>
                </th>
                <th className="px-6 py-4 text-center">{t("col_room_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {t("loading_title")}
                  </td>
                </tr>
              ) : !listData || listData.rooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {t("no_rooms_found")}
                  </td>
                </tr>
              ) : (
                listData.rooms.map((room: any) => (
                  <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 max-w-[150px] truncate">{room.name}</td>
                    <td className="px-6 py-4 font-mono font-black text-slate-600">{room.code}</td>
                    <td className="px-6 py-4 max-w-[140px] truncate">{room.owner.displayName}</td>
                    <td className="px-6 py-4">
                      {room.type === "classroom" ? t("room_type_classroom") : t("room_type_meeting")}
                    </td>
                    <td className="px-6 py-4 text-center">{room.membersCount}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusBadge(room.status)}`}>
                        {t(`room_status_${room.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(room.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 text-center flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedRoomId(room.id)}
                        className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title={t("room_detail")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {listData && listData.totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-bold">
              {t("showing_page", { page, totalPages: listData.totalPages, total: listData.total })}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[11px] disabled:opacity-50 cursor-pointer"
              >
                {t("previous_page")}
              </button>
              <button
                disabled={page === listData.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[11px] disabled:opacity-50 cursor-pointer"
              >
                {t("next_page")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Room Details Dialog */}
      {selectedRoomId && (
        <RoomDetailsDialog
          roomId={selectedRoomId}
          onClose={() => {
            setSelectedRoomId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
