// Root layout — minimal wrapper.
// The actual layout with html/body is in [locale]/layout.tsx
// This file is required by Next.js App Router.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
