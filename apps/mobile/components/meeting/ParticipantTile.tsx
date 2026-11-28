import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  TouchableOpacity,
  LayoutChangeEvent,
  PixelRatio,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Track, VideoTrack } from "livekit-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHandRaise } from "../../hooks/useHandRaise";
import { VideoView } from "@livekit/react-native";

const MIN_SCALE = 1;
const MAX_SCALE = 4.5;
const DOUBLE_TAP_SCALE = 2.4;
const DOUBLE_TAP_DELAY = 280;
const EDGE_SNAP_THRESHOLD = 12;
// Cấp cố định bề mặt 1920px (Full HD) cho SurfaceViewRenderer để chữ luôn sắc nét
// mà KHÔNG bao giờ phải resize lại VideoView khi zoom (triệt tiêu hoàn toàn giật/flicker).
const TARGET_FULL_HD_PX = 1920;

function getTouchDistance(
  t1: { pageX: number; pageY: number },
  t2: { pageX: number; pageY: number },
) {
  const dx = t1.pageX - t2.pageX;
  const dy = t1.pageY - t2.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// COMPONENT: Ô VIDEO TÁI SỬ DỤNG (TILE)
export default function ParticipantTile({
  trackRef,
  onZoomChange,
  isLandscape = false,
  onToggleLandscape,
}: {
  trackRef: any;
  onZoomChange?: (zoomed: boolean) => void;
  isLandscape?: boolean;
  onToggleLandscape?: () => void;
}) {
  const publication = trackRef.publication;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const isRemoteScreenShare =
    isScreenShare && !trackRef.participant?.isLocal;

  const [videoTrack, setVideoTrack] = useState(
    publication?.track as VideoTrack | undefined,
  );

  const isMuted = publication?.isMuted ?? false;
  const showVideo = !!videoTrack && !isMuted;
  const canZoom = isRemoteScreenShare && showVideo;

  const { getHandState } = useHandRaise();
  const handState = getHandState(trackRef.participant);
  const insets = useSafeAreaInsets();

  // Khoảng cách an toàn khi xoay ngang để nút không bị thanh điều hướng / tai thỏ của điện thoại che mất
  const overlayTop = isLandscape ? Math.max(insets.top, 14) + 6 : 10;
  const overlayLeft = isLandscape ? Math.max(insets.left, 48) + 14 : 10;
  const overlayRight = isLandscape ? Math.max(insets.right, 48) + 14 : 10;

  // Kích thước container hiện tại
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoomPercent, setZoomPercent] = useState(100);

  // Một nguồn Animated duy nhất: scaleAnim = baseFitScale * userScale (không có dual-state -> không flicker, không thu nhỏ < 100%)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const userScaleRef = useRef(1);
  const baseFitScaleRef = useRef(1);
  const baseRenderedRef = useRef({ width: 0, height: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const isZoomedReportedRef = useRef(false);

  // Theo dõi tọa độ chạm trực tiếp theo từng frame (tránh nhảy tọa độ khi chuyển 2 ngón <-> 1 ngón)
  const lastPinchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
  } | null>(null);
  const lastSingleTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef(0);
  const wasMultiTouchRef = useRef(false);

  const canZoomRef = useRef(canZoom);
  canZoomRef.current = canZoom;

  const videoTrackRef = useRef(videoTrack);
  videoTrackRef.current = videoTrack;

  const publicationRef = useRef(publication);
  publicationRef.current = publication;

  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const videoAspectRatio = useMemo(() => {
    const trackDims = (videoTrack as any)?.dimensions;
    const pubDims = publication?.dimensions;
    const vw = trackDims?.width || pubDims?.width || 0;
    const vh = trackDims?.height || pubDims?.height || 0;
    if (vw > 0 && vh > 0) {
      return vw / vh;
    }
    return 16 / 9;
  }, [videoTrack, publication?.dimensions]);

  // Tính kích thước bề mặt Full HD cố định (dp) và hệ số fit 1x cho container hiện tại
  const { fixedSurfaceW, fixedSurfaceH, baseFitScale, baseRenderedW, baseRenderedH } =
    useMemo(() => {
      const cw = containerSize.width;
      const ch = containerSize.height;
      if (!canZoom || cw <= 0 || ch <= 0) {
        return {
          fixedSurfaceW: 0,
          fixedSurfaceH: 0,
          baseFitScale: 1,
          baseRenderedW: 0,
          baseRenderedH: 0,
        };
      }

      // Kích thước hiển thị 1x (objectFit="contain") trong container
      const containerRatio = cw / ch;
      let fitW = cw;
      let fitH = ch;
      if (videoAspectRatio > containerRatio) {
        fitW = cw;
        fitH = cw / videoAspectRatio;
      } else {
        fitH = ch;
        fitW = ch * videoAspectRatio;
      }

      // Cấp bề mặt SurfaceView ở độ phân giải gốc Full HD (không nhỏ hơn fitW/fitH)
      const dpr = Math.max(1, PixelRatio.get());
      const targetLongEdgeDp = Math.max(
        TARGET_FULL_HD_PX / dpr,
        Math.max(fitW, fitH),
      );
      const surfaceW = Math.round(
        videoAspectRatio >= 1
          ? targetLongEdgeDp
          : targetLongEdgeDp * videoAspectRatio,
      );
      const surfaceH = Math.round(
        videoAspectRatio >= 1
          ? targetLongEdgeDp / videoAspectRatio
          : targetLongEdgeDp,
      );

      const nextBaseFitScale = Math.min(cw / surfaceW, ch / surfaceH);

      return {
        fixedSurfaceW: surfaceW,
        fixedSurfaceH: surfaceH,
        baseFitScale: nextBaseFitScale,
        baseRenderedW: surfaceW * nextBaseFitScale,
        baseRenderedH: surfaceH * nextBaseFitScale,
      };
    }, [canZoom, containerSize, videoAspectRatio]);

  // Cập nhật refs & reset về đúng mức 1x khi container hoặc hướng màn hình thay đổi
  useLayoutEffect(() => {
    baseFitScaleRef.current = baseFitScale;
    baseRenderedRef.current = { width: baseRenderedW, height: baseRenderedH };

    scaleAnim.stopAnimation();
    translateXAnim.stopAnimation();
    translateYAnim.stopAnimation();

    userScaleRef.current = 1;
    posRef.current = { x: 0, y: 0 };
    scaleAnim.setValue(baseFitScale);
    translateXAnim.setValue(0);
    translateYAnim.setValue(0);

    if (isZoomedReportedRef.current) {
      isZoomedReportedRef.current = false;
      onZoomChangeRef.current?.(false);
    }
    setZoomPercent(100);
  }, [
    baseFitScale,
    baseRenderedW,
    baseRenderedH,
    scaleAnim,
    translateXAnim,
    translateYAnim,
  ]);

  const notifyZoomState = useCallback((nextUserScale: number) => {
    const zoomed = nextUserScale > 1.02;
    if (isZoomedReportedRef.current !== zoomed) {
      isZoomedReportedRef.current = zoomed;
      onZoomChangeRef.current?.(zoomed);
    }
    setZoomPercent(Math.round(nextUserScale * 100));
  }, []);

  /**
   * Tính giới hạn pan (maxX, maxY) theo kích thước hiển thị thực của video
   * để video luôn bám sát khung nhìn, không bị kéo trôi ra ngoài.
   */
  const getPanBounds = useCallback((targetUserScale: number) => {
    const { width: containerW, height: containerH } = containerSizeRef.current;
    const { width: baseW, height: baseH } = baseRenderedRef.current;
    if (
      containerW <= 0 ||
      containerH <= 0 ||
      baseW <= 0 ||
      baseH <= 0 ||
      targetUserScale <= 1
    ) {
      return { maxX: 0, maxY: 0 };
    }

    const maxX = Math.max(0, (baseW * targetUserScale - containerW) / 2);
    const maxY = Math.max(0, (baseH * targetUserScale - containerH) / 2);
    return { maxX, maxY };
  }, []);

  const clampPos = useCallback(
    (
      nextPos: { x: number; y: number },
      targetUserScale: number,
      snapThreshold = 0,
    ) => {
      if (targetUserScale <= 1.01) return { x: 0, y: 0 };
      const { maxX, maxY } = getPanBounds(targetUserScale);

      let x = Math.min(Math.max(nextPos.x, -maxX), maxX);
      let y = Math.min(Math.max(nextPos.y, -maxY), maxY);

      if (snapThreshold > 0) {
        if (maxX > 0 && maxX - Math.abs(x) <= snapThreshold) {
          x = x >= 0 ? maxX : -maxX;
        }
        if (maxY > 0 && maxY - Math.abs(y) <= snapThreshold) {
          y = y >= 0 ? maxY : -maxY;
        }
      }

      return { x, y };
    },
    [getPanBounds],
  );

  const stopActiveAnimations = useCallback(() => {
    scaleAnim.stopAnimation();
    translateXAnim.stopAnimation();
    translateYAnim.stopAnimation();
  }, [scaleAnim, translateXAnim, translateYAnim]);

  const applyTransform = useCallback(
    (
      nextUserScale: number,
      nextPos: { x: number; y: number },
      animated = false,
    ) => {
      const clampedUserScale = Math.min(
        Math.max(MIN_SCALE, nextUserScale),
        MAX_SCALE,
      );
      const finalUserScale = clampedUserScale <= 1.01 ? 1 : clampedUserScale;
      const clampedPos =
        finalUserScale <= 1
          ? { x: 0, y: 0 }
          : clampPos(nextPos, finalUserScale);

      userScaleRef.current = finalUserScale;
      posRef.current = clampedPos;

      const visualScale = baseFitScaleRef.current * finalUserScale;

      stopActiveAnimations();

      if (animated) {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: visualScale,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateXAnim, {
            toValue: clampedPos.x,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: clampedPos.y,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        scaleAnim.setValue(visualScale);
        translateXAnim.setValue(clampedPos.x);
        translateYAnim.setValue(clampedPos.y);
      }

      notifyZoomState(finalUserScale);
    },
    [
      clampPos,
      notifyZoomState,
      scaleAnim,
      translateXAnim,
      translateYAnim,
      stopActiveAnimations,
    ],
  );

  const resetZoom = useCallback(
    (animated = true) => {
      applyTransform(1, { x: 0, y: 0 }, animated);
    },
    [applyTransform],
  );

  useEffect(() => {
    if (!canZoom) {
      resetZoom(false);
    }
  }, [canZoom, resetZoom]);

  useEffect(() => {
    return () => {
      if (isZoomedReportedRef.current) {
        isZoomedReportedRef.current = false;
        onZoomChangeRef.current?.(false);
      }
    };
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const prev = containerSizeRef.current;
    if (
      Math.abs(prev.width - width) > 2 ||
      Math.abs(prev.height - height) > 2
    ) {
      containerSizeRef.current = { width, height };
      setContainerSize({ width, height });
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if (!canZoomRef.current) return false;
          return evt.nativeEvent.touches.length >= 2;
        },
        onStartShouldSetPanResponderCapture: (evt) => {
          if (!canZoomRef.current) return false;
          return evt.nativeEvent.touches.length >= 2;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          if (!canZoomRef.current) return false;
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) return true;
          if (
            userScaleRef.current > 1.02 &&
            (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4)
          ) {
            return true;
          }
          return false;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          if (!canZoomRef.current) return false;
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) return true;
          if (
            userScaleRef.current > 1.02 &&
            (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4)
          ) {
            return true;
          }
          return false;
        },
        onPanResponderTerminationRequest: () => {
          return userScaleRef.current <= 1.02 && lastPinchRef.current === null;
        },
        onPanResponderGrant: (evt) => {
          stopActiveAnimations();
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            wasMultiTouchRef.current = true;
            lastSingleTouchRef.current = null;
            lastPinchRef.current = {
              dist: getTouchDistance(touches[0], touches[1]),
              midX: (touches[0].pageX + touches[1].pageX) / 2,
              midY: (touches[0].pageY + touches[1].pageY) / 2,
            };
          } else if (touches.length === 1) {
            wasMultiTouchRef.current = false;
            lastPinchRef.current = null;
            lastSingleTouchRef.current = {
              x: touches[0].pageX,
              y: touches[0].pageY,
            };
          }
        },
        onPanResponderMove: (evt) => {
          if (!canZoomRef.current) return;
          const touches = evt.nativeEvent.touches;

          if (touches.length >= 2) {
            wasMultiTouchRef.current = true;
            lastSingleTouchRef.current = null;

            const dist = getTouchDistance(touches[0], touches[1]);
            const midX = (touches[0].pageX + touches[1].pageX) / 2;
            const midY = (touches[0].pageY + touches[1].pageY) / 2;

            if (!lastPinchRef.current || lastPinchRef.current.dist < 10) {
              lastPinchRef.current = { dist, midX, midY };
              return;
            }
            if (dist < 10) return;

            const ratio = dist / lastPinchRef.current.dist;
            const prevScale = userScaleRef.current;
            const nextScale = Math.min(
              Math.max(MIN_SCALE, prevScale * ratio),
              MAX_SCALE,
            );
            const effectiveRatio = prevScale > 0 ? nextScale / prevScale : 1;
            const panDx = midX - lastPinchRef.current.midX;
            const panDy = midY - lastPinchRef.current.midY;

            lastPinchRef.current = { dist, midX, midY };

            const nextPos = {
              x: posRef.current.x * effectiveRatio + panDx,
              y: posRef.current.y * effectiveRatio + panDy,
            };

            applyTransform(nextScale, nextPos, false);
          } else if (touches.length === 1 && userScaleRef.current > 1.02) {
            const touch = touches[0];
            // Nếu vừa nhấc 1 ngón từ pinch sang 1 ngón: chỉ ghi nhận mốc mới, KHÔNG kéo ngay để tránh giật nhảy
            if (lastPinchRef.current !== null || !lastSingleTouchRef.current) {
              lastPinchRef.current = null;
              lastSingleTouchRef.current = { x: touch.pageX, y: touch.pageY };
              return;
            }

            const dx = touch.pageX - lastSingleTouchRef.current.x;
            const dy = touch.pageY - lastSingleTouchRef.current.y;
            lastSingleTouchRef.current = { x: touch.pageX, y: touch.pageY };

            const nextPos = {
              x: posRef.current.x + dx,
              y: posRef.current.y + dy,
            };
            applyTransform(userScaleRef.current, nextPos, false);
          }
        },
        onPanResponderRelease: (_evt, gestureState) => {
          lastPinchRef.current = null;
          lastSingleTouchRef.current = null;

          // Kiểm tra double-tap (chỉ khi chạm 1 ngón và không kéo)
          if (
            !wasMultiTouchRef.current &&
            Math.abs(gestureState.dx) < 8 &&
            Math.abs(gestureState.dy) < 8
          ) {
            const now = Date.now();
            if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
              lastTapTimeRef.current = 0;
              if (userScaleRef.current > 1.05) {
                resetZoom(true);
              } else {
                applyTransform(DOUBLE_TAP_SCALE, { x: 0, y: 0 }, true);
              }
              return;
            }
            lastTapTimeRef.current = now;
          }

          wasMultiTouchRef.current = false;

          // Snap cạnh khi thả tay ở gần viền khung nhìn
          if (userScaleRef.current > 1.02) {
            const snapped = clampPos(
              posRef.current,
              userScaleRef.current,
              EDGE_SNAP_THRESHOLD,
            );
            if (
              Math.abs(snapped.x - posRef.current.x) > 0.5 ||
              Math.abs(snapped.y - posRef.current.y) > 0.5
            ) {
              applyTransform(userScaleRef.current, snapped, true);
            }
          } else {
            resetZoom(true);
          }
        },
        onPanResponderTerminate: () => {
          lastPinchRef.current = null;
          lastSingleTouchRef.current = null;
          wasMultiTouchRef.current = false;
        },
      }),
    [applyTransform, clampPos, resetZoom, stopActiveAnimations],
  );

  useEffect(() => {
    const track = publication?.track as VideoTrack | undefined;
    setVideoTrack(track);

    const onSubscribed = () => {
      setVideoTrack(publication?.track as VideoTrack);
    };
    const onUnsubscribed = () => {
      setVideoTrack(undefined);
    };

    publication?.on("subscribed", onSubscribed);
    publication?.on("unsubscribed", onUnsubscribed);

    return () => {
      publication?.off("subscribed", onSubscribed);
      publication?.off("unsubscribed", onUnsubscribed);
    };
  }, [publication]);

  // Xử lý Metadata để lấy Avatar
  let avatarUrl = null;
  try {
    if (trackRef.participant.metadata) {
      const meta = JSON.parse(trackRef.participant.metadata);
      avatarUrl = meta.avatarUrl;
    }
  } catch (error) {
    console.error(error);
  }

  // Hỗ trợ double-tap cả khi ở trạng thái 1x (khi PanResponder chưa capture touch đơn)
  const handleSingleTapFallback = useCallback(() => {
    if (!canZoomRef.current) return;
    const now = Date.now();
    if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      lastTapTimeRef.current = 0;
      if (userScaleRef.current > 1.05) {
        resetZoom(true);
      } else {
        applyTransform(DOUBLE_TAP_SCALE, { x: 0, y: 0 }, true);
      }
    } else {
      lastTapTimeRef.current = now;
    }
  }, [applyTransform, resetZoom]);

  const hasFixedSurface = fixedSurfaceW > 0 && fixedSurfaceH > 0;

  return (
    <View
      onLayout={handleLayout}
      {...(canZoom ? panResponder.panHandlers : {})}
      style={{
        flex: 1,
        backgroundColor: "#0a0a0c",
        borderRadius: 0,
        overflow: "hidden",
        borderWidth: isScreenShare && !isLandscape ? 2 : 0,
        borderColor: isScreenShare && !isLandscape ? "#3b82f6" : "transparent",
      }}
    >
      {/* VIDEO HOẶC AVATAR */}
      {showVideo ? (
        canZoom ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleSingleTapFallback}
            style={{
              flex: 1,
              backgroundColor: "#0a0a0c",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <Animated.View
              collapsable={false}
              style={{
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#0a0a0c",
                ...(hasFixedSurface
                  ? { width: fixedSurfaceW, height: fixedSurfaceH }
                  : { flex: 1, width: "100%", height: "100%" }),
                transform: [
                  { translateX: translateXAnim },
                  { translateY: translateYAnim },
                  { scale: scaleAnim },
                ],
              }}
            >
              <VideoView
                style={
                  hasFixedSurface
                    ? {
                        width: fixedSurfaceW,
                        height: fixedSurfaceH,
                        backgroundColor: "#0a0a0c",
                      }
                    : { flex: 1, width: "100%", backgroundColor: "#0a0a0c" }
                }
                videoTrack={videoTrack}
                objectFit="contain"
              />
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <VideoView
            style={{ flex: 1, backgroundColor: "#0a0a0c" }}
            videoTrack={videoTrack}
            objectFit={isScreenShare ? "contain" : "cover"}
          />
        )
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#121215",
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 64, height: 64, borderRadius: 32 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#232328",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "white", fontSize: 28, fontWeight: "bold" }}
              >
                {trackRef.participant.name?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* CHỈ BÁO MỨC ZOOM (Bấm vào để reset nhanh về 100%) */}
      {canZoom && zoomPercent > 100 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => resetZoom(true)}
          style={{
            position: "absolute",
            top: overlayTop,
            left: overlayLeft,
            backgroundColor: "rgba(17, 17, 19, 0.85)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.16)",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            zIndex: 25,
          }}
        >
          <Feather name="zoom-in" size={12} color="#60a5fa" />
          <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
            {zoomPercent}%
          </Text>
          <Feather name="x" size={11} color="#94a3b8" />
        </TouchableOpacity>
      )}

      {/* NÚT XOAY NGANG / THU GỌN CHO SCREEN SHARE */}
      {isRemoteScreenShare && showVideo && onToggleLandscape && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onToggleLandscape}
          style={{
            position: "absolute",
            top: handState.isRaised ? overlayTop + 28 : overlayTop,
            right: overlayRight,
            backgroundColor: "rgba(17, 17, 19, 0.85)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.16)",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            zIndex: 25,
          }}
        >
          <Feather
            name={isLandscape ? "minimize-2" : "maximize-2"}
            size={13}
            color="#e2e8f0"
          />
          <Text style={{ color: "#f8fafc", fontSize: 11, fontWeight: "700" }}>
            {isLandscape ? "Thu gọn" : "Xoay ngang"}
          </Text>
        </TouchableOpacity>
      )}

      {/* BADGE GIƠ TAY */}
      {handState.isRaised && (
        <View
          style={{
            position: "absolute",
            top: isLandscape ? overlayTop : 6,
            right: isLandscape ? overlayRight : 6,
            backgroundColor: "rgba(245, 158, 11, 0.9)",
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
            flexDirection: "row",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <Ionicons
            name="hand-left"
            size={12}
            color="white"
            style={{ marginRight: 4 }}
          />
          <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
            Giơ tay
          </Text>
        </View>
      )}

      {/* BADGE TÊN & TRẠNG THÁI (Ẩn khi xoay ngang toàn màn hình để không che nội dung) */}
      {!isLandscape && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            backgroundColor: "rgba(17, 17, 19, 0.85)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            paddingHorizontal: 7,
            paddingVertical: 4,
            borderRadius: 6,
            flexDirection: "row",
            alignItems: "center",
            maxWidth: "90%",
          }}
        >
          {isScreenShare && (
            <Feather
              name="monitor"
              size={12}
              color="#60a5fa"
              style={{ marginRight: 4 }}
            />
          )}
          {!showVideo && !isScreenShare && (
            <Feather
              name="video-off"
              size={12}
              color="#ef4444"
              style={{ marginRight: 4 }}
            />
          )}
          <Text
            style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
            numberOfLines={1}
          >
            {trackRef.participant.name || "Khách"}{" "}
            {isScreenShare && "(Chia sẻ)"}
          </Text>
        </View>
      )}
    </View>
  );
}
