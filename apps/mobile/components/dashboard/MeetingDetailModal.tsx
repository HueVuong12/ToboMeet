import React, { useState, useEffect } from "react";
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
import { supabase } from "../../lib/supabase";
import { axiosInstance } from "../../lib/axios";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<any[]>([]);

  useEffect(() => {
    if (visible) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          setCurrentUserId(data.session.user.id);
        }
      });
    }
  }, [visible]);

  // Fetch invitation list when modal becomes visible or event changes
  useEffect(() => {
    if (visible && event) {
      axiosInstance.get(`/calendar/${event._id}/rsvp`)
        .then((response: any) => {
          setInvitees(response || []);
        })
        .catch((err) => {
          console.log("Error fetching RSVP list:", err);
        });
    } else {
      setInvitees([]);
    }
  }, [visible, event]);

  if (!event) return null;

  const isHost = currentUserId && event.hostId && currentUserId === event.hostId;

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  const isChannelMeeting = event.roomType === "channel_meeting";
  const hasInvitees = invitees && invitees.length > 0;
  const showJoin = event.meetingCode && (isChannelMeeting || hasInvitees);

  // Check if description has actual text content
  const cleanDesc = event.description ? event.description.replace(/<[^>]*>/g, "").trim() : "";
  const hasDescription = cleanDesc.length > 0;

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
                    <View style={styles.inviteeList}>
                      {invitees.map((inv: any, idx: number) => (
                        <View key={idx} style={styles.inviteeItem}>
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>
                              {(inv.displayName || inv.email).substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.inviteeName} numberOfLines={1}>
                            {inv.displayName || inv.email.split("@")[0]}
                          </Text>
                        </View>
                      ))}
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
  inviteeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  inviteeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxWidth: 150,
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#475569",
  },
  inviteeName: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
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
