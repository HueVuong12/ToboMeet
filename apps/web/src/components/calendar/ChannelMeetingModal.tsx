"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { X, ChevronDown, Search, RefreshCw, Users2 } from "lucide-react";
import TeamsRichEditor from "@/components/calendar/TeamsRichEditor";

import { useGetMyRoomsQuery } from "@/lib/redux/api/roomsApi";
import { useCreateCalendarEventMutation } from "@/lib/redux/api/calendarApi";

interface ChannelMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialRoom?: any;
  initialChannel?: any;
}

export default function ChannelMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  initialRoom,
  initialChannel,
}: ChannelMeetingModalProps) {
  const locale = useLocale();

  // RTK Query Hooks
  const { data: roomsData, isLoading: isLoadingRooms } = useGetMyRoomsQuery(undefined, { skip: !isOpen });
  const [createCalendarEvent] = useCreateCalendarEventMutation();

  const myRooms = Array.isArray(roomsData) ? roomsData : (roomsData as any)?.result ?? [];

  // Form states
  const [cmTitle, setCmTitle] = useState("");
  const cmDescRef = useRef("");
  const [cmEditorResetKey, setCmEditorResetKey] = useState(0);
  const [cmStartDate, setCmStartDate] = useState("");
  const [cmEndDate, setCmEndDate] = useState("");
  const [cmRecurrence, setCmRecurrence] = useState("NONE");
  const [cmInvitees, setCmInvitees] = useState<any[]>([]);
  const [cmErrorMsg, setCmErrorMsg] = useState("");

  // Room/Channel selection
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);

  // searchQuery: Từ khóa nhập để tìm phòng
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);

  // Phòng đang click tạm để xem danh sách kênh (chưa chọn chính thức)
  const [searchingRoom, setSearchingRoom] = useState<any | null>(null);

  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [expandedRoomsInputMode, setExpandedRoomsInputMode] = useState(false);
  const roomDropdownRef = useRef<HTMLDivElement>(null);

  const resetChannelMeetingForm = () => {
    setCmTitle("");
    cmDescRef.current = "";
    setCmEditorResetKey((prev) => prev + 1);
    setCmStartDate("");
    setCmEndDate("");
    setCmRecurrence("NONE");
    setCmInvitees([]);
    setCmErrorMsg("");
    setSelectedRoom(null);
    setSelectedChannel(null);
    setSearchingRoom(null);
    setRoomSearchQuery("");
    setRoomDropdownOpen(false);
    setExpandedRooms({});
    setExpandedRoomsInputMode(false);
  };

  // Đồng bộ hóa khởi tạo form khi mở/đóng modal
  useEffect(() => {
    if (isOpen) {
      if (initialRoom) {
        setSelectedRoom(initialRoom);
      }
      if (initialChannel) {
        setSelectedChannel(initialChannel);
      }

      // Khởi tạo thời gian bắt đầu sau 1 giờ và kết thúc sau 2 giờ từ lúc mở
      const now = new Date();
      const start = new Date(now);
      start.setHours(now.getHours() + 1, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1, 0, 0, 0);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setCmStartDate(
        `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
      );
      setCmEndDate(
        `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`
      );
    } else {
      resetChannelMeetingForm();
    }
  }, [isOpen, initialRoom, initialChannel]);

  // Nhấn ra ngoài để đóng dropdown tree-view của phòng
  useEffect(() => {
    const handleClickOutsideRoom = (e: MouseEvent) => {
      if (
        roomDropdownRef.current &&
        !roomDropdownRef.current.contains(e.target as Node)
      ) {
        setRoomDropdownOpen(false);
      }
    };
    if (roomDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutsideRoom);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideRoom);
    };
  }, [roomDropdownOpen]);

  const handleCreateChannelMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setCmErrorMsg("");

    if (!selectedRoom || !selectedChannel) {
      setCmErrorMsg(
        locale === "vi"
          ? "Vui lòng chọn phòng và kênh."
          : "Please select room and channel."
      );
      return;
    }

    const now = new Date();
    if (new Date(cmStartDate) <= now) {
      setCmErrorMsg(
        locale === "vi"
          ? "Thời gian bắt đầu họp phải sau thời gian hiện tại."
          : "Start time must be in the future."
      );
      return;
    }

    const inviteeList = cmInvitees.map((usr) => ({
      email: usr.email,
      displayName: usr.displayName || usr.fullName || usr.email,
    }));

    try {
      const payload: any = {
        title: cmTitle,
        description: cmDescRef.current,
        startDate: cmStartDate,
        endDate: cmEndDate,
        roomType: "channel_meeting",
        roomId: selectedRoom._id,
        channelId: selectedChannel._id,
        invitees: inviteeList,
      };

      if (cmRecurrence !== "NONE") {
        if (cmRecurrence.includes(";")) {
          const parts = cmRecurrence.split(";");
          const freqPart = parts[0];
          const byDayPart = parts[1] || "";
          payload.recurrenceRule = `FREQ=${freqPart};${byDayPart}`;
        } else {
          payload.recurrenceRule = `FREQ=${cmRecurrence}`;
        }
      }

      await createCalendarEvent(payload).unwrap();

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setCmErrorMsg(err.data?.message || err.message || "Không thể tạo cuộc họp kênh");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">
            {locale === "vi" ? "Cuộc họp kênh" : "Channel Meeting"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateChannelMeeting}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {cmErrorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium">
                <span>{cmErrorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {locale === "vi" ? "Tiêu đề cuộc họp" : "Meeting Title"}
              </label>
              <input
                type="text"
                required
                value={cmTitle}
                onChange={(e) => setCmTitle(e.target.value)}
                placeholder={
                  locale === "vi"
                    ? "Ví dụ: Sprint Planning"
                    : "e.g., Sprint Planning"
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  {locale === "vi" ? "Bắt đầu" : "Start"}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={cmStartDate}
                  onChange={(e) => setCmStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  {locale === "vi" ? "Kết thúc" : "End"}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={cmEndDate}
                  onChange={(e) => setCmEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-700"
                />
              </div>
            </div>

            {cmStartDate && new Date(cmStartDate) <= new Date() && (
              <p className="text-red-500 text-[11px] font-semibold mt-1">
                {locale === "vi"
                  ? "Thời gian bắt đầu họp phải sau thời gian hiện tại."
                  : "Start time must be in the future."}
              </p>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {locale === "vi" ? "Lặp lại" : "Recurrence"}
              </label>
              <div className="relative">
                <select
                  value={cmRecurrence}
                  onChange={(e) => setCmRecurrence(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white appearance-none text-slate-700"
                >
                  <option value="NONE">
                    {locale === "vi" ? "Không lặp lại" : "Does not repeat"}
                  </option>
                  <option value="DAILY">
                    {locale === "vi" ? "Hàng ngày" : "Daily"}
                  </option>
                  {(() => {
                    if (!cmStartDate) return null;
                    const dateObj = new Date(cmStartDate);
                    if (isNaN(dateObj.getTime())) return null;

                    const daysVi = ["chủ nhật", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy"];
                    const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const dayNameVi = daysVi[dateObj.getDay()];
                    const dayNameEn = daysEn[dateObj.getDay()];

                    const dayNum = dateObj.getDate();
                    const weekIndex = Math.ceil(dayNum / 7);
                    const weeksVi = ["đầu tiên", "thứ hai", "thứ ba", "thứ tư", "thứ năm"];
                    const weeksEn = ["first", "second", "third", "fourth", "fifth"];
                    const weekNameVi = weeksVi[weekIndex - 1] || "đầu tiên";
                    const weekNameEn = weeksEn[weekIndex - 1] || "first";

                    const rruleDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
                    const rruleDay = rruleDays[dateObj.getDay()];

                    const weeklyLabel = locale === "vi" ? `Hàng tuần vào ${dayNameVi}` : `Weekly on ${dayNameEn}`;
                    const monthlyLabel = locale === "vi" ? `Hàng tháng vào ngày ${dayNameVi} ${weekNameVi}` : `Monthly on the ${weekNameEn} ${dayNameEn}`;
                    const yearlyLabel = locale === "vi" ? `Hàng năm vào ngày ${dayNum} tháng ${dateObj.getMonth() + 1}` : `Annually on ${dayNameEn}, ${dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
                    const weekdayLabel = locale === "vi" ? "Mọi ngày trong tuần (từ thứ Hai đến thứ Sáu)" : "Every weekday (Monday to Friday)";

                    const weeklyVal = `WEEKLY;BYDAY=${rruleDay}`;
                    const monthlyVal = `MONTHLY;BYDAY=${weekIndex}${rruleDay}`;
                    const yearlyVal = `YEARLY`;
                    const weekdayVal = "WEEKLY;BYDAY=MO,TU,WE,TH,FR";

                    return (
                      <>
                        <option value={weeklyVal}>{weeklyLabel}</option>
                        <option value={monthlyVal}>{monthlyLabel}</option>
                        <option value={yearlyVal}>{yearlyLabel}</option>
                        <option value={weekdayVal}>{weekdayLabel}</option>
                      </>
                    );
                  })()}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* FIELD: Thêm Kênh (Combobox/Dropdown Tree View) */}
            <div className="relative" ref={roomDropdownRef}>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {locale === "vi" ? "Thêm kênh" : "Add Channel"}
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={(() => {
                    const selectionText = selectedRoom && selectedChannel ? `${selectedRoom.name} > ${selectedChannel.name}   ` : "";
                    if (roomSearchQuery) {
                      return selectionText ? `${selectionText}${roomSearchQuery}` : roomSearchQuery;
                    }
                    return selectionText;
                  })()}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    const selectionText = selectedRoom && selectedChannel ? `${selectedRoom.name} > ${selectedChannel.name}   ` : "";
                    if (selectionText && rawVal.startsWith(selectionText)) {
                      const typedPart = rawVal.substring(selectionText.length);
                      if (typedPart.trim() === `${selectedRoom.name} > ${selectedChannel.name}`.trim()) {
                        setRoomSearchQuery("");
                      } else {
                        setRoomSearchQuery(typedPart);
                      }
                    } else {
                      setRoomSearchQuery(rawVal);
                    }
                    setRoomDropdownOpen(true);
                    setExpandedRoomsInputMode(true);
                  }}
                  onFocus={() => {
                    setRoomDropdownOpen(true);
                    setRoomSearchQuery("");
                    setExpandedRoomsInputMode(false);
                  }}
                  placeholder={
                    locale === "vi" ? "Chọn phòng và kênh..." : "Select room and channel..."
                  }
                  className={`w-full ${selectedRoom ? "pl-14" : "pl-9"} pr-10 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-400 font-normal text-slate-700`}
                />

                {selectedRoom ? (() => {
                  const CARD_GRADIENTS = [
                    "from-violet-600 via-purple-600 to-indigo-700",
                    "from-blue-600 via-indigo-600 to-cyan-700",
                    "from-teal-500 via-emerald-600 to-teal-800",
                    "from-rose-500 via-pink-600 to-red-700",
                    "from-amber-500 via-orange-600 to-red-600",
                    "from-cyan-500 via-blue-600 to-indigo-700",
                    "from-fuchsia-500 via-purple-600 to-pink-700",
                    "from-emerald-500 via-teal-600 to-cyan-700",
                  ];
                  let hash = 0;
                  for (let i = 0; i < selectedRoom._id.length; i++) {
                    hash = selectedRoom._id.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const gradient = CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
                  return (
                    <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[9px] font-extrabold shadow-xs absolute left-3 top-2.5 select-none`}>
                      {selectedRoom.name.charAt(0).toUpperCase()}
                    </div>
                  );
                })() : (
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                )}
              </div>

              {roomDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto py-2">
                  {isLoadingRooms ? (
                    <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{locale === "vi" ? "Đang tải..." : "Loading..."}</span>
                    </div>
                  ) : (() => {
                    const filtered = myRooms.filter((r: any) =>
                      r.name.toLowerCase().includes(roomSearchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-slate-400">
                {locale === "vi" ? "Không tìm thấy phòng" : "No rooms found"}
                        </div>
                      );
                    }

                    return filtered.map((room: any) => {
                      const isExpanded = expandedRoomsInputMode ? true : (expandedRooms[room._id] ?? (selectedRoom?._id === room._id));

                      const CARD_GRADIENTS = [
                        "from-violet-600 via-purple-600 to-indigo-700",
                        "from-blue-600 via-indigo-600 to-cyan-700",
                        "from-teal-500 via-emerald-600 to-teal-800",
                        "from-rose-500 via-pink-600 to-red-700",
                        "from-amber-500 via-orange-600 to-red-600",
                        "from-cyan-500 via-blue-600 to-indigo-700",
                        "from-fuchsia-500 via-purple-600 to-pink-700",
                        "from-emerald-500 via-teal-600 to-cyan-700",
                      ];
                      let hash = 0;
                      for (let i = 0; i < room._id.length; i++) {
                        hash = room._id.charCodeAt(i) + ((hash << 5) - hash);
                      }
                      const gradient = CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];

                      return (
                        <div key={room._id} className="flex flex-col">
                          <div
                            onClick={() => {
                              setExpandedRoomsInputMode(false);
                              setExpandedRooms((prev) => ({
                                ...prev,
                                [room._id]: !isExpanded,
                              }));
                              setSearchingRoom(room);
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors text-xs font-bold text-slate-800 flex items-center gap-2 select-none"
                          >
                            <span className="text-[10px] text-slate-400 w-3">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[9px] font-extrabold shadow-xs shrink-0`}>
                              {room.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{room.name}</span>
                          </div>

                          {isExpanded && (
                            <div className="pl-8 pr-4 py-1 flex flex-col gap-1 bg-slate-50/50">
                              {(!room.channels || room.channels.length === 0) ? (
                                <div className="text-[11px] text-slate-400 py-1 pl-3">
                                  {locale === "vi" ? "Phòng này chưa có kênh" : "No channels in this room"}
                                </div>
                              ) : (
                                room.channels.map((channel: any) => {
                                  const isSelected = selectedChannel?._id === channel._id;
                                  return (
                                    <div
                                      key={channel._id}
                                      onClick={() => {
                                        setSelectedRoom(room);
                                        setSelectedChannel(channel);
                                        setRoomSearchQuery("");
                                        setRoomDropdownOpen(false);
                                        setSearchingRoom(null);
                                        setExpandedRoomsInputMode(false);
                                      }}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-indigo-50/75 text-[12px] font-semibold ${
                                        isSelected ? "text-indigo-600 bg-indigo-50 font-bold" : "text-slate-600"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="channel-tree-select"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                                      />
                                      <span>{channel.name}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2.5">
                {locale === "vi" ? "Mô tả" : "Description"}
              </label>
              <TeamsRichEditor
                value={cmDescRef.current}
                onChange={(html) => {
                  cmDescRef.current = html;
                }}
                resetKey={cmEditorResetKey}
                locale={locale}
                placeholder={
                  locale === "vi"
                    ? "Nội dung tóm tắt cuộc họp..."
                    : "Meeting summary notes..."
                }
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              {locale === "vi" ? "Hủy" : "Cancel"}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              {locale === "vi" ? "Lưu" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
