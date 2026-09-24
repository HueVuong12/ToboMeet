/**
 * Helper tính toán trạng thái thời gian nộp bài so với deadline
 * Đảm bảo:
 * - Không có giá trị âm
 * - Định dạng phút / giờ phút / ngày giờ
 * - So sánh timestamp UTC an toàn
 * - Hỗ trợ i18n đa ngôn ngữ
 */

export interface SubmissionTimingResult {
  status: "early" | "on_time" | "late" | "not_submitted";
  text: string;
  badgeClass: string;
  minutesDiff: number;
}

export function calculateSubmissionTiming(
  submittedAt?: string | Date | null,
  deadline?: string | Date | null,
  t?: (key: string, values?: any) => string
): SubmissionTimingResult {
  const tr = (key: string, def: string, values?: any) => {
    if (t) {
      try {
        return t(key, values);
      } catch {
        return def;
      }
    }
    return def;
  };

  if (!submittedAt) {
    return {
      status: "not_submitted",
      text: tr("timing_not_submitted", "Chưa nộp"),
      badgeClass: "text-slate-400 bg-slate-100 border-slate-200",
      minutesDiff: 0,
    };
  }

  if (!deadline) {
    return {
      status: "on_time",
      text: tr("status_submitted", "Đã nộp bài"),
      badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      minutesDiff: 0,
    };
  }

  const subTime = new Date(submittedAt).getTime();
  const dlTime = new Date(deadline).getTime();

  if (isNaN(subTime) || isNaN(dlTime)) {
    return {
      status: "on_time",
      text: tr("status_submitted", "Đã nộp bài"),
      badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      minutesDiff: 0,
    };
  }

  const diffMs = subTime - dlTime;
  const diffMinutes = Math.round(Math.abs(diffMs) / 60000);

  // Chênh lệch dưới 60 giây coi là Đúng hạn
  if (Math.abs(diffMs) < 60000) {
    return {
      status: "on_time",
      text: tr("timing_on_time", "Đúng hạn"),
      badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      minutesDiff: 0,
    };
  }

  const formatReadableTime = (totalMins: number): string => {
    if (totalMins < 60) {
      return tr("timing_minutes", `${totalMins} phút`, { count: totalMins });
    }
    if (totalMins < 1440) {
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const hoursStr = tr("timing_hours", `${hours} giờ`, { count: hours });
      const minsStr = mins > 0 ? ` ${tr("timing_minutes", `${mins} phút`, { count: mins })}` : "";
      return `${hoursStr}${minsStr}`;
    }
    const days = Math.floor(totalMins / 1440);
    const remMins = totalMins % 1440;
    const hours = Math.floor(remMins / 60);
    const daysStr = tr("timing_days", `${days} ngày`, { count: days });
    const hoursStr = hours > 0 ? ` ${tr("timing_hours", `${hours} giờ`, { count: hours })}` : "";
    return `${daysStr}${hoursStr}`;
  };

  const timeStr = formatReadableTime(diffMinutes);

  if (subTime < dlTime) {
    return {
      status: "early",
      text: tr("timing_early", `Sớm ${timeStr}`, { diff: timeStr }),
      badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      minutesDiff: diffMinutes,
    };
  } else {
    return {
      status: "late",
      text: tr("timing_late", `Trễ ${timeStr}`, { diff: timeStr }),
      badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
      minutesDiff: diffMinutes,
    };
  }
}
