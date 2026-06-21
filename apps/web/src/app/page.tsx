// Root page — redirect handled automatically by next-intl middleware
// This file exists to satisfy Next.js App Router requirements.
// The middleware.ts will redirect / → /vi (defaultLocale) automatically.
export default function RootPage() {
  return null;
}
