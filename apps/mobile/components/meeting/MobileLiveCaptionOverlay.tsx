import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Room } from "livekit-client";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useLiveCaptions, LiveCaptionItem } from "../../hooks/useLiveCaptions";

interface MobileLiveCaptionOverlayProps {
  room: Room | undefined;
  enabled: boolean;
  onClose: () => void;
}

export default function MobileLiveCaptionOverlay({
  room,
  enabled,
  onClose,
}: MobileLiveCaptionOverlayProps) {
  const { t } = useTranslation();
  const { captions } = useLiveCaptions(room, enabled);
  const scrollViewRef = useRef<ScrollView>(null);
  const isAtBottomRef = useRef(true);

  // Khi mở overlay, mặc định cuộn xuống dưới cùng để thấy câu mới nhất
  useEffect(() => {
    if (enabled) {
      isAtBottomRef.current = true;
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  // Tự động cuộn xuống dưới cùng khi có phụ đề mới, trừ khi người dùng đang lướt lên xem tin cũ
  useEffect(() => {
    if (isAtBottomRef.current && captions.length > 0) {
      const timer = setTimeout(() => {
        if (isAtBottomRef.current) {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [captions]);

  // Nhận diện khi người dùng lướt lên xem tin cũ hay đang ở cuối danh sách
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) {
      isAtBottomRef.current = true;
      return;
    }
    const paddingToBottom = 25;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isAtBottomRef.current = isCloseToBottom;
  };

  // Nhóm các đoạn thoại liên tiếp của cùng một người nói
  const groupedCaptions = useMemo(() => {
    if (!captions || captions.length === 0) return [];

    const localIdentity = room?.localParticipant?.identity;
    const groups: {
      speakerId?: string;
      speakerName: string;
      isSelf: boolean;
      items: LiveCaptionItem[];
    }[] = [];

    for (let i = 0; i < captions.length; i++) {
      const item = captions[i];
      const isSelf =
        Boolean(item.speakerId && localIdentity && item.speakerId === localIdentity) ||
        item.speakerName === "Bạn" ||
        item.speakerName === room?.localParticipant?.name;

      const speakerName = isSelf
        ? t("meeting.toolbar.you", { defaultValue: "Bạn" })
        : item.speakerName || t("meeting.toolbar.participant", { defaultValue: "Người tham gia" });

      const prevGroup = groups[groups.length - 1];
      const isSameSpeaker =
        prevGroup &&
        ((item.speakerId && prevGroup.speakerId === item.speakerId) ||
          prevGroup.speakerName === speakerName);

      if (isSameSpeaker) {
        prevGroup.items.push(item);
      } else {
        groups.push({
          speakerId: item.speakerId,
          speakerName,
          isSelf,
          items: [item],
        });
      }
    }

    return groups;
  }, [captions, room, t]);

  if (!enabled) return null;

  return (
    <View className="w-full bg-[#111113]/95 border-t border-b border-[#232328] px-3 py-2 z-20">
      {/* Header bar: Tiêu đề phụ đề + Nút tắt thu gọn */}
      <View className="flex-row items-center justify-between pb-1.5 border-b border-white/5 mb-1.5">
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons name="subtitles-outline" size={14} color="#60a5fa" />
          <Text className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            {t("meeting.toolbar.live_captions", { defaultValue: "Phụ đề trực tiếp" })}
          </Text>
          <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          {captions.length > 0 && (
            <Text className="text-[9px] text-slate-500 font-mono ml-1">
              ({captions.length}/50)
            </Text>
          )}
        </View>

        {/* Nút đóng / ẩn phụ đề */}
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          className="w-5 h-5 rounded-full bg-white/10 items-center justify-center border border-white/10"
        >
          <Feather name="x" size={12} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Danh sách bong bóng phụ đề (Có thể lướt lên xem lại tối đa 50 câu) */}
      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        onContentSizeChange={() => {
          if (isAtBottomRef.current) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
        style={{ maxHeight: 150 }}
        contentContainerStyle={{ flexGrow: 1, paddingVertical: 2 }}
      >
        {groupedCaptions.length === 0 ? (
          <View className="py-4 items-center justify-center flex-row gap-2">
            <Feather name="mic" size={12} color="#64748b" />
            <Text className="text-xs text-slate-400 italic">
              {t("meeting.toolbar.listening_captions", {
                defaultValue: "Đang lắng nghe âm thanh cuộc họp...",
              })}
            </Text>
          </View>
        ) : (
          groupedCaptions.map((group, groupIndex) => (
            <View key={`grp_${groupIndex}`} className="mb-2">
              {/* Tên người nói (Chỉ hiển thị 1 lần cho mỗi cụm người nói) */}
              <View className="flex-row items-center gap-1 mb-1 px-1">
                <Text
                  className={`text-[10px] font-bold tracking-tight ${
                    group.isSelf ? "text-sky-400" : "text-amber-400"
                  }`}
                  numberOfLines={1}
                >
                  {group.speakerName}
                </Text>
              </View>

              {/* Các câu thoại của người nói */}
              <View className="flex-col gap-1 items-start">
                {group.items.map((item) => (
                  <View
                    key={item.id}
                    className={`rounded-2xl px-3 py-1.5 max-w-[96%] border ${
                      group.isSelf
                        ? "bg-blue-600/20 border-blue-500/30"
                        : "bg-[#18181c] border-[#2b2b36]"
                    }`}
                  >
                    <Text
                      className={`text-xs leading-4 ${
                        item.isFinal ? "text-slate-100 font-medium" : "text-slate-300 italic"
                      }`}
                    >
                      {item.text}
                      {!item.isFinal && (
                        <Text className="text-sky-400 font-bold not-italic"> ...</Text>
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
