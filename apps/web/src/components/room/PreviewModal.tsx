"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useGetMeQuery } from "@/lib/redux/features/users/usersApi";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (config: {
    displayName: string;
    isCamOn: boolean;
    isMicOn: boolean;
    cameraId: string;
    micId: string;
    speakerId: string; // Thêm thiết bị đầu ra
    resolution: { width: number; height: number };
  }) => void;
  isJoining: boolean;
}

async function detectBestResolution(deviceId: string) {
  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 800, height: 600 },
    { width: 640, height: 480 },
    { width: 320, height: 240 },
  ];

  for (const resolution of resolutions) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: resolution.width,
          height: resolution.height,
        },
      });
      stream.getTracks().forEach((t) => t.stop());
      return resolution;
    } catch {}
  }
  return { width: 640, height: 480 };
}

export default function PreviewModal({
  isOpen,
  onClose,
  onJoin,
  isJoining,
}: PreviewModalProps) {
  const { data: currentUser } = useGetMeQuery();
  const [previewDisplayName, setPreviewDisplayName] = useState("");
  const [isPreviewCamOn, setIsPreviewCamOn] = useState(true);
  const [isPreviewMicOn, setIsPreviewMicOn] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    MediaDeviceInfo[]
  >([]); // State mới cho Loa

  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(""); // State mới cho Loa đã chọn

  const [cameraResolution, setCameraResolution] = useState({
    width: 640,
    height: 480,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  // Hiện tên mặc định
  useEffect(() => {
    if (currentUser && currentUser.displayName && !previewDisplayName) {
      setPreviewDisplayName(currentUser.displayName);
    }
  }, [currentUser?.displayName]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startMedia = async () => {
      if (!isOpen) return;
      try {
        if (!isPreviewCamOn && !isPreviewMicOn) {
          if (videoRef.current) videoRef.current.srcObject = null;
          await enumerateDevices();
          return;
        }

        const constraints: MediaStreamConstraints = {
          video: isPreviewCamOn
            ? selectedCameraId
              ? { deviceId: { exact: selectedCameraId } }
              : true
            : false,
          audio: isPreviewMicOn
            ? selectedMicId
              ? { deviceId: { exact: selectedMicId } }
              : true
            : false,
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);

        await enumerateDevices();

        if (videoRef.current && isPreviewCamOn) {
          videoRef.current.srcObject = currentStream;
        } else if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        toast.error("Không thể truy cập thiết bị:");
        console.error("Không thể truy cập thiết bị:", err);
      }
    };

    const enumerateDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput"); // Lọc thiết bị đầu ra

      setVideoDevices(cameras);
      setAudioDevices(mics);
      setAudioOutputDevices(speakers); // Lưu vào state

      if (!selectedCameraId && cameras.length > 0)
        setSelectedCameraId(cameras[0].deviceId);
      if (!selectedMicId && mics.length > 0) setSelectedMicId(mics[0].deviceId);
      if (!selectedSpeakerId && speakers.length > 0)
        setSelectedSpeakerId(speakers[0].deviceId); // Chọn loa mặc định
    };

    startMedia();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [
    isOpen,
    isPreviewCamOn,
    isPreviewMicOn,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
  ]);

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    const resolution = await detectBestResolution(deviceId);
    setCameraResolution(resolution);
  };

  const handleJoin = () => {
    onJoin({
      displayName: previewDisplayName,
      isCamOn: isPreviewCamOn,
      isMicOn: isPreviewMicOn,
      cameraId: selectedCameraId,
      micId: selectedMicId,
      speakerId: selectedSpeakerId,
      resolution: cameraResolution,
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            Chuẩn bị tham gia
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Khu vực có thể cuộn (Scrollable Area) cho các thiết bị nếu nội dung quá dài */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1 custom-scrollbar">
          {/* Khu vực Video Preview */}
          <div className="aspect-video bg-slate-900 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative border border-slate-200">
            {isPreviewCamOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="text-slate-500 flex flex-col items-center">
                <VideoOff size={32} className="mb-2 opacity-50" />
                <span>Camera đang tắt</span>
              </div>
            )}
            {!isPreviewMicOn && (
              <div className="absolute top-3 right-3 bg-red-500 text-white p-1.5 rounded-md shadow-sm">
                <MicOff size={14} />
              </div>
            )}
          </div>

          {/* Control Test Cam/Mic */}
          <div className="flex gap-4 justify-center mb-6">
            <button
              onClick={() => setIsPreviewMicOn(!isPreviewMicOn)}
              className={`p-3.5 rounded-full transition-colors ${
                isPreviewMicOn
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-red-100 hover:bg-red-200 text-red-600"
              }`}
            >
              {isPreviewMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              onClick={() => setIsPreviewCamOn(!isPreviewCamOn)}
              className={`p-3.5 rounded-full transition-colors ${
                isPreviewCamOn
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-red-100 hover:bg-red-200 text-red-600"
              }`}
            >
              {isPreviewCamOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>

          {/* Chọn thiết bị: Xếp dọc với space-y-4 */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={previewDisplayName}
                onChange={(e) => setPreviewDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn (tùy chọn)"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Micro
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-3 py-2 pr-10 appearance-none truncate text-sm"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Micro mặc định"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-9 pointer-events-none text-slate-500">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Select cho thiết bị đầu ra (Loa/Tai nghe) */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Loa / Tai nghe
              </label>
              <select
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-3 py-2 pr-10 appearance-none truncate text-sm"
              >
                {audioOutputDevices.length > 0 ? (
                  audioOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || "Loa hệ thống mặc định"}
                    </option>
                  ))
                ) : (
                  <option value="">Loa hệ thống mặc định</option>
                )}
              </select>
              <div className="absolute right-3 top-9 pointer-events-none text-slate-500">
                <ChevronDown size={16} />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Camera
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-3 py-2 pr-10 appearance-none truncate text-sm"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Camera mặc định"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-9 pointer-events-none text-slate-500">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 shrink-0">
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
          >
            {isJoining ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Tham gia ngay"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
