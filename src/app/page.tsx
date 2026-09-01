import HeroSection from "@/components/hero/HeroSection";
import AboutSection from "@/components/about/AboutSection";
import DashboardSection from "@/components/dashboard/DashboardSection";

// Header and Footer are rendered by the root layout so the nav appears on every
// route, not just here.
//
// PredictorSection (the old Deal Analyzer) is deliberately gone: it scored deals
// in the browser with the retired synthetic model. Card analysis now lives at
// /analysis, served by the v3 model behind the API.
export default function Home() {
  return (
    <main>
      <HeroSection />
      <AboutSection />
      <DashboardSection />
    </main>
  );
}
