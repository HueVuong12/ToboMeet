import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

interface Props {
  visible: boolean;
  onClose: () => void;
  event: any | null;
  onEdit: (event: any) => void;
  onDelete: (event: any) => void;
  onJoin: (meetingCode: string) => void;
}

export default function MeetingDetailModal({
  visible,
  onClose,
  event,
  onEdit,
  onDelete,
  onJoin,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
    const statusMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
      submitted: { label: "Đã nộp", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
      graded: { label: "Đã chấm điểm", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
      overdue: { label: "Đã quá hạn", bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
      closed: { label: "Đã khóa/đóng", bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
      in_progress: { label: "Đang thực hiện", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
    };
    const currentStatus = statusMap[event.assignmentStatus || "in_progress"] || statusMap.in_progress;

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.container, { paddingBottom: insets.bottom || 24 }]}>
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

  // Data pre-fetched in calendar.tsx before modal opened — available immediately
  const currentUserId = event._currentUserId ?? null;
  const invitees: { email: string; displayName?: string }[] =
    event._prefetchedInvitees ?? [];

  const isHost = currentUserId && event.hostId && currentUserId === event.hostId;
  const isChannelMeeting = event.roomType === "channel_meeting";
  const hasInvitees = invitees && invitees.length > 0;
  const showJoin = event.meetingCode && (isChannelMeeting || hasInvitees);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom || 24 }]}>
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
                  onPress={() => {}}
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
              {hasInvitees && (
                <View style={styles.infoRow}>
                  <Feather name="users" size={18} color="#0052FF" style={styles.infoIcon} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>
                      {i18n.language === "vi" ? "Người tham gia" : "Participants"}
                    </Text>
                    <View style={styles.participantList}>

                      {/* Host row */}
                      <View style={styles.participantRow}>
                        <View style={styles.participantAvatar}>
                          <Text style={styles.participantAvatarText}>
                            {(event.hostDisplayName || event.hostEmail || "?").substring(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.participantInfo}>
                          <Text style={styles.participantName} numberOfLines={1}>
                            {event.hostDisplayName || event.hostEmail?.split("@")[0] || ""}
                          </Text>
                          {event.hostEmail ? (
                            <Text style={styles.participantEmail} numberOfLines={1}>
                              {event.hostEmail}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: "#EEF2FF" }]}>
                          <Text style={[styles.statusBadgeText, { color: "#4F46E5" }]}>
                            {i18n.language === "vi" ? "Người tổ chức" : "Organizer"}
                          </Text>
                        </View>
                      </View>

                      {/* Invitee rows */}
                      {invitees.map((inv: any, idx: number) => {
                        const status: string = inv.status || "PENDING";
                        let dotColor = "#94A3B8";
                        if (status === "ACCEPTED") dotColor = "#10B981";
                        else if (status === "DECLINED") dotColor = "#F43F5E";
                        else if (status === "TENTATIVE") dotColor = "#F59E0B";

                        const statusLabel =
                          status === "ACCEPTED"
                            ? i18n.language === "vi" ? "Đã chấp nhận" : "Accepted"
                            : status === "DECLINED"
                            ? i18n.language === "vi" ? "Đã từ chối" : "Declined"
                            : i18n.language === "vi" ? "Chưa phản hồi" : "Pending";

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
                </View>
              )}
            </View>
          </ScrollView>

          {/* Actions Footer - Management Only */}
          {isHost && (
            <View style={styles.footer}>
              {/* Edit Button */}
              <TouchableOpacity
                onPress={() => onEdit({ ...event, invitees })}
                style={styles.editBtn}
              >
                <Feather name="edit-2" size={18} color="#475569" />
                <Text style={styles.editBtnText}>
                  {i18n.language === "vi" ? "Chỉnh sửa" : "Edit"}
                </Text>
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity
                onPress={() => onDelete({ ...event, invitees })}
                style={styles.deleteBtn}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
                <Text style={styles.deleteBtnText}>
                  {i18n.language === "vi" ? "Xóa" : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
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
    marginTop: 10,
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
});
