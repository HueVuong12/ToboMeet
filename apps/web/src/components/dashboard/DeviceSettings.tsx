"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useUpdateCurrentSessionLocationMutation,
  UserSession
} from "@/lib/redux/api/usersApi";
import {
  Monitor, Smartphone, Laptop, Globe2, LogOut,
  MoreVertical, Wifi, MapPin
} from "lucide-react";
import { useConfirm } from "@/providers/ConfirmProvider";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLocation(city?: string, country?: string, isp?: string): string {
  const INVALID = ["không xác định", "unknown", ""];
  const safeCity =
    city && !INVALID.includes(city.trim().toLowerCase()) ? city.trim() : "";
  const safeCountry =
    country && !INVALID.includes(country.trim().toLowerCase())
      ? country.trim()
      : "";
  const safeIsp =
    isp && !INVALID.includes(isp.trim().toLowerCase()) ? isp.trim() : "";

  if (safeCity && safeCountry) return `${safeCity}, ${safeCountry}`;
  if (safeIsp && safeCountry) return `${safeIsp}, ${safeCountry}`;
  if (safeCountry) return safeCountry;
  if (safeIsp) return safeIsp;
  return "Không xác định";
}

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function getMethodName(method: string | undefined, t: ReturnType<typeof useTranslations<"settings">>) {
  if (!method) return t("devices.method_password");
  const m = method.toLowerCase();
  if (m === "google" || m === "oauth") return t("devices.method_google");
  return t("devices.method_password");
}

function DevicePopover({
  session,
  onRevoke,
  isRevoking,
  currentLocale,
  t,
  gpsLocation,
}: {
  session: UserSession;
  onRevoke?: () => void;
  isRevoking: boolean;
  currentLocale: string;
  t: ReturnType<typeof useTranslations<"settings">>;
  gpsLocation?: string | null;
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
              label={t("devices.detail_method")}
              value={getMethodName(session.loginMethod, t)}
            />
            <DetailRow
              label={t("devices.detail_ip")}
              value={session.ipAddress ? session.ipAddress : "Không xác định"}
            />
            <DetailRow
              label={t("devices.detail_location")}
              value={
                session.isCurrent && gpsLocation
                  ? gpsLocation
                  : formatLocation(session.city, session.country, session.isp)
              }
            />
          </div>

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

  const [updateLocation] = useUpdateCurrentSessionLocationMutation();
  const [gpsLocation, setGpsLocation] = useState<string | null>(null);

  useEffect(() => {
    if (!isCurrent || typeof window === "undefined" || !("geolocation" in navigator)) return;

    let isMounted = true;
    const timeoutId = setTimeout(() => {}, 4000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timeoutId);
        if (!isMounted) return;
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi`,
            { headers: { "User-Agent": "ToBoMeet-Web" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.state || addr.province || "";
            const country = addr.country || "";
            if (city && country) {
              setGpsLocation(`${city}, ${country}`);
              updateLocation({ city, country }).unwrap().catch(() => {});
            } else if (country) {
              setGpsLocation(country);
              updateLocation({ city: "", country }).unwrap().catch(() => {});
            }
          }
        } catch {}
      },
      () => {
        clearTimeout(timeoutId);
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isCurrent, updateLocation]);

  const displayName =
    session.deviceName ||
    (session.browser && session.os && session.os !== "Không rõ"
      ? `${session.browser.replace(/\s+/g, "")}-${session.os.replace(/\s+/g, "")}`
      : (session.browser || "").replace(/\s+/g, "") || t("devices.unknown"));

  return (
    <div className="flex items-start gap-4 py-3.5 group select-none">
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

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-sm truncate ${session.loggedOutAt ? "text-slate-400" : "text-slate-800"}`}>
            {displayName}
          </span>
          
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

        <div className={`text-xs mt-0.5 ${session.loggedOutAt ? "text-slate-400" : "text-slate-500"}`}>
          {(() => {
            const displayLoc = isCurrent && gpsLocation ? gpsLocation : formatLocation(session.city, session.country, session.isp);
            const useGpsStyle = session.isGps || (isCurrent && !!gpsLocation);

            if (useGpsStyle && displayLoc !== "Không xác định") {
              return (
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                  {displayLoc}
                </span>
              );
            }

            if (displayLoc !== "Không xác định") {
              return (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {displayLoc}
                </span>
              );
            }
            if (session.ip && session.ip !== "Không rõ") {
              return (
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 flex-shrink-0" />
                  {session.ip}
                </span>
              );
            }
            return (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                Không xác định
              </span>
            );
          })()}
        </div>

        <div className={`text-[11px] mt-0.5 ${session.loggedOutAt ? "text-slate-400" : "text-slate-400"}`}>
          {session.loggedOutAt ? (
            <span>{getRelativeTime(session.loggedOutAt, currentLocale)}</span>
          ) : (
            <span>{t("devices.login_method_prefix")}{getMethodName(session.loginMethod, t)}</span>
          )}
        </div>
      </div>

      <DevicePopover
        session={session}
        onRevoke={onRevoke}
        isRevoking={isRevoking}
        currentLocale={currentLocale}
        t={t}
        gpsLocation={gpsLocation}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DeviceSettingsProps {
  t: ReturnType<typeof useTranslations<"settings">>;
  currentLocale: string;
}

export function DeviceSettings({ t, currentLocale }: DeviceSettingsProps) {
  const confirm = useConfirm();

  const {
    data: sessions,
    isLoading: isSessionsLoading,
    refetch,
  } = useGetSessionsQuery();

  const [revokeSession, { isLoading: isRevokingSingle }] = useRevokeSessionMutation();
  const [revokeOtherSessions, { isLoading: isRevokingOthers }] = useRevokeOtherSessionsMutation();
  const isRevoking = isRevokingSingle || isRevokingOthers;
  const [showAllLoggedOut, setShowAllLoggedOut] = useState(false);

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
    confirm({
      title: t("devices.logout_all"),
      message: t("devices.logout_all_confirm"),
      confirmText: t("devices.logout"),
      onConfirm: async () => {
        try {
          await revokeOtherSessions().unwrap();
          refetch();
        } catch (err) {
          toast.error(t("devices.logout_failed"));
          throw err;
        }
      },
    });
  };

  const currentSession = sessions?.currentDevice ?? null;
  const otherSessions = sessions?.otherDevices ?? [];
  const recentlyLoggedOut = sessions?.recentlyLoggedOut ?? [];
  const hasOthers = otherSessions.length > 0;

  const displayedLoggedOut = showAllLoggedOut 
    ? recentlyLoggedOut 
    : recentlyLoggedOut.slice(0, 5);

  return (
    <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">{t("devices.header")}</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t("devices.desc")}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col">
        {isSessionsLoading ? (
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
            <div className="pb-4">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {t("devices.section_current")}
              </h4>
              {currentSession ? (
                <DeviceListItem
                  session={currentSession}
                  currentLocale={currentLocale}
                  isRevoking={isRevoking}
                  t={t}
                />
              ) : (
                <div className="py-3 text-xs text-slate-400">
                  {t("devices.loading")}
                </div>
              )}
            </div>

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

                {recentlyLoggedOut.length > 5 && !showAllLoggedOut && (
                  <button
                    onClick={() => setShowAllLoggedOut(true)}
                    className="w-full mt-3 py-2 text-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    {t("devices.view_all_logged_out", { count: recentlyLoggedOut.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
