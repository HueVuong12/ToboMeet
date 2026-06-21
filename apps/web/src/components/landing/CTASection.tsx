// ─── CTASection ───────────────────────────────────────────────────────────────
// Full-width gradient call-to-action with email input and social proof.

import { ArrowRight, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CTASection() {
  const t = useTranslations('cta');

  return (
    <section className="py-16 md:py-20 border-t border-slate-200/60 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── CTA Card ── */}
        <div className="relative rounded-[32px] bg-navy overflow-hidden px-8 py-16 md:px-20 md:py-24 text-center">

          {/* Background decoration */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-500/15 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <div className="relative z-10">
            {/* Headline */}
            <h2 className="text-[clamp(36px,5vw,60px)] font-bold tracking-tighter text-white leading-[1.1] mb-6">
              {t('title')}{' '}
              <span className="text-gradient-brand">{t('title_accent')}</span>
            </h2>

            {/* Description */}
            <p className="text-[17px] text-slate-400 leading-relaxed max-w-xl mx-auto mb-10">
              {t('description')}
            </p>

            {/* Email form */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto mb-8">
              <div className="flex-1 w-full flex items-center bg-white/10 border border-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <input
                  id="cta-email-input"
                  type="email"
                  placeholder={t('email_placeholder')}
                  className="flex-1 bg-transparent border-none outline-none px-5 py-3.5 text-[15px] text-white placeholder-slate-400 min-w-0"
                />
              </div>
              <a
                id="cta-submit-button"
                href="/register"
                className="btn-enterprise h-[52px] px-7 text-[15px] flex-shrink-0 w-full sm:w-auto"
              >
                {t('cta_button')}
              </a>
            </div>

            {/* Or divider */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-16 bg-white/10" />
              <span className="text-[13px] text-slate-500">{t('or_text')}</span>
              <div className="h-px w-16 bg-white/10" />
            </div>

            {/* Secondary CTA */}
            <a
              id="cta-create-meeting"
              href="/meeting/new"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-400 hover:text-white transition-colors mb-8"
            >
              <Video size={16} />
              {t('create_meeting')}
            </a>

            {/* Fine print */}
            <p className="text-[13px] text-slate-500">
              {t('no_credit_card')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
