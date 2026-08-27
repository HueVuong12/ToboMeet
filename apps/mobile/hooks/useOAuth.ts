import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

export const useOAuth = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFbLoading, setIsFbLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    if (provider === "google") setIsGoogleLoading(true);
    else setIsFbLoading(true);

    setOauthError("");

    try {
      const redirectUrl = Linking.createURL("auth/callback");
      console.log("REDIRECT URL:", redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === "success") {
        const url = result.url;
        const hash = url.split("#")[1];

        if (!hash)
          throw new Error("Không tìm thấy dữ liệu xác thực từ Supabase");

        const params = hash.split("&").reduce(
          (acc, current) => {
            const [key, value] = current.split("=");
            acc[key] = value;
            return acc;
          },
          {} as Record<string, string>,
        );

        if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (sessionError) throw sessionError;
        } else {
          throw new Error("URL trả về không chứa token hợp lệ");
        }
      } else {
        throw new Error("Đăng nhập bị hủy hoặc thất bại");
      }
    } catch (error: unknown) {
      setOauthError(
        error instanceof Error
          ? error.message
          : "Lỗi mặc định khi đăng nhập Oauth",
      );
    } finally {
      if (provider === "google") setIsGoogleLoading(false);
      else setIsFbLoading(false);
    }
  };

  return {
    handleOAuthLogin,
    isGoogleLoading,
    isFbLoading,
    oauthError,
  };
};
