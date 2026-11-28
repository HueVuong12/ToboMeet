import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalParticipant } from "@livekit/react-native";
import { useHandRaise } from "../../hooks/useHandRaise";

const BUTTON_SIZE = 44;
const DRAG_THRESHOLD = 7;

type CornerState = {
  h: "left" | "right";
  v: "top" | "bottom";
};

/**
 * Nút tùy chọn bánh răng nổi khi xem Screen Share ở màn hình ngang:
 * - Có thể kéo tự do khắp vùng an toàn (loại bỏ safe area / thanh điều hướng / tai thỏ).
 * - Khi thả tay tự động hút (snap) về góc gần nhất trong 4 góc an toàn.
 * - Khi bấm sẽ sổ menu thao tác nhanh: Bật/Tắt Mic và Giơ tay/Hạ tay.
 */
export default function LandscapeFloatingMenu() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();

  const [menuOpen, setMenuOpen] = useState(false);
  // Mặc định đặt ở góc dưới bên phải để không trùng với nút "Thu gọn" ở góc trên bên phải
  const [corner, setCorner] = useState<CornerState>({
    h: "right",
    v: "bottom",
  });

  // Tính khung vùng an toàn (tránh hoàn toàn tai thỏ, thanh trạng thái và thanh điều hướng Android/iOS)
  const bounds = useMemo(() => {
    const safeLeft = Math.max(insets.left, 48) + 14;
    const safeRight = Math.max(insets.right, 48) + 14;
    const safeTop = Math.max(insets.top, 14) + 6;
    const safeBottom = Math.max(insets.bottom, 16) + 10;

    const minX = safeLeft;
    const maxX = Math.max(safeLeft, windowWidth - safeRight - BUTTON_SIZE);
    const minY = safeTop;
    const maxY = Math.max(safeTop, windowHeight - safeBottom - BUTTON_SIZE);

    return { minX, maxX, minY, maxY };
  }, [insets, windowWidth, windowHeight]);

  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const windowSizeRef = useRef({ width: windowWidth, height: windowHeight });
  windowSizeRef.current = { width: windowWidth, height: windowHeight };

  const getCornerCoords = useCallback(
    (targetCorner: CornerState, currentBounds = boundsRef.current) => ({
      x: targetCorner.h === "left" ? currentBounds.minX : currentBounds.maxX,
      y: targetCorner.v === "top" ? currentBounds.minY : currentBounds.maxY,
    }),
    [],
  );

  const initialPos = getCornerCoords(corner, bounds);
  const translateX = useRef(new Animated.Value(initialPos.x)).current;
  const translateY = useRef(new Animated.Value(initialPos.y)).current;
  const currentPosRef = useRef(initialPos);
  const dragStartPosRef = useRef(initialPos);
  const isDraggingRef = useRef(false);
  const cornerRef = useRef(corner);
  cornerRef.current = corner;

  // Cập nhật lại vị trí góc an toàn khi kích thước màn hình hoặc insets thay đổi
  useEffect(() => {
    const nextPos = getCornerCoords(cornerRef.current, bounds);
    currentPosRef.current = nextPos;
    translateX.setValue(nextPos.x);
    translateY.setValue(nextPos.y);
  }, [bounds, getCornerCoords, translateX, translateY]);

  const toggleMic = useCallback(() => {
    localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const handleToggleHand = useCallback(() => {
    toggleHandRaise();
  }, [toggleHandRaise]);

  const snapToNearestCorner = useCallback(
    (x: number, y: number) => {
      const b = boundsRef.current;
      const { width, height } = windowSizeRef.current;
      const centerX = x + BUTTON_SIZE / 2;
      const centerY = y + BUTTON_SIZE / 2;

      const nextCorner: CornerState = {
        h: centerX < width / 2 ? "left" : "right",
        v: centerY < height / 2 ? "top" : "bottom",
      };

      const target = getCornerCoords(nextCorner, b);
      currentPosRef.current = target;
      setCorner(nextCorner);

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: target.x,
          useNativeDriver: true,
          tension: 85,
          friction: 11,
        }),
        Animated.spring(translateY, {
          toValue: target.y,
          useNativeDriver: true,
          tension: 85,
          friction: 11,
        }),
      ]).start();
    },
    [getCornerCoords, translateX, translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
          translateY.stopAnimation();
          isDraggingRef.current = false;
          dragStartPosRef.current = { ...currentPosRef.current };
        },
        onPanResponderMove: (_evt, gestureState) => {
          const movedDist = Math.hypot(gestureState.dx, gestureState.dy);
          if (!isDraggingRef.current && movedDist >= DRAG_THRESHOLD) {
            isDraggingRef.current = true;
            setMenuOpen(false);
          }

          if (isDraggingRef.current) {
            const b = boundsRef.current;
            const nextX = Math.min(
              Math.max(dragStartPosRef.current.x + gestureState.dx, b.minX),
              b.maxX,
            );
            const nextY = Math.min(
              Math.max(dragStartPosRef.current.y + gestureState.dy, b.minY),
              b.maxY,
            );
            currentPosRef.current = { x: nextX, y: nextY };
            translateX.setValue(nextX);
            translateY.setValue(nextY);
          }
        },
        onPanResponderRelease: () => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            snapToNearestCorner(
              currentPosRef.current.x,
              currentPosRef.current.y,
            );
          } else {
            setMenuOpen((prev) => !prev);
          }
        },
        onPanResponderTerminate: () => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            snapToNearestCorner(
              currentPosRef.current.x,
              currentPosRef.current.y,
            );
          }
        },
      }),
    [snapToNearestCorner, translateX, translateY],
  );

  // Tính vị trí menu sổ xuống/lên theo góc mà nút đang bám
  const snappedCoords = getCornerCoords(corner, bounds);
  const menuPositionStyle = useMemo(() => {
    const style: Record<string, number> = {};
    if (corner.v === "top") {
      style.top = snappedCoords.y + BUTTON_SIZE + 8;
    } else {
      style.bottom = Math.max(
        10,
        windowHeight - snappedCoords.y + 8,
      );
    }

    if (corner.h === "left") {
      style.left = snappedCoords.x;
    } else {
      style.right = Math.max(
        10,
        windowWidth - snappedCoords.x - BUTTON_SIZE,
      );
    }
    return style;
  }, [corner, snappedCoords, windowWidth, windowHeight]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
      }}
    >
      {/* Backdrop chạm ra ngoài để đóng menu */}
      {menuOpen && (
        <Pressable
          onPress={() => setMenuOpen(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 41,
          }}
        />
      )}

      {/* Menu sổ xuống/lên chứa các thao tác nhanh */}
      {menuOpen && (
        <View
          style={{
            position: "absolute",
            ...menuPositionStyle,
            minWidth: 176,
            backgroundColor: "rgba(17, 17, 21, 0.94)",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.14)",
            padding: 6,
            zIndex: 42,
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
              },
              android: { elevation: 12 },
            }),
          }}
        >
          {/* Bật / Tắt Mic */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={toggleMic}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: isMicrophoneEnabled
                ? "rgba(16, 185, 129, 0.14)"
                : "rgba(239, 68, 68, 0.14)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather
                name={isMicrophoneEnabled ? "mic" : "mic-off"}
                size={16}
                color={isMicrophoneEnabled ? "#34d399" : "#f87171"}
              />
              <Text
                style={{
                  color: "#f8fafc",
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
              </Text>
            </View>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isMicrophoneEnabled ? "#34d399" : "#f87171",
              }}
            />
          </TouchableOpacity>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              marginVertical: 4,
            }}
          />

          {/* Giơ tay / Hạ tay */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleToggleHand}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: isLocalHandRaised
                ? "rgba(245, 158, 11, 0.18)"
                : "transparent",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons
                name="hand-left"
                size={16}
                color={isLocalHandRaised ? "#fbbf24" : "#cbd5e1"}
              />
              <Text
                style={{
                  color: isLocalHandRaised ? "#fde68a" : "#f8fafc",
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {isLocalHandRaised ? "Hạ tay xuống" : "Giơ tay"}
              </Text>
            </View>
            {isLocalHandRaised && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#fbbf24",
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Nút bánh răng nổi có thể kéo & tự snap vào 4 góc */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: menuOpen
            ? "rgba(37, 99, 235, 0.92)"
            : "rgba(17, 17, 21, 0.88)",
          borderWidth: 1,
          borderColor: menuOpen
            ? "rgba(147, 197, 253, 0.5)"
            : "rgba(255, 255, 255, 0.2)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 43,
          transform: [{ translateX }, { translateY }],
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
            },
            android: { elevation: 10 },
          }),
        }}
      >
        <Feather name="settings" size={20} color="#f8fafc" />
        {/* Chấm trạng thái nhỏ khi đang bật mic hoặc giơ tay */}
        {(isMicrophoneEnabled || isLocalHandRaised) && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: isLocalHandRaised ? "#fbbf24" : "#34d399",
              borderWidth: 1.5,
              borderColor: "#111115",
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

