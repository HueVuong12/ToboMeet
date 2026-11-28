import React from "react";
import { Stack } from "expo-router";

export default function MeetingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        orientation: "portrait_up",
        animation: "none",
      }}
    />
  );
}

