// hooks/useBreakoutTimer.ts
import { useState, useEffect, useRef } from "react";
import { useGetBreakoutCountsQuery } from "../lib/redux/features/meetings/meetingsApi";

interface UseBreakoutTimerProps {
  startedAt: number;
  durationMinutes: number;
  meetingCode: string;
}

export function useBreakoutTimer({
  startedAt,
  durationMinutes,
  meetingCode,
}: UseBreakoutTimerProps): string | null {
  const [realTime, setRealTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0);

  // Biến Ref để ghi nhớ thời điểm bắt đầu gọi API (không dùng state để tránh re-render)
  const requestStartTime = useRef<number>(0);

  const { data, isLoading, isFetching } = useGetBreakoutCountsQuery(
    { code: meetingCode },
    { skip: !startedAt || !durationMinutes || !meetingCode },
  );

  // Ghi lại thời điểm ngay khi API vừa được bắn đi
  useEffect(() => {
    if (isFetching) {
      requestStartTime.current = Date.now();
    }
  }, [isFetching]);

  // Tính toán độ lệch giờ (Offset) bằng thuật toán NTP
  useEffect(() => {
    if (data?.serverTime && requestStartTime.current > 0) {
      const receiveTime = Date.now();

      // Tổng thời gian API đi và về
      const rtt = receiveTime - requestStartTime.current;

      // Giờ server thực tế tại khoảnh khắc nhận được data
      const accurateServerTime = data.serverTime + rtt / 2;

      // Tính độ lệch chuẩn
      setTimeOffset(accurateServerTime - receiveTime);
    }
  }, [data?.serverTime]);

  // Chạy đếm ngược mượt mà ở Local
  useEffect(() => {
    if (!startedAt || !durationMinutes) return;
    const interval = setInterval(() => {
      setRealTime(Date.now() + timeOffset);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeOffset, startedAt, durationMinutes]);

  // NẾU PHÒNG CHƯA CÓ GIỜ -> Ẩn hoàn toàn
  if (!startedAt || !durationMinutes) return null;

  // NẾU ĐANG CALL API CHỜ GIỜ SERVER -> Hiện placeholder
  if (isLoading || !data) return "--:--";

  // TÍNH TOÁN THỜI GIAN CÒN LẠI
  const endTime = startedAt + durationMinutes * 60 * 1000;
  const remainingMs = endTime - realTime;

  if (remainingMs <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;

  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
