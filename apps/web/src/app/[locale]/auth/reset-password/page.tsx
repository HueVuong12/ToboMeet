"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const t = useTranslations("admin");
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setIsLoading(false);

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        // Đăng xuất để xóa session hiện tại sau khi đổi mật khẩu
        await supabase.auth.signOut();
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || "Đã xảy ra lỗi khi cập nhật mật khẩu.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 bg-white shadow-xl rounded-3xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 mb-4">
            <Lock className="text-indigo-600 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            Đặt lại mật khẩu
          </h2>
          <p className="text-slate-500 text-sm">
            Nhập mật khẩu mới cho tài khoản của bạn để hoàn tất quá trình khôi phục.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-500 mb-2">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Đổi mật khẩu thành công!
            </p>
            <p className="text-xs text-slate-400 animate-pulse">
              Đang chuyển hướng về trang đăng nhập...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mật khẩu mới
              </label>
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-white transition-all focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none outline-none px-4 py-3 text-sm text-slate-800"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Xác nhận mật khẩu
              </label>
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-white transition-all focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-none outline-none px-4 py-3 text-sm text-slate-800"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-75 text-white font-semibold rounded-xl transition-all shadow-md shadow-brand-600/10 cursor-pointer"
            >
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Cập nhật mật khẩu
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
