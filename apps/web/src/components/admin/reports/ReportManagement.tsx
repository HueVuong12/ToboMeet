import { useState, useCallback } from "react";
import { Flag, LayoutDashboard, List, Home } from "lucide-react";
import { useGetAdminReportsQuery, useGetAdminRoomReportsQuery } from "@/lib/redux/api/adminApi";
import { AdminReportListItem, AdminReportFilters } from "@/lib/redux/api/adminApi";
import ReportDashboard from "./ReportDashboard";
import ReportListTable from "./ReportListTable";
import RoomReportListTable from "./RoomReportListTable";
import ReportFilters, { ReportFilterState, DEFAULT_FILTERS } from "./ReportFilters";
import ReportSearchBar from "./ReportSearchBar";
import ReportDetailModal from "./ReportDetailModal";
import RoomReportDetailModal from "./RoomReportDetailModal";
import ReportExportMenu from "./ReportExportMenu";
import ReportToast, { ToastType } from "./ReportToast";
import { useTranslations } from "next-intl";

type SubTab = "dashboard" | "list" | "rooms";

interface Props {
  onNavigateToUsers?: (userId?: string) => void;
}

export default function ReportManagement({ onNavigateToUsers }: Props) {
  const t = useTranslations("admin.reports");
  const [subTab, setSubTab] = useState<SubTab>("dashboard");
  const [page, setPage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedRoomReportId, setSelectedRoomReportId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
  }, []);

  // Build query params
  const queryParams: AdminReportFilters = {
    page,
    limit: 10,
    search: search || undefined,
    status: filters.status || undefined,
    reason: filters.reason || undefined,
    hasEvidence: filters.hasEvidence || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isFetching } = useGetAdminReportsQuery(queryParams, {
    skip: subTab !== "list",
  });

  const { data: roomReportsData, isLoading: isRoomsLoading, isFetching: isRoomsFetching } = useGetAdminRoomReportsQuery({
    page: roomPage,
    limit: 10,
    status: filters.status || undefined,
    search: search || undefined,
  }, {
    skip: subTab !== "rooms",
  });

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const handleFilterChange = (f: ReportFilterState) => {
    setFilters(f);
    setPage(1);
    setRoomPage(1);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    setRoomPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {t("title", { fallback: "Quản lý báo cáo vi phạm" })}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {t("subtitle", { fallback: "Xem xét các báo cáo vi phạm chính sách của người dùng và phòng họp trực tuyến." })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subTab === "list" && (
            <ReportExportMenu filters={queryParams} />
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab("dashboard")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === "dashboard"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          {t("tab_overview", { fallback: "Tổng quan" })}
        </button>
        <button
          onClick={() => setSubTab("list")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === "list"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <List className="w-4 h-4" />
          {t("tab_user_reports", { fallback: "Báo cáo người dùng" })}
          {data?.total ? (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-600 text-[11px] font-bold">
              {data.total}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setSubTab("rooms")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            subTab === "rooms"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Home className="w-4 h-4" />
          {t("tab_room_reports", { fallback: "Báo cáo phòng" })}
          {roomReportsData?.total ? (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[11px] font-bold">
              {roomReportsData.total}
            </span>
          ) : null}
        </button>
      </div>

      {/* Content */}
      {subTab === "dashboard" ? (
        <ReportDashboard />
      ) : subTab === "list" ? (
        <div className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <ReportSearchBar value={search} onChange={handleSearch} />
          </div>
          <ReportFilters filters={filters} onChange={handleFilterChange} />

          {/* Table */}
          <ReportListTable
            reports={data?.reports || []}
            total={data?.total || 0}
            page={page}
            totalPages={data?.totalPages || 1}
            isLoading={isLoading || isFetching}
            onPageChange={setPage}
            onViewReport={(r: AdminReportListItem) => setSelectedReportId(r._id)}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <ReportSearchBar value={search} onChange={handleSearch} />
          </div>
          <ReportFilters filters={filters} onChange={handleFilterChange} />

          {/* Room Report Table */}
          <RoomReportListTable
            reports={roomReportsData?.reports || []}
            total={roomReportsData?.total || 0}
            page={roomPage}
            totalPages={roomReportsData?.totalPages || 1}
            isLoading={isRoomsLoading || isRoomsFetching}
            onPageChange={setRoomPage}
            onViewReport={(r: any) => setSelectedRoomReportId(r._id)}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        </div>
      )}

      {/* Detail Modal Báo cáo người dùng */}
      {selectedReportId && (
        <ReportDetailModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
          onViewUser={(userId) => {
            setSelectedReportId(null);
            onNavigateToUsers?.(userId);
          }}
          onSuccess={(msg) => showToast(msg, "success")}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {/* Detail Modal Báo cáo phòng họp */}
      {selectedRoomReportId && (
        <RoomReportDetailModal
          reportId={selectedRoomReportId}
          onClose={() => setSelectedRoomReportId(null)}
          onSuccess={(msg) => showToast(msg, "success")}
        />
      )}

      {/* Toast */}
      {toast && (
        <ReportToast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
