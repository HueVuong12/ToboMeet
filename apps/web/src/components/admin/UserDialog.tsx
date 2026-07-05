"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCreateUserMutation, useUpdateUserMutation, AdminUserResponse } from "@/lib/redux/api/adminApi";
import { Loader2, X, User } from "lucide-react";

interface UserDialogProps {
  user?: AdminUserResponse | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function UserDialog({
  user,
  onClose,
  onSuccess,
}: UserDialogProps) {
  const t = useTranslations("admin");
  const isEdit = !!user;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [status, setStatus] = useState<"active" | "locked">("active");

  const [error, setError] = useState<string | null>(null);

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setRole(user.role === "admin" ? "admin" : "user");
      setStatus(user.status);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isEdit && user) {
        const res = await updateUser({
          id: user.id,
          displayName: user.displayName,
          role,
          status,
        }).unwrap();
        if (res && res.emailWarning) {
          onSuccess(`${t("update_success")} ${t("warning_prefix")}${res.emailWarning}`);
        } else {
          onSuccess(t("update_success"));
        }
      } else {
        const autoDisplayName = email.split("@")[0] || t("new_member");
        await createUser({
          email: email.trim(),
          password: password.trim() || undefined,
          displayName: autoDisplayName,
          role,
        }).unwrap();
        onSuccess(t("create_success"));
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || t("default_error"));
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            <span>{isEdit ? t("edit_info") : t("add_user")}</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors disabled:opacity-50"
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t("password")}
              </label>
              <input
                type="password"
                placeholder={t("password_placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
              />
            </div>
          )}



          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t("role")}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {isEdit && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t("status")}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                >
                  <option value="active">Active</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {t("cancel_action")}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-brand-600/10"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? t("update") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
