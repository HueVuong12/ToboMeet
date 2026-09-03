import { useCallback } from "react";
import { useIsRecording, useRoomContext } from "@livekit/components-react";
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

  const isRecording = useIsRecording();

  const [startCloudRecordingApi, { isLoading: isStarting }] =
    useStartCloudRecordingMutation();
  const [stopCloudRecordingApi, { isLoading: isStopping }] =
    useStopCloudRecordingMutation();

  const startRecording = useCallback(async () => {
    if (!targetCode) return;
    try {
      await startCloudRecordingApi({ meetingCode: targetCode }).unwrap();
      toast.success(t("cloud_recording_started"));
    } catch (error: any) {
      console.error("Lỗi khi bắt đầu ghi hình trên cloud:", error);
      const errorCode = error?.data?.code || error?.code;
      if (errorCode) {
        toast.error(tServer(errorCode));
      } else {
        toast.error(t("cloud_recording_error"));
      }
    }
  }, [targetCode, startCloudRecordingApi, t, tServer]);

  const stopRecording = useCallback(async () => {
    if (!targetCode) return;
    try {
      await stopCloudRecordingApi({ meetingCode: targetCode }).unwrap();
      toast.success(t("cloud_recording_stopped"));
    } catch (error: any) {
      console.error("Lỗi khi dừng ghi hình trên cloud:", error);
      const errorCode = error?.data?.code || error?.code;
      if (errorCode) {
        toast.error(tServer(errorCode));
      } else {
        toast.error(t("cloud_recording_error"));
      }
    }
  }, [targetCode, stopCloudRecordingApi, t, tServer]);

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
