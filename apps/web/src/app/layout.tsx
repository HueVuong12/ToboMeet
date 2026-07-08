import StoreProvider from "@/lib/redux/StoreProvider";
import { createClient } from "@/lib/supabase/server";
import { EventProvider } from "@/providers/EventProvider";
import { Toaster } from "sonner";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;

  return (
    <StoreProvider>
      <EventProvider userId={userId}>{children}</EventProvider>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </StoreProvider>
  );
}
