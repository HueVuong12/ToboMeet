// ─── i18n Navigation Utilities ────────────────────────────────────────────────
// Exports locale-aware navigation helpers built with next-intl's createNavigation.
// Use these instead of next/navigation when you need locale-prefixed routing.

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
