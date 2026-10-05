import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  Dimensions,
  type KeyboardEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePickerJS from "./DateTimePickerJS";
import { useCreateCalendarEventMutation } from "../../lib/redux/api/calendarApi";
import { useGetMyRoomsForCalendarQuery } from "../../lib/redux/api/roomsCalendarApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChannelEventModal({
  visible,
  onClose,
  onSuccess,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end">("start");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>(
    {}
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: rooms, isLoading: isLoadingRooms } =
    useGetMyRoomsForCalendarQuery(undefined, {
      skip: !visible,
    });
  const [createEvent, { isLoading: isCreating }] =
    useCreateCalendarEventMutation();

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
  }, [visible]);

  const { height: screenHeight } = Dimensions.get("window");
  const panelTop = screenHeight * 0.12;
  const bottomPad =
    keyboardHeight > 0
      ? Math.max(insets.bottom + 16, 16)
      : Math.max(insets.bottom + 20, 32);

  // Khởi tạo ngày mặc định và reset state khi mở modal
  useEffect(() => {
    if (visible) {
      setTitle("");
      setDescription("");
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);

      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      setStartDate(start.toISOString());
      setEndDate(end.toISOString());
      setSelectedRoom(null);
      setSelectedChannel(null);
      setSearchQuery("");
      setDropdownOpen(false);
    }
  }, [visible]);

  const handleDateChange = (isoString: string) => {
    if (pickerTarget === "start") {
      setStartDate(isoString);
    } else {
      setEndDate(isoString);
    }
    setShowPicker(false);
  };

  const formatDisplayDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formattedDate =
      i18n.language === "vi"
        ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
        : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}  ${formattedDate}`;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        t("calendar.alert_title_required", {
          defaultValue: "Vui lòng nhập tiêu đề sự kiện",
        })
      );
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        t("calendar.alert_select_time_required", {
          defaultValue: "Vui lòng chọn thời gian bắt đầu và kết thúc",
        })
      );
      return;
    }

    const startVal = new Date(startDate);
    const endVal = new Date(endDate);
    if (isNaN(startVal.getTime()) || isNaN(endVal.getTime())) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        t("calendar.alert_invalid_datetime", {
          defaultValue: "Thời gian không hợp lệ",
        })
      );
      return;
    }

    if (endVal <= startVal) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        t("calendar.alert_end_before_start", {
          defaultValue: "Thời gian kết thúc phải sau thời gian bắt đầu",
        })
      );
      return;
    }

    if (!selectedRoom || !selectedChannel) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        t("calendar.channel_modal.error_select_room_channel", {
          defaultValue: "Vui lòng chọn phòng và kênh.",
        })
      );
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        startDate: startVal.toISOString(),
        endDate: endVal.toISOString(),
        roomType: "channel_meeting",
        roomId: selectedRoom._id,
        channelId: selectedChannel._id,
      };

      await createEvent(payload).unwrap();
      Alert.alert(
        i18n.language === "vi" ? "Thành công" : "Success",
        t("calendar.channel_modal.success_create", {
          defaultValue: "Tạo sự kiện kênh thành công!",
        })
      );
      onSuccess();
      handleClose();
    } catch (error: any) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        error?.data?.message ||
          t("calendar.channel_modal.error_create", {
            defaultValue: "Không thể tạo sự kiện kênh",
          })
      );
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setSelectedRoom(null);
    setSelectedChannel(null);
    setSearchQuery("");
    setDropdownOpen(false);
    onClose();
  };

  const filteredRooms = (rooms || []).filter((r: any) =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-slate-900/50">
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0"
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              handleClose();
            }
          }}
        />

        <View
          style={{
            top: panelTop,
            bottom: keyboardHeight,
            paddingBottom: bottomPad,
          }}
          className="absolute left-0 right-0 bg-white rounded-t-3xl px-6 pt-5 border-t border-slate-100"
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-lg font-bold text-slate-800">
              {t("calendar.channel_modal.title", {
                defaultValue: "Sự kiện kênh",
              })}
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-1">
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form ScrollView */}
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4">
              {/* Tiêu đề */}
              <View>
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.event_title", {
                    defaultValue: "Tiêu đề sự kiện",
                  })}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={
                    i18n.language === "vi"
                      ? "Ví dụ: Họp nhóm dự án"
                      : "e.g., Team Sync"
                  }
                  placeholderTextColor="#94A3B8"
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white"
                />
              </View>

              {/* Bắt đầu */}
              <View>
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.start_time", {
                    defaultValue: "Thời gian bắt đầu",
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerTarget("start");
                    setShowPicker(true);
                  }}
                  className="border border-slate-200 rounded-xl px-4 py-3 flex-row justify-between items-center bg-white"
                >
                  <Text
                    className={`text-sm ${
                      startDate ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {startDate
                      ? formatDisplayDateTime(startDate)
                      : t("calendar.select_start_time", {
                          defaultValue: "Chọn thời gian bắt đầu",
                        })}
                  </Text>
                  <Feather name="calendar" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Kết thúc */}
              <View>
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.end_time", {
                    defaultValue: "Thời gian kết thúc",
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerTarget("end");
                    setShowPicker(true);
                  }}
                  className="border border-slate-200 rounded-xl px-4 py-3 flex-row justify-between items-center bg-white"
                >
                  <Text
                    className={`text-sm ${
                      endDate ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {endDate
                      ? formatDisplayDateTime(endDate)
                      : t("calendar.select_end_time", {
                          defaultValue: "Chọn thời gian kết thúc",
                        })}
                  </Text>
                  <Feather name="calendar" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              {showPicker && (
                <DateTimePickerJS
                  visible={showPicker}
                  value={pickerTarget === "start" ? startDate : endDate}
                  onClose={() => setShowPicker(false)}
                  onChange={handleDateChange}
                />
              )}

              {/* Chọn phòng & kênh */}
              <View className="z-10">
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.channel_modal.channel_label", {
                    defaultValue: "Thêm kênh",
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => setDropdownOpen(!dropdownOpen)}
                  className="border border-slate-200 rounded-xl px-4 py-3 flex-row justify-between items-center bg-white"
                >
                  <Text
                    className={`text-sm ${
                      selectedRoom && selectedChannel
                        ? "text-slate-900 font-semibold"
                        : "text-slate-400"
                    }`}
                    numberOfLines={1}
                  >
                    {selectedRoom && selectedChannel
                      ? `${selectedRoom.name} > ${selectedChannel.name}`
                      : t("calendar.channel_modal.channel_placeholder", {
                          defaultValue: "Chọn phòng và kênh...",
                        })}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>

                {dropdownOpen && (
                  <View className="border border-slate-200 rounded-xl mt-1.5 bg-white p-3 max-h-52">
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={t("calendar.search_placeholder", {
                        defaultValue: "Tìm kiếm...",
                      })}
                      placeholderTextColor="#94A3B8"
                      className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-slate-50 mb-2"
                      onFocus={() => {
                        setTimeout(() => {
                          scrollRef.current?.scrollTo({
                            y: 150,
                            animated: true,
                          });
                        }, 300);
                      }}
                    />

                    {isLoadingRooms ? (
                      <View className="py-4 items-center">
                        <ActivityIndicator size="small" color="#0052FF" />
                      </View>
                    ) : (
                      <ScrollView nestedScrollEnabled className="max-h-36">
                        {filteredRooms.map((room: any) => {
                          const isExpanded = !!expandedRooms[room._id];
                          return (
                            <View key={room._id} className="mb-1">
                              <TouchableOpacity
                                onPress={() =>
                                  setExpandedRooms((prev) => ({
                                    ...prev,
                                    [room._id]: !prev[room._id],
                                  }))
                                }
                                className="flex-row items-center gap-2 py-2 px-2 rounded-lg bg-slate-50"
                              >
                                <Feather
                                  name={
                                    isExpanded
                                      ? "chevron-down"
                                      : "chevron-right"
                                  }
                                  size={14}
                                  color="#64748B"
                                />
                                <Text
                                  className="text-xs font-bold text-slate-800 flex-1"
                                  numberOfLines={1}
                                >
                                  {room.name}
                                </Text>
                              </TouchableOpacity>

                              {isExpanded && (
                                <View className="pl-6 gap-1 my-1">
                                  {!room.channels ||
                                  room.channels.length === 0 ? (
                                    <Text className="text-[11px] text-slate-400 pl-1">
                                      {t(
                                        "calendar.channel_modal.no_channels",
                                        {
                                          defaultValue:
                                            "Phòng này chưa có kênh",
                                        }
                                      )}
                                    </Text>
                                  ) : (
                                    room.channels.map((channel: any) => {
                                      const isSelected =
                                        selectedChannel?._id === channel._id;
                                      return (
                                        <TouchableOpacity
                                          key={channel._id}
                                          onPress={() => {
                                            setSelectedRoom(room);
                                            setSelectedChannel(channel);
                                            setDropdownOpen(false);
                                          }}
                                          className={`flex-row items-center gap-2 py-1.5 px-2 rounded-lg ${
                                            isSelected ? "bg-blue-50" : ""
                                          }`}
                                        >
                                          <View
                                            className={`w-3.5 h-3.5 rounded-full border items-center justify-center ${
                                              isSelected
                                                ? "border-blue-600"
                                                : "border-slate-400"
                                            }`}
                                          >
                                            {isSelected && (
                                              <View className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                            )}
                                          </View>
                                          <Text
                                            className={`text-xs ${
                                              isSelected
                                                ? "font-bold text-blue-600"
                                                : "text-slate-600"
                                            }`}
                                          >
                                            {channel.name}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                        {filteredRooms.length === 0 && (
                          <Text className="text-xs text-slate-400 text-center py-3">
                            {t("calendar.channel_modal.no_rooms", {
                              defaultValue: "Không tìm thấy phòng",
                            })}
                          </Text>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              {/* Mô tả */}
              <View>
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.description", { defaultValue: "Mô tả" })}
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("calendar.description_placeholder", {
                    defaultValue: "Nội dung tóm tắt sự kiện...",
                  })}
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white min-h-[80px]"
                  style={{ textAlignVertical: "top" }}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action buttons pinned at bottom */}
          <View className="flex-row gap-3 pt-3.5 border-t border-slate-100 mt-2">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl items-center justify-center active:bg-slate-50"
            >
              <Text className="text-slate-600 font-bold text-sm">
                {t("calendar.cancel", { defaultValue: "Hủy" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isCreating}
              className="flex-1 py-3 bg-blue-600 rounded-xl items-center justify-center active:bg-blue-700"
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  {t("calendar.save", { defaultValue: "Lưu" })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
