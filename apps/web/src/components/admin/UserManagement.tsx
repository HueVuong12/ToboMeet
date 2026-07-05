"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useGetAdminUsersQuery,
  AdminUserResponse,
  useUpdateUserMutation,
} from "@/lib/redux/api/adminApi";
import { Search, UserPlus, Loader2, Check, ChevronLeft, ChevronRight } from "lucide-react";
import UserListTable from "./UserListTable";
import UserDialog from "./UserDialog";
import ResetPasswordDialog from "./ResetPasswordDialog";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { createPortal } from "react-dom";

export default function UserManagement() {
  const t = useTranslations("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const { data, isLoading, isFetching, refetch } = useGetAdminUsersQuery({
    query: searchQuery,
    page: currentPage,
    limit: 10,
  });

  const users = data?.users || [];
  const totalPages = data?.totalPages || 1;
  const totalUsers = data?.total || 0;

  const [updateUser] = useUpdateUserMutation();

  // Modals state
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserResponse | null>(null);

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUserResponse | null>(null);

  // Confirm Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"danger" | "warning" | "info">("warning");
  const [confirmAction, setConfirmAction] = useState<() => Promise<void>>(() => async () => {});

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    refetch(); // Reload list
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleEditClick = (user: AdminUserResponse) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleResetPasswordClick = (user: AdminUserResponse) => {
    setResetPasswordUser(user);
    setIsResetPasswordOpen(true);
  };

  const handleToggleLockClick = (user: AdminUserResponse) => {
    const newStatus = user.status === "active" ? "locked" : "active";
    
    setConfirmTitle(newStatus === "locked" ? t("lock_confirm_title") : t("unlock_confirm_title"));
    setConfirmDesc(
      newStatus === "locked"
        ? t("lock_confirm_desc", { name: user.displayName || user.email })
        : t("unlock_confirm_desc", { name: user.displayName || user.email })
    );
    setConfirmVariant("warning");
    
    setConfirmAction(() => async () => {
      try {
        console.log(`[Frontend Log] Chuẩn bị gửi yêu cầu updateUser: id=${user.id}, newStatus=${newStatus}`);
        const res = await updateUser({
          id: user.id,
          displayName: user.displayName,
          role: user.role,
          status: newStatus,
        }).unwrap();
        console.log(`[Frontend Log] updateUser phản hồi thành công:`, res);
        setIsConfirmOpen(false);
        
        const successMsg = newStatus === "locked" ? t("lock_success") : t("unlock_success");
        if (res && res.emailWarning) {
          triggerToast(`${successMsg} ${t("warning_prefix")}${res.emailWarning}`);
        } else {
          triggerToast(successMsg);
        }
      } catch (err: any) {
        setIsConfirmOpen(false);
        triggerToast(t("error_prefix") + (err?.data?.message || err?.message));
      }
    });
    
    setIsConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t("user_management")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("user_management_desc")}
        </p>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("search_placeholder")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Add User Button */}
        <button
          onClick={() => {
            setSelectedUser(null);
            setIsUserDialogOpen(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-brand-600/10"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t("add_user")}</span>
        </button>
      </div>

      {/* User Table List */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-semibold">{t("loading_title")}</p>
        </div>
      ) : (
        <div className="relative">
          {isFetching && (
            <div className="absolute top-2 right-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-150 z-10 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("syncing")}</span>
            </div>
          )}
          <UserListTable
            users={users}
            onEdit={handleEditClick}
            onResetPassword={handleResetPasswordClick}
            onToggleLock={handleToggleLockClick}
          />
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 mt-4 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-500">
              <div>
                {t("showing_page", { page: currentPage, totalPages, total: totalUsers })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1 || isFetching}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-slate-200 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t("previous_page")}</span>
                </button>
                <button
                  disabled={currentPage >= totalPages || isFetching}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-slate-200 cursor-pointer"
                >
                  <span>{t("next_page")}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Info Add/Edit Dialog */}
      {isUserDialogOpen && (
        <UserDialog
          user={selectedUser}
          onClose={() => {
            setIsUserDialogOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={triggerToast}
        />
      )}

      {/* Reset Password Dialog */}
      {isResetPasswordOpen && resetPasswordUser && (
        <ResetPasswordDialog
          userId={resetPasswordUser.id}
          userEmail={resetPasswordUser.email}
          onClose={() => {
            setIsResetPasswordOpen(false);
            setResetPasswordUser(null);
          }}
          onSuccess={triggerToast}
        />
      )}

      {/* Confirm Dialog */}
      {isConfirmOpen && (
        <AdminConfirmDialog
          isOpen={isConfirmOpen}
          title={confirmTitle}
          description={confirmDesc}
          variant={confirmVariant}
          onConfirm={confirmAction}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}

      {/* Toast Alert */}
      {showToast &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
