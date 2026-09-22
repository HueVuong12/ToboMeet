import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface QuizCountdownProps {
  startedAt: string;
  timeLimitMinutes: number;
  onTimeUp: () => void;
}

export default function QuizCountdown({
  startedAt,
  timeLimitMinutes,
  onTimeUp,
}: QuizCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const start = new Date(startedAt).getTime();
    const durationMs = timeLimitMinutes * 60 * 1000;
    const end = start + durationMs;
    const remain = Math.max(0, Math.floor((end - Date.now()) / 1000));
    return remain;
  });

  useEffect(() => {
    if (timeLimitMinutes <= 0) return;

    const interval = setInterval(() => {
      const start = new Date(startedAt).getTime();
      const durationMs = timeLimitMinutes * 60 * 1000;
      const end = start + durationMs;
      const remain = Math.max(0, Math.floor((end - Date.now()) / 1000));

      setTimeLeft(remain);

      if (remain <= 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, onTimeUp]);

  if (timeLimitMinutes <= 0) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60; // Dưới 1 phút cảnh báo đỏ

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
        isUrgent
          ? "bg-rose-50 border-rose-300 text-rose-600 animate-pulse"
          : "bg-slate-100 border-slate-200 text-slate-700"
      }`}
    >
      {isUrgent ? (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
      ) : (
        <Clock className="w-3.5 h-3.5 text-blue-600" />
      )}
      <span>
        {pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
