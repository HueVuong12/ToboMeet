"use client";

import { useState } from "react";
import { useGetAdminStatsQuery } from "@/lib/redux/api/adminApi";
import { Loader2, ArrowLeft, LayoutDashboard, Users, Menu, X, ChevronLeft, ChevronRight, Video, FolderOpen } from "lucide-react";
import StoreProvider from "@/lib/redux/StoreProvider";
import AdminDashboardHeader from "@/components/admin/AdminDashboardHeader";
import AdminStatsGrid from "@/components/admin/AdminStatsGrid";
import AdminUsageChart from "@/components/admin/AdminUsageChart";
import AdminRecentActivity from "@/components/admin/AdminRecentActivity";
import UserManagement from "@/components/admin/UserManagement";
import AdminRoomManagement from "@/components/admin/AdminRoomManagement";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

function AdminDashboardContent() {
  const router = useRouter();
  const t = useTranslations("admin");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "rooms">("overview");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const { data: stats, isLoading, isFetching, refetch } = useGetAdminStatsQuery(undefined, {
    skip: activeTab !== "overview",
  });

  if (isLoading && activeTab === "overview") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500 font-semibold">{t("loading_title")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-lg transform rotate-3 shadow-sm"></div>
            <div className="absolute inset-0 bg-brand-500 blur-sm opacity-40 rounded-lg"></div>
            <div className="relative z-10 text-white">
              <Video size={15} strokeWidth={2.5} />
            </div>
          </div>
          <span className="text-lg font-black tracking-tighter text-navy leading-none">
            Tobo<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">Meet</span>
          </span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Drawer overlay on mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sticky/Fixed Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen bg-white border-r border-slate-200 z-50 flex flex-col transition-all duration-300 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "w-16" : "w-60"}`}
      >
        {/* Sidebar Brand header */}
        <div className="relative flex items-center justify-center px-4 py-5 border-b border-slate-100 h-16 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-lg transform rotate-3 shadow-sm"></div>
                <div className="absolute inset-0 bg-brand-500 blur-sm opacity-40 rounded-lg"></div>
                <div className="relative z-10 text-white">
                  <Video size={15} strokeWidth={2.5} />
                </div>
              </div>
              <span className="text-[20px] font-black tracking-tighter text-navy leading-none">
                Tobo<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">Meet</span>
              </span>
            </div>
          ) : (
            <div className="relative flex h-8 w-8 items-center justify-center mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-lg shadow-sm"></div>
              <div className="relative z-10 text-white">
                <Video size={15} strokeWidth={2.5} />
              </div>
            </div>
          )}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden absolute right-4 p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => {
              setActiveTab("overview");
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-brand-100 ${
              activeTab === "overview"
                ? "bg-brand-50 text-brand-600"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>{t("title")}</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab("users");
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-brand-100 ${
              activeTab === "users"
                ? "bg-brand-50 text-brand-600"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Users className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>{t("user_management")}</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab("rooms");
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-brand-100 ${
              activeTab === "rooms"
                ? "bg-brand-50 text-brand-600"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <FolderOpen className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>{t("rooms_management_title")}</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 space-y-1.5 shrink-0">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </button>

          {/* Collapse/Expand Toggle (Desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all focus:outline-none"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span>Thu gọn</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {activeTab === "overview" ? (
            <>
              {/* Header */}
              <AdminDashboardHeader
                onRefresh={refetch}
                isFetching={isFetching}
              />

              {stats && (
                <div className="space-y-8 mt-6">
                  {/* Stats Cards Grid */}
                  <AdminStatsGrid
                    totalUsers={stats.totalUsers}
                    onlineUsers={stats.onlineUsers}
                    activeMeetings={stats.activeMeetings}
                    totalMeetings={stats.totalMeetings}
                    roomsCreatedToday={stats.roomsCreatedToday}
                    averageMeetingDuration={stats.averageMeetingDuration}
                  />

                  {/* Usage Chart */}
                  <AdminUsageChart data={stats.chartData} />

                  {/* Recent Activities */}
                  <AdminRecentActivity
                    recentRooms={stats.recentRooms}
                    recentMeetings={stats.recentMeetings}
                  />
                </div>
              )}
            </>
          ) : activeTab === "users" ? (
            <div className="mt-2">
              <UserManagement />
            </div>
          ) : (
            <div className="mt-2">
              <AdminRoomManagement />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <StoreProvider>
      <AdminDashboardContent />
    </StoreProvider>
  );
}
