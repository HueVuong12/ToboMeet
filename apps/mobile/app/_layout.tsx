import "../global.css";
import React, { useEffect, useState } from "react";
import {
  Slot,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [session, setSession] = useState<unknown>(null);

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

    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
  }, [session, isAuthReady, segments, navigationState?.key]);

  return <Slot />;
}
