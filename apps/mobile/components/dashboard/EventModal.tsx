import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePickerJS from "./DateTimePickerJS";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCreateCalendarEventMutation,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
} from "../../lib/redux/api/calendarApi";
import { useGlobalUserSearch } from "../../hooks/useGlobalUserSearch";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventToEdit?: any | null; // If passed, we are in Edit mode
}

export default function EventModal({ visible, onClose, onSuccess, eventToEdit }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInvitees, setSelectedInvitees] = useState<any[]>([]);
  const [recurrence, setRecurrence] = useState("NONE");

  // DateTimePicker states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end">("start");
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // Local UI states
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [recurrenceDropdownOpen, setRecurrenceDropdownOpen] = useState(false);

  // RTK query hooks
  const [createEvent, { isLoading: isCreating }] = useCreateCalendarEventMutation();
  const [updateEvent, { isLoading: isUpdating }] = useUpdateCalendarEventMutation();
  const [deleteEvent, { isLoading: isDeleting }] = useDeleteCalendarEventMutation();

  const {
    users: suggestedUsers = [],
    isSearching,
    isLoadingMore,
    hasNext: hasNextPage,
    loadMore: loadMoreUsers,
  } = useGlobalUserSearch({
    q: memberSearchQuery,
    skip: !visible || !memberSearchQuery.trim(),
    debounceMs: 300,
  });

  // Populate data when editing
  useEffect(() => {
    if (visible) {
      if (eventToEdit) {
        setTitle(eventToEdit.title || "");
        setDescription(eventToEdit.description || "");
        setStartDate(eventToEdit.startDate || "");
        setEndDate(eventToEdit.endDate || "");
        
        // Match recurrence FREQ
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
            eventToEdit.invitees.map((inv: any) => ({
              email: inv.email,
              displayName: inv.displayName || inv.email,
            }))
          );
        } else {
          setSelectedInvitees([]);
        }
      } else {
        // Create mode defaults
        setTitle("");
        setDescription("");
        const start = new Date();
        start.setMinutes(0, 0, 0); // Round to hour
        const end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour
        setStartDate(start.toISOString());
        setEndDate(end.toISOString());
        setRecurrence("NONE");
        setSelectedInvitees([]);
      }
    }
  }, [visible, eventToEdit]);



  // Recurrence options calculator
  const getRecurrenceOptions = () => {
    const list = [
      { label: t("calendar.recurrence_none"), value: "NONE" },
      { label: t("calendar.recurrence_daily"), value: "DAILY" },
    ];

    if (!startDate) return list;
    const dateObj = new Date(startDate);
    if (isNaN(dateObj.getTime())) return list;

    const isVi = i18n.language === "vi";
    const daysVi = ["chủ nhật", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy"];
    const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = isVi ? daysVi[dateObj.getDay()] : daysEn[dateObj.getDay()];

    const dayNum = dateObj.getDate();
    const weekIndex = Math.ceil(dayNum / 7);
    const weeksVi = ["đầu tiên", "thứ hai", "thứ ba", "thứ tư", "thứ năm"];
    const weeksEn = ["first", "second", "third", "fourth", "fifth"];
    const weekName = isVi ? (weeksVi[weekIndex - 1] || "đầu tiên") : (weeksEn[weekIndex - 1] || "first");
    const rruleDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const rruleDay = rruleDays[dateObj.getDay()];

    list.push({
      label: t("calendar.recurrence_weekly", { dayName }),
      value: `WEEKLY;BYDAY=${rruleDay}`,
    });
    list.push({
      label: t("calendar.recurrence_monthly", { dayName, weekName }),
      value: `MONTHLY;BYDAY=${weekIndex}${rruleDay}`,
    });
    list.push({
      label: t("calendar.recurrence_yearly", { dayNum, month: dateObj.getMonth() + 1 }),
      value: `YEARLY`,
    });
    list.push({
      label: t("calendar.recurrence_weekdays"),
      value: "WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    });

    return list;
  };

  const recurrenceOptions = getRecurrenceOptions();
  const currentRecurrenceLabel = recurrenceOptions.find((opt) => opt.value === recurrence)?.label || t("calendar.recurrence_none");

  // Handle Date picker selection
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
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", t("calendar.alert_title_required"));
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", t("calendar.alert_select_time_required"));
      return;
    }

    const startVal = new Date(startDate);
    const endVal = new Date(endDate);
    if (isNaN(startVal.getTime()) || isNaN(endVal.getTime())) {
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", t("calendar.alert_invalid_datetime"));
      return;
    }

    if (endVal <= startVal) {
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", t("calendar.alert_end_before_start"));
      return;
    }

    if (!eventToEdit && startVal <= new Date()) {
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", t("calendar.alert_start_in_past"));
      return;
    }

    const inviteeList = selectedInvitees.map((usr) => ({
      email: usr.email,
      displayName: usr.displayName || usr.fullName || usr.email,
    }));

    try {
      const payload: any = {
        title,
        description,
        startDate: startVal.toISOString(),
        endDate: endVal.toISOString(),
        roomType: eventToEdit?.roomType || "meeting",
        invitees: inviteeList,
      };

      if (eventToEdit?.roomId) payload.roomId = eventToEdit.roomId;
      if (eventToEdit?.channelId) payload.channelId = eventToEdit.channelId;

      if (recurrence !== "NONE") {
        payload.recurrenceRule = `FREQ=${recurrence}`;
      }

      if (eventToEdit) {
        await updateEvent({ id: eventToEdit._id, body: payload }).unwrap();
        Alert.alert(t("password_reset.password_success"), t("calendar.alert_update_success"));
      } else {
        await createEvent(payload).unwrap();
        Alert.alert(t("password_reset.password_success"), t("calendar.alert_create_success"));
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", error?.data?.message || "Error");
    }
  };

  const handleDelete = () => {
    if (!eventToEdit) return;

    Alert.alert(
      t("calendar.delete"),
      t("calendar.alert_delete_confirm"),
      [
        { text: t("calendar.cancel"), style: "cancel" },
        {
          text: t("calendar.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(eventToEdit._id).unwrap();
              Alert.alert(t("password_reset.password_success"), t("calendar.alert_delete_success"));
              onSuccess();
              handleClose();
            } catch (err: any) {
              Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", err?.data?.message || "Error");
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
    const formattedDate = i18n.language === "vi"
      ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
      : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}  ${formattedDate}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {eventToEdit ? t("calendar.edit_event") : t("calendar.create_event")}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={{ gap: 16 }}>
              {/* Tiêu đề */}
              <View>
                <Text style={styles.label}>{t("calendar.event_title")}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={i18n.language === "vi" ? "Ví dụ: Sprint Planning" : "e.g., Sprint Planning"}
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              {/* Bắt đầu */}
              <View>
                <Text style={styles.label}>{t("calendar.start_time")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerTarget("start");
                    setShowPicker(true);
                  }}
                  style={styles.datePickerInput}
                >
                  <Text style={{ fontSize: 14, color: startDate ? "#0F172A" : "#94A3B8" }}>
                    {startDate ? formatDisplayDateTime(startDate) : t("calendar.select_start_time")}
                  </Text>
                  <Feather name="calendar" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Kết thúc */}
              <View>
                <Text style={styles.label}>{t("calendar.end_time")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerTarget("end");
                    setShowPicker(true);
                  }}
                  style={styles.datePickerInput}
                >
                  <Text style={{ fontSize: 14, color: endDate ? "#0F172A" : "#94A3B8" }}>
                    {endDate ? formatDisplayDateTime(endDate) : t("calendar.select_end_time")}
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

              {/* Lặp lại (Recurrence) */}
              <View style={{ zIndex: 10 }}>
                <Text style={styles.label}>{t("calendar.recurrence")}</Text>
                <TouchableOpacity
                  onPress={() => setRecurrenceDropdownOpen(!recurrenceDropdownOpen)}
                  style={styles.dropdownTrigger}
                >
                  <Text style={{ fontSize: 14, color: "#0F172A" }}>
                    {currentRecurrenceLabel}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>

                {recurrenceDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {recurrenceOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => {
                          setRecurrence(opt.value);
                          setRecurrenceDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          opt.value === recurrence && { backgroundColor: "#F1F5F9" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            opt.value === recurrence && { fontWeight: "bold", color: "#0052FF" },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Thêm khách mời */}
              <View>
                <Text style={styles.label}>{t("calendar.add_guests")}</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    placeholder={t("calendar.search_guests_placeholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                  {isSearching && (
                    <ActivityIndicator
                      size="small"
                      color="#0052FF"
                      style={{ position: "absolute", right: 12, top: 12 }}
                    />
                  )}
                </View>

                {/* Danh sách người dùng gợi ý */}
                {memberSearchQuery.trim().length > 0 && suggestedUsers.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                      {suggestedUsers.map((usr) => {
                        const isSelected = selectedInvitees.some((sel) => sel.email === usr.email);
                        return (
                          <TouchableOpacity
                            key={usr.supabaseId || usr._id || usr.email}
                            onPress={() => {
                              if (isSelected) return;
                              setSelectedInvitees([
                                ...selectedInvitees,
                                {
                                  email: usr.email,
                                  displayName: usr.displayName || usr.email,
                                  avatarUrl: usr.avatarUrl,
                                },
                              ]);
                              setMemberSearchQuery("");
                            }}
                            style={styles.suggestionItem}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarPlaceholderText}>
                                  {(usr.displayName || usr.email)
                                    .substring(0, 1)
                                    .toUpperCase()}
                                </Text>
                              </View>
                              <View>
                                <Text style={styles.suggestionTitle}>
                                  {usr.displayName || usr.email}
                                </Text>
                                <Text style={styles.suggestionSub}>{usr.email}</Text>
                              </View>
                            </View>
                            {isSelected && (
                              <Text style={styles.selectedBadge}>{t("calendar.selected")}</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {hasNextPage && (
                        <TouchableOpacity
                          onPress={loadMoreUsers}
                          disabled={isLoadingMore}
                          style={{
                            paddingVertical: 8,
                            alignItems: "center",
                            borderTopWidth: 1,
                            borderTopColor: "#F1F5F9",
                          }}
                        >
                          {isLoadingMore ? (
                            <ActivityIndicator size="small" color="#0052FF" />
                          ) : (
                            <Text style={{ fontSize: 12, color: "#0052FF", fontWeight: "600" }}>
                              {t("room.load_more", { defaultValue: "Tải thêm" })}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Danh sách khách mời đã chọn */}
                {selectedInvitees.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {selectedInvitees.map((usr) => (
                      <View key={usr.email} style={styles.inviteeChip}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                          <View style={[styles.avatarPlaceholder, { width: 22, height: 22 }]}>
                            <Text style={[styles.avatarPlaceholderText, { fontSize: 10 }]}>
                              {(usr.displayName || usr.email).substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, color: "#334155", flex: 1 }} numberOfLines={1}>
                            {usr.displayName || usr.email}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            setSelectedInvitees(
                              selectedInvitees.filter((sel) => sel.email !== usr.email)
                            )
                          }
                          style={{ padding: 2 }}
                        >
                          <Feather name="x" size={14} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Mô tả */}
              <View>
                <Text style={styles.label}>{t("calendar.description")}</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("calendar.description_placeholder")}
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.footer}>
            {eventToEdit && (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting}
                style={[styles.btn, styles.btnDelete]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.btnDeleteText}>{t("calendar.delete")}</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleClose}
              style={[styles.btn, styles.btnCancel, eventToEdit ? { flex: 1.5 } : { flex: 1 }]}
            >
              <Text style={styles.btnCancelText}>{t("calendar.cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isCreating || isUpdating}
              style={[styles.btn, styles.btnSave, eventToEdit ? { flex: 1.5 } : { flex: 1 }]}
            >
              {isCreating || isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnSaveText}>{t("calendar.save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  datePickerInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#334155",
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 180,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E293B",
  },
  suggestionSub: {
    fontSize: 11,
    color: "#64748B",
  },
  selectedBadge: {
    fontSize: 10,
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: "bold",
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E0E7FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    color: "#4338CA",
    fontSize: 12,
    fontWeight: "bold",
  },
  inviteeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 10,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnDelete: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  btnDeleteText: {
    color: "#EF4444",
    fontWeight: "bold",
    fontSize: 14,
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  btnCancelText: {
    color: "#475569",
    fontWeight: "bold",
    fontSize: 14,
  },
  btnSave: {
    backgroundColor: "#0052FF",
  },
  btnSaveText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
