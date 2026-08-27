"use client";

import { useTranslations } from "next-intl";
import { ChangePasswordForm } from "./password/ChangePasswordForm";

export function PasswordSettings() {
  const t = useTranslations("settings.password");

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6 animate-fade-in">
      {/* Tieu de Tab */}
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">
          {t("header")}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{t("desc")}</p>
      </div>

      {/* Form doi mat khau */}
      <ChangePasswordForm />
    </div>
  );
}
