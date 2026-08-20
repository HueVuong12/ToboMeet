import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  Text,
  Modal,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { toast } from "../../lib/toast";
import { useHandRaise } from "../../hooks/useHandRaise";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoomSettings } from "../../hooks/useRoomSettings";
import { useParticipantManager } from "../../hooks/useParticipantManager";
import { useMeetingSessionContext } from "./contexts/MeetingSessionContext";
import InviteMemberModal from "./InviteMemberModal";
import CreateBreakoutModal from "./CreateBreakoutModal";
import JoinBreakoutModal from "./JoinBreakoutModal";
import { useTranslation } from "react-i18next";

export default function MobileToolbar({
  initialFacingMode,
  roomId,
  channelId,
  meetingCode,
  onOpenMembers,
  onOpenChat,
}: {
  initialFacingMode?: "user" | "environment";
  roomId: string;
  channelId: string;
  meetingCode: string;
  onOpenMembers: () => void;
  onOpenChat: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();
  const { handleReturnToMain, isLeavingBreakout } = useMeetingSessionContext();

  const {
    isHost,
    isChatEnabled,
    isWaitingRoomEnabled,
    approvalPermission,
    isBreakoutActive,
    breakoutRoomsList,
    roomType,
    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
    handleEndBreakout,
  } = useRoomSettings({
    roomId,
    channelId,
    meetingCode,
  });

  const isInBreakoutRoom = roomType === "breakout";

  const { displayParticipants } = useParticipantManager({
    roomId,
    channelId,
    meetingCode,
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBreakoutModalOpen, setIsBreakoutModalOpen] = useState(false);
  const [isJoinBreakoutModalOpen, setIsJoinBreakoutModalOpen] = useState(false);

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode || "user",
  );

  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isApprovalSubmenuOpen, setIsApprovalSubmenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  const handleFlipCamera = async () => {
    const trackPublication = localParticipant.videoTrackPublications
      .values()
      .next().value;

    if (trackPublication?.videoTrack) {
      const videoTrack = trackPublication.videoTrack;
      const newFacingMode = facingMode === "user" ? "environment" : "user";

      try {
        await videoTrack.restartTrack({ facingMode: newFacingMode });
        setFacingMode(newFacingMode);
      } catch (error) {
        console.error(error);
        toast.error(t("meeting.toolbar.toast_flip_error"));
      }
    }
  };

  const handleCopyLink = async () => {
    setIsCopied(true);
    toast.success(t("meeting.toolbar.toast_link_copied"));

    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleLeaveClick = () => {
    if (isInBreakoutRoom) {
      Alert.alert(
        t("meeting.toolbar.leave_breakout_confirm_title", {
          defaultValue: "Rời phòng thảo luận",
        }),
        t("meeting.toolbar.leave_breakout_confirm_desc", {
          defaultValue:
            "Bạn muốn quay về phòng họp chính hay rời hẳn cuộc họp?",
        }),
        [
          {
            text: t("meeting.toolbar.cancel", { defaultValue: "Hủy" }),
            style: "cancel",
          },
          {
            text: t("meeting.toolbar.return_to_main_action", {
              defaultValue: "Quay về phòng chính",
            }),
            onPress: () => handleReturnToMain(room.name),
          },
          {
            text: t("meeting.toolbar.leave_meeting", {
              defaultValue: "Rời cuộc họp",
            }),
            style: "destructive",
            onPress: () => room.disconnect(),
          },
        ],
      );
    } else {
      Alert.alert(
        t("meeting.toolbar.confirm_leave_title"),
        t("meeting.toolbar.confirm_leave_desc"),
        [
          { text: t("meeting.toolbar.cancel"), style: "cancel" },
          {
            text: t("meeting.toolbar.leave_action"),
            style: "destructive",
            onPress: () => room.disconnect(),
          },
        ],
      );
    }
  };

  // UI Component: Nút Switch tùy chỉnh
  const CustomSwitch = ({ value }: { value: boolean }) => (
    <View
      className={`w-11 h-6 rounded-full justify-center px-0.5 ${
        value ? "bg-emerald-500" : "bg-gray-600"
      }`}
    >
      <View
        className={`w-5 h-5 rounded-full bg-white ${
          value ? "self-end" : "self-start"
        }`}
      />
    </View>
  );

  return (
    <>
      <View className="bg-[#111] border-t border-[#333] h-14">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="items-center"
        >
          {/* Nút Camera */}
          <TouchableOpacity
            onPress={toggleCam}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Feather
              name={isCameraEnabled ? "video" : "video-off"}
              size={20}
              color={isCameraEnabled ? "#d1d5db" : "#ef4444"}
            />
            <Text
              className={`text-[10px] mt-1 font-medium ${isCameraEnabled ? "text-gray-300" : "text-red-500"}`}
            >
              {t("meeting.toolbar.camera")}
            </Text>
          </TouchableOpacity>

          {/* Nút Lật Camera */}
          <TouchableOpacity
            onPress={handleFlipCamera}
            disabled={!isCameraEnabled}
            className={`min-w-[60px] h-14 justify-center items-center ${isCameraEnabled ? "opacity-100" : "opacity-40"}`}
          >
            <Feather name="refresh-ccw" size={20} color="#d1d5db" />
            <Text className="text-gray-300 text-[10px] mt-1 font-medium">
              {t("meeting.toolbar.flip_camera")}
            </Text>
          </TouchableOpacity>

          {/* Nút Mic */}
          <TouchableOpacity
            onPress={toggleMic}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Feather
              name={isMicrophoneEnabled ? "mic" : "mic-off"}
              size={20}
              color={isMicrophoneEnabled ? "#d1d5db" : "#ef4444"}
            />
            <Text
              className={`text-[10px] mt-1 font-medium ${isMicrophoneEnabled ? "text-gray-300" : "text-red-500"}`}
            >
              {t("meeting.toolbar.mic")}
            </Text>
          </TouchableOpacity>

          {/* Nút Thành Viên */}
          <TouchableOpacity
            onPress={onOpenMembers}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Feather name="users" size={20} color="#d1d5db" />
            <Text className="text-gray-300 text-[10px] mt-1 font-medium">
              {t("meeting.toolbar.participants")}
            </Text>
          </TouchableOpacity>

          {/* Nút Chat */}
          <TouchableOpacity
            onPress={onOpenChat}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Feather name="message-square" size={20} color="#d1d5db" />
            <Text className="text-gray-300 text-[10px] mt-1 font-medium">
              {t("meeting.toolbar.chat")}
            </Text>
          </TouchableOpacity>

          {/* Nút Giơ tay */}
          <TouchableOpacity
            onPress={toggleHandRaise}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Ionicons
              name="hand-left"
              size={20}
              color={isLocalHandRaised ? "#f59e0b" : "#d1d5db"}
            />
            <Text
              className={`text-[10px] mt-1 font-medium ${isLocalHandRaised ? "text-amber-500" : "text-gray-300"}`}
            >
              {t("meeting.toolbar.raise_hand")}
            </Text>
          </TouchableOpacity>

          {/* Nút Breakout (Nếu đang có phiên) */}
          {isBreakoutActive && (
            <TouchableOpacity
              onPress={() => setIsJoinBreakoutModalOpen(true)}
              className="min-w-[60px] h-14 justify-center items-center"
            >
              <Feather name="grid" size={20} color="#60a5fa" />
              <Text className="text-blue-400 text-[10px] mt-1 font-bold">
                {t("meeting.toolbar.breakout", { defaultValue: "Breakout" })}
              </Text>
            </TouchableOpacity>
          )}

          {/* Nút Quản lý/Tùy chọn */}
          <TouchableOpacity
            onPress={() => setShowAdminMenu(true)}
            className="min-w-[60px] h-14 justify-center items-center"
          >
            <Feather name="more-vertical" size={20} color="#d1d5db" />
            <Text className="text-gray-300 text-[10px] mt-1 font-medium">
              {t("meeting.toolbar.options")}
            </Text>
          </TouchableOpacity>

          {/* Nút Rời đi */}
          <TouchableOpacity
            onPress={handleLeaveClick}
            disabled={isLeavingBreakout}
            className="min-w-[60px] h-14 justify-center items-center px-3"
          >
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text className="text-red-500 text-[10px] mt-1 font-bold">
              {isInBreakoutRoom
                ? t("meeting.toolbar.leave_short", { defaultValue: "Rời đi" })
                : t("meeting.toolbar.leave_meeting")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* MENU TÙY CHỌN CHUNG & QUẢN TRỊ (BOTTOM SHEET) */}
      <Modal visible={showAdminMenu} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          style={{
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          }}
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowAdminMenu(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-[#222] p-5 rounded-t-2xl border border-[#333]"
          >
            <View className="w-10 h-1 bg-[#444] rounded-full self-center mb-4" />

            {/* TÙY CHỌN CHUNG (AI CŨNG THẤY) */}
            <Text className="text-gray-400 text-[11px] font-bold mb-3 uppercase">
              {t("meeting.toolbar.general_options")}
            </Text>

            <TouchableOpacity
              onPress={handleCopyLink}
              className="flex-row items-center py-3.5 px-3 bg-[#111] rounded-lg border border-[#333] mb-2"
            >
              <Feather
                name={isCopied ? "check" : "copy"}
                size={20}
                color={isCopied ? "#10b981" : "#d1d5db"}
              />
              <Text
                className={`ml-3 text-sm font-medium ${isCopied ? "text-emerald-500" : "text-gray-300"}`}
              >
                {isCopied
                  ? t("meeting.toolbar.link_copied")
                  : t("meeting.toolbar.copy_link")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowAdminMenu(false); // Đóng menu tùy chọn
                setTimeout(() => setIsInviteModalOpen(true), 300);
              }}
              className="flex-row items-center py-3.5 px-3 bg-[#111] rounded-lg border border-[#333] mb-2"
            >
              <Feather name="user-plus" size={20} color="#d1d5db" />
              <Text className="ml-3 text-sm font-medium text-gray-300">
                {t("meeting.toolbar.invite_participants")}
              </Text>
            </TouchableOpacity>

            {/* CÔNG CỤ QUẢN TRỊ (CHỈ HOST MỚI THẤY) */}
            {isHost && (
              <>
                <View className="h-[1px] bg-[#333] my-3" />

                <Text className="text-gray-400 text-[11px] font-bold mb-3 uppercase">
                  {t("meeting.toolbar.admin_tools")}
                </Text>

                {/* Quản lý Breakout Room (Tạo / Kết thúc) */}
                {!isBreakoutActive ? (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAdminMenu(false);
                      setTimeout(() => setIsBreakoutModalOpen(true), 300);
                    }}
                    className="flex-row items-center justify-between py-3.5 px-3 bg-[#111] rounded-lg border border-[#333] mb-2"
                  >
                    <View className="flex-row items-center">
                      <Feather name="grid" size={20} color="#60a5fa" />
                      <Text className="text-gray-300 ml-3 text-sm font-medium">
                        {t("meeting.toolbar.create_breakout", {
                          defaultValue: "Chia nhóm thảo luận",
                        })}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      setShowAdminMenu(false);
                      await handleEndBreakout();
                    }}
                    className="flex-row items-center justify-between py-3.5 px-3 bg-red-500/10 rounded-lg border border-red-500/30 mb-2"
                  >
                    <View className="flex-row items-center">
                      <Feather name="square" size={20} color="#ef4444" />
                      <Text className="text-red-400 ml-3 text-sm font-bold">
                        {t("meeting.toolbar.end_breakout", {
                          defaultValue: "Kết thúc thảo luận",
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Switch Bật/Tắt Chat */}
                <TouchableOpacity
                  onPress={handleToggleChat}
                  className="flex-row items-center justify-between py-3.5 px-3 bg-[#111] rounded-lg border border-[#333] mb-2"
                >
                  <View className="flex-row items-center">
                    <Feather
                      name="message-square"
                      size={20}
                      color={isChatEnabled ? "#10b981" : "#6b7280"}
                    />
                    <Text className="text-gray-300 ml-3 text-sm font-medium">
                      {t("meeting.toolbar.enable_chat")}
                    </Text>
                  </View>
                  <CustomSwitch value={isChatEnabled} />
                </TouchableOpacity>

                {/* Switch Bật/Tắt Phòng chờ */}
                <TouchableOpacity
                  onPress={handleToggleWaitingRoom}
                  className="flex-row items-center justify-between py-3.5 px-3 bg-[#111] rounded-lg border border-[#333] mb-2"
                >
                  <View className="flex-row items-center">
                    <Feather
                      name="shield"
                      size={20}
                      color={isWaitingRoomEnabled ? "#10b981" : "#6b7280"}
                    />
                    <Text className="text-gray-300 ml-3 text-sm font-medium">
                      {t("meeting.toolbar.waiting_room")}
                    </Text>
                  </View>
                  <CustomSwitch value={isWaitingRoomEnabled} />
                </TouchableOpacity>

                {/* Submenu: Chỉ định ai có thể duyệt */}
                {isWaitingRoomEnabled && (
                  <View className="bg-[#111] rounded-lg border border-[#333] overflow-hidden">
                    <TouchableOpacity
                      onPress={() =>
                        setIsApprovalSubmenuOpen(!isApprovalSubmenuOpen)
                      }
                      className="flex-row items-center justify-between py-3.5 px-3"
                    >
                      <View className="flex-row items-center">
                        <Feather name="user-check" size={20} color="#6b7280" />
                        <Text className="text-gray-300 ml-3 text-sm font-medium">
                          {t("meeting.toolbar.approval_permission")}
                        </Text>
                      </View>
                      <Feather
                        name={
                          isApprovalSubmenuOpen
                            ? "chevron-down"
                            : "chevron-right"
                        }
                        size={20}
                        color="#6b7280"
                      />
                    </TouchableOpacity>

                    {isApprovalSubmenuOpen && (
                      <View className="border-t border-[#333] bg-[#1a1a1a]">
                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateApprovalPermission("admin_only")
                          }
                          className="flex-row items-center py-3 px-4"
                        >
                          <Feather
                            name="check"
                            size={16}
                            color={
                              approvalPermission === "admin_only"
                                ? "#10b981"
                                : "transparent"
                            }
                          />
                          <Text className="text-gray-300 ml-3 text-[13px]">
                            {t("meeting.toolbar.admin_only")}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateApprovalPermission("member_and_admin")
                          }
                          className="flex-row items-center py-3 px-4"
                        >
                          <Feather
                            name="check"
                            size={16}
                            color={
                              approvalPermission === "member_and_admin"
                                ? "#10b981"
                                : "transparent"
                            }
                          />
                          <Text className="text-gray-300 ml-3 text-[13px]">
                            {t("meeting.toolbar.member_and_admin")}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateApprovalPermission("everyone")
                          }
                          className="flex-row items-center py-3 px-4"
                        >
                          <Feather
                            name="check"
                            size={16}
                            color={
                              approvalPermission === "everyone"
                                ? "#10b981"
                                : "transparent"
                            }
                          />
                          <Text className="text-gray-300 ml-3 text-[13px]">
                            {t("meeting.toolbar.everyone")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
        meetingCode={meetingCode}
        displayParticipants={displayParticipants}
      />

      <CreateBreakoutModal
        isOpen={isBreakoutModalOpen}
        onClose={() => setIsBreakoutModalOpen(false)}
        meetingCode={meetingCode}
      />

      <JoinBreakoutModal
        isOpen={isJoinBreakoutModalOpen}
        onClose={() => setIsJoinBreakoutModalOpen(false)}
        rooms={breakoutRoomsList}
        meetingCode={meetingCode}
      />
    </>
  );
}

