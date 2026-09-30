import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useGetCalendarRsvpQuery,
  useLeaveCalendarEventMutation,
} from "../../lib/redux/api/calendarApi";
import { useGetMeQuery } from "../../lib/redux/features/users/usersApi";
import InviteCalendarModal from "./InviteCalendarModal";

interface Props {
  visible: boolean;
  onClose: () => void;
  event: any | null;
  onEdit: (event: any) => void;
  onDelete: (event: any) => void;
  onJoin: (meetingCode: string) => void;
  onRefresh?: () => void;
}

export default function MeetingDetailModal({
  visible,
  onClose,
  event,
  onEdit,
  onDelete,
  onJoin,
  onRefresh,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN (Rules of Hooks)
  const { data: currentUser } = useGetMeQuery();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [leaveCalendarEvent, { isLoading: isLeaving }] = useLeaveCalendarEventMutation();

  const { data: rsvpData } = useGetCalendarRsvpQuery(event?._id ?? "", {
    skip: !visible || !event?._id || event?.eventType === "assignment",
  });

  if (!event) return null;

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  // Check if description has actual text content
  const cleanDesc = event.description ? event.description.replace(/<[^>]*>/g, "").trim() : "";
  const hasDescription = cleanDesc.length > 0;

  // Render chuyên biệt cho Nhiệm vụ (Assignment)
  if (event.eventType === "assignment") {
    const isVi = i18n.language === "vi";
    const statusMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
      submitted: {
        label: isVi ? "Đã nộp" : "Submitted",
        bg: "#ECFDF5",
        text: "#065F46",
        border: "#A7F3D0",
      },
      graded: {
        label: isVi ? "Đã chấm điểm" : "Graded",
        bg: "#ECFDF5",
        text: "#065F46",
        border: "#A7F3D0",
      },
      overdue: {
        label: isVi ? "Đã quá hạn" : "Overdue",
        bg: "#FFF1F2",
        text: "#9F1239",
        border: "#FECDD3",
      },
      closed: {
        label: isVi ? "Đã khóa/đóng" : "Closed",
        bg: "#F8FAFC",
        text: "#475569",
        border: "#E2E8F0",
      },
      in_progress: {
        label: isVi ? "Đang thực hiện" : "In Progress",
        bg: "#EFF6FF",
        text: "#1D4ED8",
        border: "#BFDBFE",
      },
    };
    const currentStatus = statusMap[event.assignmentStatus || "in_progress"] || statusMap.in_progress;

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
            <View style={styles.header}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="clipboard" size={20} color="#4F46E5" />
                <Text style={styles.headerTitle}>
                  {i18n.language === "vi" ? "Chi tiết nhiệm vụ" : "Assignment Details"}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <View style={{
                  backgroundColor: currentStatus.bg,
                  borderColor: currentStatus.border,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 12,
                }}>
                  <Text style={{ color: currentStatus.text, fontSize: 11, fontWeight: "700" }}>
                    {currentStatus.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>{event.title}</Text>

              <View style={{
                backgroundColor: "#F8FAFC",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                gap: 8,
                marginTop: 8,
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: "#64748B" }}>
                    {i18n.language === "vi" ? "Bắt đầu:" : "Start:"}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                    {formatDateTime(event.assignmentStartDate || event.startDate)}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: "#64748B" }}>
                    {i18n.language === "vi" ? "Thời gian kết thúc:" : "End time:"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: event.assignmentStatus === "overdue" ? "700" : "600",
                      color: event.assignmentStatus === "overdue" ? "#E11D48" : "#334155",
                    }}
                  >
                    {formatDateTime(event.assignmentDueDate || event.startDate)}
                  </Text>
                </View>

                {event.hostDisplayName ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTopWidth: 1, borderTopColor: "#E2E8F0" }}>
                    <Text style={{ fontSize: 12, color: "#64748B" }}>
                      {i18n.language === "vi" ? "Người giao:" : "Assigned by:"}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#1E293B" }}>
                      {event.hostDisplayName}
                    </Text>
                  </View>
                ) : null}
              </View>

              {hasDescription ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 }}>
                    {i18n.language === "vi" ? "Mô tả nhiệm vụ" : "Description"}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#475569", lineHeight: 18 }}>
                    {cleanDesc}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#4F46E5",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={() => {
                  onClose();
                  router.push(`/assignment/${event.assignmentId}?roomId=${event.roomId}`);
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                  {i18n.language === "vi" ? "Xem chi tiết nhiệm vụ" : "View Assignment"}
                </Text>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const activeInvitees: { email: string; displayName?: string; userId?: string; status?: string; isHost?: boolean; avatarUrl?: string }[] =
    rsvpData && rsvpData.length > 0 ? rsvpData : (event._prefetchedInvitees || event.invitees || []);

  const currentUserId =
    currentUser?.supabaseId ||
    (currentUser as any)?.id ||
    (currentUser as any)?._id ||
    event._currentUserId ||
    null;

  const isHost = Boolean(
    (currentUserId && event.hostId && (
      currentUserId === event.hostId ||
      currentUser?.supabaseId === event.hostId ||
      (currentUser as any)?.id === event.hostId ||
      (currentUser as any)?._id === event.hostId
    )) ||
    (event._currentUserId && event.hostId && event._currentUserId === event.hostId)
  );

  const isChannelMeeting = event.roomType === "channel_meeting";
  const hasInvitees = activeInvitees && activeInvitees.length > 0;
  const showJoin = event.meetingCode && (isChannelMeeting || hasInvitees || isHost);

  const hostMember = activeInvitees.find(
    (m: any) => m.isHost || m.userId === event.hostId
  );
  const guestList = activeInvitees.filter(
    (inv: any) => !inv.isHost && inv.userId !== event.hostId
  );

  const existingMemberIds = [
    ...(event.hostId ? [event.hostId] : []),
    ...(event.acceptedUserIds || []),
    ...(event.pendingUserIds || []),
    ...activeInvitees
      .filter((m: any) => m.status === "ACCEPTED" || m.status === "PENDING" || m.isHost)
      .map((m: any) => m.userId)
      .filter(Boolean),
  ];

  const existingEmails = [
    ...(event.hostEmail ? [event.hostEmail] : []),
    ...(event.invitees || []).map((i: any) => i.email).filter(Boolean),
    ...activeInvitees
      .filter((m: any) => m.status === "ACCEPTED" || m.status === "PENDING" || m.isHost)
      .map((m: any) => m.email)
      .filter(Boolean),
  ];

  const handleLeaveConfirm = () => {
    Alert.alert(
      t("calendar.leave_confirm_title", { defaultValue: "Xác nhận hủy tham gia" }),
      t("calendar.leave_confirm_desc", { defaultValue: "Bạn có chắc chắn muốn hủy tham gia lịch họp này không? Sự kiện sẽ được xóa khỏi lịch của bạn." }),
      [
        { text: t("calendar.cancel", { defaultValue: "Hủy" }), style: "cancel" },
        {
          text: t("calendar.leave_event", { defaultValue: "Hủy tham gia" }),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveCalendarEvent(event._id).unwrap();
              Alert.alert(
                i18n.language === "vi" ? "Thành công" : "Success",
                t("calendar.alert_leave_success", { defaultValue: "Đã hủy tham gia lịch họp thành công" })
              );
              onRefresh?.();
              onClose();
            } catch (err: any) {
              Alert.alert(
                i18n.language === "vi" ? "Lỗi" : "Error",
                err?.data?.message || err?.message || t("calendar.alert_leave_error", { defaultValue: "Không thể hủy tham gia lịch họp. Vui lòng thử lại" })
              );
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {i18n.language === "vi" ? "Chi tiết lịch họp" : "Meeting Details"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Title */}
            <Text style={styles.title}>{event.title}</Text>

            {/* Room / Channel indicator */}
            {isChannelMeeting && (
              <View style={styles.badgeContainer}>
                <View style={styles.badgeChannel}>
                  <Text style={styles.badgeTextChannel}>
                    {t("calendar.channel_meeting") || "Họp kênh"}
                  </Text>
                </View>
              </View>
            )}

            {/* Microsoft Teams style Action Buttons (Tham gia & Trò chuyện) under Title */}
            {showJoin && (
              <View style={styles.meetActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onJoin(event.meetingCode);
                  }}
                  style={styles.meetJoinBtn}
                >
                  <Feather name="video" size={16} color="#FFFFFF" />
                  <Text style={styles.meetJoinText}>
                    {i18n.language === "vi" ? "Tham gia" : "Join"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { }}
                  style={styles.meetChatBtn}
                >
                  <Feather name="message-square" size={16} color="#475569" />
                  <Text style={styles.meetChatText}>
                    {i18n.language === "vi" ? "Trò chuyện" : "Chat"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Info Items */}
            <View style={styles.infoSection}>
              {/* Time */}
              <View style={[styles.infoRow, { alignItems: "flex-start" }]}>
                <Feather name="clock" size={18} color="#0052FF" style={[styles.infoIcon, { marginTop: 2 }]} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoValue}>
                    {formatDateTime(event.startDate)}
                  </Text>
                  <Text style={[styles.infoValue, { marginTop: 2 }]}>
                    {i18n.language === "vi" ? "đến" : "to"} {formatDateTime(event.endDate)}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {hasDescription && (
                <View style={styles.infoRow}>
                  <Feather name="align-left" size={18} color="#0052FF" style={styles.infoIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>
                      {i18n.language === "vi" ? "Mô tả" : "Description"}
                    </Text>
                    <Text style={styles.infoValue}>
                      {cleanDesc}
                    </Text>
                  </View>
                </View>
              )}

              {/* Invitees / Participants */}
              {(hasInvitees || isHost) && (
                <View style={styles.participantsSection}>
                  <View style={styles.participantsHeaderRow}>
                    <View style={styles.participantsHeaderLeft}>
                      <Feather name="users" size={18} color="#0052FF" />
                      <Text style={[styles.infoLabel, { marginBottom: 0 }]}>
                        {t("calendar.participants", { defaultValue: i18n.language === "vi" ? "Người tham gia" : "Participants" })}
                      </Text>
                    </View>
                    {isHost && (
                      <TouchableOpacity
                        onPress={() => setInviteModalVisible(true)}
                        style={styles.inviteButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="user-plus" size={13} color="#0052FF" />
                        <Text style={styles.inviteButtonText}>
                          {t("calendar.invite_btn", { defaultValue: "Mời" })}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.participantList}>
                    {/* Host row */}
                    <View style={styles.participantRow}>
                      <View style={styles.participantAvatar}>
                        <Text style={styles.participantAvatarText}>
                          {(hostMember?.displayName || event.hostDisplayName || hostMember?.email || event.hostEmail || "?").substring(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName} numberOfLines={1}>
                          {hostMember?.displayName || event.hostDisplayName || hostMember?.email?.split("@")[0] || event.hostEmail?.split("@")[0] || ""}
                        </Text>
                        {(hostMember?.email || event.hostEmail) ? (
                          <Text style={styles.participantEmail} numberOfLines={1}>
                            {hostMember?.email || event.hostEmail}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: "#EEF2FF" }]}>
                        <Text style={[styles.statusBadgeText, { color: "#4F46E5" }]}>
                          {t("calendar.organizer", { defaultValue: i18n.language === "vi" ? "Người tổ chức" : "Organizer" })}
                        </Text>
                      </View>
                    </View>

                    {/* Invitee rows */}
                    {guestList.map((inv: any, idx: number) => {
                      const status: string = inv.status || "PENDING";
                      let dotColor = "#94A3B8";
                      if (status === "ACCEPTED") dotColor = "#10B981";
                      else if (status === "DECLINED") dotColor = "#F43F5E";
                      else if (status === "TENTATIVE") dotColor = "#F59E0B";

                      const statusLabel =
                        status === "ACCEPTED"
                          ? t("calendar.responded", { defaultValue: i18n.language === "vi" ? "Đã chấp nhận" : "Accepted" })
                          : status === "DECLINED"
                            ? i18n.language === "vi" ? "Đã từ chối" : "Declined"
                            : t("calendar.no_response", { defaultValue: i18n.language === "vi" ? "Chưa phản hồi" : "Pending" });

                      return (
                        <View key={idx} style={styles.participantRow}>
                          <View style={styles.participantAvatar}>
                            <Text style={styles.participantAvatarText}>
                              {(inv.displayName || inv.email || "?").substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.participantInfo}>
                            <Text style={styles.participantName} numberOfLines={1}>
                              {inv.displayName || inv.email?.split("@")[0]}
                            </Text>
                            {inv.email ? (
                              <Text style={styles.participantEmail} numberOfLines={1}>
                                {inv.email}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Actions Footer */}
          <View style={styles.footer}>
            {isHost ? (
              <>
                {/* Edit Button */}
                <TouchableOpacity
                  onPress={() => onEdit({ ...event, invitees: activeInvitees })}
                  style={styles.editBtn}
                >
                  <Feather name="edit-2" size={18} color="#475569" />
                  <Text style={styles.editBtnText}>
                    {i18n.language === "vi" ? "Chỉnh sửa" : "Edit"}
                  </Text>
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => onDelete({ ...event, invitees: activeInvitees })}
                  style={styles.deleteBtn}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>
                    {i18n.language === "vi" ? "Xóa" : "Delete"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleLeaveConfirm}
                disabled={isLeaving}
                style={styles.leaveBtn}
              >
                {isLeaving ? (
                  <ActivityIndicator size="small" color="#E11D48" />
                ) : (
                  <>
                    <Feather name="log-out" size={18} color="#E11D48" />
                    <Text style={styles.leaveBtnText}>
                      {t("calendar.leave_event", { defaultValue: "Hủy tham gia" })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {inviteModalVisible && (
        <InviteCalendarModal
          visible={inviteModalVisible}
          onClose={() => setInviteModalVisible(false)}
          eventId={event._id}
          existingMemberIds={existingMemberIds}
          existingEmails={existingEmails}
          onSuccess={() => {
            onRefresh?.();
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  badgeChannel: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  badgeTextChannel: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "bold",
  },
  meetActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  meetJoinBtn: {
    flex: 1,
    backgroundColor: "#0052FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  meetJoinText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  meetChatBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  meetChatText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "bold",
  },
  infoSection: {
    gap: 20,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  participantList: {
    gap: 12,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  participantAvatarText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#475569",
  },
  participantInfo: {
    flex: 1,
    minWidth: 0,
  },
  participantName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  participantEmail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 12,
  },
  editBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  participantsSection: {
    marginTop: 4,
  },
  participantsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  participantsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0052FF",
  },
  leaveBtn: {
    flex: 1,
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  leaveBtnText: {
    color: "#E11D48",
    fontSize: 14,
    fontWeight: "600",
  },
});
