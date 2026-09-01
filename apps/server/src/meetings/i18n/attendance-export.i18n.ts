export interface AttendanceExportDict {
  sheetNameDetailed: string;
  sheetNameMinimal: string;
  fileNamePrefix: string;
  headers: {
    stt: string;
    displayName: string;
    totalDuration: string;
    // Detailed mode headers
    visitIndex: string;
    joinedAt: string;
    leftAt: string;
    visitDuration: string;
    // Minimal mode headers
    firstJoinedAt: string;
    lastLeftAt: string;
    visitCount: string;
  };
  values: {
    guest: string;
    none: string;
    inCall: string;
    minutesUnit: string;
    hoursUnit: string;
    secondsUnit: string;
    noVisit: string;
  };
}

export const ATTENDANCE_EXPORT_DICT: Record<string, AttendanceExportDict> = {
  vi: {
    sheetNameDetailed: 'Lịch sử vào ra chi tiết',
    sheetNameMinimal: 'Tổng quan điểm danh',
    fileNamePrefix: 'diem-danh',
    headers: {
      stt: 'STT',
      displayName: 'Họ và tên',
      totalDuration: 'Tổng thời gian',
      visitIndex: 'Lượt',
      joinedAt: 'Thời gian vào',
      leftAt: 'Thời gian ra',
      visitDuration: 'Thời lượng lượt',
      firstJoinedAt: 'Thời gian vào đầu tiên',
      lastLeftAt: 'Thời gian ra cuối cùng',
      visitCount: 'Số lượt vào',
    },
    values: {
      guest: 'Khách',
      none: 'Không có',
      inCall: 'Đang trong phòng',
      minutesUnit: 'phút',
      hoursUnit: 'giờ',
      secondsUnit: 'giây',
      noVisit: 'Chưa tham gia',
    },
  },
  en: {
    sheetNameDetailed: 'Detailed Attendance',
    sheetNameMinimal: 'Attendance Summary',
    fileNamePrefix: 'attendance',
    headers: {
      stt: 'No.',
      displayName: 'Full Name',
      totalDuration: 'Total Duration',
      visitIndex: 'Entry #',
      joinedAt: 'Join Time',
      leftAt: 'Leave Time',
      visitDuration: 'Entry Duration',
      firstJoinedAt: 'First Joined',
      lastLeftAt: 'Last Left',
      visitCount: 'Total Visits',
    },
    values: {
      guest: 'Guest',
      none: 'None',
      inCall: 'In call',
      minutesUnit: 'mins',
      hoursUnit: 'hrs',
      secondsUnit: 'secs',
      noVisit: 'Not joined',
    },
  },
};

export function getAttendanceExportDict(lang?: string): AttendanceExportDict {
  const code = (lang || 'vi').trim().toLowerCase();
  return ATTENDANCE_EXPORT_DICT[code] || ATTENDANCE_EXPORT_DICT.vi;
}

export function formatExportDuration(
  totalSeconds: number,
  dict: AttendanceExportDict,
): string {
  if (!totalSeconds || totalSeconds <= 0) {
    return `0 ${dict.values.minutesUnit}`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hrs > 0) {
    return remainingMins > 0
      ? `${hrs} ${dict.values.hoursUnit} ${remainingMins} ${dict.values.minutesUnit}`
      : `${hrs} ${dict.values.hoursUnit}`;
  }
  if (mins > 0) {
    return `${mins} ${dict.values.minutesUnit}`;
  }
  return `${totalSeconds} ${dict.values.secondsUnit}`;
}
