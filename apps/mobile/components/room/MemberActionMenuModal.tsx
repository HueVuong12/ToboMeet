import React from "react";
import { View, Text, TouchableOpacity, Modal, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import {
  useTransferRoomOwnershipMutation,
  useUpdateChannelMemberRoleMutation,
  useRemoveChannelMemberMutation,
} from "../../lib/redux/features/rooms/roomsApi";
import {
  ChannelResponse,
  RoomMemberResponse,
  RoomResponse,
} from "@tobomeet/shared/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MemberActionMenuModalProps {
  visible: boolean;
  onClose: () => void;
  member: RoomMemberResponse | null; // selectedMemberForMenu
  room: RoomResponse;
  currentChannel?: ChannelResponse;
  currentUserId: string | undefined;

  // Cờ phân quyền
  isOwner: boolean;
  canUserManageChannel: boolean;
  isCurrentUserRoomVice: boolean;
  isTargetAdmin: boolean;
  isTargetRoomVice: boolean;
  isTargetRoomLeader: boolean;

  // Callback function
  onReportUser: (member: RoomMemberResponse) => void;
  onKickMember: (member: RoomMemberResponse) => void;
  refetchMembers: () => void;
  refetchRoom: () => void;
}

export default function MemberActionMenuModal({
  visible,
  onClose,
  member,
  room,
  currentChannel,
  currentUserId,
  isOwner,
  canUserManageChannel,
  isCurrentUserRoomVice,
  isTargetAdmin,
  isTargetRoomVice,
  isTargetRoomLeader,
  onReportUser,
  onKickMember,
  refetchMembers,
  refetchRoom,
}: MemberActionMenuModalProps) {
  const { t } = useTranslation();

  const [updateChannelMemberRole] = useUpdateChannelMemberRoleMutation();
  const [transferRoomOwnershipMutation] = useTransferRoomOwnershipMutation();
  const [removeChannelMember] = useRemoveChannelMemberMutation();

  if (!member || !room) return null;
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end bg-black/50"
        style={{ paddingBottom: insets.bottom }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="absolute inset-0"
        />
        <View className="bg-white rounded-t-3xl p-6 shadow-2xl">
          <View className="items-center mb-4">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
            <Text className="font-bold text-slate-800 text-lg mt-3">
              {member.displayName}
            </Text>
          </View>

          {/* Nút: Báo xấu */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              onReportUser(member);
            }}
            className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
          >
            <Feather name="flag" size={18} color="#EF4444" />
            <Text className="text-red-500 text-base font-semibold">
              {t("room.report_user")}
            </Text>
          </TouchableOpacity>

          {/* Các lệnh chức năng - Ẩn đối với bản thân */}
          {member.userId !== currentUserId && (
            <>
              {/* QUẢN LÝ QUYỀN (CHỈ DÀNH CHO OWNER) */}
              {isOwner && (
                <>
                  {/* Bổ nhiệm admin */}
                  {!isTargetAdmin && member.userId !== room.ownerId && (
                    <TouchableOpacity
                      onPress={async () => {
                        onClose();
                        try {
                          await updateChannelMemberRole({
                            roomId: room._id,
                            channelId: currentChannel?._id || "",
                            targetUserId: member.userId,
                            role: "admin",
                          }).unwrap();
                          toast.success(
                            t("room.toast_appoint_vice_leader_success", {
                              defaultValue: "Bổ nhiệm Phó nhóm thành công",
                            }),
                          );
                          refetchMembers();
                        } catch (err: any) {
                          const subTitle =
                            room.type === "classroom"
                              ? t("room.role_assistant", {
                                  defaultValue: "Ban cán sự",
                                })
                              : t("room.role_vice_leader", {
                                  defaultValue: "Phó nhóm",
                                });
                          Alert.alert(
                            t("room.error", { defaultValue: "Lỗi" }),
                            err?.data?.message ||
                              t("room.max_vice_reached", {
                                role: subTitle,
                                defaultValue: `Đã đạt số lượng tối đa 3 ${subTitle}`,
                              }),
                          );
                        }
                      }}
                      className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
                    >
                      <Feather name="user-check" size={18} color="#2563EB" />
                      <Text className="text-blue-600 text-base font-semibold">
                        {room.type === "classroom"
                          ? t("room.appoint_assistant", {
                              defaultValue: "Bổ nhiệm Ban cán sự",
                            })
                          : t("room.appoint_vice_leader", {
                              defaultValue: "Bổ nhiệm Phó nhóm",
                            })}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Thu hồi admin */}
                  {isTargetAdmin && member.userId !== room.ownerId && (
                    <TouchableOpacity
                      onPress={async () => {
                        onClose();
                        try {
                          await updateChannelMemberRole({
                            roomId: room._id,
                            channelId: currentChannel?._id || "",
                            targetUserId: member.userId,
                            role: "member",
                          }).unwrap();
                          toast.success(
                            t("room.toast_revoke_vice_leader_success", {
                              defaultValue: "Đã thu hồi quyền thành công",
                            }),
                          );
                          refetchMembers();
                        } catch (err: any) {
                          Alert.alert(
                            t("room.error", { defaultValue: "Lỗi" }),
                            err?.data?.message ||
                              t("room.cannot_revoke", {
                                defaultValue: "Không thể thu hồi",
                              }),
                          );
                        }
                      }}
                      className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
                    >
                      <Feather name="user-minus" size={18} color="#D97706" />
                      <Text className="text-amber-600 text-base font-semibold">
                        {room.type === "classroom"
                          ? t("room.revoke_assistant", {
                              defaultValue: "Thu hồi Ban cán sự",
                            })
                          : t("room.revoke_vice_leader", {
                              defaultValue: "Thu hồi Phó nhóm",
                            })}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Chuyển quyền Owner */}
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      const isClass = room.type === "classroom";
                      const ownerTitle = isClass
                        ? t("room.role_teacher", { defaultValue: "Giảng viên" })
                        : t("room.role_leader", {
                            defaultValue: "Trưởng nhóm",
                          });
                      const memberTitle = isClass
                        ? t("room.role_student", { defaultValue: "Học viên" })
                        : t("room.role_member", { defaultValue: "Thành viên" });
                      Alert.alert(
                        isClass
                          ? t("room.transfer_teacher_title", {
                              defaultValue: "Chuyển quyền Giảng viên",
                            })
                          : t("room.transfer_leader_title", {
                              defaultValue: "Chuyển quyền Trưởng nhóm",
                            }),
                        t("room.transfer_confirm_message", {
                          role: ownerTitle,
                          name: member.displayName,
                          downgradedRole: memberTitle,
                          defaultValue: `Bạn có chắc chắn muốn chuyển quyền ${ownerTitle} cho ${member.displayName}? Sau khi xác nhận, bạn sẽ trở thành ${memberTitle}.`,
                        }),
                        [
                          {
                            text: t("room.cancel", { defaultValue: "Hủy" }),
                            style: "cancel",
                          },
                          {
                            text: t("room.confirm", {
                              defaultValue: "Xác nhận",
                            }),
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await transferRoomOwnershipMutation({
                                  roomId: room._id,
                                  newOwnerId: member.userId,
                                }).unwrap();
                                refetchMembers();
                                refetchRoom();
                              } catch (err: any) {
                                Alert.alert(
                                  "Lỗi",
                                  err?.data?.message ||
                                    "Không thể chuyển quyền",
                                );
                              }
                            },
                          },
                        ],
                      );
                    }}
                    className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
                  >
                    <Feather name="shield" size={18} color="#B45309" />
                    <Text className="text-amber-700 text-base font-bold">
                      {room.type === "classroom"
                        ? t("room.appoint_teacher", {
                            defaultValue: "Bổ nhiệm Giảng viên",
                          })
                        : t("room.appoint_leader", {
                            defaultValue: "Bổ nhiệm Trưởng nhóm",
                          })}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* XÓA KHỎI KÊNH RIÊNG TƯ */}
              {canUserManageChannel &&
                member.userId !== room.ownerId &&
                currentChannel?.isPrivate &&
                (isOwner ||
                  (!isTargetAdmin &&
                    !isTargetRoomVice &&
                    !isTargetRoomLeader)) && (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      Alert.alert(
                        "Xác nhận xóa khỏi kênh",
                        `Bạn có chắc chắn muốn xóa thành viên ${member.displayName} khỏi kênh riêng tư này?`,
                        [
                          { text: t("room.cancel"), style: "cancel" },
                          {
                            text: "Xóa",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await removeChannelMember({
                                  roomId: room._id,
                                  channelId: currentChannel._id,
                                  targetUserId: member.userId,
                                }).unwrap();
                                toast.success(
                                  t(
                                    "room.toast_remove_from_private_channel_success",
                                    {
                                      defaultValue:
                                        "Đã xóa khỏi Kênh riêng tư thành công",
                                    },
                                  ),
                                );
                                refetchRoom();
                              } catch (err: any) {
                                toast.error(
                                  "Không thể xóa thành viên khỏi kênh",
                                );
                              }
                            },
                          },
                        ],
                      );
                    }}
                    className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
                  >
                    <Feather name="user-minus" size={18} color="#EF4444" />
                    <Text className="text-red-500 text-base font-semibold">
                      {t("room.remove_from_private_channel", {
                        defaultValue: "Xóa khỏi Kênh riêng tư",
                      })}
                    </Text>
                  </TouchableOpacity>
                )}

              {/* KICK KHỎI PHÒNG (Room Level) */}
              {currentChannel?.isPrivate !== true &&
                (isOwner ||
                  (isCurrentUserRoomVice &&
                    !isTargetAdmin &&
                    !isTargetRoomVice &&
                    !isTargetRoomLeader)) && (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onKickMember(member);
                    }}
                    className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
                  >
                    <Feather name="user-x" size={18} color="#EF4444" />
                    <Text className="text-red-500 text-base font-semibold">
                      {t("room.remove_member")}
                    </Text>
                  </TouchableOpacity>
                )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
