import { useState, useRef, useCallback, useEffect } from "react";

export function useScreenRecorder({
  isMicrophoneEnabled,
}: {
  isMicrophoneEnabled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
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

      // Lấy tiếng của bạn (Microphone)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
        video: false,
      });

      // Đồng bộ trạng thái Tắt/Bật mic hiện tại
      micStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicrophoneEnabled;
      });
      micStreamRef.current = micStream;

      // Khởi tạo Bàn Mixer Ảo
      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      const audioDestination = audioContext.createMediaStreamDestination();

      // Trộn 2 luồng âm thanh lại
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

      // Gộp luồng Hình ảnh + Âm thanh
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      // Lấy cấu hình từ Local Storage mà người dùng đã set trong SettingsDialog
      const savedFormat = localStorage.getItem("recording_format") || "webm";
      const savedPath = localStorage.getItem("recording_path") || "";

      // Gửi cấu hình xuống Node.js
      (window as any).electronAPI.startRecording({
        format: savedFormat,
        savePath: savedPath,
      });
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm",
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          (window as any).electronAPI.saveVideoChunk(buffer);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      screenStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
    } catch (error) {
      console.error("Lỗi khi quay màn hình và trộn âm thanh:", error);
      stopRecording();
    }
  }, [isMicrophoneEnabled]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      const activeStream = mediaRecorderRef.current.stream;
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

      (window as any).electronAPI.stopRecording();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
