import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/hero/HeroSection";
import AboutSection from "@/components/about/AboutSection";
import PredictorSection from "@/components/predictor/PredictorSection";
import DashboardSection from "@/components/dashboard/DashboardSection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <PredictorSection />
        <DashboardSection />
      </main>
      <Footer />
    </>
  );
}
