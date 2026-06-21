// ─── Navigation ───────────────────────────────────────────────────────────────
export const NAV_LINKS = [
  { labelKey: 'header.features', href: '#features' },
  { labelKey: 'header.solutions', href: '#solutions' },
  { labelKey: 'header.platform', href: '#platform' },
  { labelKey: 'header.pricing', href: '#pricing' },
] as const;

// ─── Mock Meeting Participants (Hero Mockup) ───────────────────────────────────
export const MOCK_PARTICIPANTS = [
  { id: 1, name: 'Ngọc Huệ', initials: 'NH', gradient: 'from-blue-500 to-cyan-400', isMuted: false, isSpeaking: true },
  { id: 2, name: 'Hoa Lan', initials: 'HL', gradient: 'from-violet-500 to-purple-600', isMuted: true, isSpeaking: false },
  { id: 3, name: 'Trần Phúc Hưng', initials: 'PH', gradient: 'from-emerald-500 to-teal-500', isMuted: false, isSpeaking: false },
  { id: 4, name: 'Thu Hằng', initials: 'TH', gradient: 'from-orange-500 to-rose-500', isMuted: true, isSpeaking: false },
] as const;

// ─── Features ─────────────────────────────────────────────────────────────────
export const FEATURES_CONFIG = [
  { icon: 'Video', gradient: 'from-blue-500 to-cyan-500', messageKey: 0 },
  { icon: 'GraduationCap', gradient: 'from-violet-500 to-purple-600', messageKey: 1 },
  { icon: 'ShieldCheck', gradient: 'from-emerald-500 to-teal-600', messageKey: 2 },
] as const;

// ─── Stats ────────────────────────────────────────────────────────────────────
export const STATS_CONFIG = [
  { icon: 'Users', valueKey: 'users_value', labelKey: 'users_label', accent: 'text-brand-500' },
  { icon: 'Video', valueKey: 'meetings_value', labelKey: 'meetings_label', accent: 'text-violet-500' },
  { icon: 'Globe2', valueKey: 'countries_value', labelKey: 'countries_label', accent: 'text-emerald-500' },
  { icon: 'Activity', valueKey: 'uptime_value', labelKey: 'uptime_label', accent: 'text-orange-500' },
] as const;

// ─── How It Works ─────────────────────────────────────────────────────────────
export const HOW_IT_WORKS_CONFIG = [
  { icon: 'PlusCircle', gradient: 'from-blue-500 to-cyan-500', bgLight: 'bg-blue-50', ring: 'ring-blue-200' },
  { icon: 'Share2', gradient: 'from-violet-500 to-purple-600', bgLight: 'bg-violet-50', ring: 'ring-violet-200' },
  { icon: 'Zap', gradient: 'from-emerald-500 to-teal-500', bgLight: 'bg-emerald-50', ring: 'ring-emerald-200' },
] as const;

// ─── Testimonials ─────────────────────────────────────────────────────────────
export const TESTIMONIALS_CONFIG = [
  { initials: 'NM', gradient: 'from-blue-500 to-cyan-500', rating: 5, messageKey: 0 },
  { initials: 'TH', gradient: 'from-violet-500 to-purple-600', rating: 5, messageKey: 1 },
  { initials: 'LH', gradient: 'from-emerald-500 to-teal-600', rating: 5, messageKey: 2 },
  { initials: 'PH', gradient: 'from-orange-500 to-rose-500', rating: 5, messageKey: 3 },
  { initials: 'DN', gradient: 'from-slate-600 to-slate-800', rating: 5, messageKey: 4 },
  { initials: 'SK', gradient: 'from-pink-500 to-rose-500', rating: 5, messageKey: 5 },
] as const;

// ─── Platforms ────────────────────────────────────────────────────────────────
export const PLATFORMS_CONFIG = [
  { icon: 'Globe', gradient: 'from-blue-500 to-cyan-500', messageKey: 0 },
  { icon: 'Monitor', gradient: 'from-violet-500 to-indigo-600', messageKey: 1 },
  { icon: 'Smartphone', gradient: 'from-emerald-500 to-teal-600', messageKey: 2 },
] as const;

// ─── Pricing ──────────────────────────────────────────────────────────────────
export const PRICING_CONFIG = [
  {
    tier: 'free',
    highlighted: false,
    monthlyPrice: 0,
    yearlyPrice: 0,
    isFree: true,
    featureCount: 5,
  },
  {
    tier: 'pro',
    highlighted: true,
    monthlyPrice: 9.99,
    yearlyPrice: 7.99,
    isFree: false,
    featureCount: 8,
  },
  {
    tier: 'enterprise',
    highlighted: false,
    monthlyPrice: null,
    yearlyPrice: null,
    isFree: false,
    featureCount: 8,
  },
] as const;

// ─── Footer Links ─────────────────────────────────────────────────────────────
export const FOOTER_LINKS = {
  product: ['#features', '#pricing', '#security', '#integrations'],
  company: ['/about', '/blog', '/careers', '/contact'],
  legal: ['/terms', '/privacy', '/cookies'],
} as const;
