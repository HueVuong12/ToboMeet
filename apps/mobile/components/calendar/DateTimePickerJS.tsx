import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, FlatList } from "react-native";
import { useTranslation } from "react-i18next";

interface DateTimePickerJSProps {
  visible: boolean;
  value: string; // ISO string
  onClose: () => void;
  onChange: (value: string) => void;
}

export default function DateTimePickerJS({
  visible,
  value,
  onClose,
  onChange,
}: DateTimePickerJSProps) {
  const { t, i18n } = useTranslation();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const [day, setDay] = useState("01");
  const [month, setMonth] = useState("01");
  const [year, setYear] = useState("2026");
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");

  useEffect(() => {
    if (visible) {
      const initialDate = value ? new Date(value) : new Date();
      if (!isNaN(initialDate.getTime())) {
        setDay(pad(initialDate.getDate()));
        setMonth(pad(initialDate.getMonth() + 1));
        setYear(initialDate.getFullYear().toString());
        setHour(pad(initialDate.getHours()));
        setMinute(pad(initialDate.getMinutes()));
      }
    }
  }, [visible, value]);

  const days = Array.from({ length: 31 }, (_, i) => pad(i + 1));
  const months = Array.from({ length: 12 }, (_, i) => pad(i + 1));
  const years = Array.from({ length: 10 }, (_, i) => (2025 + i).toString());
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = Array.from({ length: 60 }, (_, i) => pad(i));

  const handleConfirm = () => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const h = parseInt(hour, 10);
    const min = parseInt(minute, 10);

    const testDate = new Date(y, m - 1, d, h, min);
    onChange(testDate.toISOString());
    onClose();
  };

  const renderColumn = (
    label: string,
    data: string[],
    selected: string,
    setSelected: (val: string) => void
  ) => {
    return (
      <View className="flex-1 items-center">
        <Text className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase">
          {label}
        </Text>
        <FlatList
          data={data}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          className="w-full"
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <TouchableOpacity
                onPress={() => setSelected(item)}
                className={`py-2 items-center rounded-lg ${
                  isSelected ? "bg-blue-100" : ""
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    isSelected ? "font-bold text-blue-600" : "text-slate-700"
                  }`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const isVi = i18n.language === "vi";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-slate-900/60 justify-center items-center p-4">
        <View className="bg-white rounded-3xl p-5 w-full max-w-sm border border-slate-100">
          <Text className="text-base font-bold text-slate-900 mb-4 text-center">
            {isVi ? "Chọn thời gian" : "Select Date & Time"}
          </Text>

          <View className="flex-row h-44 justify-between items-center border border-slate-200 rounded-2xl p-2 bg-slate-50">
            {renderColumn(isVi ? "Ngày" : "Day", days, day, setDay)}
            {renderColumn(isVi ? "Tháng" : "Month", months, month, setMonth)}
            {renderColumn(isVi ? "Năm" : "Year", years, year, setYear)}
            <Text className="text-base font-bold text-slate-400 self-center mt-3">
              :
            </Text>
            {renderColumn(isVi ? "Giờ" : "Hour", hours, hour, setHour)}
            {renderColumn(isVi ? "Phút" : "Min", minutes, minute, setMinute)}
          </View>

          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 border border-slate-200 py-3 rounded-xl items-center active:bg-slate-50"
            >
              <Text className="text-slate-600 font-bold text-sm">
                {t("calendar.cancel", { defaultValue: "Hủy" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              className="flex-1 bg-blue-600 py-3 rounded-xl items-center active:bg-blue-700"
            >
              <Text className="text-white font-bold text-sm">
                {t("calendar.delete_modal.confirm", { defaultValue: "Xác nhận" })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
