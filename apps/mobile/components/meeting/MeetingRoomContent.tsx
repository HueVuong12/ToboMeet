import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRoomContext } from "@livekit/react-native";
import { Participant, RoomEvent } from "livekit-client";
import { Feather } from "@expo/vector-icons";
import { toast } from "../../lib/toast";

import MobileToolbar from "../../components/meeting/MobileToolbar";
import MobileVideoGrid from "../../components/meeting/MobileVideoGrid";
import MembersModal from "../../components/meeting/MembersModal";
import MobileChatModal from "../../components/meeting/MobileChatModal";
import { useParticipantManager } from "../../hooks/useParticipantManager";
import { useTranslation } from "react-i18next";
import { useBreakoutSync } from "../../hooks/useBreakoutSync";
import { useRoomSettings } from "../../hooks/useRoomSettings";
import { useBreakoutTimer } from "../../hooks/useBreakoutTimer";

export default function MeetingRoomContent({
  meetingData,
  meetingCode,
  handleDisconnect,
}: any) {
  const { t } = useTranslation();
  const room = useRoomContext();

  // Lắng nghe các sự kiện đồng bộ breakout
  useBreakoutSync();

  const { roomName, roomType, breakoutStartedAt, breakoutDuration } =
    useRoomSettings({
      roomId: meetingData.roomId,
      channelId: meetingData.channelId,
      meetingCode,
    });

  const isBreakoutRoom = roomType === "breakout";

  const timeDisplay = useBreakoutTimer({
    startedAt: breakoutStartedAt,
    durationMinutes: breakoutDuration,
    meetingCode,
  });

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const { displayParticipants } = useParticipantManager({
    roomId: meetingData.roomId,
    channelId: meetingData.channelId,
    meetingCode: meetingCode,
  });

  const [participantStatus, setParticipantStatus] = useState(() => {
    try {
      const base64Url = meetingData.token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      let jsonPayload = "";
      if (typeof window !== "undefined" && window.atob) {
        jsonPayload = decodeURIComponent(
          window
            .atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join(""),
        );
      } else {
        const Buffer = require("buffer").Buffer;
        jsonPayload = Buffer.from(base64, "base64").toString("utf8");
      }
      const payload = JSON.parse(jsonPayload);

      if (payload.metadata) {
        const meta = JSON.parse(payload.metadata);
        return meta.status || "joined";
      }
    } catch (e) {
      console.error("Lỗi parse JWT:", e);
    }
    return "joined";
  });

  useEffect(() => {
    const handleMetadataChanged = (
      prevMetadata: string | undefined,
      participant: Participant,
    ) => {
      if (participant.identity === room.localParticipant?.identity) {
        try {
          if (participant.metadata) {
            const meta = JSON.parse(participant.metadata);
            const prevMeta = prevMetadata ? JSON.parse(prevMetadata) : null;

            if (
              meta.status &&
              meta.status === "joined" &&
              prevMeta?.status !== "joined" // Chỉ thông báo khi trạng thái thay đổi từ "waiting" sang "joined"
            ) {
              toast.success(t("meeting.meeting_page.toast_approved"));
            }

            if (meta.status) {
              setParticipantStatus(meta.status);
            }
          }
        } catch (e) {
          console.error("Lỗi parse metadata:", e);
        }
      }
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [room]);

  // GIAO DIỆN KHI ĐANG Ở PHÒNG CHỜ
  if (participantStatus === "waiting") {
    return (
      <View className="flex-1 bg-[#111] items-center justify-center p-4">
        {/* Khối chứa Text và Spinner */}
        <View className="flex-row items-center mb-3">
          <Text className="text-2xl font-bold text-white tracking-wide mr-3">
            {t("meeting.meeting_page.waiting_title")}
          </Text>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>

        <Text className="text-gray-400 text-center text-sm leading-5 mb-8 mt-2 px-6">
          {t("meeting.meeting_page.waiting_desc")}
        </Text>

        {/* HIỂN THỊ TỐI ĐA 5 NGƯỜI ĐANG TRONG CUỘC HỌP */}
        {displayParticipants.length > 0 ? (
          <View className="w-full bg-[#1a1a1a] rounded-2xl p-5 border border-[#333] mb-8">
            <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5 text-center">
              {t("meeting.meeting_page.in_meeting_header")}
            </Text>

            <View className="flex-row flex-wrap justify-center gap-4">
              {displayParticipants.slice(0, 5).map((p) => {
                let avatarUrl = "";
                try {
                  if (p.metadata) {
                    const meta = JSON.parse(p.metadata);
                    avatarUrl = meta.avatarUrl;
                  }
                } catch (e) {
                  console.error(
                    "Lỗi phân tích metadata của người tham gia:",
                    e,
                  );
                }

                return (
                  <View key={p.identity} className="items-center w-14">
                    <View className="relative mb-2">
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          className="w-12 h-12 rounded-full border-2 border-[#333]"
                        />
                      ) : (
                        <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center border-2 border-[#333]">
                          <Text className="text-slate-300 font-bold text-sm uppercase">
                            {p.name?.charAt(0) || "?"}
                          </Text>
                        </View>
                      )}
                      <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full" />
                    </View>
                    <Text
                      className="text-[10px] text-slate-300 text-center w-full"
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* DÒNG CHỮ HIỂN THỊ SỐ NGƯỜI CÒN LẠI */}
            {displayParticipants.length > 5 && (
              <Text className="mt-5 text-center text-xs font-medium text-slate-400">
                {t("meeting.meeting_page.other_participants_count", {
                  count: displayParticipants.length - 5,
                })}
              </Text>
            )}
          </View>
        ) : (
          <Text className="text-sm text-slate-400 text-center mb-8">
            {t("meeting.meeting_page.no_one_in_meeting")}
          </Text>
        )}

        <TouchableOpacity
          onPress={handleDisconnect}
          className="px-6 py-3 bg-[#222] border border-[#333] rounded-xl"
        >
          <Text className="text-gray-300 font-medium text-sm">
            {t("meeting.meeting_page.leave_waiting_room")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // GIAO DIỆN KHI ĐÃ ĐƯỢC DUYỆT VÀO PHÒNG
  return (
    <View className="flex-1 bg-black">
      <View className="h-[70px] justify-center items-center bg-[#111] border-b border-[#333] px-4">
        {isBreakoutRoom ? (
          <View className="items-center">
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <Feather name="grid" size={12} color="#60a5fa" />
              <Text className="text-blue-400 text-[11px] font-bold uppercase tracking-wider">
                {roomName || "Breakout Room"}
              </Text>
            </View>
            {timeDisplay && (
              <View className="flex-row items-center gap-1 bg-[#222] px-2.5 py-0.5 rounded-full border border-[#333]">
                <Feather name="clock" size={11} color="#f59e0b" />
                <Text className="text-amber-400 font-mono font-bold text-xs">
                  {timeDisplay}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <Text className="text-gray-400 text-xs uppercase font-bold">
              {t("meeting.meeting_page.room_header")}
            </Text>
            <Text className="text-white font-bold text-base">{meetingCode}</Text>
          </>
        )}
      </View>

      <View className="flex-1">
        <MobileVideoGrid />
      </View>

      <MobileToolbar
        meetingCode={meetingCode}
        roomId={meetingData.roomId}
        channelId={meetingData.channelId}
        initialFacingMode={
          meetingData.cameraFacing === "back" ? "environment" : "user"
        }
        onOpenMembers={() => setShowMembersModal(true)}
        onOpenChat={() => setShowChatModal(true)}
      />

      <MembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        roomId={meetingData.roomId}
        channelId={meetingData.channelId}
        meetingCode={meetingCode}
      />

      <MobileChatModal
        meetingCode={meetingCode}
        roomId={meetingData.roomId}
        channelId={meetingData.channelId}
        visible={showChatModal}
        onClose={() => setShowChatModal(false)}
      />
    </View>
  );
}
