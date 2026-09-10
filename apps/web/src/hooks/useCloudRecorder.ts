import { useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useIsBotRecording } from "@/hooks/useIsBotRecording";
import { toast } from "sonner";
import {
  useStartCloudRecordingMutation,
  useStopCloudRecordingMutation,
} from "@/lib/redux/api/meetingsApi";
import { useTranslations } from "next-intl";

export function useCloudRecorder({
  meetingCode,
}: {
  meetingCode?: string;
} = {}) {
  const t = useTranslations("meeting.toolbar");
  const tServer = useTranslations("server.errors");
  const room = useRoomContext();
  const targetCode = meetingCode || room?.name;

  const isRecording = useIsBotRecording();

  const [startCloudRecordingApi, { isLoading: isStarting }] =
    useStartCloudRecordingMutation();
  const [stopCloudRecordingApi, { isLoading: isStopping }] =
    useStopCloudRecordingMutation();

  const getErrorMessage = useCallback(
    (error: any) => {
      const errorCode = error?.data?.code || error?.code;
      if (errorCode) {
        try {
          const translated = tServer(String(errorCode));
          if (translated) return translated;
        } catch {
          // Bỏ qua nếu mã lỗi chưa được định nghĩa trong translation
        }
      }
      return error?.data?.message || error?.message || t("cloud_recording_error");
    },
    [t, tServer]
  );

  const startRecording = useCallback(async () => {
    if (!targetCode) return;
    try {
      await startCloudRecordingApi({ meetingCode: targetCode }).unwrap();
      toast.success(t("cloud_recording_started"));
    } catch (error: any) {
      console.error("Lỗi khi bắt đầu ghi hình trên cloud:", error);
      toast.error(getErrorMessage(error));
    }
  }, [targetCode, startCloudRecordingApi, t, getErrorMessage]);

  const stopRecording = useCallback(async () => {
    if (!targetCode) return;
    try {
      await stopCloudRecordingApi({ meetingCode: targetCode }).unwrap();
      toast.success(t("cloud_recording_stopped"));
    } catch (error: any) {
      console.error("Lỗi khi dừng ghi hình trên cloud:", error);
      toast.error(getErrorMessage(error));
    }
  }, [targetCode, stopCloudRecordingApi, t, getErrorMessage]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isStarting,
    isStopping,
    isLoading: isStarting || isStopping,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
