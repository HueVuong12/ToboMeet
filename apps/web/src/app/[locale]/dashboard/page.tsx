import { createClient } from "@/lib/supabase/server";
import StoreProvider from "@/lib/redux/StoreProvider";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { Room } from "@tobomeet/shared/types";

const NESTJS_BASE_URL =
  process.env.NESTJS_BASE_URL || "http://localhost:3001/api";

// Prefetch rooms trực tiếp từ NestJS (bỏ qua proxy, tránh double network hop)
async function prefetchRooms(accessToken: string): Promise<Room[]> {
  try {
    const res = await fetch(`${NESTJS_BASE_URL}/rooms/my`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    // Unwrap ApiResponse wrapper nếu có
    return json.result ?? (Array.isArray(json) ? json : []);
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  // Middleware đã bảo vệ route — getSession() chỉ gọi 1 lần duy nhất ở đây
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Prefetch server-side để tránh client-side waterfall (RTK Query fetch sau hydrate)
  const initialRooms = session?.access_token
    ? await prefetchRooms(session.access_token)
    : [];

  return (
    <StoreProvider>
      <DashboardContent initialRooms={initialRooms} />
    </StoreProvider>
  );
}
