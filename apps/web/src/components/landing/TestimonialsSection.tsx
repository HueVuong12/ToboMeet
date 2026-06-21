// ─── TestimonialsSection ───────────────────────────────────────────────────────
// 6 customer testimonials in a masonry-style 3-column grid.

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TESTIMONIALS_CONFIG } from '@/lib/constants';

export default function TestimonialsSection() {
  const t = useTranslations('testimonials');
  const items = t.raw('items') as Array<{ name: string; role: string; content: string }>;

  return (
    <section className="py-16 md:py-20 bg-white border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section Header ── */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-[clamp(36px,5vw,52px)] font-bold text-navy tracking-tighter leading-[1.1]">
            {t('section_title')}{' '}
            <span className="text-gradient-brand">{t('section_title_accent')}</span>
          </h2>
        </div>

        {/* ── Testimonial Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS_CONFIG.map((config, i) => {
            const item = items[i];
            if (!item) return null;

            return (
              <div
                key={i}
                id={`testimonial-${i + 1}`}
                className={`relative flex flex-col p-7 rounded-[20px] border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group
                  ${i === 1 ? 'md:mt-8' : ''}
                  ${i === 3 ? 'lg:mt-6' : ''}
                `}
              >
                {/* Quote mark decoration */}
                <div className="absolute top-5 right-6 text-[64px] leading-none text-slate-100 font-serif select-none group-hover:text-slate-200/80 transition-colors">
                  "
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: config.rating }).map((_, si) => (
                    <Star key={si} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-[15px] text-slate-600 leading-relaxed mb-6 relative z-10 flex-1">
                  &ldquo;{item.content}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 shadow-sm`}
                  >
                    {config.initials}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-navy">{item.name}</p>
                    <p className="text-[12px] text-slate-500">{item.role}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
