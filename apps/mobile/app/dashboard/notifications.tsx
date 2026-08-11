import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Router, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useNotifications } from "../../hooks/useNotifications";
import { useLazyExchangeSessionQuery } from "../../lib/redux/features/meetings/meetingsApi";
import { NotificationResponse } from "@tobomeet/shared/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused(); // true khi đang ở màn hình này, false khi chuyển tab khác

  const { notifications, isLoading, isFetching, hasNext, loadMore, refresh } =
    useNotifications({ limit: 15, skip: !isFocused });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const renderItem = ({ item }: { item: NotificationResponse }) => {
    return <NotificationCard notification={item} router={router} />;
  };

  return (
    <View className="flex-1 bg-[#f5f5f5]">
      <View className="pt-4 pb-4 px-5 bg-white border-b border-slate-100 flex-row items-center">
        <Text className="text-xl font-bold text-slate-800">Thông báo</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0052FF" />
          <Text className="text-slate-400 mt-2">Đang tải thông báo...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center opacity-70">
          <View className="w-16 h-16 rounded-full bg-slate-200 items-center justify-center mb-4">
            <Feather name="bell" size={32} color="#94A3B8" />
          </View>
          <Text className="text-slate-500 font-medium">
            Bạn chưa có thông báo nào
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNext && !isFetching) {
              loadMore();
            }
          }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListFooterComponent={
            isFetching && !isLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#0052FF" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// Component thẻ thông báo
function NotificationCard({
  notification,
  router,
}: {
  notification: NotificationResponse;
  router: Router;
}) {
  const [exchangeSession] = useLazyExchangeSessionQuery();
  const [isProcessing, setIsProcessing] = useState(false);

  const getNotificationDetails = (type: string, metadata: any) => {
    switch (type) {
      case "KICKED":
        return {
          title: "Bị xóa khỏi nhóm",
          content: `Bạn đã bị xoá khỏi nhóm ${metadata?.roomName || ""}.`,
          icon: "user-minus",
          colorClass: "bg-red-100",
          iconColor: "#dc2626",
        };
      case "ROOM_DISBANDED":
        return {
          title: "Nhóm đã giải tán",
          content: `Trưởng nhóm đã giải tán ${metadata?.roomName || "nhóm"}.`,
          icon: "trash-2",
          colorClass: "bg-orange-100",
          iconColor: "#ea580c",
        };
      case "MEETING_INVITE":
        return {
          title: "Tham gia họp",
          content: `${metadata?.inviterName || "Ai đó"} đã mời bạn tham gia cuộc họp trong phòng ${metadata?.roomName}.`,
          icon: "video",
          colorClass: "bg-blue-100",
          iconColor: "#0052FF",
          sessionId: metadata?.sessionId,
          isActionable: true,
          actionTitle: "Tham gia",
        };
      default:
        return {
          title: "Thông báo hệ thống",
          content: `Sự kiện diễn ra (${type}).`,
          icon: "bell",
          colorClass: "bg-slate-100",
          iconColor: "#64748b",
        };
    }
  };

  const {
    title,
    content,
    icon,
    colorClass,
    iconColor,
    isActionable,
    actionTitle,
    sessionId,
  } = getNotificationDetails(notification.type, notification.metadata || {});

  const handleActionClick = async () => {
    if (!sessionId) return;
    setIsProcessing(true);
    try {
      const response = await exchangeSession(sessionId).unwrap();
      if (response && response.meetingCode) {
        router.push(`/meeting/${response.meetingCode}`);
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: error?.message || "Phiên họp có thể đã kết thúc.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View
      className={`p-4 rounded-2xl border ${
        notification.isRead
          ? "bg-white border-slate-100"
          : "bg-blue-50 border-blue-100"
      }`}
    >
      {!notification.isRead && (
        <View className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500" />
      )}

      <View className="flex-row gap-3">
        <View
          className={`w-10 h-10 rounded-full items-center justify-center ${colorClass}`}
        >
          <Feather name={icon as any} size={20} color={iconColor} />
        </View>

        <View className="flex-1 pt-0.5">
          <Text className="text-[14px] font-bold text-slate-800">{title}</Text>
          <Text className="text-[12px] text-slate-600 mt-1 leading-5">
            {content}
          </Text>
          <Text className="text-[10px] text-slate-400 font-medium mt-2">
            {new Date(notification.createdAt).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </Text>

          {isActionable && (
            <TouchableOpacity
              onPress={handleActionClick}
              disabled={isProcessing}
              className="mt-3.5 w-full items-center justify-center py-3 px-4 bg-[#0052FF] rounded-xl active:bg-blue-700"
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-[13px] font-bold">
                  {actionTitle}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
