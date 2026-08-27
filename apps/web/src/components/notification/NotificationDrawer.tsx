import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Loader2, X } from "lucide-react";
import NotificationCard from "./NotificationCard";
import { useTranslations } from "next-intl";

export default function NotificationDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("notification");
  const { notifications, isLoading, isFetching, hasNext, loadMore } =
    useNotifications({ limit: 15, markAsRead: !isOpen });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (hasNext && !isFetching) {
        loadMore();
      }
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 left-17 bottom-0 w-95 bg-white z-40 shadow-[24px_0_40px_rgba(0,0,0,0.08)] flex flex-col border-r border-slate-100 transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-[-150%]"
          }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <h2 className="text-lg font-bold text-slate-800">
            {t("drawer.title")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-sm font-medium text-slate-400">
                {t("drawer.loading")}
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-70">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {t("drawer.empty")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((notif) => (
                <NotificationCard
                  key={notif._id}
                  notification={notif}
                  onCloseDrawer={onClose}
                />
              ))}

              {isFetching && !isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
