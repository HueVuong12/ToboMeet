import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Assignment } from "./types";

interface AssignmentListProps {
  assignments: Assignment[];
  isTeacher: boolean;
  onSelect: (assignment: Assignment) => void;
  onCreateClick: () => void;
  activeTab: "upcoming" | "grading" | "overdue" | "returned" | "draft";
  setActiveTab: (tab: "upcoming" | "grading" | "overdue" | "returned" | "draft") => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

export default function AssignmentList({
  assignments,
  isTeacher,
  onSelect,
  onCreateClick,
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing = false,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: AssignmentListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const now = new Date().getTime();

  const tabs = [
    { id: "upcoming", label: t("assignments.tab_upcoming") },
    ...(isTeacher ? [{ id: "grading", label: t("assignments.tab_grading") }] : []),
    { id: "overdue", label: t("assignments.tab_overdue") },
    { id: "returned", label: t("assignments.tab_returned") },
    ...(isTeacher ? [{ id: "draft", label: t("assignments.tab_draft") }] : []),
  ];

  const filteredAssignments = assignments.filter((a) => {
    if (searchQuery.trim() !== "") {
      const matchTitle = a.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchTitle) return false;
    }

    if (!isTeacher) {
      return a.status === "published";
    }

    const deadlineTime = a.deadline ? new Date(a.deadline).getTime() : 0;
    const isPastDeadline = deadlineTime ? deadlineTime <= now : false;

    if (activeTab === "draft") {
      return a.status === "draft";
    }

    if (a.status !== "published") {
      return false;
    }

    if (activeTab === "upcoming") {
      if (isPastDeadline) return false;
      return true;
    }

    if (activeTab === "grading") {
      const submissions = (a as any).submissions || [];
      return submissions.some((s: any) => s.submittedAt && !s.gradedAt);
    }

    if (activeTab === "overdue") {
      if (!isPastDeadline) return false;
      return true;
    }

    if (activeTab === "returned") {
      const submissions = (a as any).submissions || [];
      return submissions.length > 0 && submissions.some((s: any) => s.gradedAt);
    }

    return false;
  });

  const formatDeadlineText = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${date}/${month}/${year}`;
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header Bar */}
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {onOpenLeftDrawer && (
            <TouchableOpacity onPress={onOpenLeftDrawer} className="p-1 mr-2">
              <Feather name="menu" size={24} color="#1E293B" />
            </TouchableOpacity>
          )}
          <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center mr-2.5">
            <Text className="font-bold text-[#0052FF] text-sm">T</Text>
          </View>
          <Text className="font-bold text-slate-900 text-lg">{t("assignments.title")}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          {isTeacher && (
            <TouchableOpacity
              onPress={onCreateClick}
              className="flex-row items-center gap-1.5 bg-[#0052FF] active:bg-blue-700 px-3.5 py-2 rounded-xl shadow-xs"
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text className="font-bold text-white text-xs">{t("assignments.create_btn")}</Text>
            </TouchableOpacity>
          )}
          {onOpenRightDrawer && (
            <TouchableOpacity onPress={onOpenRightDrawer} className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
              <Feather name="info" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View className="bg-white px-4 py-2 border-b border-slate-100">
        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Feather name="search" size={14} color="#94A3B8" />
          <TextInput
            placeholder={t("assignments.search_members")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-xs text-slate-800 py-1 font-medium"
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.trim() !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs Navigation (Teachers only) */}
      {isTeacher && (
        <View className="bg-white border-b border-slate-200 px-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-3.5 border-b-2 mr-1.5 ${
                    isActive ? "border-[#0052FF]" : "border-transparent"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isActive ? "text-[#0052FF]" : "text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <View className="flex-1 justify-center items-center p-6">
          <Feather name="file-text" size={44} color="#CBD5E1" />
          <Text className="text-slate-400 font-bold text-xs mt-3 text-center">
            {t("assignments.no_data")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAssignments}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#0052FF"]} />
            ) : undefined
          }
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                onPress={() => onSelect(item)}
                className="bg-[#FFFFFF] border border-slate-200 rounded-2xl p-4 mb-3 flex-row items-center active:bg-slate-50 shadow-xs"
              >
                <View className="w-11 h-11 bg-[#e66a9a] rounded-2xl justify-center items-center shrink-0 mr-3 shadow-xs">
                  <Feather name="upload" size={20} color="#ffffff" />
                </View>

                <View className="flex-1 min-w-0">
                  <Text className="font-bold text-slate-900 text-sm mb-1" numberOfLines={1}>
                    {item.title}
                  </Text>

                  {item.status === "draft" && isTeacher ? (
                    <View className="self-start bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold text-amber-600 uppercase">
                        {t("assignments.status_draft")}
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Feather name="calendar" size={13} color="#94A3B8" />
                      <Text className="text-xs text-slate-500 font-medium" numberOfLines={1}>
                        Hạn nộp: {formatDeadlineText(item.deadline)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
