import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";

interface MobileWhiteboardModalProps {
  visible: boolean;
  onClose: () => void;
  meetingCode: string;
}

export default function MobileWhiteboardModal({
  visible,
  onClose,
  meetingCode,
}: MobileWhiteboardModalProps) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const webViewRef = useRef<WebView>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [tokens, setTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Xác định Web Base URL từ biến môi trường
  const getWebBaseUrl = useCallback(() => {
    if (process.env.EXPO_PUBLIC_WEB_URL) {
      return process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, "");
    }
    if (process.env.EXPO_PUBLIC_API_URL) {
      // Ví dụ: http://192.168.1.13:3001/api -> http://192.168.1.13:3000
      return process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, "").replace(
        ":3001",
        ":3000",
      );
    }
    return "http://localhost:3000";
  }, []);

  // Lấy session Supabase mới nhất từ mobile
  const fetchSession = useCallback(async () => {
    try {
      setIsLoadingSession(true);
      setLoadError(null);

      // Thử refresh session nếu có thể để token luôn tươi mới
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const refreshRes = await supabase.auth.refreshSession();
        session = refreshRes.data.session;
      }

      if (!session?.access_token || !session?.refresh_token) {
        setLoadError(
          t("meeting.toolbar.whiteboard_no_session", {
            defaultValue: "Không tìm thấy phiên đăng nhập hợp lệ",
          }),
        );
        setIsLoadingSession(false);
        return;
      }

      setTokens({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
      setIsLoadingSession(false);
    } catch (err: any) {
      console.error("[MobileWhiteboard] Lỗi lấy session:", err);
      setLoadError(
        err?.message ||
        t("meeting.toolbar.whiteboard_error_generic", {
          defaultValue: "Lỗi kết nối",
        }),
      );
      setIsLoadingSession(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible) {
      fetchSession();
    } else {
      setTokens(null);
      setLoadError(null);
    }
  }, [visible, fetchSession, reloadKey]);

  const handleReload = () => {
    setReloadKey((k) => k + 1);
  };

  // Helper escape HTML strings an toàn
  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Tạo HTML tự động POST sang route handler /api/auth/bridge?next=...
  const renderBridgeHtml = () => {
    if (!tokens) return "";

    const webBaseUrl = getWebBaseUrl();
    const currentLocale = i18n.language?.startsWith("en") ? "en" : "vi";
    const targetNextPath = `/${currentLocale}/whiteboard/${meetingCode}`;
    const bridgeUrl = `${webBaseUrl}/api/auth/bridge?next=${encodeURIComponent(targetNextPath)}`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background-color: #0e0e11;
              color: #ffffff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              user-select: none;
              -webkit-user-select: none;
            }
            .spinner-wrapper {
              position: relative;
              margin-bottom: 20px;
            }
            .spinner {
              width: 44px;
              height: 44px;
              border: 3px solid rgba(59, 130, 246, 0.2);
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .title {
              font-size: 15px;
              font-weight: 600;
              color: #ffffff;
              margin-bottom: 6px;
            }
            .desc {
              font-size: 12px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="spinner-wrapper">
            <div class="spinner"></div>
          </div>
          <div class="title">${t("meeting.toolbar.whiteboard_connecting", { defaultValue: "Đang kết nối Bảng trắng..." })}</div>
          <div class="desc">${t("meeting.toolbar.whiteboard_syncing_auth", { defaultValue: "Đồng bộ phiên xác thực an toàn" })}</div>

          <form id="bridgeForm" method="POST" action="${bridgeUrl}">
            <input type="hidden" name="access_token" value="${escapeHtml(tokens.accessToken)}" />
            <input type="hidden" name="refresh_token" value="${escapeHtml(tokens.refreshToken)}" />
          </form>

          <script>
            try {
              document.getElementById("bridgeForm").submit();
            } catch (err) {
              console.error("Form submit error:", err);
            }
          </script>
        </body>
      </html>
    `;
  };

  // Script inject vào WebView để lắng nghe nút đóng trên Web UI (window.close())
  const injectedJs = `
    (function() {
      window.close = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_WHITEBOARD' }));
        }
      };
    })();
    true;
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-[#0e0e11]"
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* HEADER TOOLBAR NATIVE CỦA MODAL */}
        <View className="h-12 flex-row items-center justify-between px-3 bg-[#161619] border-b border-[#232328]">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="w-8 h-8 rounded-lg bg-white/5 items-center justify-center active:bg-white/10"
            >
              <Feather name="arrow-left" size={18} color="#ffffff" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-1.5 ml-1">
              <Feather name="edit-3" size={15} color="#3b82f6" />
              <Text className="text-white font-bold text-sm">
                {t("meeting.toolbar.whiteboard", { defaultValue: "Bảng trắng" })}
              </Text>
              <View className="px-1.5 py-0.5 rounded bg-[#232328] ml-1">
                <Text className="text-[11px] font-mono text-gray-400">
                  {meetingCode}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleReload}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="w-8 h-8 rounded-lg bg-white/5 items-center justify-center active:bg-white/10"
            >
              <Feather name="rotate-cw" size={16} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="w-8 h-8 rounded-lg bg-red-500/10 items-center justify-center active:bg-red-500/20"
            >
              <Feather name="x" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* NỘI DUNG WEBVIEW HOẶC LOADING/ERROR */}
        <View className="flex-1 bg-[#111113]">
          {isLoadingSession && (
            <View className="flex-1 justify-center items-center bg-[#0e0e11]">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-gray-400 text-xs mt-3">
                {t("meeting.toolbar.whiteboard_preparing", {
                  defaultValue: "Đang chuẩn bị phiên làm việc...",
                })}
              </Text>
            </View>
          )}

          {!isLoadingSession && loadError && (
            <View className="flex-1 justify-center items-center px-6 bg-[#0e0e11]">
              <Feather name="alert-triangle" size={36} color="#f59e0b" />
              <Text className="text-white text-base font-bold mt-3 mb-1 text-center">
                {t("meeting.toolbar.whiteboard_load_error", {
                  defaultValue: "Không thể mở bảng trắng",
                })}
              </Text>
              <Text className="text-gray-400 text-xs text-center mb-6">
                {loadError}
              </Text>
              <TouchableOpacity
                onPress={handleReload}
                className="px-5 py-2.5 bg-blue-600 rounded-xl flex-row items-center gap-2"
              >
                <Feather name="rotate-cw" size={15} color="#ffffff" />
                <Text className="text-white font-bold text-xs">
                  {t("meeting.toolbar.retry", { defaultValue: "Thử lại" })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoadingSession && !loadError && tokens && (
            <WebView
              ref={webViewRef}
              source={{
                html: renderBridgeHtml(),
                baseUrl: getWebBaseUrl(),
              }}
              injectedJavaScript={injectedJs}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data?.type === "CLOSE_WHITEBOARD") {
                    onClose();
                  }
                } catch {
                  // ignore
                }
              }}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              domStorageEnabled={true}
              javaScriptEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              originWhitelist={["*"]}
              scalesPageToFit={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="absolute inset-0 justify-center items-center bg-[#0e0e11] z-10">
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text className="text-gray-400 text-xs mt-3">
                    {t("meeting.toolbar.whiteboard_loading_canvas", {
                      defaultValue: "Đang tải bảng vẽ...",
                    })}
                  </Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn("WebView error: ", nativeEvent);
              }}
              style={{ flex: 1, backgroundColor: "#111113" }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
