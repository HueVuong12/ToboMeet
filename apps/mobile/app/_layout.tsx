import "../global.css";
import "../lib/i18n";
import React, { useEffect, useState } from "react";
import {
  Slot,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../lib/supabase";
import { View } from "react-native";
import LanguageSwitcher from "../components/commons/LanguageSwitcher";
import StoreProvider from "../lib/redux/StoreProvider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [session, setSession] = useState<unknown>(null);
  const [isSplashHidden, setIsSplashHidden] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsAuthReady(true);
    });

    // Lắng nghe mọi sự kiện: Đăng nhập, Đăng xuất, Đổi mật khẩu...
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Sự kiện Auth:", event);
        setSession(session);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady || !navigationState?.key) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isResetPasswordFlow = segments.includes("forgot-password");

    if (session && inAuthGroup && !isResetPasswordFlow) {
      router.replace("/home");
    } else if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    }

    if (!isSplashHidden) {
      setTimeout(() => {
        SplashScreen.hideAsync()
          .then(() => setIsSplashHidden(true))
          .catch((err) => console.log("Splash Screen already hidden or errored:", err.message));
      }, 100);
    }
  }, [session, isAuthReady, segments, navigationState?.key, isSplashHidden]);

  const showGlobalLanguageSwitcher = segments[0] === "(auth)";

  return (
    <View style={{ flex: 1 }}>
      <StoreProvider>
        {showGlobalLanguageSwitcher && <LanguageSwitcher />}
        <Slot />
      </StoreProvider>
    </View>
  );
}
