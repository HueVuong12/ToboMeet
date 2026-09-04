"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Film,
  X,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface HlsRecordingPlayerProps {
  src: string;
  title?: string;
  durationSeconds?: number;
  onClose?: () => void;
  autoPlay?: boolean;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function HlsRecordingPlayer({
  src,
  title,
  durationSeconds,
  onClose,
  autoPlay = true,
}: HlsRecordingPlayerProps) {
  const t = useTranslations("room");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize HLS Player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setError(null);

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay blocked by browser policy
            setIsPlaying(false);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("HLS Network error encountered, trying recover...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS Media error encountered, trying recover...");
              hls.recoverMediaError();
              break;
            default:
              console.error("HLS Fatal error:", data);
              setIsLoading(false);
              setError(t("session_recording_error_hls", { defaultValue: "Lỗi tải luồng video HLS." }));
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple HLS (Safari)
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => {
            setIsPlaying(false);
          });
        }
      });
      video.addEventListener("error", () => {
        setIsLoading(false);
        setError(t("session_recording_error_hls", { defaultValue: "Lỗi tải video." }));
      });
    } else {
      setIsLoading(false);
      setError(t("session_recording_error_hls", { defaultValue: "Trình duyệt không hỗ trợ HLS." }));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, t]);

  // Video Events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (!duration || isNaN(duration) || duration === 0) {
        if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
          setDuration(videoRef.current.duration);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  };

  const copyStreamUrl = () => {
    navigator.clipboard.writeText(src);
    setCopied(true);
    toast.success(t("session_recording_copied", { defaultValue: "Đã sao chép liên kết!" }));
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-hide controls when idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 3500);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full rounded-2xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-800 select-none group aspect-video max-h-[70vh] flex items-center justify-center"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onClick={togglePlay}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
          <Loader2 size={36} className="text-brand-400 animate-spin" />
          <p className="text-xs text-slate-300 font-medium tracking-wide">
            {t("session_loading", { defaultValue: "Đang tải video..." })}
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 p-6 text-center">
          <AlertCircle size={40} className="text-rose-500" />
          <p className="text-sm text-slate-200 font-semibold max-w-md">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              if (hlsRef.current) {
                hlsRef.current.loadSource(src);
              }
            }}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors mt-2"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Top Bar Header */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-brand-500/20 text-brand-400 rounded-lg border border-brand-500/30 shrink-0">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-lg">
              {title || t("session_recording_player_title", { defaultValue: "Bản ghi cuộc họp" })}
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono tracking-wider">
              {t("session_recording_hls_badge", { defaultValue: "HLS STREAM" })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyStreamUrl}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
            title={t("session_recording_copy_link", { defaultValue: "Sao chép liên kết" })}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline text-[11px]">
              {copied ? t("session_recording_copied") : t("session_recording_copy_link")}
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
              title={t("session_recording_close_player", { defaultValue: "Đóng" })}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Center Big Play Button when Paused */}
      {!isPlaying && !isLoading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-auto p-4 rounded-full bg-brand-600/90 hover:bg-brand-500 text-white shadow-xl backdrop-blur-xs transition-transform hover:scale-110 active:scale-95 cursor-pointer z-10"
        >
          <Play size={28} className="translate-x-0.5" />
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-2 group/slider w-full">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2.5 transition-all"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={() => skipTime(-10)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors hidden xs:flex items-center gap-0.5 text-[10px]"
              title="-10s"
            >
              <RotateCcw size={15} />
              <span>10s</span>
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => skipTime(10)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors hidden xs:flex items-center gap-0.5 text-[10px]"
              title="+10s"
            >
              <RotateCw size={15} />
              <span>10s</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs text-slate-300 font-mono select-none">
              <span className="text-white font-semibold">{formatTime(currentTime)}</span>
              <span className="text-slate-500"> / </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                title={t("session_recording_speed", { defaultValue: "Tốc độ" })}
              >
                <Gauge size={13} />
                <span>{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md flex flex-col min-w-[70px] z-30">
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-3 py-1 text-xs text-left hover:bg-brand-600/30 transition-colors ${
                        playbackSpeed === spd
                          ? "text-brand-400 font-bold bg-brand-500/10"
                          : "text-slate-300"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
