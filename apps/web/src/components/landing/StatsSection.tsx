// ─── StatsSection ─────────────────────────────────────────────────────────────
// Highlights key platform metrics: users, meetings, countries, uptime.

import { Users, Video, Globe2, Activity, LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STATS_CONFIG } from '@/lib/constants';

const ICON_MAP: Record<string, LucideIcon> = { Users, Video, Globe2, Activity };

export default function StatsSection() {
  const t = useTranslations('stats');

  return (
    <section className="py-16 bg-white border-y border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200/70 rounded-[20px] overflow-hidden border border-slate-200">
          {STATS_CONFIG.map((stat, i) => {
            const Icon = ICON_MAP[stat.icon];
            return (
              <div
                key={stat.valueKey}
                className="bg-white px-8 py-10 flex flex-col items-center text-center group hover:bg-slate-50/60 transition-colors"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-slate-50 group-hover:scale-110 transition-transform`}>
                  {Icon && <Icon size={20} className={stat.accent} strokeWidth={1.75} />}
                </div>

                {/* Value */}
                <div className={`text-[clamp(28px,4vw,40px)] font-bold tracking-tighter ${stat.accent} mb-1`}>
                  {t(stat.valueKey as Parameters<typeof t>[0])}
                </div>

                {/* Label */}
                <p className="text-[13px] font-semibold text-slate-500 leading-snug">
                  {t(stat.labelKey as Parameters<typeof t>[0])}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
