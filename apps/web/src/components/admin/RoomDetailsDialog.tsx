import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  Info,
  Users,
  BarChart2,
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  ShieldAlert,
  HelpCircle,
  Video,
  Play,
  UserCheck,
  CheckCircle,
  Layers,
  MessageSquare,
  Hash,
} from "lucide-react";
import {
  useGetAdminRoomDetailsQuery,
  useDisbandRoomMutation,
} from "@/lib/redux/api/adminApi";
import { toast } from "sonner";

interface RoomDetailsDialogProps {
  roomId: string;
  onClose: () => void;
}

export default function RoomDetailsDialog({ roomId, onClose }: RoomDetailsDialogProps) {
  const t = useTranslations("admin");
  const { data: room, isLoading, refetch } = useGetAdminRoomDetailsQuery(roomId);
  const [disbandRoom, { isLoading: isDisbanding }] = useDisbandRoomMutation();

  const [activeTab, setActiveTab] = useState<"info" | "members" | "stats" | "reports" | "timeline">("info");
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false);
  const [disbandReason, setDisbandReason] = useState("spam");
  const [customReason, setCustomReason] = useState("");
  const [disbandError, setDisbandError] = useState("");

  if (isLoading || !room) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mb-4"></div>
          <p className="text-sm font-bold text-slate-500">{t("loading_title")}</p>
        </div>
      </div>
    );
  }

  const handleDisbandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisbandError("");

    let finalReason = "";
    if (disbandReason === "other") {
      if (!customReason.trim()) {
        setDisbandError(t("validation_required_reason"));
        return;
      }
      finalReason = customReason.trim();
    } else {
      finalReason = t(`disband_reason_${disbandReason}`, {
        defaultValue: disbandReason === "spam" ? "Spam" : disbandReason,
      });
    }

    try {
      await disbandRoom({ id: roomId, reason: finalReason }).unwrap();
      toast.success(t("disband_success"));
      setShowDisbandConfirm(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("default_error"));
    }
  };

  const getReasonLabel = (reasonKey: string) => {
    return t(`disband_reason_${reasonKey.toLowerCase()}`, { defaultValue: reasonKey });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${room.status === "disbanded" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {room.name}
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {t("col_room_code")}: <span className="font-bold text-slate-600">{room.code}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-100 flex gap-4 shrink-0 bg-white overflow-x-auto scrollbar-none">
          {[
            { id: "info", label: t("tab_info"), icon: Info },
            { id: "members", label: t("tab_members"), icon: Users },
            { id: "stats", label: t("tab_stats"), icon: BarChart2 },
            { id: "reports", label: t("tab_reports"), icon: AlertTriangle },
            { id: "timeline", label: t("tab_timeline"), icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-slate-50/30">
          
          {activeTab === "info" && (
            <div className="space-y-6">
              {/* Basic Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-white p-5 border border-slate-150 rounded-2xl">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_name")}</span>
                  <p className="text-sm font-bold text-slate-800">{room.name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_code")}</span>
                  <p className="text-sm font-bold text-slate-800">{room.code}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_host")}</span>
                  <p className="text-sm font-bold text-slate-800">{room.owner.displayName} ({room.owner.email})</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_type")}</span>
                  <p className="text-sm font-bold text-slate-800">
                    {room.type === "classroom" ? t("room_type_classroom") : t("room_type_meeting")}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_status")}</span>
                  <p className="mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      room.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : room.status === "disbanded"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {t(`room_status_${room.status}`)}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t("col_room_created")}</span>
                  <p className="text-sm font-bold text-slate-800">{formatTime(room.createdAt)}</p>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="flex gap-3">
                {room.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setShowDisbandConfirm(true)}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-red-600/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>{t("disband_action")}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <div className="space-y-3">
              {room.members.map((member: any) => (
                <div key={member.userId} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-slate-500 uppercase">{member.displayName.slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{member.displayName}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      member.role === "owner" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {member.role === "owner" ? t("host_label") : t("member_label")}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      member.status === "Đang trong phòng" ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-400"
                    }`}>
                      {member.status === "Đang trong phòng" ? t("status_in_room") : t("status_left")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: t("stat_total_members"), value: room.stats.totalParticipants ?? 0, icon: Users },
                { label: t("stat_online_members"), value: room.stats.onlineParticipants ?? 0, icon: UserCheck },
                { label: t("stat_total_channels"), value: room.stats.totalChannels ?? 0, icon: Hash },
                { label: t("stat_total_meetings"), value: room.stats.totalMeetings ?? 0, icon: Video },
                { label: t("stat_total_messages"), value: room.stats.totalMessages ?? 0, icon: MessageSquare },
                { label: t("stat_total_polls"), value: room.stats.totalPolls ?? 0, icon: HelpCircle },
              ].map((statItem, index) => {
                const Icon = statItem.icon;
                return (
                  <div key={index} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
                    <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{statItem.label}</span>
                      <p className="text-lg font-black text-slate-800 mt-0.5">{statItem.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-4">
              {room.reports.length === 0 ? (
                <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 font-medium">
                  {t("no_history_recorded")}
                </div>
              ) : (
                room.reports.map((reportItem: any) => (
                  <div key={reportItem.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                      <span className="text-xs font-bold text-slate-500">
                        {t("col_room_host")}: <strong className="text-slate-700">{reportItem.reporterName}</strong>
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{formatTime(reportItem.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("lock_reason")}: <strong className="text-red-600">{getReasonLabel(reportItem.reason)}</strong>
                    </p>
                    {reportItem.details && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 p-2.5 rounded-xl mt-2 font-medium">
                        {reportItem.details}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 py-2 ml-4">
              {room.activities.length === 0 ? (
                <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 font-medium -ml-10">
                  {t("no_history_recorded")}
                </div>
              ) : (
                room.activities.map((activityItem: any) => (
                  <div key={activityItem._id} className="relative">
                    {/* Circle Dot */}
                    <div className="absolute -left-[31px] top-1 bg-brand-600 w-3 h-3 rounded-full border-2 border-white shadow-xs"></div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {activityItem.type}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 mt-1.5">
                        {activityItem.metadata?.details || activityItem.type}
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                        {formatTime(activityItem.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* Disband Confirmation Dialog */}
      {showDisbandConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">{t("disband_confirm_title")}</h3>
              <button
                onClick={() => setShowDisbandConfirm(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDisbandSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                {t("disband_confirm_desc", { name: room.name })}
              </p>
              
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  {t("disband_reason_label")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "spam", label: t("disband_reason_spam") },
                    { value: "inappropriate", label: t("disband_reason_inappropriate") },
                    { value: "harassment", label: t("disband_reason_harassment") },
                    { value: "system", label: t("disband_reason_system") },
                    { value: "other", label: t("disband_reason_other") },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDisbandReason(item.value)}
                      className={`px-3 py-2 text-xs font-bold border rounded-lg text-left transition-all ${
                        disbandReason === item.value
                          ? "bg-red-50 border-red-500 text-red-700"
                          : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {disbandReason === "other" && (
                <div>
                  <textarea
                    required
                    rows={3}
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value);
                      if (e.target.value.trim()) setDisbandError("");
                    }}
                    placeholder={t("disband_reason_other_placeholder")}
                    className={`w-full px-4 py-3 bg-white border rounded-2xl text-sm focus:outline-none focus:border-red-500 transition-colors ${
                      disbandError ? "border-red-500" : "border-slate-200"
                    }`}
                  />
                  {disbandError && (
                    <p className="text-xs text-red-500 font-semibold mt-1">
                      {disbandError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisbandConfirm(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
                >
                  {t("cancel_action")}
                </button>
                <button
                  type="submit"
                  disabled={isDisbanding}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{t("disband_action")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
