/**
 * QuizCountdown.tsx — Bộ đếm ngược thời gian làm bài
 * Tách riêng để tái sử dụng và dễ test
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

interface QuizCountdownProps {
  /** Thời điểm bắt đầu làm bài (ISO string) */
  startedAt: string;
  /** Giới hạn thời gian (phút). 0 = không giới hạn */
  timeLimitMinutes: number;
  /** Callback khi hết giờ — gọi auto-submit */
  onTimeUp: () => void;
}

function calcSecondsLeft(startedAt: string, timeLimitMinutes: number): number {
  const started = new Date(startedAt).getTime();
  const limitMs = timeLimitMinutes * 60 * 1000;
  const elapsed = Date.now() - started;
  return Math.max(0, Math.floor((limitMs - elapsed) / 1000));
}

export default function QuizCountdown({
  startedAt,
  timeLimitMinutes,
  onTimeUp,
}: QuizCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    calcSecondsLeft(startedAt, timeLimitMinutes),
  );
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const onTimeUpRef = useRef(onTimeUp);
  const hasCalledTimeUp = useRef(false);

  // Cập nhật ref khi prop thay đổi — tránh stale closure
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Hiệu ứng pulse khi còn ≤ 60 giây
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (timeLimitMinutes <= 0) return;

    const interval = setInterval(() => {
      const left = calcSecondsLeft(startedAt, timeLimitMinutes);
      setSecondsLeft(left);

      if (left <= 60 && left > 0) {
        startPulse();
      }

      if (left === 0 && !hasCalledTimeUp.current) {
        hasCalledTimeUp.current = true;
        clearInterval(interval);
        onTimeUpRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, startPulse]);

  if (timeLimitMinutes <= 0) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isWarning = secondsLeft <= 60;

  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <Animated.View
      style={{ transform: [{ scale: isWarning ? pulseAnim : 1 }] }}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
        isWarning
          ? "bg-red-50 border-red-200"
          : "bg-blue-50 border-blue-100"
      }`}
    >
      <Feather
        name="clock"
        size={14}
        color={isWarning ? "#EF4444" : "#0052FF"}
      />
      <Text
        className={`font-bold text-sm tabular-nums ${
          isWarning ? "text-red-600" : "text-[#0052FF]"
        }`}
      >
        {timeStr}
      </Text>
    </Animated.View>
  );
}
