import StoreProvider from "@/lib/redux/StoreProvider";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
      {children}
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </StoreProvider>
  );
}
