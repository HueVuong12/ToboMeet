// src/components/meeting/MeetingLobby.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface MeetingLobbyProps {
  meetingCode: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  camOn: boolean;
  setCamOn: (val: boolean) => void;
  micOn: boolean;
  setMicOn: (val: boolean) => void;
  handleJoinByCode: () => void;
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

export default function MeetingLobby({
  meetingCode,
  displayName,
  setDisplayName,
  camOn,
  setCamOn,
  micOn,
  setMicOn,
  handleJoinByCode,
  isJoining,
}: MeetingLobbyProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    MediaDeviceInfo[]
  >([]);

  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");

  const [cameraResolution, setCameraResolution] = useState({
    width: 640,
    height: 480,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  // State mới để theo dõi việc xin quyền
  const [isPermissionChecked, setIsPermissionChecked] = useState(false);

  // Xin quyền khi vào lobby
  useEffect(() => {
    const requestInitialPermissions = async () => {
      try {
        // Yêu cầu luồng cả mic và cam để trình duyệt hiện popup
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        // Xin quyền thành công xong thì tắt luồng này đi ngay lập tức
        // để trả quyền điều khiển về cho state camOn/micOn
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.warn("Người dùng từ chối quyền hoặc lỗi thiết bị:", error);
        toast.error("Vui lòng cấp quyền Camera và Micro để tiếp tục!");
      } finally {
        setIsPermissionChecked(true); // Đánh dấu là đã hỏi xong
      }
    };

    requestInitialPermissions();
  }, []); // Chỉ chạy 1 lần khi mount

  useEffect(() => {
    // Đợi đến khi quá trình xin quyền ban đầu kết thúc mới chạy logic này
    if (!isPermissionChecked) return;

    let currentStream: MediaStream | null = null;

    const startMedia = async () => {
      try {
        if (!camOn && !micOn) {
          if (videoRef.current) videoRef.current.srcObject = null;
          await enumerateDevices();
          return;
        }

        const constraints: MediaStreamConstraints = {
          video: camOn
            ? selectedCameraId
              ? { deviceId: { exact: selectedCameraId } }
              : true
            : false,
          audio: micOn
            ? selectedMicId
              ? { deviceId: { exact: selectedMicId } }
              : true
            : false,
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);

        await enumerateDevices();

        if (videoRef.current && camOn) {
          videoRef.current.srcObject = currentStream;
        } else if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        toast.error("Không thể truy cập thiết bị media");
        console.error("Lỗi media preview:", err);
      }
    };

    const enumerateDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");

      setVideoDevices(cameras);
      setAudioDevices(mics);
      setAudioOutputDevices(speakers);

      if (!selectedCameraId && cameras.length > 0)
        setSelectedCameraId(cameras[0].deviceId);
      if (!selectedMicId && mics.length > 0) setSelectedMicId(mics[0].deviceId);
      if (!selectedSpeakerId && speakers.length > 0)
        setSelectedSpeakerId(speakers[0].deviceId);
    };

    startMedia();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [
    camOn,
    micOn,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
    isPermissionChecked,
  ]);

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    const resolution = await detectBestResolution(deviceId);
    setCameraResolution(resolution);
  };

  const handleJoin = () => {
    sessionStorage.setItem(
      `device_config_${meetingCode}`,
      JSON.stringify({
        camOn,
        micOn,
        micId: selectedMicId,
        speakerId: selectedSpeakerId,
        cameraConfig: cameraResolution,
      }),
    );
    handleJoinByCode();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8 font-sans transition-colors duration-700">
      {/* Khai báo Keyframes CSS cho hiệu ứng mượt mà */}
      <style>{`
        @keyframes smoothFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slideUpStagger {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: smoothFadeIn 0.8s ease-out forwards;
        }
        .animate-slide-up-1 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
        }
        .animate-slide-up-2 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
        }
        .animate-slide-up-3 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 w-full max-w-5xl p-6 lg:p-8 animate-fade-in">
        {/* Header Sảnh chờ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-2 animate-slide-up-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Chuẩn bị tham gia
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Kiểm tra camera và micro của bạn trước khi vào cuộc họp
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 px-3.5 py-1.5 rounded-full self-start sm:self-auto shadow-sm">
            <span className="text-xs text-slate-500 mr-1.5">Mã phòng:</span>
            <span className="text-sm font-semibold font-mono text-blue-600">
              {meetingCode}
            </span>
          </div>
        </div>

        {/* Layout Responsive: Trái (Preview Cam/Mic) | Phải (Cấu hình) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI: Video Preview & Quick Controls */}
          <div className="lg:col-span-7 flex flex-col items-center animate-slide-up-2">
            <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shadow-inner border border-slate-800 flex items-center justify-center transition-all duration-500">
              {camOn ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100 transition-opacity duration-700 opacity-100"
                />
              ) : (
                <div className="text-slate-400 flex flex-col items-center animate-fade-in">
                  <VideoOff size={40} className="mb-2 opacity-60" />
                  <span className="text-sm font-medium">Camera đang tắt</span>
                </div>
              )}

              {/* Badge Mic Off */}
              {!micOn && (
                <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-xs text-white p-2 rounded-lg shadow-md animate-fade-in">
                  <MicOff size={16} />
                </div>
              )}
            </div>

            {/* Quick Toggle Controls Cam/Mic */}
            <div className="flex gap-4 justify-center mt-5">
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className={`p-3.5 rounded-full transition-all duration-300 shadow-sm hover:scale-105 active:scale-95 ${
                  micOn
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : "bg-red-100 hover:bg-red-200 text-red-600"
                }`}
                title={micOn ? "Tắt Micro" : "Bật Micro"}
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                type="button"
                onClick={() => setCamOn(!camOn)}
                className={`p-3.5 rounded-full transition-all duration-300 shadow-sm hover:scale-105 active:scale-95 ${
                  camOn
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : "bg-red-100 hover:bg-red-200 text-red-600"
                }`}
                title={camOn ? "Tắt Camera" : "Bật Camera"}
              >
                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: Form chọn thiết bị & Nút Join */}
          <div className="lg:col-span-5 space-y-4 animate-slide-up-3">
            {/* Tên hiển thị */}
            <div className="group">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white transition-all shadow-sm hover:border-slate-400"
              />
            </div>

            {/* Select Micro */}
            <div className="relative group">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                Micro
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-xl px-3.5 py-2.5 pr-10 appearance-none truncate text-sm bg-white transition-all shadow-sm hover:border-slate-400 cursor-pointer"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Micro mặc định"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-[38px] pointer-events-none text-slate-500 transition-transform group-focus-within:-rotate-180 duration-300">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Select Loa / Tai nghe */}
            <div className="relative group">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                Loa / Tai nghe
              </label>
              <select
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-xl px-3.5 py-2.5 pr-10 appearance-none truncate text-sm bg-white transition-all shadow-sm hover:border-slate-400 cursor-pointer"
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
              <div className="absolute right-3.5 top-[38px] pointer-events-none text-slate-500 transition-transform group-focus-within:-rotate-180 duration-300">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Select Camera */}
            <div className="relative group">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 transition-colors group-focus-within:text-blue-600">
                Camera
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-xl px-3.5 py-2.5 pr-10 appearance-none truncate text-sm bg-white transition-all shadow-sm hover:border-slate-400 cursor-pointer"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Camera mặc định"}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-[38px] pointer-events-none text-slate-500 transition-transform group-focus-within:-rotate-180 duration-300">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Nút Tham gia ngay */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining || !isPermissionChecked}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex justify-center items-center gap-2 text-sm"
              >
                {isJoining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Tham gia ngay"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
