"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useGetSessionsQuery, useRevokeSessionMutation, UserSession } from "@/lib/redux/api/usersApi";
import {
  X, Globe, Globe2, Check, Monitor, Smartphone, Laptop,
  Loader2, LogOut, ShieldAlert, MoreVertical,
  Clock, Wifi, Shield, ArrowRight, MapPin
} from "lucide-react";
import { useConfirm } from "@/providers/ConfirmProvider";
import { toast } from "sonner";

interface SettingsDialogProps {
  onClose: () => void;
}

type Tab = "language" | "devices";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeviceIcon(session: UserSession) {
  const os = (session.os || "").toLowerCase();
  const browser = (session.browser || "").toLowerCase();

  if (session.isMobile || os.includes("android") || os.includes("ios") || os.includes("iphone") || os.includes("ipad")) {
    return "mobile";
  }
  if (os.includes("mac") || os.includes("macos")) return "mac";
  if (browser.includes("chrome") && !session.isDesktop) return "chrome";
  return "desktop";
}

function DeviceIcon({ session, size = "md" }: { session: UserSession; size?: "sm" | "md" | "lg" }) {
  const type = getDeviceIcon(session);
  const sizeClass = size === "lg" ? "w-6 h-6" : size === "sm" ? "w-4 h-4" : "w-5 h-5";

  if (type === "mobile") return <Smartphone className={sizeClass} />;
  if (type === "mac") return <Laptop className={sizeClass} />;
  if (type === "chrome") return <Globe2 className={sizeClass} />;
  return <Monitor className={sizeClass} />;
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getRelativeTime(dateStr: string, locale: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (locale === "vi") {
      if (minutes < 1) return "Vừa xong";
      if (minutes < 60) return `${minutes} phút trước`;
      if (hours < 24) return `${hours} giờ trước`;
      if (days === 1) return "Hôm qua";
      return `${days} ngày trước`;
    } else {
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return "Yesterday";
      return `${days}d ago`;
    }
  } catch {
    return dateStr;
  }
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 py-3 bg-white animate-pulse">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 bg-slate-100 rounded-full w-2/5" />
        <div className="h-2 bg-slate-100 rounded-full w-3/5" />
      </div>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0" />
    </div>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

// ─── Device Popover ───────────────────────────────────────────────────────────
function DevicePopover({
  session,
  onRevoke,
  isRevoking,
  currentLocale,
  t,
}: {
  session: UserSession;
  onRevoke?: () => void;
  isRevoking: boolean;
  currentLocale: string;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all duration-150 active:scale-95"
        title={t("devices.action_details")}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 bg-white rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.12)] border border-slate-100 overflow-hidden animate-scale-in origin-top-right">
          {/* Details section */}
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t("devices.action_details")}</p>

            <DetailRow
              label={t("devices.detail_login_time")}
              value={formatDate(session.createdAt, currentLocale)}
            />
            <DetailRow
              label={t("devices.detail_last_active")}
              value={formatDate(session.updatedAt, currentLocale)}
            />
            <DetailRow
              label={t("devices.detail_os")}
              value={session.os || t("devices.unknown")}
            />
            <DetailRow
              label={t("devices.detail_browser")}
              value={session.browser || t("devices.unknown")}
            />
            <DetailRow
              label={t("devices.detail_ip")}
              value={session.ip || t("devices.unknown")}
            />
            {/* Vị trí địa lý từ geolocation */}
            <DetailRow
              label={t("devices.detail_location")}
              value={
                session.city && session.country
                  ? `${session.city}, ${session.country}`
                  : session.country
                  || t("devices.location_unknown")
              }
            />
          </div>

          {/* Logout button — only for non-current */}
          {!session.isCurrent && !session.loggedOutAt && onRevoke && (
            <>
              <div className="h-px bg-slate-100 mx-4" />
              <div className="p-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    onRevoke();
                  }}
                  disabled={isRevoking}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-150 text-sm font-semibold disabled:opacity-50 active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {t("devices.logout_device")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Device List Item (Mobile Zalo Style) ───────────────────────────────────────
function DeviceListItem({
  session,
  onRevoke,
  isRevoking,
  currentLocale,
  t,
}: {
  session: UserSession;
  onRevoke?: () => void;
  isRevoking: boolean;
  currentLocale: string;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const isCurrent = session.isCurrent;
  const relativeTime = getRelativeTime(session.updatedAt, currentLocale);

  // Ưu tiên deviceName từ backend ("Chrome trên Windows"), fallback: ghép browser + os
  const displayName =
    session.deviceName ||
    (session.browser && session.os && session.os !== "Không rõ"
      ? `${session.browser} trên ${session.os}`
      : session.browser || t("devices.unknown"));

  // Dịch loginMethod sang tên thân thiện
  const getMethodName = (method: string) => {
    if (!method) return t("devices.method_password");
    const m = method.toLowerCase();
    if (m === "google") return t("devices.method_google");
    if (m === "password" || m === "email") return t("devices.method_password");
    if (m === "otp") return t("devices.method_otp");
    // Capitalize first letter cho các method khác (github, apple, microsoft...)
    return method.charAt(0).toUpperCase() + method.slice(1);
  };

  return (
    <div className="flex items-start gap-4 py-3.5 group select-none">
      {/* Device Icon Circle */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border
          ${isCurrent 
            ? "bg-brand-550/10 border-brand-200 text-brand-600" 
            : session.loggedOutAt
            ? "bg-slate-50 border-slate-100 text-slate-400"
            : "bg-slate-50 border-slate-200/80 text-slate-500"
          }
        `}
      >
        <DeviceIcon session={session} size="md" />
      </div>

      {/* Info Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-sm truncate ${session.loggedOutAt ? "text-slate-400" : "text-slate-800"}`}>
            {displayName}
          </span>
          
          {/* Badge THIẾT BỊ QUEN */}
          {session.isFamiliar && !session.loggedOutAt && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-sky-500 text-white tracking-wider">
              {t("devices.badge_familiar")}
            </span>
          )}

          {isCurrent && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500 text-white tracking-wider">
              {t("devices.current_device").toUpperCase()}
            </span>
          )}
        </div>

        {/* Subtitle 1: Vị trí địa lý (city, country) */}
        <div className={`text-xs mt-0.5 ${session.loggedOutAt ? "text-slate-400" : "text-slate-500"}`}>
          {session.city || session.country ? (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {[session.city, session.country].filter(Boolean).join(", ")}
            </span>
          ) : session.ip ? (
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3 flex-shrink-0" />
              {session.ip}
            </span>
          ) : (
            <span>{isCurrent ? t("devices.active") : relativeTime}</span>
          )}
        </div>

        {/* Subtitle 2: Phương thức đăng nhập */}
        <div className={`text-[11px] mt-0.5 ${session.loggedOutAt ? "text-slate-400" : "text-slate-400"}`}>
          {session.loggedOutAt ? (
            <span>{getRelativeTime(session.loggedOutAt, currentLocale)}</span>
          ) : (
            <span>{t("devices.login_method_prefix")}{getMethodName(session.loginMethod || "password")}</span>
          )}
        </div>
      </div>

      {/* Popover Action details */}
      <DevicePopover
        session={session}
        onRevoke={onRevoke}
        isRevoking={isRevoking}
        currentLocale={currentLocale}
        t={t}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const t = useTranslations("settings");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<Tab>("language");
  const {
    data: sessions,
    isLoading: isSessionsLoading,
    refetch,
  } = useGetSessionsQuery(undefined, {
    skip: activeTab !== "devices",
  });
  const [revokeSession, { isLoading: isRevoking }] = useRevokeSessionMutation();

  const [showAllLoggedOut, setShowAllLoggedOut] = useState(false);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleLanguageChange = (newLocale: "vi" | "en") => {
    if (newLocale === currentLocale) return;
    router.replace(pathname, { locale: newLocale });
  };

  const handleRevokeSession = (sessionId: string) => {
    confirm({
      title: t("devices.logout_device"),
      message: t("devices.confirm_logout"),
      confirmText: t("devices.logout"),
      onConfirm: async () => {
        try {
          await revokeSession(sessionId).unwrap();
          refetch();
        } catch (err) {
          toast.error(t("devices.logout_failed"));
          throw err;
        }
      },
    });
  };

  const handleRevokeAll = () => {
    const othersToRevoke = sessions?.otherDevices ?? [];
    confirm({
      title: t("devices.logout_all"),
      message: t("devices.logout_all_confirm"),
      confirmText: t("devices.logout"),
      onConfirm: async () => {
        try {
          await Promise.all(othersToRevoke.map((s) => revokeSession(s.id).unwrap()));
          refetch();
        } catch (err) {
          toast.error(t("devices.logout_failed"));
          throw err;
        }
      },
    });
  };

  // ── Normalize API response ──
  // Backend đã trả về đúng format SessionsResponse { currentDevice, otherDevices, ... }
  // Chỉ cần đọc thẳng, không cần xử lý fallback phức tạp.
  const currentSession = sessions?.currentDevice ?? null;
  const otherSessions = sessions?.otherDevices ?? [];
  const recentlyLoggedOut = sessions?.recentlyLoggedOut ?? [];
  const hasOthers = otherSessions.length > 0;


  // Giới hạn hiển thị lịch sử đã đăng xuất (mặc định 5 mục trừ khi click show all)
  const displayedLoggedOut = showAllLoggedOut 
    ? recentlyLoggedOut 
    : recentlyLoggedOut.slice(0, 5);

  const maxWidthClass = activeTab === "devices" ? "max-w-3xl" : "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`
          relative bg-white border border-slate-200/60
          rounded-3xl shadow-[0_32px_64px_rgba(15,23,42,0.18)]
          w-full ${maxWidthClass}
          ${activeTab === "devices" ? "h-[85vh] max-h-[700px]" : "h-[480px]"}
          overflow-hidden flex flex-col md:flex-row animate-scale-in transition-all duration-300
        `}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/30 flex items-center justify-center transition-all duration-200 hover:rotate-90 active:scale-90"
        >
          <X className="w-4 h-4 text-slate-600" />
        </button>

        {/* Left Sidebar */}
        <aside className="w-full md:w-56 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-100 p-4 flex flex-col gap-6 flex-shrink-0 select-none">
          <div className="px-2 pt-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{t("title")}</h2>
          </div>

          <nav className="flex flex-row md:flex-col gap-1.5">
            <button
              onClick={() => setActiveTab("language")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-250 w-full text-left
                ${activeTab === "language"
                  ? "bg-linear-to-r from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/25 scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                }`}
            >
              <Globe className={`w-4 h-4 ${activeTab === "language" ? "animate-pulse" : ""}`} />
              <span>{t("tabs.language")}</span>
            </button>

            <button
              onClick={() => setActiveTab("devices")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-250 w-full text-left
                ${activeTab === "devices"
                  ? "bg-linear-to-r from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/25 scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                }`}
            >
              <Monitor className="w-4 h-4" />
              <span>{t("tabs.devices")}</span>
              {!isSessionsLoading && sessions && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === "devices" ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"}`}>
                  {1 + (otherSessions?.length ?? 0)}
                </span>
              )}
            </button>
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* ── Language Tab ─────────────────────────────────────────────── */}
          {activeTab === "language" && (
            <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">{t("language.header")}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("language.desc")}</p>
              </div>

              <div className="flex flex-col gap-3 mt-1">
                <button
                  onClick={() => handleLanguageChange("vi")}
                  className={`group relative flex items-center justify-between px-5 py-4 rounded-2xl border text-sm font-semibold transition-all duration-300 text-left w-full overflow-hidden active:scale-[0.99]
                    ${currentLocale === "vi"
                      ? "border-brand-500 bg-brand-50/15 text-brand-600 shadow-md shadow-brand-500/5"
                      : "border-slate-200/80 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                    }`}
                >
                  {currentLocale === "vi" && (
                    <div className="absolute inset-0 bg-linear-to-r from-brand-500/5 to-indigo-500/5 pointer-events-none" />
                  )}
                  <div className="flex items-center gap-4 z-10">
                    <div className="w-8 h-6 rounded-md overflow-hidden shadow-sm border border-slate-100 flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                      <svg viewBox="0 0 30 20" className="w-full h-full object-cover">
                        <rect width="30" height="20" fill="#da251d"/>
                        <polygon points="15,4 16.17,7.62 20,7.62 16.9,9.88 18.08,13.5 15,11.25 11.92,13.5 13.1,9.88 10,7.62 13.83,7.62" fill="#ffff00"/>
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{t("language.vietnamese")}</span>
                      <span className="text-[11px] text-slate-400 font-normal mt-0.5">Vietnamese</span>
                    </div>
                  </div>
                  <div className="z-10">
                    {currentLocale === "vi" ? (
                      <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/30">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-200 group-hover:border-slate-400 transition-colors" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleLanguageChange("en")}
                  className={`group relative flex items-center justify-between px-5 py-4 rounded-2xl border text-sm font-semibold transition-all duration-300 text-left w-full overflow-hidden active:scale-[0.99]
                    ${currentLocale === "en"
                      ? "border-brand-500 bg-brand-50/15 text-brand-600 shadow-md shadow-brand-500/5"
                      : "border-slate-200/80 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                    }`}
                >
                  {currentLocale === "en" && (
                    <div className="absolute inset-0 bg-linear-to-r from-brand-500/5 to-indigo-500/5 pointer-events-none" />
                  )}
                  <div className="flex items-center gap-4 z-10">
                    <div className="w-8 h-6 rounded-md overflow-hidden shadow-sm border border-slate-100 flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                      <svg viewBox="0 0 52 39" className="w-full h-full object-cover">
                        <rect width="52" height="39" fill="#ffffff"/>
                        <path d="M0,1.5 h52 M0,7.5 h52 M0,13.5 h52 M0,19.5 h52 M0,25.5 h52 M0,31.5 h52 M0,37.5 h52" stroke="#b22234" strokeWidth="3"/>
                        <rect width="22" height="21" fill="#3c3b6e"/>
                        <path d="
                          M2.5,3 h0.1 M7,3 h0.1 M11.5,3 h0.1 M16,3 h0.1 M20.5,3 h0.1
                          M4.5,6.5 h0.1 M9,6.5 h0.1 M13.5,6.5 h0.1 M18,6.5 h0.1
                          M2.5,10 h0.1 M7,10 h0.1 M11.5,10 h0.1 M16,10 h0.1 M20.5,10 h0.1
                          M4.5,13.5 h0.1 M9,13.5 h0.1 M13.5,13.5 h0.1 M18,13.5 h0.1
                          M2.5,17 h0.1 M7,17 h0.1 M11.5,17 h0.1 M16,17 h0.1 M20.5,17 h0.1
                        " stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{t("language.english")}</span>
                      <span className="text-[11px] text-slate-400 font-normal mt-0.5">Tiếng Anh (Mỹ)</span>
                    </div>
                  </div>
                  <div className="z-10">
                    {currentLocale === "en" ? (
                      <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/30">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-200 group-hover:border-slate-400 transition-colors" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Devices Tab ───────────────────────────────────────────────── */}
          {activeTab === "devices" && (
            <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
              {/* Device List */}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col">
                {isSessionsLoading ? (
                  // ── Skeleton ──
                  <div className="flex flex-col">
                    <div className="py-2">
                      <div className="h-3 w-24 bg-slate-100 rounded-full animate-pulse mb-2" />
                      <SkeletonCard />
                    </div>
                    <div className="py-2 border-t border-slate-100 mt-2">
                      <div className="h-3 w-40 bg-slate-100 rounded-full animate-pulse mb-2" />
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-100">
                    
                    {/* Section 1: This Device */}
                    <div className="pb-4">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {t("devices.section_current")}
                      </h4>
                      {currentSession ? (
                        <DeviceListItem
                          session={currentSession}
                          isRevoking={isRevoking}
                          currentLocale={currentLocale}
                          t={t}
                        />
                      ) : (
                        <div className="py-3 text-xs text-slate-400 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{t("devices.unknown")}</span>
                        </div>
                      )}

                    </div>

                    {/* Section 2: Other Devices */}
                    <div className="py-4">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {t("devices.section_others")}
                      </h4>
                      {hasOthers ? (
                        <div className="flex flex-col divide-y divide-slate-100/50">
                          {otherSessions.map((session) => (
                            <DeviceListItem
                              key={session.id}
                              session={session}
                              onRevoke={() => handleRevokeSession(session.id)}
                              isRevoking={isRevoking}
                              currentLocale={currentLocale}
                              t={t}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="py-3 text-xs text-slate-400">
                          {t("devices.empty")}
                        </div>
                      )}

                      {/* Standalone Logout All Button */}
                      {hasOthers && (
                        <div className="mt-4 pt-2">
                          <button
                            onClick={handleRevokeAll}
                            disabled={isRevoking}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all duration-200 border border-slate-200/60 active:scale-[0.99] disabled:opacity-50"
                          >
                            <LogOut className="w-4 h-4 text-slate-500" />
                            {t("devices.logout_all")}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Section 3: Recently Logged Out */}
                    {recentlyLoggedOut.length > 0 && (
                      <div className="py-4">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {t("devices.section_logged_out")}
                        </h4>
                        <div className="flex flex-col divide-y divide-slate-100/50">
                          {displayedLoggedOut.map((session) => (
                            <DeviceListItem
                              key={session.id}
                              session={session}
                              isRevoking={isRevoking}
                              currentLocale={currentLocale}
                              t={t}
                            />
                          ))}
                        </div>

                        {/* Show all link if history > 5 */}
                        {recentlyLoggedOut.length > 5 && !showAllLoggedOut && (
                          <button
                            onClick={() => setShowAllLoggedOut(true)}
                            className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand-600 transition-colors py-2"
                          >
                            <span>{t("devices.view_all_logged_out", { count: recentlyLoggedOut.length })}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
