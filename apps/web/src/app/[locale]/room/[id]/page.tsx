import { createClient } from "@/lib/supabase/server";
import StoreProvider from "@/lib/redux/StoreProvider";
import RoomContent from "@/components/room/RoomContent";

interface RoomPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return;
  }

  const userId = data?.claims.sub;

  return (
    <StoreProvider>
      <RoomContent roomId={id} userId={userId} />
    </StoreProvider>
  );
}
