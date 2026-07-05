"use client";

import { useTranslations } from "next-intl";
import { AdminUserResponse, useUpdateUserMutation } from "@/lib/redux/api/adminApi";
import { Edit2, Key, ShieldAlert, ShieldCheck, Shield, Calendar } from "lucide-react";

interface UserListTableProps {
  users: AdminUserResponse[];
  onEdit: (user: AdminUserResponse) => void;
  onResetPassword: (user: AdminUserResponse) => void;
  onToggleLock: (user: AdminUserResponse) => void;
}

export default function UserListTable({
  users = [],
  onEdit,
  onResetPassword,
  onToggleLock,
}: UserListTableProps) {
  const t = useTranslations("admin");

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t("user_name")}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t("role")}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t("status")}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t("created_at")}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400 font-medium">
                  {t("no_data")}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs uppercase">
                        {user.displayName?.substring(0, 2) || "U"}
                      </div>
                      <span>{user.displayName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                        user.role === "admin"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : user.role === "moderator"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        user.status === "active"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {user.status === "active" ? "Active" : "Locked"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(user.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-1.5 whitespace-nowrap">
                    {/* Sửa */}
                    <button
                      onClick={() => onEdit(user)}
                      className="inline-flex items-center p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
                      title={t("edit_info")}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Đổi mật khẩu */}
                    <button
                      onClick={() => onResetPassword(user)}
                      className="inline-flex items-center p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
                      title={t("reset_password")}
                    >
                      <Key className="w-4 h-4" />
                    </button>

                    {/* Khóa/Mở khóa */}
                    <button
                      onClick={() => onToggleLock(user)}
                      className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                        user.status === "active"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-600"
                          : "bg-green-50 hover:bg-green-100 text-green-600"
                      }`}
                      title={user.status === "active" ? t("lock_account") : t("unlock_account")}
                    >
                      {user.status === "active" ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
