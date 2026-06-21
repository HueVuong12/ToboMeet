// ─── PricingSection ───────────────────────────────────────────────────────────
// 3 pricing tiers (Free / Pro / Enterprise) with monthly/yearly toggle.
// Client component: toggle requires useState.

'use client';

import { useState } from 'react';
import { Check, Zap, Building2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PRICING_CONFIG } from '@/lib/constants';

export default function PricingSection() {
  const t = useTranslations('pricing');
  const [isYearly, setIsYearly] = useState(false);
  const tiers = t.raw('tiers') as Array<{
    name: string;
    description: string;
    cta: string;
    features: string[];
  }>;

  const tierIcons: Record<string, { icon: any; color: string }> = {
    free: { icon: Zap, color: 'text-amber-500' },
    pro: { icon: Sparkles, color: 'text-violet-400' },
    enterprise: { icon: Building2, color: 'text-blue-600' }
  };

  return (
    <section id="pricing" className="py-16 md:py-20 bg-white border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section Header ── */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-[clamp(36px,5vw,52px)] font-bold text-navy tracking-tighter leading-[1.1]">
            {t('section_title')}{' '}
            <span className="text-gradient-brand">{t('section_title_accent')}</span>
          </h2>
          <p className="mt-5 text-[17px] text-slate-500 leading-relaxed">
            {t('section_desc')}
          </p>
        </div>

        {/* ── Billing Toggle ── */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            <span className={`text-[14px] font-semibold transition-colors ${!isYearly ? 'text-navy' : 'text-slate-400'}`}>
              {t('toggle_monthly')}
            </span>
            <button
              id="pricing-billing-toggle"
              onClick={() => setIsYearly(!isYearly)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none
                ${isYearly ? 'bg-brand-500' : 'bg-slate-200'}`}
              aria-label="Toggle billing period"
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${isYearly ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-[14px] font-semibold transition-colors ${isYearly ? 'text-navy' : 'text-slate-400'}`}>
                {t('toggle_yearly')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                {t('save_badge')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Pricing Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
          {PRICING_CONFIG.filter(c => c.tier !== 'enterprise').map((config: typeof PRICING_CONFIG[number]) => {
            const originalIndex = PRICING_CONFIG.findIndex(c => c.tier === config.tier);
            const tier = tiers[originalIndex];
            if (!tier) return null;
            const { icon: TierIcon, color: iconColor } = tierIcons[config.tier] || { icon: Zap, color: 'text-amber-500' };
            const price = isYearly ? config.yearlyPrice : config.monthlyPrice;

            return (
              <div
                key={config.tier}
                id={`pricing-tier-${config.tier}`}
                className={`relative flex flex-col rounded-[24px] p-8 border transition-all duration-300 hover:-translate-y-1
                  ${config.highlighted
                    ? 'bg-navy border-navy shadow-[0_20px_60px_-15px_rgba(10,37,64,0.4)]'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                  }`}
              >
                {/* Popular badge */}
                {config.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-brand-500 text-white text-[12px] font-bold shadow-lg whitespace-nowrap">
                    ⭐ {t('popular_badge')}
                  </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                    ${config.highlighted ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <TierIcon size={20} className={iconColor} strokeWidth={1.75} />
                  </div>
                  <h3 className={`text-[20px] font-bold tracking-tight ${config.highlighted ? 'text-white' : 'text-navy'}`}>
                    {tier.name}
                  </h3>
                </div>

                {/* Description */}
                <p className={`text-[14px] leading-relaxed mb-6 ${config.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  {config.isFree ? (
                    <div className={`text-[40px] font-bold tracking-tighter ${config.highlighted ? 'text-white' : 'text-navy'}`}>
                      {t('free_label')}
                    </div>
                  ) : config.monthlyPrice !== null ? (
                    <div className="flex items-end gap-1">
                      <span className={`text-[40px] font-bold tracking-tighter leading-none ${config.highlighted ? 'text-white' : 'text-navy'}`}>
                        ${price}
                      </span>
                      <span className={`text-[15px] font-semibold mb-1.5 ${config.highlighted ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('per_month')}
                      </span>
                    </div>
                  ) : (
                    <div className={`text-[28px] font-bold tracking-tight ${config.highlighted ? 'text-white' : 'text-navy'}`}>
                      {t('contact_text')}
                    </div>
                  )}
                  {isYearly && config.monthlyPrice !== null && !config.isFree && (
                    <p className={`text-[12px] mt-1 ${config.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Tiết kiệm ${((config.monthlyPrice - config.yearlyPrice!) * 12).toFixed(2)}/năm
                    </p>
                  )}
                </div>

                {/* CTA */}
                <a
                  href={config.tier === 'enterprise' ? '/contact' : '/register'}
                  className={`flex items-center justify-center gap-2 w-full h-12 rounded-full text-[15px] font-semibold mb-8 transition-all duration-200
                    ${config.highlighted
                      ? 'bg-brand-500 text-white hover:bg-brand-400 shadow-lg shadow-brand-500/30'
                      : 'bg-slate-100 text-navy hover:bg-brand-500 hover:text-white hover:shadow-lg hover:shadow-brand-500/30'
                    }`}
                >
                  {tier.cta}
                </a>

                {/* Divider */}
                <div className={`h-px mb-6 ${config.highlighted ? 'bg-white/10' : 'bg-slate-100'}`} />

                {/* Feature list */}
                <ul className="flex flex-col gap-3.5 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                        ${config.highlighted ? 'bg-brand-500/20' : 'bg-brand-50'}`}>
                        <Check size={12} className={config.highlighted ? 'text-brand-400' : 'text-brand-600'} strokeWidth={2.5} />
                      </div>
                      <span className={`text-[14px] leading-snug ${config.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── Footer note ── */}
        <p className="text-center text-[13px] text-slate-400 mt-8">
          {t('footer_note')}
        </p>

      </div>
    </section>
  );
}
