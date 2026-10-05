import { useDispatch, useStore } from "react-redux";
import { rrulestr } from "rrule";
import { calendarApi } from "../lib/redux/api/calendarApi";
import { AppDispatch, RootState } from "../lib/redux/store";
import { CalendarEvent } from "../components/calendar/types";

/**
 * Sinh các buổi lịch ảo (occurrences) cho một sự kiện lặp trong một khoảng thời gian [rangeStart, rangeEnd].
 * Nếu là sự kiện đơn lẻ, kiểm tra xem nó có rơi vào khoảng thời gian này hay không.
 */
export function generateOccurrencesForRange(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  // Nếu không phải sự kiện lặp hoặc recurrenceRule bị hủy/NONE -> Lịch đơn
  if (
    !event.isRecurring ||
    !event.recurrenceRule ||
    event.recurrenceRule === "NONE" ||
    event.recurrenceRule.trim() === ""
  ) {
    const evStart = new Date(event.startDate);
    const evEnd = new Date(event.endDate || event.startDate);
    if (evStart <= rangeEnd && evEnd >= rangeStart) {
      return [
        {
          ...event,
          isOccurrence: false,
          occurrenceDate: undefined,
        },
      ];
    }
    return [];
  }

  // Sự kiện lặp: tính toán các occurrences rơi vào khoảng thời gian
  try {
    const offsetMs = 7 * 60 * 60 * 1000; // GMT+07:00 (Asia/Ho_Chi_Minh)
    const startObj = new Date(event.startDate);
    const endObj = new Date(event.endDate || event.startDate);
    const duration = endObj.getTime() - startObj.getTime();

    const localStart = new Date(startObj.getTime() + offsetMs);
    const localRangeStart = new Date(rangeStart.getTime() + offsetMs);
    const localRangeEnd = new Date(rangeEnd.getTime() + offsetMs);

    let ruleStr = event.recurrenceRule;
    if (!ruleStr.startsWith("RRULE:") && !ruleStr.startsWith("FREQ=")) {
      ruleStr = `FREQ=${ruleStr}`;
    }

    const rule = rrulestr(ruleStr, { dtstart: localStart });
    const occurrences = rule.between(localRangeStart, localRangeEnd, true);

    const exceptionsSet = new Set(event.recurrenceExceptions || []);
    const results: CalendarEvent[] = [];

    for (const occ of occurrences) {
      const dateStr = occ.toISOString().substring(0, 10);
      // Bỏ qua các ngày nằm trong danh sách ngoại lệ
      if (exceptionsSet.has(dateStr)) {
        continue;
      }

      const occStart = new Date(occ.getTime() - offsetMs);
      const occEnd = new Date(occStart.getTime() + duration);

      results.push({
        ...event,
        startDate: occStart.toISOString(),
        endDate: occEnd.toISOString(),
        isOccurrence: true,
        occurrenceDate: dateStr,
      });
    }

    return results;
  } catch (err) {
    console.error("Lỗi khi sinh lịch ảo rrule trên FE mobile:", err);
    const evStart = new Date(event.startDate);
    const evEnd = new Date(event.endDate || event.startDate);
    if (evStart <= rangeEnd && evEnd >= rangeStart) {
      return [event];
    }
    return [];
  }
}

