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
import {
  useCreateCalendarEventMutation,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
} from "../../lib/redux/api/calendarApi";
import { useGlobalUserSearch } from "../../hooks/useGlobalUserSearch";
import DateTimePickerJS from "./DateTimePickerJS";
import { CalendarEvent } from "./types";

interface Invitee {
  email: string;
  displayName: string;
  fullName?: string;
  avatarUrl?: string;
}

interface EventPayload {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  roomType: "meeting";
  invitees: { email: string; displayName?: string }[];
  recurrenceRule?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventToEdit?: CalendarEvent | null;
}

export default function EventModal({
  visible,
  onClose,
  onSuccess,
  eventToEdit,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [createEvent, { isLoading: isCreating }] =
    useCreateCalendarEventMutation();
  const [updateEvent, { isLoading: isUpdating }] =
    useUpdateCalendarEventMutation();
  const [deleteEvent, { isLoading: isDeleting }] =
    useDeleteCalendarEventMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState("NONE");
  const [selectedInvitees, setSelectedInvitees] = useState<Invitee[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end">("start");
  const [recurrenceDropdownOpen, setRecurrenceDropdownOpen] = useState(false);

  const {
    users: suggestedUsers = [],
    isSearching,
    isLoadingMore,
    hasNext: hasNextPage,
    loadMore: loadMoreUsers,
  } = useGlobalUserSearch({
    q: memberSearchQuery,
    skip: !visible || !!eventToEdit,
    debounceMs: 300,
  });

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

  // Populate data when editing
  useEffect(() => {
    if (visible) {
      if (eventToEdit) {
        setTitle(eventToEdit.title || "");
        setDescription(eventToEdit.description || "");
        setStartDate(eventToEdit.startDate || "");
        setEndDate(eventToEdit.endDate || "");

        if (eventToEdit.recurrenceRule) {
          if (eventToEdit.recurrenceRule.startsWith("FREQ=")) {
            setRecurrence(eventToEdit.recurrenceRule.replace("FREQ=", ""));
          } else {
            setRecurrence(eventToEdit.recurrenceRule);
          }
        } else {
          setRecurrence("NONE");
        }

        if (eventToEdit.invitees) {
          setSelectedInvitees(
            eventToEdit.invitees.map((inv) => ({
              email: inv.email,
              displayName: inv.displayName || inv.email,
            }))
          );
        } else {
          setSelectedInvitees([]);
        }
      } else {
        setTitle("");
        setDescription("");
        const start = new Date();
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() + 1);

        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        setStartDate(start.toISOString());
        setEndDate(end.toISOString());
        setRecurrence("NONE");
        setSelectedInvitees([]);
      }
      setMemberSearchQuery("");
      setRecurrenceDropdownOpen(false);
    }
  }, [visible, eventToEdit]);

  const getRecurrenceOptions = () => {
    const list = [
      {
        label: t("calendar.recurrence_none", { defaultValue: "Không lặp lại" }),
        value: "NONE",
      },
      {
        label: t("calendar.recurrence_daily", { defaultValue: "Hàng ngày" }),
        value: "DAILY",
      },
    ];

    if (!startDate) return list;
    const dateObj = new Date(startDate);
    if (isNaN(dateObj.getTime())) return list;

    const isVi = i18n.language === "vi";
    const daysVi = [
      "chủ nhật",
      "thứ hai",
      "thứ ba",
      "thứ tư",
      "thứ năm",
      "thứ sáu",
      "thứ bảy",
    ];
    const daysEn = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayName = isVi ? daysVi[dateObj.getDay()] : daysEn[dateObj.getDay()];

    const dayNum = dateObj.getDate();
    const weekIndex = Math.ceil(dayNum / 7);
    const weeksVi = ["đầu tiên", "thứ hai", "thứ ba", "thứ tư", "thứ năm"];
    const weeksEn = ["first", "second", "third", "fourth", "fifth"];
    const weekName = isVi
      ? weeksVi[weekIndex - 1] || "đầu tiên"
      : weeksEn[weekIndex - 1] || "first";
    const rruleDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const rruleDay = rruleDays[dateObj.getDay()];

    list.push({
      label: t("calendar.recurrence_weekly", {
        dayName,
        defaultValue: `Hàng tuần vào ${dayName}`,
      }),
      value: `WEEKLY;BYDAY=${rruleDay}`,
    });
    list.push({
      label: t("calendar.recurrence_monthly", {
        dayName,
        weekName,
        defaultValue: `Hàng tháng vào ngày ${dayName} ${weekName}`,
      }),
      value: `MONTHLY;BYDAY=${weekIndex}${rruleDay}`,
    });
    list.push({
      label: t("calendar.recurrence_yearly", {
        dayNum,
        month: dateObj.getMonth() + 1,
        defaultValue: `Hàng năm vào ngày ${dayNum}/${dateObj.getMonth() + 1}`,
      }),
      value: `YEARLY`,
    });
    list.push({
      label: t("calendar.recurrence_weekdays", {
        defaultValue: "Mọi ngày trong tuần (từ thứ Hai đến thứ Sáu)",
      }),
      value: "WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    });

    return list;
  };

  const recurrenceOptions = getRecurrenceOptions();
  const currentRecurrenceLabel =
    recurrenceOptions.find((opt) => opt.value === recurrence)?.label ||
    t("calendar.recurrence_none", { defaultValue: "Không lặp lại" });

  const handleDateChange = (isoString: string) => {
    if (pickerTarget === "start") {
      setStartDate(isoString);
    } else {
      setEndDate(isoString);
    }
    setShowPicker(false);
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

    try {
      if (eventToEdit) {
        const payload: any = {
          title: title.trim(),
          description: description.trim(),
        };

        if (recurrence && recurrence !== "NONE") {
          payload.recurrenceRule = `FREQ=${recurrence}`;
        } else {
          payload.recurrenceRule = "";
        }

        await updateEvent({ id: eventToEdit._id, body: payload }).unwrap();
        Alert.alert(
          i18n.language === "vi" ? "Thành công" : "Success",
          t("calendar.alert_update_success", {
            defaultValue: "Cập nhật sự kiện thành công!",
          })
        );
      } else {
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

        if (startVal <= new Date()) {
          Alert.alert(
            i18n.language === "vi" ? "Lỗi" : "Error",
            t("calendar.alert_start_in_past", {
              defaultValue: "Thời gian bắt đầu phải sau thời gian hiện tại",
            })
          );
          return;
        }

        const inviteeList = selectedInvitees.map((usr) => ({
          email: usr.email,
          displayName: usr.displayName || usr.fullName || usr.email,
        }));

        const payload: EventPayload = {
          title: title.trim(),
          description: description.trim(),
          startDate: startVal.toISOString(),
          endDate: endVal.toISOString(),
          roomType: "meeting",
          invitees: inviteeList,
        };

        if (recurrence !== "NONE") {
          payload.recurrenceRule = `FREQ=${recurrence}`;
        }

        await createEvent(payload).unwrap();
        Alert.alert(
          i18n.language === "vi" ? "Thành công" : "Success",
          t("calendar.alert_create_success", {
            defaultValue: "Tạo sự kiện thành công!",
          })
        );
      }

      onSuccess();
      handleClose();
    } catch (error: unknown) {
      const errObj = error as { data?: { message?: string } };
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        errObj?.data?.message || "Error"
      );
    }
  };

  const handleDelete = () => {
    if (!eventToEdit) return;

    Alert.alert(
      t("calendar.delete", { defaultValue: "Xóa" }),
      t("calendar.alert_delete_confirm", {
        defaultValue: "Bạn có chắc chắn muốn xóa sự kiện này?",
      }),
      [
        {
          text: t("calendar.cancel", { defaultValue: "Hủy" }),
          style: "cancel",
        },
        {
          text: t("calendar.delete", { defaultValue: "Xóa" }),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(eventToEdit._id).unwrap();
              Alert.alert(
                i18n.language === "vi" ? "Thành công" : "Success",
                t("calendar.alert_delete_success", {
                  defaultValue: "Xóa sự kiện thành công!",
                })
              );
              onSuccess();
              handleClose();
            } catch (err: unknown) {
              const errObj = err as { data?: { message?: string } };
              Alert.alert(
                i18n.language === "vi" ? "Lỗi" : "Error",
                errObj?.data?.message || "Error"
              );
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setRecurrence("NONE");
    setSelectedInvitees([]);
    setMemberSearchQuery("");
    setRecurrenceDropdownOpen(false);
    onClose();
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
              {eventToEdit
                ? t("calendar.edit_event", { defaultValue: "Chỉnh sửa sự kiện" })
                : t("calendar.create_event", { defaultValue: "Tạo sự kiện" })}
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-1">
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

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
                      ? "Ví dụ: Sprint Planning"
                      : "e.g., Sprint Planning"
                  }
                  placeholderTextColor="#94A3B8"
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white"
                />
              </View>

              {/* Bắt đầu & Kết thúc (Ẩn khi đang chỉnh sửa) */}
              {!eventToEdit && (
                <>
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

                  {/* DateTimePicker rendering */}
                  {showPicker && (
                    <DateTimePickerJS
                      visible={showPicker}
                      value={pickerTarget === "start" ? startDate : endDate}
                      onClose={() => setShowPicker(false)}
                      onChange={handleDateChange}
                    />
                  )}
                </>
              )}

              {/* Lặp lại (Recurrence) */}
              <View className="z-10">
                <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                  {t("calendar.recurrence", { defaultValue: "Lặp lại" })}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setRecurrenceDropdownOpen(!recurrenceDropdownOpen)
                  }
                  className="border border-slate-200 rounded-xl px-4 py-3 flex-row justify-between items-center bg-white"
                >
                  <Text className="text-sm text-slate-800">
                    {currentRecurrenceLabel}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>

                {recurrenceDropdownOpen && (
                  <View className="border border-slate-200 rounded-xl mt-1.5 bg-white overflow-hidden">
                    {recurrenceOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => {
                          setRecurrence(opt.value);
                          setRecurrenceDropdownOpen(false);
                        }}
                        className={`px-4 py-3 border-b border-slate-100 ${
                          opt.value === recurrence ? "bg-slate-50" : ""
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            opt.value === recurrence
                              ? "font-bold text-blue-600"
                              : "text-slate-700"
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Thêm khách mời (Ẩn khi đang chỉnh sửa) */}
              {!eventToEdit && (
                <View>
                  <Text className="text-xs font-bold text-slate-500 mb-1.5 uppercase">
                    {t("calendar.add_guests", {
                      defaultValue: "Thêm người tham gia",
                    })}
                  </Text>
                  <View className="relative">
                    <TextInput
                      value={memberSearchQuery}
                      onChangeText={setMemberSearchQuery}
                      placeholder={t("calendar.search_guests_placeholder", {
                        defaultValue: "Nhập tên hoặc email...",
                      })}
                      placeholderTextColor="#94A3B8"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white pr-10"
                    />
                    {isSearching && (
                      <ActivityIndicator
                        size="small"
                        color="#0052FF"
                        className="absolute right-3.5 top-3.5"
                      />
                    )}
                  </View>

                  {/* Danh sách người dùng gợi ý */}
                  {memberSearchQuery.trim().length > 0 &&
                    suggestedUsers.length > 0 && (
                      <View className="border border-slate-200 rounded-xl mt-1.5 max-h-44 bg-white overflow-hidden">
                        <ScrollView nestedScrollEnabled className="max-h-44">
                          {suggestedUsers.map((usr) => {
                            const isSelected = selectedInvitees.some(
                              (sel) => sel.email === usr.email
                            );
                            return (
                              <TouchableOpacity
                                key={usr.supabaseId || usr._id || usr.email}
                                onPress={() => {
                                  if (isSelected) return;
                                  setSelectedInvitees([
                                    ...selectedInvitees,
                                    {
                                      email: usr.email,
                                      displayName:
                                        usr.displayName || usr.email,
                                      avatarUrl: usr.avatarUrl,
                                    },
                                  ]);
                                  setMemberSearchQuery("");
                                }}
                                className="px-4 py-2.5 flex-row justify-between items-center border-b border-slate-100"
                              >
                                <View className="flex-row items-center gap-2 flex-1 mr-2">
                                  <View className="w-7 h-7 rounded-full bg-blue-100 items-center justify-center">
                                    <Text className="text-xs font-bold text-blue-700">
                                      {(usr.displayName || usr.email)
                                        .substring(0, 1)
                                        .toUpperCase()}
                                    </Text>
                                  </View>
                                  <View className="flex-1">
                                    <Text
                                      className="text-xs font-bold text-slate-800"
                                      numberOfLines={1}
                                    >
                                      {usr.displayName || usr.email}
                                    </Text>
                                    <Text
                                      className="text-[10px] text-slate-400"
                                      numberOfLines={1}
                                    >
                                      {usr.email}
                                    </Text>
                                  </View>
                                </View>
                                {isSelected && (
                                  <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Text className="text-[10px] font-bold text-slate-500">
                                      {t("calendar.selected", {
                                        defaultValue: "Đã chọn",
                                      })}
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                          {hasNextPage && (
                            <TouchableOpacity
                              onPress={loadMoreUsers}
                              disabled={isLoadingMore}
                              className="py-2.5 items-center border-t border-slate-100"
                            >
                              {isLoadingMore ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#0052FF"
                                />
                              ) : (
                                <Text className="text-xs font-semibold text-blue-600">
                                  {i18n.language === "vi"
                                    ? "Tải thêm"
                                    : "Load more"}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      </View>
                    )}

                  {/* Danh sách khách mời đã chọn */}
                  {selectedInvitees.length > 0 && (
                    <View className="mt-2 gap-1.5">
                      {selectedInvitees.map((usr) => (
                        <View
                          key={usr.email}
                          className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                        >
                          <View className="flex-row items-center gap-2 flex-1 mr-2">
                            <View className="w-5 h-5 rounded-full bg-blue-100 items-center justify-center">
                              <Text className="text-[10px] font-bold text-blue-700">
                                {(usr.displayName || usr.email)
                                  .substring(0, 1)
                                  .toUpperCase()}
                              </Text>
                            </View>
                            <Text
                              className="text-xs text-slate-700 flex-1"
                              numberOfLines={1}
                            >
                              {usr.displayName || usr.email}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              setSelectedInvitees(
                                selectedInvitees.filter(
                                  (sel) => sel.email !== usr.email
                                )
                              )
                            }
                            className="p-1"
                          >
                            <Feather name="x" size={13} color="#94A3B8" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

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

          {/* Action buttons */}
          <View className="flex-row gap-3 pt-3.5 border-t border-slate-100 mt-2">
            {eventToEdit && (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 border border-rose-200 bg-rose-50 rounded-xl items-center justify-center active:bg-rose-100"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text className="text-rose-600 font-bold text-sm">
                    {t("calendar.delete", { defaultValue: "Xóa" })}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSave}
              disabled={isCreating || isUpdating}
              className="flex-1 py-3 bg-blue-600 rounded-xl items-center justify-center active:bg-blue-700"
            >
              {isCreating || isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  {eventToEdit
                    ? t("calendar.save", { defaultValue: "Cập nhật" })
                    : t("calendar.save", { defaultValue: "Lưu" })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
