import { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Network,
  Users,
  Wand2,
  Hand,
  Clock,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  UserMinus,
  ArrowRightLeft,
  ArrowRightCircle,
  UserPlus,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  Edit2,
  Check,
} from "lucide-react";
import { useStartBreakoutSessionMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
import { useParticipantManager } from "@/hooks/useParticipantManager";
import { CreateBreakoutRoomDto } from "@tobomeet/shared/types";
import { useTranslations } from "next-intl";

interface CreateBreakoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
}

type BreakoutMode = "auto" | "manual" | "free_choose";

interface LocalRoom {
  id: string;
  name: string;
  assignedUserIds: string[];
}

export default function CreateBreakoutModal({
  isOpen,
  onClose,
  meetingCode,
}: CreateBreakoutModalProps) {
  const t = useTranslations("meeting.create_breakout_modal");
  const tServer = useTranslations("server.errors");

  const { displayParticipants } = useParticipantManager({
    meetingCode: meetingCode,
  });

  const [startBreakoutApi, { isLoading }] = useStartBreakoutSessionMutation();

  // Step state: 1 (Setup) | 2 (Assignment & Review)
  const [step, setStep] = useState<1 | 2>(1);

  // Mode state
  const [mode, setMode] = useState<BreakoutMode>("auto");

  // Step 1 Form States
  const [roomCount, setRoomCount] = useState<number>(2);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [roomPrefix, setRoomPrefix] = useState<string>(t("room_prefix"));

  // Step 2 Local Rooms State
  const [rooms, setRooms] = useState<LocalRoom[]>([]);

  // Editing Room Name inline state
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState<string>("");

  // Action Menu state on participant (3 dots menu)
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<"move" | "exchange" | null>(null);

  // Multi-select Add Participants Modal State
  const [addModalTargetRoomId, setAddModalTargetRoomId] = useState<string | null>(null);
  const [selectedUserIdsToAdd, setSelectedUserIdsToAdd] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Assignable participants (if multiple, exclude host/local if possible, else take all)
  const assignableParticipants = useMemo(() => {
    const nonLocal = displayParticipants.filter((p) => !p.isLocal);
    return nonLocal.length > 0 ? nonLocal : displayParticipants;
  }, [displayParticipants]);

  // Unassigned participants pool
  const unassignedParticipants = useMemo(() => {
    const assignedSet = new Set<string>();
    rooms.forEach((r) => r.assignedUserIds.forEach((uid) => assignedSet.add(uid)));
    return assignableParticipants.filter((p) => !assignedSet.has(p.identity));
  }, [assignableParticipants, rooms]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setMode("auto");
      setRoomCount(2);
      setDurationMinutes(15);
      setRoomPrefix(t("room_prefix"));
      setRooms([]);
      setActiveMenuUserId(null);
      setActiveSubMenu(null);
      setAddModalTargetRoomId(null);
    }
  }, [isOpen, t]);

  if (!isOpen) return null;

  // Helper to generate & partition rooms
  const generateRoomsForStep2 = (currentMode: BreakoutMode, count: number, prefix: string) => {
    const pfx = prefix.trim() || t("room_prefix");
    const countNum = Math.max(1, count);

    const newRooms: LocalRoom[] = Array.from({ length: countNum }, (_, i) => ({
      id: `room_${Date.now()}_${i + 1}`,
      name: `${pfx} ${i + 1}`,
      assignedUserIds: [],
    }));

    if (currentMode === "auto") {
      // Shuffle and partition evenly
      const shuffled = [...assignableParticipants].sort(() => 0.5 - Math.random());
      shuffled.forEach((p, index) => {
        const targetRoomIndex = index % countNum;
        newRooms[targetRoomIndex].assignedUserIds.push(p.identity);
      });
    }

    setRooms(newRooms);
  };

  // Step 1 -> Step 2
  const handleProceedToStep2 = () => {
    if (roomCount < 1) {
      toast.error(t("error_min_room"));
      return;
    }
    if (durationMinutes < 1) {
      toast.error(t("error_min_duration"));
      return;
    }

    generateRoomsForStep2(mode, roomCount, roomPrefix);
    setStep(2);
  };

  // Shuffle again in Step 2 (Auto mode)
  const handleShuffleAgain = () => {
    if (rooms.length === 0) return;
    const shuffled = [...assignableParticipants].sort(() => 0.5 - Math.random());
    const updated = rooms.map((r) => ({ ...r, assignedUserIds: [] as string[] }));

    shuffled.forEach((p, index) => {
      const targetRoomIndex = index % updated.length;
      updated[targetRoomIndex].assignedUserIds.push(p.identity);
    });

    setRooms(updated);
    toast.success(t("shuffle_again"));
  };

  // Add new room in Step 2
  const handleAddRoom = () => {
    const pfx = roomPrefix.trim() || t("room_prefix");
    const newRoom: LocalRoom = {
      id: `room_${Date.now()}_${rooms.length + 1}`,
      name: `${pfx} ${rooms.length + 1}`,
      assignedUserIds: [],
    };
    setRooms((prev) => [...prev, newRoom]);
  };

  // Delete room in Step 2
  const handleDeleteRoom = (roomId: string) => {
    if (rooms.length <= 1) {
      toast.error(t("error_min_room"));
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (editingRoomId === roomId) {
      setEditingRoomId(null);
    }
  };

  // Rename room inline
  const handleStartRenameRoom = (roomId: string, currentName: string) => {
    setEditingRoomId(roomId);
    setEditingRoomName(currentName);
  };

  const handleSaveRoomName = (roomId: string) => {
    if (!editingRoomName.trim()) {
      toast.error(t("error_room_name_empty"));
      return;
    }
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, name: editingRoomName.trim() } : r)),
    );
    setEditingRoomId(null);
  };

  // Remove participant from room
  const handleRemoveParticipant = (roomId: string, userId: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, assignedUserIds: r.assignedUserIds.filter((id) => id !== userId) }
          : r,
      ),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Move participant to another room
  const handleMoveParticipant = (fromRoomId: string, toRoomId: string, userId: string) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === fromRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.filter((id) => id !== userId),
          };
        }
        if (r.id === toRoomId) {
          return {
            ...r,
            assignedUserIds: [...r.assignedUserIds, userId],
          };
        }
        return r;
      }),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Exchange participant with someone in another room
  const handleExchangeParticipant = (
    fromRoomId: string,
    fromUserId: string,
    toRoomId: string,
    toUserId: string,
  ) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === fromRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.map((id) =>
              id === fromUserId ? toUserId : id,
            ),
          };
        }
        if (r.id === toRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.map((id) =>
              id === toUserId ? fromUserId : id,
            ),
          };
        }
        return r;
      }),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Open multi-select modal for adding users
  const handleOpenAddModal = (roomId: string) => {
    setAddModalTargetRoomId(roomId);
    setSelectedUserIdsToAdd([]);
    setSearchQuery("");
  };

  // Confirm multi-select add users
  const handleConfirmAddUsers = () => {
    if (!addModalTargetRoomId || selectedUserIdsToAdd.length === 0) return;

    setRooms((prev) =>
      prev.map((r) =>
        r.id === addModalTargetRoomId
          ? { ...r, assignedUserIds: [...r.assignedUserIds, ...selectedUserIdsToAdd] }
          : r,
      ),
    );
    setAddModalTargetRoomId(null);
    setSelectedUserIdsToAdd([]);
  };

  // Toggle user selection in add modal
  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIdsToAdd((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  // Submit and start breakout session
  const handleSubmit = async () => {
    if (rooms.length === 0) {
      toast.error(t("error_min_room"));
      return;
    }
    if (durationMinutes < 1) {
      toast.error(t("error_min_duration"));
      return;
    }
    if (rooms.some((r) => !r.name.trim())) {
      toast.error(t("error_room_name_empty"));
      return;
    }

    const payloadRooms: CreateBreakoutRoomDto[] = rooms.map((r) => ({
      name: r.name.trim(),
      durationMinutes: durationMinutes,
      assignedUsers: mode === "free_choose" ? undefined : r.assignedUserIds,
    }));

    try {
      await startBreakoutApi({
        code: meetingCode,
        rooms: payloadRooms,
      }).unwrap();

      toast.success(t("success_start"));
      onClose();
    } catch (error: any) {
      if (error?.code) {
        toast.error(tServer(String(error.code)));
      } else if (error?.status === 400) {
        toast.error(t("error_invalid_data"));
      } else {
        toast.error(t("error_create_failed"));
      }
    }
  };

  // Find user details helper
  const getParticipantInfo = (userId: string) => {
    const p = displayParticipants.find((item) => item.identity === userId);
    return {
      name: p?.name || userId,
      initial: (p?.name || userId).charAt(0).toUpperCase(),
    };
  };

  // Target room for the Add Modal
  const targetRoomForAdd = rooms.find((r) => r.id === addModalTargetRoomId);

  // Filter unassigned participants for the add modal
  const filteredUnassigned = unassignedParticipants.filter((p) =>
    (p.name || p.identity).toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm animate-fade-in transition-opacity"
        onClick={() => {
          if (activeMenuUserId) {
            setActiveMenuUserId(null);
            setActiveSubMenu(null);
          } else {
            onClose();
          }
        }}
      />

      {/* Main Modal Container */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[95vw] bg-[#18181b] border border-[#2e2e33] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${step === 1 ? "max-w-lg h-[82vh] md:h-[70vh]" : "max-w-4xl h-[88vh] md:h-[82vh]"
          }`}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#121214] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Network size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {step === 1 ? t("step_1_title") : t("step_2_title")}
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#27272a] text-slate-400 border border-[#3f3f46] rounded-full">
                  {step === 1 ? "1 / 2" : "2 / 2"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 1 ? t("step_1_subtitle") : t("step_2_subtitle")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-hidden bg-[#161618] flex flex-col relative">
          {/* ================= STEP 1: SETUP & MODE SELECTION ================= */}
          {step === 1 && (
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {/* Mode Selection Cards */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Phương thức phân chia
                </label>

                {/* Option 1: Auto */}
                <div
                  onClick={() => setMode("auto")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${mode === "auto"
                    ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5"
                    : "border-[#27272a] bg-[#1e1e22] hover:border-[#3f3f46] hover:bg-[#232328]"
                    }`}
                >
                  <div
                    className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${mode === "auto"
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                      : "bg-[#27272a] text-slate-400"
                      }`}
                  >
                    <Wand2 size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${mode === "auto" ? "text-blue-400" : "text-slate-200"
                          }`}
                      >
                        {t("mode_auto")}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === "auto"
                          ? "border-blue-500 bg-blue-500"
                          : "border-[#52525b]"
                          }`}
                      >
                        {mode === "auto" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {t("mode_auto_desc")}
                    </p>
                  </div>
                </div>

                {/* Option 2: Manual */}
                <div
                  onClick={() => setMode("manual")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${mode === "manual"
                    ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5"
                    : "border-[#27272a] bg-[#1e1e22] hover:border-[#3f3f46] hover:bg-[#232328]"
                    }`}
                >
                  <div
                    className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${mode === "manual"
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                      : "bg-[#27272a] text-slate-400"
                      }`}
                  >
                    <Hand size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${mode === "manual" ? "text-blue-400" : "text-slate-200"
                          }`}
                      >
                        {t("mode_manual")}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === "manual"
                          ? "border-blue-500 bg-blue-500"
                          : "border-[#52525b]"
                          }`}
                      >
                        {mode === "manual" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {t("mode_manual_desc")}
                    </p>
                  </div>
                </div>

                {/* Option 3: Free choose */}
                <div
                  onClick={() => setMode("free_choose")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${mode === "free_choose"
                    ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5"
                    : "border-[#27272a] bg-[#1e1e22] hover:border-[#3f3f46] hover:bg-[#232328]"
                    }`}
                >
                  <div
                    className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${mode === "free_choose"
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                      : "bg-[#27272a] text-slate-400"
                      }`}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${mode === "free_choose" ? "text-blue-400" : "text-slate-200"
                          }`}
                      >
                        {t("mode_free")}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === "free_choose"
                          ? "border-blue-500 bg-blue-500"
                          : "border-[#52525b]"
                          }`}
                      >
                        {mode === "free_choose" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {t("mode_free_desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1e1e22] p-4 rounded-xl border border-[#27272a]">
                {/* Room Count */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    {t("room_count")}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRoomCount((c) => Math.max(1, c - 1))}
                      className="w-10 h-10 rounded-lg bg-[#27272a] hover:bg-[#323238] border border-[#3f3f46] text-white flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={roomCount}
                      onChange={(e) => setRoomCount(Math.max(1, Number(e.target.value)))}
                      className="flex-1 h-10 bg-[#121214] border border-[#3f3f46] text-white text-center font-mono font-bold text-base rounded-lg focus:border-blue-500 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setRoomCount((c) => c + 1)}
                      className="w-10 h-10 rounded-lg bg-[#27272a] hover:bg-[#323238] border border-[#3f3f46] text-white flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {mode === "auto" && assignableParticipants.length > 0 && (
                    <p className="text-[11px] text-blue-400 mt-1.5 font-medium">
                      {t("auto_calc_hint", {
                        count: Math.ceil(assignableParticipants.length / Math.max(1, roomCount)),
                      })}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    {t("duration")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(Math.max(1, Number(e.target.value)))
                      }
                      className="w-full h-10 pl-10 pr-12 bg-[#121214] border border-[#3f3f46] text-white font-mono font-bold text-base rounded-lg focus:border-blue-500 outline-none transition-colors"
                    />
                    <Clock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      {t("minutes_unit")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {t("total_participants_hint", {
                      count: assignableParticipants.length,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: ASSIGNMENT & ROOM MANAGEMENT ================= */}
          {step === 2 && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Step 2 Top Bar */}
              <div className="px-6 py-3 border-b border-[#27272a] bg-[#1a1a1e] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <ArrowLeft size={16} /> {t("btn_back")}
                  </button>

                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${mode === "auto"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      : mode === "manual"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                      }`}
                  >
                    {mode === "auto"
                      ? t("mode_auto")
                      : mode === "manual"
                        ? t("mode_manual")
                        : t("mode_free")}
                  </span>

                  {mode !== "free_choose" && (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-md ${unassignedParticipants.length > 0
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                    >
                      {t("unassigned_count", {
                        count: unassignedParticipants.length,
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Duration quick display / editor */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121214] border border-[#3f3f46] rounded-lg text-xs">
                    <Clock size={14} className="text-amber-400" />
                    <input
                      type="number"
                      min={1}
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(Math.max(1, Number(e.target.value)))
                      }
                      className="w-8 bg-transparent text-center font-mono font-bold text-white outline-none"
                    />
                    <span className="text-slate-400">{t("minutes_unit")}</span>
                  </div>

                  {/* Shuffle again (Auto mode only) */}
                  {mode === "auto" && (
                    <button
                      onClick={handleShuffleAgain}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#323238] text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[#3f3f46] transition-colors"
                      title={t("shuffle_again")}
                    >
                      <RefreshCw size={13} /> {t("shuffle_again")}
                    </button>
                  )}

                  {/* Add Room button */}
                  <button
                    onClick={handleAddRoom}
                    className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={14} /> {t("add_room")}
                  </button>
                </div>
              </div>

              {/* Step 2 Rooms Content */}
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#141416]">
                {mode === "free_choose" && (
                  <div className="mb-5 p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-xs flex items-center gap-2.5">
                    <Sparkles size={18} className="shrink-0 text-purple-400" />
                    <span>{t("free_choose_notice")}</span>
                  </div>
                )}

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => {
                    const isEditing = editingRoomId === room.id;

                    return (
                      <div
                        key={room.id}
                        className="bg-[#1e1e22] border border-[#2e2e34] hover:border-[#3f3f48] rounded-xl flex flex-col overflow-hidden transition-all shadow-md"
                      >
                        {/* Room Card Header */}
                        <div className="p-3 bg-[#18181b] border-b border-[#2e2e34] flex items-center justify-between gap-2">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingRoomName}
                                  onChange={(e) => setEditingRoomName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveRoomName(room.id);
                                    if (e.key === "Escape") setEditingRoomId(null);
                                  }}
                                  className="w-full bg-[#121214] border border-blue-500 text-white text-xs font-bold rounded px-2 py-1 outline-none"
                                />
                                <button
                                  onClick={() => handleSaveRoomName(room.id)}
                                  className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                                >
                                  <Check size={14} />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() =>
                                  handleStartRenameRoom(room.id, room.name)
                                }
                                className="group/name flex items-center gap-1.5 cursor-pointer truncate"
                                title={t("rename_room")}
                              >
                                <span className="font-bold text-sm text-slate-100 truncate">
                                  {room.name}
                                </span>
                                <Edit2
                                  size={12}
                                  className="text-slate-500 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {mode !== "free_choose" && (
                              <span className="text-[11px] font-bold text-slate-400 bg-[#27272a] px-2 py-0.5 rounded-full border border-[#3f3f46]">
                                {room.assignedUserIds.length}
                              </span>
                            )}

                            {/* Add User Button */}
                            {mode !== "free_choose" && (
                              <button
                                onClick={() => handleOpenAddModal(room.id)}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md transition-colors"
                                title={t("add_participants")}
                              >
                                <UserPlus size={15} />
                              </button>
                            )}

                            {/* Delete Room Button */}
                            <button
                              onClick={() => handleDeleteRoom(room.id)}
                              disabled={rooms.length <= 1}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent rounded-md transition-colors"
                              title={t("delete_room_tooltip")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Room Card Body (Participants List) */}
                        <div className="p-3 flex-1 min-h-[140px] max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
                          {mode === "free_choose" ? (
                            <div className="m-auto text-center py-6 text-slate-500 text-xs italic flex flex-col items-center gap-2">
                              <Users size={20} className="text-slate-600" />
                              <span>{t("mode_free_desc")}</span>
                            </div>
                          ) : room.assignedUserIds.length === 0 ? (
                            <div className="m-auto text-center py-6 flex flex-col items-center gap-2">
                              <p className="text-slate-500 text-xs italic">
                                {t("no_participants")}
                              </p>
                              <button
                                onClick={() => handleOpenAddModal(room.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md flex items-center gap-1 transition-colors"
                              >
                                <Plus size={13} /> {t("add_participants")}
                              </button>
                            </div>
                          ) : (
                            room.assignedUserIds.map((userId) => {
                              const pInfo = getParticipantInfo(userId);
                              const isMenuOpen = activeMenuUserId === userId;

                              return (
                                <div
                                  key={userId}
                                  className="relative flex items-center justify-between p-2 rounded-lg bg-[#141416] border border-[#27272a] hover:border-[#3f3f46] text-xs font-medium text-slate-200 transition-colors group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {pInfo.initial}
                                    </div>
                                    <span className="truncate">{pInfo.name}</span>
                                  </div>

                                  {/* Action Menu Trigger */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isMenuOpen) {
                                        setActiveMenuUserId(null);
                                        setActiveSubMenu(null);
                                      } else {
                                        setActiveMenuUserId(userId);
                                        setActiveSubMenu(null);
                                      }
                                    }}
                                    className={`p-1 rounded text-slate-400 hover:text-white hover:bg-[#27272a] transition-colors ${isMenuOpen
                                      ? "text-white bg-[#27272a]"
                                      : "opacity-60 group-hover:opacity-100"
                                      }`}
                                  >
                                    <MoreVertical size={14} />
                                  </button>

                                  {/* Dropdown Menu Popover */}
                                  {isMenuOpen && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full mt-1 z-50 w-56 bg-[#1f1f23] border border-[#3f3f46] rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 animate-scale-in"
                                    >
                                      {/* Menu Option 1: Remove */}
                                      <button
                                        onClick={() =>
                                          handleRemoveParticipant(room.id, userId)
                                        }
                                        className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                      >
                                        <UserMinus size={14} />
                                        {t("remove_from_room")}
                                      </button>

                                      {/* Menu Option 2: Move to another room */}
                                      <div className="relative">
                                        <button
                                          onClick={() =>
                                            setActiveSubMenu((prev) =>
                                              prev === "move" ? null : "move",
                                            )
                                          }
                                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${activeSubMenu === "move"
                                            ? "bg-[#2c2c32] text-blue-400"
                                            : "text-slate-300 hover:bg-[#27272a]"
                                            }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <ArrowRightCircle size={14} />
                                            {t("move_to_room")}
                                          </div>
                                          <ArrowRight size={12} className="opacity-60" />
                                        </button>

                                        {activeSubMenu === "move" && (
                                          <div className="mt-1 p-1 bg-[#141416] border border-[#3f3f46] rounded-lg max-h-36 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
                                            {rooms
                                              .filter((r) => r.id !== room.id)
                                              .map((otherRoom) => (
                                                <button
                                                  key={otherRoom.id}
                                                  onClick={() =>
                                                    handleMoveParticipant(
                                                      room.id,
                                                      otherRoom.id,
                                                      userId,
                                                    )
                                                  }
                                                  className="w-full px-2 py-1 text-left text-[11px] font-medium text-slate-300 hover:text-white hover:bg-blue-600/20 rounded truncate transition-colors"
                                                >
                                                  {otherRoom.name}
                                                </button>
                                              ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Menu Option 3: Exchange with participant in another room */}
                                      <div className="relative">
                                        <button
                                          onClick={() =>
                                            setActiveSubMenu((prev) =>
                                              prev === "exchange" ? null : "exchange",
                                            )
                                          }
                                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${activeSubMenu === "exchange"
                                            ? "bg-[#2c2c32] text-amber-400"
                                            : "text-slate-300 hover:bg-[#27272a]"
                                            }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <ArrowRightLeft size={14} />
                                            {t("exchange_with")}
                                          </div>
                                          <ArrowRight size={12} className="opacity-60" />
                                        </button>

                                        {activeSubMenu === "exchange" && (
                                          <div className="mt-1 p-1 bg-[#141416] border border-[#3f3f46] rounded-lg max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                            {rooms
                                              .filter((r) => r.id !== room.id)
                                              .flatMap((otherRoom) =>
                                                otherRoom.assignedUserIds.map((otherUid) => ({
                                                  room: otherRoom,
                                                  uid: otherUid,
                                                  info: getParticipantInfo(otherUid),
                                                })),
                                              )
                                              .map(({ room: oRoom, uid: oUid, info: oInfo }) => (
                                                <button
                                                  key={oUid}
                                                  onClick={() =>
                                                    handleExchangeParticipant(
                                                      room.id,
                                                      userId,
                                                      oRoom.id,
                                                      oUid,
                                                    )
                                                  }
                                                  className="w-full px-2 py-1 text-left text-[11px] font-medium text-slate-300 hover:text-white hover:bg-amber-500/20 rounded flex items-center justify-between gap-2 transition-colors"
                                                >
                                                  <span className="truncate">{oInfo.name}</span>
                                                  <span className="text-[9px] text-slate-500 shrink-0">
                                                    ({oRoom.name})
                                                  </span>
                                                </button>
                                              ))}

                                            {rooms.filter(
                                              (r) =>
                                                r.id !== room.id &&
                                                r.assignedUserIds.length > 0,
                                            ).length === 0 && (
                                                <p className="text-[10px] text-slate-500 italic p-1">
                                                  Không có người ở phòng khác
                                                </p>
                                              )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= MULTI-SELECT ADD PARTICIPANTS MODAL ================= */}
          {addModalTargetRoomId && targetRoomForAdd && (
            <div className="absolute inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#1f1f23] border border-[#3f3f46] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
              >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-[#2e2e34] flex items-center justify-between bg-[#18181b]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {t("select_participants_title", {
                        roomName: targetRoomForAdd.name,
                      })}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {t("unassigned_count", {
                        count: unassignedParticipants.length,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setAddModalTargetRoomId(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search & Select All */}
                <div className="p-3 border-b border-[#2e2e34] bg-[#18181b]/50 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder={t("search_participant")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 bg-[#121214] border border-[#3f3f46] text-white text-xs rounded-lg focus:border-blue-500 outline-none"
                    />
                  </div>

                  {filteredUnassigned.length > 0 && (
                    <button
                      onClick={() => {
                        if (
                          selectedUserIdsToAdd.length === filteredUnassigned.length
                        ) {
                          setSelectedUserIdsToAdd([]);
                        } else {
                          setSelectedUserIdsToAdd(
                            filteredUnassigned.map((p) => p.identity),
                          );
                        }
                      }}
                      className="px-2.5 py-1 bg-[#27272a] hover:bg-[#323238] text-slate-300 text-xs font-semibold rounded-lg shrink-0 border border-[#3f3f46] transition-colors"
                    >
                      {selectedUserIdsToAdd.length === filteredUnassigned.length
                        ? t("deselect_all")
                        : t("select_all")}
                    </button>
                  )}
                </div>

                {/* Participant List */}
                <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 bg-[#141416]">
                  {filteredUnassigned.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs italic">
                      {t("no_unassigned_found")}
                    </div>
                  ) : (
                    filteredUnassigned.map((p) => {
                      const isSelected = selectedUserIdsToAdd.includes(p.identity);
                      return (
                        <div
                          key={p.identity}
                          onClick={() => handleToggleUserSelection(p.identity)}
                          className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between gap-3 transition-colors ${isSelected
                            ? "bg-blue-600/15 border-blue-500/50 text-white"
                            : "bg-[#1e1e22] border-[#2e2e34] hover:border-[#3f3f46] text-slate-300"
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {(p.name || p.identity).charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium truncate">
                              {p.name || p.identity}
                            </span>
                          </div>

                          <div className="shrink-0 text-blue-400">
                            {isSelected ? (
                              <CheckSquare size={18} />
                            ) : (
                              <Square size={18} className="text-slate-500" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-[#2e2e34] bg-[#18181b] flex items-center justify-end gap-2">
                  <button
                    onClick={() => setAddModalTargetRoomId(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-[#27272a] rounded-lg transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleConfirmAddUsers}
                    disabled={selectedUserIdsToAdd.length === 0}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    {t("add_selected", { count: selectedUserIdsToAdd.length })}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-[#27272a] bg-[#121214] flex items-center justify-between shrink-0">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#27272a] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={15} /> {t("btn_back")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-[#27272a] rounded-lg transition-colors"
            >
              {t("cancel")}
            </button>

            {step === 1 ? (
              <button
                onClick={handleProceedToStep2}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
              >
                {t("btn_next")}
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
              >
                {isLoading && <Loader2 size={15} className="animate-spin" />}
                {t("start_breakout")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