export function useCalendarCacheManager() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();

  /**
   * Lấy danh sách các query cache của getCalendarEvents hiện có trong Redux store (các trang/tháng/tuần đã fetch)
   */
  const getCalendarQueries = () => {
    const state = store.getState();
    const queries = state.api?.queries || {};
    return Object.values(queries).filter(
      (q: any) => q?.endpointName === "getCalendarEvents" && q?.originalArgs
    );
  };

  /**
   * Đồng bộ sự kiện vào tất cả các trang đã fetch:
   * - Nếu là lịch định kỳ: sinh các lịch ảo cho từng trang đã fetch
   * - Nếu là lịch đơn: xóa các lịch ảo cũ, chỉ giữ lại đúng 1 lịch đơn nếu rơi vào trang đó
   */
  const syncEventWithCache = (event: CalendarEvent) => {
    if (!event || !event._id) return;
    const queries = getCalendarQueries();

    queries.forEach((q: any) => {
      const args = q.originalArgs as { start: string; end: string };
      if (!args?.start || !args?.end) return;

      const rangeStart = new Date(args.start);
      const rangeEnd = new Date(args.end);

      const occurrences = generateOccurrencesForRange(
        event,
        rangeStart,
        rangeEnd
      );

      dispatch(
        calendarApi.util.updateQueryData("getCalendarEvents", args, (draft: any[]) => {
          // 1. Xóa toàn bộ các bản ghi cũ của event này (gồm cả master và các lịch ảo cũ)
          let i = draft.length;
          while (i--) {
            if (draft[i]._id === event._id) {
              draft.splice(i, 1);
            }
          }

          // 2. Thêm các bản ghi mới được sinh ra vào draft
          if (occurrences.length > 0) {
            draft.push(...occurrences);
          }

          // 3. Sắp xếp lại theo thời gian bắt đầu
          draft.sort(
            (a, b) =>
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
        })
      );
    });
  };

  /**
   * Thêm sự kiện mới vào cache RTK Query mà không cần gọi lại API
   */
  const addEventToCache = (event: CalendarEvent) => {
    syncEventWithCache(event);
  };

  /**
   * Cập nhật sự kiện (hoặc khôi phục sự kiện) trong cache RTK Query
   */
  const updateEventInCache = (payload: {
    eventId: string;
    updateType?: "single" | "all" | "restore";
    occurrenceDate?: string;
    event?: CalendarEvent;
  }) => {
    if (!payload?.eventId) return;
    const { eventId, updateType = "all", occurrenceDate, event } = payload;
    const cleanDate = occurrenceDate?.substring(0, 10);
    const queries = getCalendarQueries();

    if (updateType === "single") {
      // Chỉ chỉnh sửa 1 buổi đơn lẻ trong chuỗi lặp
      queries.forEach((q: any) => {
        const args = q.originalArgs as { start: string; end: string };
        if (!args?.start || !args?.end) return;
        const rangeStart = new Date(args.start);
        const rangeEnd = new Date(args.end);

        dispatch(
          calendarApi.util.updateQueryData("getCalendarEvents", args, (draft: any[]) => {
            const oldIndex = draft.findIndex(
              (item) =>
                item._id === eventId &&
                (cleanDate
                  ? item.occurrenceDate === cleanDate ||
                    item.startDate?.startsWith(cleanDate)
                  : true)
            );
            if (oldIndex !== -1) {
              draft.splice(oldIndex, 1);
            }

            if (event) {
              const evStart = new Date(event.startDate);
              const evEnd = new Date(event.endDate || event.startDate);
              if (evStart <= rangeEnd && evEnd >= rangeStart) {
                const alreadyExists = draft.some(
                  (item) => item._id === event._id
                );
                if (!alreadyExists) {
                  draft.push(event);
                }
              }
            }

            draft.sort(
              (a, b) =>
                new Date(a.startDate).getTime() -
                new Date(b.startDate).getTime()
            );
          })
        );
      });
    } else {
      // updateType === "all" hoặc "restore":
      // Đồng bộ lại toàn bộ chuỗi theo event mới nhất
      if (event) {
        syncEventWithCache(event);
      }
    }
  };

  /**
   * Xóa sự kiện (chỉ 1 lần hoặc toàn bộ) trong cache RTK Query
   */
  const deleteEventFromCache = (payload: {
    eventId: string;
    deleteType?: "single" | "all";
    occurrenceDate?: string;
  }) => {
    if (!payload?.eventId) return;
    const { eventId, deleteType = "all", occurrenceDate } = payload;
    const cleanDate = occurrenceDate?.substring(0, 10);
    const queries = getCalendarQueries();

    queries.forEach((q: any) => {
      const args = q.originalArgs as { start: string; end: string };
      if (!args?.start || !args?.end) return;

      dispatch(
        calendarApi.util.updateQueryData("getCalendarEvents", args, (draft: any[]) => {
          if (deleteType === "single" && cleanDate) {
            // Xóa chỉ 1 occurrence
            const index = draft.findIndex(
              (item) =>
                item._id === eventId &&
                (item.occurrenceDate === cleanDate ||
                  item.startDate?.startsWith(cleanDate))
            );
            if (index !== -1) {
              draft.splice(index, 1);
            }

            // Cập nhật recurrenceExceptions cho các items còn lại của event này
            draft.forEach((item) => {
              if (item._id === eventId) {
                if (!item.recurrenceExceptions) {
                  item.recurrenceExceptions = [];
                }
                if (!item.recurrenceExceptions.includes(cleanDate)) {
                  item.recurrenceExceptions.push(cleanDate);
                }
              }
            });
          } else {
            // Xóa toàn bộ chuỗi
            return draft.filter((item) => item._id !== eventId);
          }
        })
      );
    });
  };

  return {
    addEventToCache,
    updateEventInCache,
    deleteEventFromCache,
    syncEventWithCache,
  };
}
