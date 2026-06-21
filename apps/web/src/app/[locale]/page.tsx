// ─── Landing Page ─────────────────────────────────────────────────────────────────────
// Trang chủ Tobo — Landing page với 9 sections.
// Sections: Hero → Features → HowItWorks → Testimonials
//          → CrossPlatform → Pricing → CTA → Footer

import Header               from '@/components/landing/Header';
import HeroSection          from '@/components/landing/HeroSection';

import FeaturesSection      from '@/components/landing/FeaturesSection';
import HowItWorksSection    from '@/components/landing/HowItWorksSection';
import TestimonialsSection  from '@/components/landing/TestimonialsSection';
import CrossPlatformSection from '@/components/landing/CrossPlatformSection';
import PricingSection       from '@/components/landing/PricingSection';
import CTASection           from '@/components/landing/CTASection';
import Footer               from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* ── Sticky Navigation ── */}
      <Header />

      {/* ── Above the Fold ── */}
      <HeroSection />


      {/* ── Product Features (Bento Grid) ── */}
      <FeaturesSection />

      {/* ── How It Works (3 Steps) ── */}
      <HowItWorksSection />

      {/* ── Customer Testimonials ── */}
      <TestimonialsSection />

      {/* ── Multi-Platform Support ── */}
      <CrossPlatformSection />

      {/* ── Pricing Tiers ── */}
      <PricingSection />

      {/* ── Final Call-to-Action ── */}
      <CTASection />

      {/* ── Site Footer ── */}
      <Footer />
    </main>
  );
}
