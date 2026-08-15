import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Loader2, X } from "lucide-react";

export default function NotificationDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { notifications, isLoading, isFetching, hasNext, loadMore } =
    useNotifications({ limit: 15 });

  // Xử lý Infinite Scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Nếu cuộn cách đáy 50px thì gọi loadMore
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (hasNext && !isFetching) {
        loadMore();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay che phần main content */}
      <div
        className="fixed inset-y-0 left-[68px] right-0 z-[200] bg-slate-900/20 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer trượt từ trái ra, sát với thanh Sidebar */}
      <div className="fixed top-0 left-17 bottom-0 w-95 bg-white z-[210] shadow-[24px_0_40px_rgba(0,0,0,0.08)] flex flex-col border-r border-slate-100 animate-slide-in-left">
        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <h2 className="text-lg font-bold text-slate-800">Thông báo</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách thông báo (Content) */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-sm font-medium text-slate-400">
                Đang tải thông báo...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-70">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Bạn chưa có thông báo nào
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((notif: any) => (
                <div
                  key={notif.id}
                  className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer 
                    ${
                      notif.isRead
                        ? "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                        : "bg-brand-50/40 border-brand-100/60 hover:bg-brand-50/70"
                    }
                  `}
                >
                  {/* Chấm tròn báo chưa đọc */}
                  {!notif.isRead && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(0,85,255,0.4)]" />
                  )}

                  <div className="flex gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        notif.isRead
                          ? "bg-slate-100 text-slate-500"
                          : "bg-brand-100 text-brand-600"
                      }`}
                    >
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-[13px] text-slate-800 font-medium leading-snug">
                        {/* Tạm thời hiển thị thô, sau này bạn có thể phân rã dựa vào notif.type */}
                        Có một sự kiện diễn ra ({notif.type})
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1.5 flex items-center gap-1">
                        {new Date(notif.createdAt).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loader khi cuộn (Infinite scroll loading) */}
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
