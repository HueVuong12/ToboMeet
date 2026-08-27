"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function LanguageSwitcher() {
  const t = useTranslations("header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  };

  const flags: Record<string, string> = { vi: "🇻🇳", en: "🇺🇸" };
  const labels: Record<string, string> = { vi: t("lang_vi"), en: t("lang_en") };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 rounded-full text-[13px] font-semibold text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors"
      >
        <span>{flags[locale]}</span>
        <span className="hidden sm:block">{labels[locale]}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-20 w-40 rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            {["vi", "en"].map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold transition-colors
                  ${
                    locale === loc
                      ? "bg-brand-50 text-brand-600"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <span>{flags[loc]}</span>
                <span>{labels[loc]}</span>
                {locale === loc && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
