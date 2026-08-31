import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useTranslation } from "react-i18next";

interface DateTimePickerJSProps {
  visible: boolean;
  value: string; // ISO string
  onClose: () => void;
  onChange: (value: string) => void;
}

export default function DateTimePickerJS({ visible, value, onClose, onChange }: DateTimePickerJSProps) {
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

  const renderColumn = (label: string, data: string[], selected: string, setSelected: (val: string) => void) => {
    return (
      <View style={styles.column}>
        <Text style={styles.columnLabel}>{label}</Text>
        <FlatList
          data={data}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <TouchableOpacity
                onPress={() => setSelected(item)}
                style={[styles.item, isSelected && styles.selectedItem]}
              >
                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("calendar.picker_title")}</Text>
          
          <View style={styles.pickerContainer}>
            {renderColumn(t("calendar.day"), days, day, setDay)}
            {renderColumn(t("calendar.month"), months, month, setMonth)}
            {renderColumn(t("calendar.year"), years, year, setYear)}
            <Text style={styles.timeDivider}>:</Text>
            {renderColumn(t("calendar.hour"), hours, hour, setHour)}
            {renderColumn(t("calendar.minute"), minutes, minute, setMinute)}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t("calendar.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>{t("calendar.confirm")}</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerContainer: {
    flexDirection: "row",
    height: 180,
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 8,
    backgroundColor: "#F8FAFC",
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 6,
  },
  list: {
    width: "100%",
  },
  item: {
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  selectedItem: {
    backgroundColor: "#E0E7FF",
  },
  itemText: {
    fontSize: 13,
    color: "#334155",
  },
  selectedItemText: {
    fontWeight: "bold",
    color: "#0052FF",
  },
  timeDivider: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#94A3B8",
    alignSelf: "center",
    marginTop: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#475569",
    fontWeight: "bold",
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#0052FF",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
