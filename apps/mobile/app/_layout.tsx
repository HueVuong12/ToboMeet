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
import Toast from "react-native-toast-message";
import { EventProvider } from "../providers/EventProvider";
import { registerGlobals } from "@livekit/react-native";
import { Session } from "@supabase/supabase-js";

registerGlobals();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
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
          .catch((err) =>
            console.log(
              "Splash Screen already hidden or errored:",
              err.message,
            ),
          );
      }, 100);
    }
  }, [session, isAuthReady, segments, navigationState?.key, isSplashHidden]);

  const showGlobalLanguageSwitcher = segments[0] === "(auth)";
  const currentUserId = session ? session.user?.id : undefined;

  if (!isAuthReady || !navigationState?.key) return null; // chặn splash screen qua trang login

  return (
    <View style={{ flex: 1 }}>
      <StoreProvider>
        {showGlobalLanguageSwitcher && <LanguageSwitcher />}
        <EventProvider userId={currentUserId}>
          <Slot />
        </EventProvider>
        <Toast />
      </StoreProvider>
    </View>
  );
}
