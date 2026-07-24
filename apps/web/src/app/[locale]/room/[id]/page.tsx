import { createClient } from "@/lib/supabase/server";
import StoreProvider from "@/lib/redux/StoreProvider";
import RoomContent from "@/components/room/RoomContent";
import { redirect } from "next/navigation";

interface RoomPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id, locale } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect(`/${locale || "vi"}/auth/login?redirectTo=/room/${id}`);
  }

  return (
    <StoreProvider>
      <RoomContent roomId={id} userId={session.user.id} />
    </StoreProvider>
  );
}
