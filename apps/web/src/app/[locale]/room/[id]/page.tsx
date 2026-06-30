import { createClient } from "@/lib/supabase/server";
import StoreProvider from "@/lib/redux/StoreProvider";
import RoomContent from "@/components/room/RoomContent";

interface RoomPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  // Middleware đã bảo vệ route — chỉ cần lấy user.id, không cần kiểm tra + redirect lại
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <StoreProvider>
      <RoomContent roomId={id} userId={session!.user.id} />
    </StoreProvider>
  );
}
