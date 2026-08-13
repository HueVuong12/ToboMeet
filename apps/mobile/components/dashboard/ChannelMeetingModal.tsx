import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useCreateCalendarEventMutation } from "../../lib/redux/api/calendarApi";
import { useGetMyRoomsForCalendarQuery } from "../../lib/redux/api/roomsCalendarApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChannelMeetingModal({ visible, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [expandedRoomsInputMode, setExpandedRoomsInputMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: rooms, isLoading: isLoadingRooms } = useGetMyRoomsForCalendarQuery(undefined, {
    skip: !visible,
  });
  const [createEvent, { isLoading: isCreating }] = useCreateCalendarEventMutation();

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tiêu đề cuộc họp");
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert("Lỗi", "Vui lòng chọn thời gian bắt đầu và kết thúc");
      return;
    }
    if (!selectedRoom || !selectedChannel) {
      Alert.alert("Lỗi", "Vui lòng chọn phòng và kênh");
      return;
    }

    try {
      const payload = {
        title,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        roomType: "channel_meeting",
        roomId: selectedRoom._id,
        channelId: selectedChannel._id,
      };

      await createEvent(payload).unwrap();
      Alert.alert("Thành công", "Đã tạo cuộc họp kênh thành công");
      onSuccess();
      handleClose();
    } catch (error: any) {
      Alert.alert("Lỗi", error?.data?.message || "Không thể tạo cuộc họp");
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
    setExpandedRooms({});
    setDropdownOpen(false);
    onClose();
  };

  const filteredRooms = rooms?.filter((r: any) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#0F172A" }}>Cuộc họp kênh</Text>
            <TouchableOpacity onPress={handleClose}>
              <Feather name="x" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: 16 }}>
              {/* Tiêu đề */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748B", marginBottom: 6 }}>TIÊU ĐỀ CUỘC HỌP</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ví dụ: Sprint Planning"
                  placeholderTextColor="#94A3B8"
                  style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#0F172A" }}
                />
              </View>

              {/* Bắt đầu */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748B", marginBottom: 6 }}>BẮT ĐẦU (YYYY-MM-DDTHH:MM)</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-08-13T22:00"
                  placeholderTextColor="#94A3B8"
                  style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#0F172A" }}
                />
              </View>

              {/* Kết thúc */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748B", marginBottom: 6 }}>KẾT THÚC (YYYY-MM-DDTHH:MM)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-08-13T23:00"
                  placeholderTextColor="#94A3B8"
                  style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#0F172A" }}
                />
              </View>

              {/* Combobox Chọn phòng dạng Tree (Phòng / Kênh lồng nhau) */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748B", marginBottom: 6 }}>THÊM KÊNH</Text>
                
                {/* Input gõ tìm kiếm trực tiếp trên mobile */}
                <View style={{ position: "relative" }}>
                  <TextInput
                    value={(() => {
                      const selectionText = selectedRoom && selectedChannel ? `${selectedRoom.name} > ${selectedChannel.name}   ` : "";
                      if (searchQuery) {
                        return selectionText ? `${selectionText}${searchQuery}` : searchQuery;
                      }
                      return selectionText;
                    })()}
                    onChangeText={(txt) => {
                      const selectionText = selectedRoom && selectedChannel ? `${selectedRoom.name} > ${selectedChannel.name}   ` : "";
                      if (selectionText && txt.startsWith(selectionText)) {
                        const typedPart = txt.substring(selectionText.length);
                        if (typedPart.trim() === `${selectedRoom.name} > ${selectedChannel.name}`.trim()) {
                          setSearchQuery("");
                        } else {
                          setSearchQuery(typedPart);
                        }
                      } else {
                        setSearchQuery(txt);
                      }
                      setDropdownOpen(true);
                      setExpandedRoomsInputMode(true);
                    }}
                    onFocus={() => {
                      setDropdownOpen(true);
                      setSearchQuery("");
                      setExpandedRoomsInputMode(false);
                    }}
                    placeholder="Chọn phòng và kênh..."
                    placeholderTextColor="#94A3B8"
                    style={{
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      borderRadius: 12,
                      paddingLeft: selectedRoom ? 44 : 36,
                      paddingRight: 36,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: "#0F172A",
                      backgroundColor: "#FFFFFF",
                      fontWeight: selectedRoom && selectedChannel ? "bold" : "normal"
                    }}
                  />
                  {selectedRoom ? (() => {
                    const CARD_GRADIENTS = [
                      "#7C3AED", "#2563EB", "#0D9488", "#E11D48",
                      "#D97706", "#0891B2", "#C026D3", "#059669"
                    ];
                    let hash = 0;
                    for (let i = 0; i < selectedRoom._id.length; i++) {
                      hash = selectedRoom._id.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    const color = CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
                    return (
                      <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: color, justifyContent: "center", alignItems: "center", position: "absolute", left: 12, top: 12 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "bold" }}>
                          {selectedRoom.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    );
                  })() : (
                    <Feather name="search" size={14} color="#64748B" style={{ position: "absolute", left: 14, top: 15 }} />
                  )}
                  <TouchableOpacity 
                    onPress={() => setDropdownOpen(!dropdownOpen)} 
                    style={{ position: "absolute", right: 14, top: 15 }}
                  >
                    <Feather name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {dropdownOpen && (
                  <View style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, marginTop: 4, padding: 8, backgroundColor: "#FFFFFF", maxHeight: 220, zIndex: 99 }}>
                    {isLoadingRooms ? (
                      <ActivityIndicator size="small" color="#0052FF" />
                    ) : (
                      <ScrollView nestedScrollEnabled>
                        {filteredRooms.map((room: any) => {
                          const isExpanded = expandedRoomsInputMode ? true : (expandedRooms[room._id] ?? (selectedRoom?._id === room._id));
                          const CARD_GRADIENTS = [
                            "#7C3AED", "#2563EB", "#0D9488", "#E11D48",
                            "#D97706", "#0891B2", "#C026D3", "#059669"
                          ];
                          let hash = 0;
                          for (let i = 0; i < room._id.length; i++) {
                            hash = room._id.charCodeAt(i) + ((hash << 5) - hash);
                          }
                          const color = CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];

                          return (
                            <View key={room._id} style={{ marginBottom: 6 }}>
                              {/* Dòng phòng */}
                              <TouchableOpacity
                                onPress={() => {
                                  setExpandedRoomsInputMode(false);
                                  setExpandedRooms(prev => ({
                                    ...prev,
                                    [room._id]: !isExpanded
                                  }));
                                }}
                                style={{ paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                              >
                                <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={12} color="#64748B" />
                                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: color, justifyContent: "center", alignItems: "center" }}>
                                  <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "bold" }}>
                                    {room.name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#1E293B", flex: 1 }} numberOfLines={1}>
                                  {room.name}
                                </Text>
                              </TouchableOpacity>

                              {/* Danh sách kênh thụt lề */}
                              {isExpanded && (
                                <View style={{ paddingLeft: 28, gap: 4, marginVertical: 4 }}>
                                  {(!room.channels || room.channels.length === 0) ? (
                                    <Text style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>Chưa có kênh</Text>
                                  ) : (
                                    room.channels.map((channel: any) => {
                                      const isSelected = selectedChannel?._id === channel._id;
                                      return (
                                        <TouchableOpacity
                                          key={channel._id}
                                          onPress={() => {
                                            setSelectedRoom(room);
                                            setSelectedChannel(channel);
                                            setSearchQuery("");
                                            setDropdownOpen(false);
                                            setExpandedRoomsInputMode(false);
                                          }}
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 8,
                                            paddingVertical: 6,
                                            paddingHorizontal: 8,
                                            backgroundColor: isSelected ? "#EFF6FF" : "transparent",
                                            borderRadius: 8
                                          }}
                                        >
                                          <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: isSelected ? "#0052FF" : "#94A3B8", justifyContent: "center", alignItems: "center" }}>
                                            {isSelected && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#0052FF" }} />}
                                          </View>
                                          <Text style={{ fontSize: 13, color: isSelected ? "#0052FF" : "#475569", fontWeight: isSelected ? "bold" : "normal" }}>
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
                          <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", paddingVertical: 8 }}>Không tìm thấy phòng</Text>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              {/* Mô tả */}
              <View>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748B", marginBottom: 6 }}>MÔ TẢ</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Nội dung cuộc họp..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={{ borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#0F172A", height: 80, textAlignVertical: "top" }}
                />
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={{ flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "#475569", fontWeight: "bold", fontSize: 14 }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isCreating}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: "#0052FF", borderRadius: 12, alignItems: "center" }}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 14 }}>Lưu</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
