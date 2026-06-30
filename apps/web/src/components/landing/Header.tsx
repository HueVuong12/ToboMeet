// ─── Header ────────────────────────────────────────────────────────────────────
// Sticky header: logo, nav links, language switcher, CTA actions.
// Scroll-aware: transparent → frosted glass effect after 10px.

"use client";

import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Video } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { NAV_LINKS } from "@/lib/constants";
import Link from "next/link";
import LanguageSwitcher from "../commons/LanguageSwitcher";

// ─── Header Component ─────────────────────────────────────────────────────────
export default function Header({ variant = "default" }: { variant?: "default" | "auth" }) {
  const t = useTranslations();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm"
            : "bg-transparent border-b border-transparent"
        }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group flex-shrink-0"
          >
            <div className="relative flex h-9 w-9 items-center justify-center">
              {/* Nền gradient chéo */}
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
              {/* Nền đổ bóng mờ ảo */}
              <div className="absolute inset-0 bg-brand-500 blur opacity-40 rounded-xl group-hover:opacity-60 transition-opacity duration-300"></div>
              {/* Icon */}
              <div className="relative z-10 text-white">
                <Video
                  size={18}
                  strokeWidth={2.5}
                  className="group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>
            <span className="text-[22px] font-black tracking-tighter text-navy">
              Tobo
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">
                Meet
              </span>
            </span>
          </Link>

          {/* ── Desktop Nav ── */}
          {variant !== "auth" && (
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-[14px] font-semibold text-slate-500 hover:text-navy hover:bg-slate-50/80 transition-colors"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          )}

          {/* ── Desktop Actions ── */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href={`/api/auth/logout?locale=${locale}`}
              className="px-4 py-2 text-[14px] font-semibold text-slate-600 hover:text-navy transition-colors"
            >
              {t("header.login")}
            </Link>
            <Link
              href="/signup"
              className="btn-enterprise py-2 px-5 text-[14px]"
            >
              {t("header.register")}
            </Link>
          </div>

          {/* ── Mobile Toggle ── */}
          <button
            id="header-mobile-menu-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-6 shadow-xl">
          {variant !== "auth" && (
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14px] font-semibold text-navy hover:bg-slate-50"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <Link
                href={`/api/auth/logout?locale=${locale}`}
                className="text-[14px] font-semibold text-slate-600"
              >
                {t("header.login")}
              </Link>
              <LanguageSwitcher />
            </div>
            <Link href="/signup" className="btn-enterprise justify-center">
              {t("header.register")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
