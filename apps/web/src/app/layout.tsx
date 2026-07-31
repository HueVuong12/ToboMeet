import StoreProvider from "@/lib/redux/StoreProvider";
import { createClient } from "@/lib/supabase/server";
import { EventProvider } from "@/providers/EventProvider";
import { GlobalSocketListeners } from "@/providers/GlobalSocketListeners";
import { Toaster } from "sonner";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  return (
    <StoreProvider>
      <EventProvider userId={userId}>
        <GlobalSocketListeners />
        {children}
      </EventProvider>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </StoreProvider>
  );
}
