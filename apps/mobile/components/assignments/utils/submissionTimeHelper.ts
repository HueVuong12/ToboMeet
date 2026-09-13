/**
 * Helper tính toán trạng thái thời gian nộp bài so với deadline trên Mobile
 * Đảm bảo:
 * - So sánh timestamp UTC độc lập timezone
 * - Tính toán chính xác phút chênh lệch
 * - Định dạng phút / giờ phút / ngày giờ tương tự Web
 */

export interface SubmissionTimingResult {
  status: "early" | "on_time" | "late" | "not_submitted";
  text: string;
  minutesDiff: number;
}

export function calculateSubmissionTiming(
  submittedAt?: string | Date | null,
  deadline?: string | Date | null,
  t?: (key: string, options?: any) => string
): SubmissionTimingResult {
  const notSubmittedText = t
    ? t("assignments.timing_not_submitted", { defaultValue: "Chưa nộp" })
    : "Chưa nộp";
  const turnedInText = t
    ? t("assignments.status_submitted", { defaultValue: "Đã nộp để đánh giá" })
    : "Đã nộp để đánh giá";
  const onTimeText = t
    ? t("assignments.timing_on_time", { defaultValue: "Đúng hạn" })
    : "Đúng hạn";

  if (!submittedAt) {
    return {
      status: "not_submitted",
      text: notSubmittedText,
      minutesDiff: 0,
    };
  }

  if (!deadline) {
    return {
      status: "on_time",
      text: turnedInText,
      minutesDiff: 0,
    };
  }

  const subTime = new Date(submittedAt).getTime();
  const dlTime = new Date(deadline).getTime();

  if (isNaN(subTime) || isNaN(dlTime)) {
    return {
      status: "on_time",
      text: turnedInText,
      minutesDiff: 0,
    };
  }

  const diffMs = subTime - dlTime;
  const diffMinutes = Math.round(Math.abs(diffMs) / 60000);

  // Chênh lệch dưới 60 giây coi là Đúng hạn
  if (Math.abs(diffMs) < 60000) {
    return {
      status: "on_time",
      text: onTimeText,
      minutesDiff: 0,
    };
  }

  const minUnit = t ? t("assignments.unit_minute", { defaultValue: "phút" }) : "phút";
  const hourUnit = t ? t("assignments.unit_hour", { defaultValue: "giờ" }) : "giờ";
  const dayUnit = t ? t("assignments.unit_day", { defaultValue: "ngày" }) : "ngày";

  const formatReadableTime = (totalMins: number): string => {
    if (totalMins < 60) {
      return `${totalMins} ${minUnit}`;
    }
    if (totalMins < 1440) {
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const hoursStr = `${hours} ${hourUnit}`;
      const minsStr = mins > 0 ? ` ${mins} ${minUnit}` : "";
      return `${hoursStr}${minsStr}`;
    }
    const days = Math.floor(totalMins / 1440);
    const remMins = totalMins % 1440;
    const hours = Math.floor(remMins / 60);
    const daysStr = `${days} ${dayUnit}`;
    const hoursStr = hours > 0 ? ` ${hours} ${hourUnit}` : "";
    return `${daysStr}${hoursStr}`;
  };

  const timeStr = formatReadableTime(diffMinutes);

  if (subTime < dlTime) {
    const earlyText = t
      ? t("assignments.timing_early", { diff: timeStr, defaultValue: `Sớm ${timeStr}` })
      : `Sớm ${timeStr}`;
    return {
      status: "early",
      text: earlyText,
      minutesDiff: diffMinutes,
    };
  } else {
    const lateText = t
      ? t("assignments.timing_late", { diff: timeStr, defaultValue: `Trễ ${timeStr}` })
      : `Trễ ${timeStr}`;
    return {
      status: "late",
      text: lateText,
      minutesDiff: diffMinutes,
    };
  }
}
