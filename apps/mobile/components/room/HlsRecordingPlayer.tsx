import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";

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
  const { t } = useTranslation();
  const videoViewRef = useRef<VideoView>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(durationSeconds || 0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSpeedModal, setShowSpeedModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Setup expo-video player
  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    if (autoPlay) {
      p.play();
    }
  });

  // Attach status and event listeners
  useEffect(() => {
    if (!player) return;

    const subPlaying = player.addListener("playingChange", (event) => {
      setIsPlaying(event.isPlaying);
      if (event.isPlaying) {
        setIsLoading(false);
      }
    });

    const subStatus = player.addListener("statusChange", (event) => {
      if (event.status === "loading") {
        setIsLoading(true);
        setHasError(false);
      } else if (event.status === "readyToPlay") {
        setIsLoading(false);
        setHasError(false);
        if (player.duration > 0) {
          setDuration(player.duration);
        }
      } else if (event.status === "error") {
        setIsLoading(false);
        setHasError(true);
      }
    });

    const subTime = player.addListener("timeUpdate", (event) => {
      setCurrentTime(event.currentTime);
      if (player.duration > 0 && (!duration || duration === 0)) {
        setDuration(player.duration);
      }
    });

    return () => {
      subPlaying.remove();
      subStatus.remove();
      subTime.remove();
    };
  }, [player, duration]);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, resetControlsTimer]);

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    resetControlsTimer();
  };

  const handleSkip = (seconds: number) => {
    if (!player) return;
    player.seekBy(seconds);
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (!player) return;
    const newMuted = !isMuted;
    player.muted = newMuted;
    setIsMuted(newMuted);
    resetControlsTimer();
  };

  const handleSpeedSelect = (speed: number) => {
    if (!player) return;
    player.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedModal(false);
    resetControlsTimer();
  };

  const handleFullscreen = () => {
    if (videoViewRef.current) {
      videoViewRef.current.enterFullscreen();
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(src);
    setCopied(true);
    toast.success(
      t("room.session_recording_copied", {
        defaultValue: "Đã sao chép liên kết bản ghi!",
      })
    );
    setTimeout(() => setCopied(false), 2000);
    resetControlsTimer();
  };

  const handleRetry = () => {
    if (!player) return;
    setHasError(false);
    setIsLoading(true);
    player.replay();
  };

  const handleSeekTouch = (evt: any) => {
    if (!duration || duration <= 0 || !player) return;
    const { locationX } = evt.nativeEvent;
    // Assume progress bar width is screen width - 32px padding - 8px extra
    const barWidth = Dimensions.get("window").width - 48;
    const ratio = Math.max(0, Math.min(locationX / barWidth, 1));
    const targetTime = ratio * duration;
    player.currentTime = targetTime;
    setCurrentTime(targetTime);
    resetControlsTimer();
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

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View className="w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl mb-4">
      {/* Video Container Area */}
      <TouchableWithoutFeedback onPress={resetControlsTimer}>
        <View className="relative w-full aspect-video bg-black justify-center items-center">
          <VideoView
            ref={videoViewRef}
            style={styles.video}
            player={player}
            nativeControls={false}
            contentFit="contain"
            allowsFullscreen={true}
          />

          {/* Loading Indicator */}
          {isLoading && !hasError && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center gap-2 z-20">
              <ActivityIndicator size="large" color="#0052FF" />
              <Text className="text-xs text-slate-300 font-medium">
                {t("room.session_loading", { defaultValue: "Đang tải video..." })}
              </Text>
            </View>
          )}

          {/* Error View */}
          {hasError && (
            <View className="absolute inset-0 bg-black/85 p-6 items-center justify-center gap-2 z-30">
              <Feather name="alert-circle" size={32} color="#F43F5E" />
              <Text className="text-xs text-slate-200 text-center font-semibold">
                {t("room.session_recording_error", {
                  defaultValue: "Không thể tải luồng video HLS.",
                })}
              </Text>
              <TouchableOpacity
                onPress={handleRetry}
                className="mt-2 px-4 py-1.5 bg-blue-600 rounded-lg active:bg-blue-700"
              >
                <Text className="text-xs font-bold text-white">
                  {t("room.session_recording_retry", { defaultValue: "Thử lại" })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Top Bar Header (Shown when controls visible) */}
          {showControls && (
            <View className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex-row items-center justify-between z-20">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <View className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <Feather name="film" size={13} color="#60A5FA" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-white" numberOfLines={1}>
                    {title ||
                      t("room.session_recording_player_title", {
                        defaultValue: "Bản ghi cuộc họp",
                      })}
                  </Text>
                  <Text className="text-[10px] text-emerald-400 font-mono">
                    {t("room.session_recording_hls_badge", {
                      defaultValue: "HLS STREAM",
                    })}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  onPress={handleCopyLink}
                  className="p-1.5 bg-slate-800/80 rounded-lg border border-slate-700 active:bg-slate-700 flex-row items-center gap-1"
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={12}
                    color={copied ? "#34D399" : "#CBD5E1"}
                  />
                  <Text className="text-[10px] text-slate-300">
                    {copied
                      ? t("room.session_recording_copied", { defaultValue: "Đã chép" })
                      : t("room.session_recording_copy_link", { defaultValue: "Sao chép" })}
                  </Text>
                </TouchableOpacity>

                {onClose && (
                  <TouchableOpacity
                    onPress={onClose}
                    className="p-1.5 bg-slate-800/80 rounded-lg border border-slate-700 active:bg-rose-600"
                  >
                    <Feather name="x" size={14} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Center Big Play/Pause Button */}
          {showControls && !isLoading && !hasError && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={togglePlay}
              className="absolute p-4 rounded-full bg-blue-600/90 items-center justify-center shadow-lg z-20"
            >
              <Feather
                name={isPlaying ? "pause" : "play"}
                size={24}
                color="#ffffff"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </TouchableOpacity>
          )}

          {/* Bottom Controls Bar */}
          {showControls && (
            <View className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20">
              {/* Seek / Progress Bar */}
              <TouchableWithoutFeedback onPress={handleSeekTouch}>
                <View className="w-full h-4 justify-center py-1">
                  <View className="w-full h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                    <View
                      style={{ width: `${progressPercent}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>

              {/* Action Buttons Row */}
              <View className="flex-row items-center justify-between mt-1">
                {/* Left Controls: Play, Skip, Mute, Time */}
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={togglePlay}
                    className="p-1.5 active:bg-white/10 rounded-lg"
                  >
                    <Feather
                      name={isPlaying ? "pause" : "play"}
                      size={16}
                      color="#ffffff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSkip(-10)}
                    className="p-1.5 active:bg-white/10 rounded-lg flex-row items-center"
                  >
                    <Feather name="rotate-ccw" size={13} color="#CBD5E1" />
                    <Text className="text-[10px] text-slate-300 ml-0.5">10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSkip(10)}
                    className="p-1.5 active:bg-white/10 rounded-lg flex-row items-center"
                  >
                    <Feather name="rotate-cw" size={13} color="#CBD5E1" />
                    <Text className="text-[10px] text-slate-300 ml-0.5">10s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={toggleMute}
                    className="p-1.5 active:bg-white/10 rounded-lg"
                  >
                    <Feather
                      name={isMuted ? "volume-x" : "volume-2"}
                      size={15}
                      color="#CBD5E1"
                    />
                  </TouchableOpacity>

                  <Text className="text-[11px] font-mono text-slate-300 ml-1">
                    <Text className="font-bold text-white">{formatTime(currentTime)}</Text>
                    <Text className="text-slate-500"> / </Text>
                    <Text>{formatTime(duration)}</Text>
                  </Text>
                </View>

                {/* Right Controls: Speed & Fullscreen */}
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => setShowSpeedModal(true)}
                    className="px-2 py-1 bg-white/10 active:bg-white/20 rounded-lg flex-row items-center gap-1"
                  >
                    <Feather name="activity" size={11} color="#CBD5E1" />
                    <Text className="text-[11px] font-bold text-slate-200">
                      {playbackSpeed}x
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleFullscreen}
                    className="p-1.5 active:bg-white/10 rounded-lg"
                  >
                    <Feather name="maximize" size={15} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Speed Selector Modal */}
      <Modal
        visible={showSpeedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSpeedModal(false)}>
          <View className="flex-1 bg-black/60 justify-center items-center p-6">
            <TouchableWithoutFeedback>
              <View className="w-64 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
                <View className="flex-row items-center justify-between pb-3 border-b border-slate-800 mb-2">
                  <Text className="text-sm font-bold text-white">
                    {t("room.session_recording_speed", { defaultValue: "Tốc độ phát" })}
                  </Text>
                  <TouchableOpacity onPress={() => setShowSpeedModal(false)}>
                    <Feather name="x" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {SPEED_OPTIONS.map((spd) => {
                  const isSelected = playbackSpeed === spd;
                  return (
                    <TouchableOpacity
                      key={spd}
                      onPress={() => handleSpeedSelect(spd)}
                      className={`flex-row items-center justify-between py-2.5 px-3 rounded-xl mb-1 ${
                        isSelected ? "bg-blue-600/20 border border-blue-500/40" : "active:bg-slate-800"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? "text-blue-400 font-bold" : "text-slate-300"
                        }`}
                      >
                        {spd}x {spd === 1 ? "(Bình thường)" : ""}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={14} color="#60A5FA" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    width: "100%",
    height: "100%",
  },
});
