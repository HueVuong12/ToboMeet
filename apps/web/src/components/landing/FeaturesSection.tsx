import { Video, GraduationCap, ShieldCheck, Globe2, Zap, LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FEATURES_CONFIG } from '@/lib/constants';
import MeetingMockup from './MeetingMockup';

const ICON_MAP: Record<string, LucideIcon> = { Video, GraduationCap, ShieldCheck };

export default function FeaturesSection() {
  const t = useTranslations('features');
  const items = t.raw('items') as Array<{ title: string; description: string }>;

  return (
    <section id="features" className="relative py-16 md:py-20 bg-white border-t border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="max-w-2xl flex-1">
            <h2 className="text-[clamp(28px,4vw,46px)] font-bold text-navy tracking-tighter leading-[1.1]">
              {t('section_title')}{' '}
              <span className="text-gradient-brand">{t('section_title_gradient')}</span>
            </h2>
          </div>
          <p className="text-[17px] text-slate-500 leading-relaxed max-w-md md:max-w-[380px] md:shrink-0">
            {t('section_desc')}
          </p>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-px bg-slate-200 border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">

          {/* Feature 1 — Large card (spans 3 cols = 50% width) */}
          <div className="md:col-span-3 bg-white p-10 md:p-12 flex flex-col justify-between group hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300">
                {(() => {
                  const Icon = ICON_MAP[FEATURES_CONFIG[0].icon];
                  return <Icon size={22} className="text-blue-600" strokeWidth={1.75} />;
                })()}
              </div>
              <h3 className="text-[28px] font-bold tracking-tight text-navy mb-4">
                {items[0].title}
              </h3>
              <p className="text-[16px] text-slate-500 leading-relaxed max-w-lg">
                {items[0].description}
              </p>
            </div>
            {/* Mini quality indicators */}
            <div className="mt-8 flex flex-wrap gap-3">
              {['4K Ultra HD', '<100ms Latency', 'Adaptive Bitrate', 'Noise Cancel'].map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[12px] font-semibold text-blue-700">
                  <Zap size={11} className="text-blue-500" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Mockup Card — Large card (spans 3 cols = 50% width, seamless/paddingless dark background) */}
          <div className="md:col-span-3 bg-slate-900 overflow-hidden flex flex-col justify-between relative group">
            <MeetingMockup />
          </div>

          {/* Feature 2 (spans 2 cols = 33.3% width) */}
          <div className="md:col-span-2 bg-white p-10 flex flex-col group hover:bg-slate-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              {(() => {
                const Icon = ICON_MAP[FEATURES_CONFIG[1].icon];
                return <Icon size={20} className="text-violet-600" strokeWidth={1.75} />;
              })()}
            </div>
            <h3 className="text-[20px] font-bold tracking-tight text-navy mb-3">
              {items[1].title}
            </h3>
            <p className="text-[15px] text-slate-500 leading-relaxed">
              {items[1].description}
            </p>
          </div>

          {/* Feature 3 (spans 2 cols = 33.3% width) */}
          <div className="md:col-span-2 bg-white p-10 flex flex-col group hover:bg-slate-50/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              {(() => {
                const Icon = ICON_MAP[FEATURES_CONFIG[2].icon];
                return <Icon size={20} className="text-emerald-600" strokeWidth={1.75} />;
              })()}
            </div>
            <h3 className="text-[20px] font-bold tracking-tight text-navy mb-3">
              {items[2].title}
            </h3>
            <p className="text-[15px] text-slate-500 leading-relaxed">
              {items[2].description}
            </p>
          </div>

          {/* Uptime Stat Card (spans 2 cols = 33.3% width, light theme) */}
          <div className="md:col-span-2 bg-white p-10 flex flex-col justify-between group hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe2 size={20} className="text-blue-600" strokeWidth={1.75} />
              </div>
              <div className="text-[clamp(36px,4vw,48px)] font-bold tracking-tighter text-navy mb-2 leading-none">
                99.99<span className="text-[20px] text-blue-600">%</span>
              </div>
              <p className="text-[15px] font-semibold text-slate-500 leading-snug">
                {t('uptime_label')}
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
