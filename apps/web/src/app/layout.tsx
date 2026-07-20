import StoreProvider from "@/lib/redux/StoreProvider";
import { createClient } from "@/lib/supabase/server";
import { EventProvider } from "@/providers/EventProvider";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
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
      <ConfirmProvider>
        <EventProvider userId={userId}>{children}</EventProvider>
      </ConfirmProvider>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </StoreProvider>
  );
}
