import { useState, useRef, useCallback, useEffect } from "react";
import { useMeetingConfig } from "./useMeetingConfig";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useScreenRecorder({
  isMicrophoneEnabled,
}: {
  isMicrophoneEnabled: boolean;
}) {
  const t = useTranslations("meeting.toolbar");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { config } = useMeetingConfig();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicrophoneEnabled;
      });
    }
  }, [isMicrophoneEnabled]);

  const startRecording = useCallback(async () => {
    try {
      await (window as any).electronAPI.prepareRecording();

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
        video: false,
      });

      micStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicrophoneEnabled;
      });
      micStreamRef.current = micStream;

      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      const audioDestination = audioContext.createMediaStreamDestination();

      if (screenStream.getAudioTracks().length > 0) {
        const systemSource = audioContext.createMediaStreamSource(
          new MediaStream([screenStream.getAudioTracks()[0]]),
        );
        systemSource.connect(audioDestination);
      }

      if (micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(audioDestination);
      }

      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      const mappedConfig = {
        format: config.recordingFormat,
        savePath: config.recordingPath,
      };

      (window as any).electronAPI.startRecording(mappedConfig);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm",
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          (window as any).electronAPI.saveVideoChunk(buffer);
        }
      };

      mediaRecorder.onstop = () => {
        (window as any).electronAPI.stopRecording();
        toast.success(t("recording_saved", { path: config.recordingPath }));
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setIsPaused(false);

      screenStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
    } catch (error) {
      console.error("Lỗi khi quay màn hình và trộn âm thanh:", error);
      stopRecording();
    }
  }, [isMicrophoneEnabled, config]);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }

      const activeStream = mediaRecorderRef.current.stream;

      // Lệnh stop này sẽ tự động gọi vào sự kiện onstop đã khai báo phía trên
      mediaRecorderRef.current.stop();
      activeStream.getTracks().forEach((track) => track.stop());

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsRecording(false);
      setIsPaused(false);
    }
  }, []);

  return {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
