// ─── HeroSection ──────────────────────────────────────────────────────────────
// Landing page hero: animated headline, HTML/CSS meeting UI mockup,
// join form, and social proof. No static images — fully dynamic.

import {
  ArrowRight, Video, ShieldCheck,
  Mic, MicOff, Monitor, MessageSquare, PhoneOff,
  Users, ScreenShare,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MOCK_PARTICIPANTS } from '@/lib/constants';



// ─── HeroSection Component ─────────────────────────────────────────────────────
export default function HeroSection() {
  const t = useTranslations('hero');

  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 bg-enterprise-mesh overflow-hidden">

      {/* Background decoration orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-t from-slate-50/40 to-transparent pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">

        {/* ── Copy Block ── */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">

          {/* Headline */}
          <h1 className="animate-fade-in-up delay-100 text-[clamp(44px,7vw,88px)] font-bold tracking-tighter text-navy leading-[1.05] mb-6">
            <span className="md:whitespace-nowrap">
              {t('title_line1')}{' '}
              <span className="text-gradient-brand">{t('title_line1_accent')}</span>
            </span>
            <br />
            <span className="text-slate-400">{t('title_line2')}</span>
          </h1>

          {/* Description */}
          <p className="animate-fade-in-up delay-200 text-[clamp(16px,2vw,20px)] text-slate-500 leading-relaxed max-w-2xl mb-10">
            {t('description')}
          </p>

          {/* CTA Row */}
          <div className="animate-fade-in-up delay-300 flex flex-wrap items-center justify-center gap-4 w-full">
            {/* Create meeting button */}
            <a
              id="hero-create-meeting"
              href="/meeting/new"
              className="btn-enterprise h-14 px-8 text-[15px] flex-shrink-0"
            >
              <Video size={19} />
              {t('create_meeting')}
            </a>

            {/* Join room input */}
            <div className="flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm h-14 w-full sm:w-auto">
              <input
                id="hero-join-code"
                type="text"
                placeholder={t('join_placeholder')}
                className="bg-transparent border-none outline-none px-5 text-[15px] text-navy w-full sm:w-52 placeholder-slate-400"
              />
              <button
                id="hero-join-button"
                className="flex items-center justify-center gap-2 px-5 h-full font-semibold text-[14px] text-navy hover:bg-slate-50 border-l border-slate-100 transition-colors flex-shrink-0"
              >
                {t('join_button')}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Social proof */}
          <div className="animate-fade-in delay-600 mt-8 flex items-center gap-2.5">
            <div className="flex -space-x-2">
              {MOCK_PARTICIPANTS.map((p) => (
                <div
                  key={p.id}
                  className={`w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}
                >
                  {p.initials}
                </div>
              ))}
            </div>
            <p className="text-[14px] text-slate-500">
              <span className="font-bold text-navy">{t('social_proof_number')}</span>{' '}
              {t('social_proof')}
            </p>
          </div>
        </div>



      </div>
    </section>
  );
}
